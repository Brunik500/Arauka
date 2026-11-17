-- ARAUKA v0.9 - identidad, perfiles y experiencias.
-- PRECONDICION: schema.sql aplicado. v0.5 y v0.7 son opcionales; v0.6 se detecta
-- por comportamiento, no por nombre de archivo. Ejecutar todo el archivo como una transaccion.
-- Aditiva: no elimina ni reescribe trabajos, intereses, perfiles, evaluaciones o avisos.

begin;

do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.jobs') is null
     or to_regclass('public.interests') is null or to_regclass('public.portfolio') is null
     or to_regclass('public.reviews') is null then
    raise exception 'Falta schema.sql base de ARAUKA; v0.9 no puede continuar';
  end if;
  if not exists(select 1 from pg_extension where extname='pgcrypto') then
    raise exception 'Falta extension pgcrypto requerida por ARAUKA';
  end if;
end $$;

-- Las policies permisivas se combinan con OR. Una policy INSERT desconocida podria
-- eludir v0.9; se aborta en vez de reemplazar una personalizacion silenciosamente.
do $$
declare v_policy text;
begin
  select format('%I.%I: %I',schemaname,tablename,policyname) into v_policy
  from pg_policies
  where schemaname='public' and cmd in ('INSERT','ALL') and (
    (tablename='jobs' and policyname not in ('jobs client insert','jobs hiring capability insert')) or
    (tablename='interests' and policyname not in ('interests professional insert','interests offering capability insert')) or
    (tablename='portfolio' and policyname not in ('portfolio professional insert','portfolio offering capability insert'))
  ) limit 1;
  if v_policy is not null then
    raise exception 'Policy INSERT no reconocida; revisar manualmente antes de v0.9: %',v_policy;
  end if;
end $$;

do $$ begin
  create type public.arauka_profile_kind as enum ('personal','professional','business','company');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.arauka_experience as enum ('cliente','maestro','empresa');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.arauka_verification_status as enum ('not_applicable','pending','verified','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.account_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_experience public.arauka_experience,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_experiences (
  user_id uuid not null references auth.users(id) on delete cascade,
  experience public.arauka_experience not null,
  profile_kind public.arauka_profile_kind not null,
  enabled_at timestamptz not null default now(),
  primary key(user_id,experience),
  check ((experience='cliente' and profile_kind in ('personal','company')) or
         (experience='maestro' and profile_kind in ('professional','business')) or
         (experience='empresa' and profile_kind='company'))
);

create table if not exists public.commercial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_kind public.arauka_profile_kind not null check(profile_kind in ('professional','business','company')),
  public_name text check(public_name is null or char_length(btrim(public_name)) between 1 and 120),
  legal_name text check(legal_name is null or char_length(btrim(legal_name)) between 1 and 180),
  tax_id text,
  legal_type text,
  economic_activity text,
  tax_address text,
  municipality text,
  region text,
  representative_name text,
  contact_email text,
  business_phone text,
  coverage text[] not null default '{}',
  services text[] not null default '{}',
  verification_status public.arauka_verification_status not null default 'not_applicable',
  verification_reviewed_at timestamptz,
  verification_reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((profile_kind='company' and verification_status in ('pending','verified','rejected')) or
         (profile_kind<>'company' and verification_status='not_applicable')),
  check (profile_kind<>'company' or (legal_name is not null and tax_id is not null))
);

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  document_type text not null check(char_length(document_type) between 2 and 80),
  created_at timestamptz not null default now(),
  check(storage_path like user_id::text || '/%')
);

-- Compatibilidad conservadora. Todo perfil historico puede contratar; is_professional
-- activa oferta como professional, nunca como company. NOBRO requiere asignacion manual.
insert into public.account_identities(user_id,primary_experience)
select id,case when is_professional then 'maestro'::public.arauka_experience else 'cliente'::public.arauka_experience end from public.profiles
on conflict(user_id) do nothing;
insert into public.account_experiences(user_id,experience,profile_kind)
select id,'cliente','personal' from public.profiles on conflict do nothing;
insert into public.account_experiences(user_id,experience,profile_kind)
select id,'maestro','professional' from public.profiles where is_professional on conflict do nothing;
insert into public.commercial_profiles(user_id,profile_kind,public_name)
select id,'professional',coalesce(nullif(btrim(company_name),''),display_name) from public.profiles where is_professional
on conflict(user_id) do nothing;

