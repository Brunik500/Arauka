-- ARAUKA v0.9.3 - registro empresarial y verificacion administrativa.
-- PRECONDICION: v0.9, v0.9.1 y v0.9.2 instaladas.
-- No elimina ni reescribe trabajos, postulaciones, perfiles, portafolios o avisos.

begin;

do $$
begin
  if to_regclass('public.commercial_profiles') is null
     or to_regclass('public.company_documents') is null
     or to_regclass('public.account_experiences') is null then
    raise exception 'Falta el esquema de identidad v0.9';
  end if;
end $$;

-- La pertenencia administrativa solo puede provisionarse desde un contexto backend
-- autorizado. No se deriva de metadata, perfiles ni campos editables del navegador.
create table if not exists public.administrative_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  note text check(note is null or char_length(note)<=300)
);
alter table public.administrative_reviewers enable row level security;
revoke all on table public.administrative_reviewers from public,anon,authenticated,service_role;
grant select,insert,delete on public.administrative_reviewers to service_role;

create or replace function public.is_administrative_reviewer() returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1 from public.administrative_reviewers where user_id=auth.uid()
  );
$$;
revoke all on function public.is_administrative_reviewer() from public,anon;
grant execute on function public.is_administrative_reviewer() to authenticated;

create or replace function public.upsert_my_company_profile(
  p_legal_name text,
  p_tax_id text,
  p_legal_type text,
  p_public_name text,
  p_economic_activity text,
  p_tax_address text,
  p_municipality text,
  p_region text,
  p_representative_name text,
  p_contact_email text,
  p_business_phone text,
  p_services text[],
  p_coverage text[]
) returns public.commercial_profiles
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_clean_rut text;
  v_body text;
  v_digit text;
  v_sum integer:=0;
  v_factor integer:=2;
  v_expected text;
  v_row public.commercial_profiles;
  i integer;
begin
  if v_user is null then raise exception 'Autenticacion requerida'; end if;
  if not exists(select 1 from public.account_experiences where user_id=v_user and experience='empresa' and profile_kind='company') then
    raise exception 'Experiencia Empresa no activada';
  end if;

  v_clean_rut:=regexp_replace(upper(coalesce(p_tax_id,'')),'[^0-9K]','','g');
  if v_clean_rut !~ '^[0-9]{7,8}[0-9K]$' then raise exception 'RUT invalido'; end if;
  v_body:=left(v_clean_rut,-1);v_digit:=right(v_clean_rut,1);
  for i in reverse length(v_body)..1 loop
    v_sum:=v_sum+(substr(v_body,i,1)::integer*v_factor);
    v_factor:=case when v_factor=7 then 2 else v_factor+1 end;
  end loop;
  v_expected:=case 11-(v_sum%11) when 11 then '0' when 10 then 'K' else (11-(v_sum%11))::text end;
  if v_digit<>v_expected then raise exception 'RUT invalido'; end if;
  v_clean_rut:=v_body||'-'||v_digit;

  if char_length(btrim(coalesce(p_legal_name,''))) not between 2 and 180 then raise exception 'Razon social invalida'; end if;
  if char_length(btrim(coalesce(p_legal_type,''))) not between 2 and 100 then raise exception 'Tipo juridico invalido'; end if;
  if char_length(btrim(coalesce(p_economic_activity,''))) not between 2 and 180 then raise exception 'Actividad economica invalida'; end if;
  if char_length(btrim(coalesce(p_tax_address,''))) not between 5 and 240 then raise exception 'Direccion tributaria invalida'; end if;
  if char_length(btrim(coalesce(p_municipality,''))) not between 2 and 100 then raise exception 'Comuna invalida'; end if;
  if char_length(btrim(coalesce(p_region,''))) not between 2 and 100 then raise exception 'Region invalida'; end if;
  if char_length(btrim(coalesce(p_representative_name,''))) not between 2 and 160 then raise exception 'Representante invalido'; end if;
  if coalesce(p_contact_email,'') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(p_contact_email)>254 then raise exception 'Correo invalido'; end if;
  if coalesce(p_business_phone,'') !~ '^\+?[0-9 ()-]{8,20}$' then raise exception 'Telefono invalido'; end if;
  if coalesce(cardinality(p_services),0)<1 or cardinality(p_services)>30 then raise exception 'Servicios invalidos'; end if;
  if coalesce(cardinality(p_coverage),0)<1 or cardinality(p_coverage)>30 then raise exception 'Cobertura invalida'; end if;
  if exists(select 1 from unnest(p_services||p_coverage) x where char_length(btrim(x)) not between 2 and 100) then raise exception 'Servicio o cobertura invalido'; end if;
  if nullif(btrim(coalesce(p_public_name,'')),'') is not null and char_length(btrim(p_public_name))>120 then raise exception 'Nombre comercial invalido'; end if;

  insert into public.commercial_profiles(
    user_id,profile_kind,public_name,legal_name,tax_id,legal_type,economic_activity,
    tax_address,municipality,region,representative_name,contact_email,business_phone,
    services,coverage,verification_status,verification_reviewed_at,verification_reviewed_by,updated_at
  ) values (
    v_user,'company',nullif(btrim(p_public_name),''),btrim(p_legal_name),v_clean_rut,btrim(p_legal_type),
    btrim(p_economic_activity),btrim(p_tax_address),btrim(p_municipality),btrim(p_region),
    btrim(p_representative_name),lower(btrim(p_contact_email)),btrim(p_business_phone),
    array(select distinct btrim(x) from unnest(p_services) x),
    array(select distinct btrim(x) from unnest(p_coverage) x),
    'pending',null,null,now()
  )
  on conflict(user_id) do update set
    profile_kind='company',public_name=excluded.public_name,legal_name=excluded.legal_name,
    tax_id=excluded.tax_id,legal_type=excluded.legal_type,economic_activity=excluded.economic_activity,
    tax_address=excluded.tax_address,municipality=excluded.municipality,region=excluded.region,
    representative_name=excluded.representative_name,contact_email=excluded.contact_email,
    business_phone=excluded.business_phone,services=excluded.services,coverage=excluded.coverage,
    verification_status='pending',verification_reviewed_at=null,verification_reviewed_by=null,updated_at=now()
  where commercial_profiles.user_id=v_user and commercial_profiles.profile_kind='company'
  returning * into v_row;
  if v_row.user_id is null then raise exception 'El perfil comercial existente no es Empresa'; end if;
  -- Replica solamente los campos declarados publicos al perfil de descubrimiento.
  update public.profiles set
    company_name=nullif(btrim(p_public_name),''),categories=v_row.services,
    service_localities=v_row.coverage,is_professional=true
  where id=v_user;
  return v_row;
end $$;
-- Resolver el OID desde la funcion recien creada evita mantener una segunda copia
-- manual de su firma. La migracion aborta si nombre, cantidad o tipos no coinciden.
do $$
declare v_function regprocedure;
begin
  select p.oid::regprocedure into v_function
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='upsert_my_company_profile'
    and p.pronargs=13
    and oidvectortypes(p.proargtypes)='text, text, text, text, text, text, text, text, text, text, text, text[], text[]';
  if v_function is null then raise exception 'Firma inesperada de public.upsert_my_company_profile'; end if;
  execute format('revoke all on function %s from public,anon',v_function);
  execute format('grant execute on function %s to authenticated',v_function);
end $$;

create or replace function public.review_company_verification(
  p_company_user_id uuid,
  p_decision public.arauka_verification_status
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not public.is_administrative_reviewer() then
    raise exception 'Revision administrativa no autorizada';
  end if;
  if p_decision not in ('verified','rejected') then raise exception 'Decision administrativa invalida'; end if;
  update public.commercial_profiles
  set verification_status=p_decision,verification_reviewed_at=now(),verification_reviewed_by=auth.uid(),updated_at=now()
  where user_id=p_company_user_id and profile_kind='company';
  if not found then raise exception 'Empresa no encontrada'; end if;
end $$;
revoke all on function public.review_company_verification(uuid,public.arauka_verification_status) from public,anon;
grant execute on function public.review_company_verification(uuid,public.arauka_verification_status) to authenticated;

-- Proyeccion publica minima: nunca expone RUT, direccion, contacto o documentos.
create or replace view public.verified_companies with (security_barrier=true) as
select user_id,public_name,verification_reviewed_at
from public.commercial_profiles
where profile_kind='company' and verification_status='verified';
revoke all on public.verified_companies from public,anon,authenticated,service_role;
grant select on public.verified_companies to anon,authenticated;

-- Revisores autorizados pueden leer metadata y objetos privados. No se crean URLs
-- publicas ni una interfaz administrativa en el cliente publico.
drop policy if exists "documents administrative read" on public.company_documents;
create policy "documents administrative read" on public.company_documents for select to authenticated
using(public.is_administrative_reviewer());

drop policy if exists "company documents administrative read" on storage.objects;
create policy "company documents administrative read" on storage.objects for select to authenticated
using(bucket_id='company-documents' and public.is_administrative_reviewer());

notify pgrst,'reload schema';
commit;