-- El registro crea SOLO la experiencia elegida. El valor proviene de metadata de signUp,
-- pero se valida contra una lista cerrada dentro de esta funcion confiable.
create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_choice text:=coalesce(new.raw_user_meta_data->>'initial_experience','cliente');
declare v_exp public.arauka_experience;
declare v_kind public.arauka_profile_kind;
begin
  if v_choice='professional' then v_exp:='maestro';v_kind:='professional';
  elsif v_choice='business' then v_exp:='maestro';v_kind:='business';
  elsif v_choice='company' then v_exp:='empresa';v_kind:='company';
  else v_exp:='cliente';v_kind:='personal'; end if;
  insert into public.profiles(id,display_name,is_professional) values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Usuario ARAUKA'),100),v_exp in ('maestro','empresa')) on conflict(id) do nothing;
  insert into public.account_identities(user_id,primary_experience) values(new.id,v_exp) on conflict(user_id) do nothing;
  insert into public.account_experiences(user_id,experience,profile_kind) values(new.id,v_exp,v_kind) on conflict do nothing;
  return new;
end $$;

create or replace function public.set_primary_experience(p_experience public.arauka_experience) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.account_experiences where user_id=auth.uid() and experience=p_experience) then raise exception 'Experiencia no activada'; end if;
  update public.account_identities set primary_experience=p_experience,updated_at=now() where user_id=auth.uid();
end $$;
revoke all on function public.set_primary_experience(public.arauka_experience) from public,anon;
grant execute on function public.set_primary_experience(public.arauka_experience) to authenticated;

create or replace function public.activate_experience(p_experience public.arauka_experience,p_profile_kind public.arauka_profile_kind,p_public_name text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Autenticacion requerida'; end if;
  if not ((p_experience='cliente' and p_profile_kind='personal') or (p_experience='maestro' and p_profile_kind in ('professional','business'))) then
    raise exception 'Combinacion de experiencia no permitida';
  end if;
  if exists(select 1 from public.account_experiences where user_id=auth.uid() and experience=p_experience and profile_kind<>p_profile_kind) then
    raise exception 'La experiencia ya existe con otro tipo de perfil; requiere un flujo de cambio dedicado';
  end if;
  insert into public.account_experiences(user_id,experience,profile_kind) values(auth.uid(),p_experience,p_profile_kind) on conflict(user_id,experience) do nothing;
  if p_experience='maestro' then
    insert into public.commercial_profiles(user_id,profile_kind,public_name) values(auth.uid(),p_profile_kind,left(nullif(btrim(p_public_name),''),120))
    on conflict(user_id) do update set profile_kind=excluded.profile_kind,public_name=coalesce(excluded.public_name,commercial_profiles.public_name),updated_at=now()
    where commercial_profiles.verification_status='not_applicable';
    update public.profiles set is_professional=true where id=auth.uid();
  end if;
end $$;
revoke all on function public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text) from public,anon;
grant execute on function public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text) to authenticated;

create or replace view public.my_account_experiences with (security_invoker=true) as
select e.experience,e.profile_kind,(i.primary_experience=e.experience) is_primary,
       coalesce(c.public_name,p.company_name,p.display_name) public_name,c.legal_name,
       coalesce(c.verification_status,'not_applicable') verification_status
from public.account_experiences e join public.account_identities i using(user_id)
join public.profiles p on p.id=e.user_id left join public.commercial_profiles c on c.user_id=e.user_id
where e.user_id=auth.uid();

alter table public.account_identities enable row level security;
alter table public.account_experiences enable row level security;
alter table public.commercial_profiles enable row level security;
alter table public.company_documents enable row level security;
drop policy if exists "identity owner read" on public.account_identities;
create policy "identity owner read" on public.account_identities for select to authenticated using(user_id=auth.uid());
drop policy if exists "experiences owner read" on public.account_experiences;
create policy "experiences owner read" on public.account_experiences for select to authenticated using(user_id=auth.uid());
drop policy if exists "commercial owner read" on public.commercial_profiles;
create policy "commercial owner read" on public.commercial_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists "commercial owner insert" on public.commercial_profiles;
drop policy if exists "documents owner read" on public.company_documents;
create policy "documents owner read" on public.company_documents for select to authenticated using(user_id=auth.uid());
drop policy if exists "documents owner insert" on public.company_documents;
create policy "documents owner insert" on public.company_documents for insert to authenticated with check(
  user_id=auth.uid() and exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience='empresa'));
-- Sin UPDATE/DELETE de estados sensibles para authenticated. Cambios comerciales deben
-- exponerse luego mediante RPC de campos permitidos; la verificacion es solo administrativa.

drop policy if exists "jobs client insert" on public.jobs;
drop policy if exists "jobs hiring capability insert" on public.jobs;
create policy "jobs hiring capability insert" on public.jobs for insert to authenticated with check(
  client_id=auth.uid() and status='open' and selected_pro_id is null and client_contact_consent=false and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('cliente','empresa')));
drop policy if exists "interests professional insert" on public.interests;
drop policy if exists "interests offering capability insert" on public.interests;
create policy "interests offering capability insert" on public.interests for insert to authenticated with check(
  pro_id=auth.uid() and pro_contact_consent=false and exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('maestro','empresa')) and
  exists(select 1 from public.jobs j where j.id=job_id and j.status='open' and j.client_id<>auth.uid()));

-- Cierra la via heredada: la politica owner de profiles permite filas propias, pero RLS
-- no restringe columnas. is_professional pasa a ser solo un campo de compatibilidad.
revoke update on table public.profiles from authenticated;
grant update(display_name,company_name,bio,categories,service_localities) on public.profiles to authenticated;

drop policy if exists "portfolio professional insert" on public.portfolio;
drop policy if exists "portfolio offering capability insert" on public.portfolio;
create policy "portfolio offering capability insert" on public.portfolio for insert to authenticated with check(
  pro_id=auth.uid() and image_path like auth.uid()::text || '/%' and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('maestro','empresa')));

drop policy if exists "portfolio images owner upload" on storage.objects;
drop policy if exists "portfolio images offering capability upload" on storage.objects;
create policy "portfolio images offering capability upload" on storage.objects for insert to authenticated with check(
  bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('maestro','empresa')));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-documents','company-documents',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
drop policy if exists "company documents owner upload" on storage.objects;
create policy "company documents owner upload" on storage.objects for insert to authenticated with check(
  bucket_id='company-documents' and (storage.foldername(name))[1]=auth.uid()::text and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience='empresa'));
drop policy if exists "company documents owner read" on storage.objects;
create policy "company documents owner read" on storage.objects for select to authenticated using(bucket_id='company-documents' and (storage.foldername(name))[1]=auth.uid()::text);

-- Privilegios SQL y RLS son capas distintas. service_role omite RLS, pero necesita
-- GRANT explicito para las operaciones PostgREST administrativas.
revoke all on table public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents from public,anon,authenticated,service_role;
revoke usage on type public.arauka_profile_kind,public.arauka_experience,public.arauka_verification_status from public,anon;
grant usage on type public.arauka_profile_kind,public.arauka_experience,public.arauka_verification_status to authenticated,service_role;
grant select on public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents to authenticated;
grant insert on public.company_documents to authenticated;
grant select on public.my_account_experiences to authenticated;

grant usage on schema public to service_role;
grant select on public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents to service_role;
grant insert(user_id,profile_kind,public_name,legal_name,tax_id,legal_type,economic_activity,tax_address,municipality,region,representative_name,contact_email,business_phone,coverage,services,verification_status)
  on public.commercial_profiles to service_role;
grant update(verification_status,verification_reviewed_at,verification_reviewed_by)
  on public.commercial_profiles to service_role;

commit;

-- ROLLBACK TECNICO (solo si la app ya no depende de v0.9): eliminar policies nuevas,
-- restaurar las policies v0.8 desde schema.sql, luego drop view/tables/types en orden inverso.
-- No se automatiza para evitar una perdida accidental de datos creados despues del despliegue.
