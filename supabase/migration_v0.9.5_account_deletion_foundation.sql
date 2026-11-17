-- ARAUKA v0.9.5 - base DESHABILITADA para eliminación con historial anonimizado.
-- No elimina cuentas al instalarse. Requiere v0.9.4 y un orquestador servidor posterior.
begin;

do $$ begin
  if to_regclass('public.profiles') is null or to_regclass('public.jobs') is null
     or to_regclass('public.interests') is null or to_regclass('public.portfolio') is null
     or to_regclass('public.reviews') is null or to_regclass('public.verifications') is null
     or to_regclass('public.commercial_profiles') is null or to_regclass('public.administrative_reviewers') is null
     or to_regclass('public.account_registration_intents') is null then
    raise exception 'Falta el esquema ARAUKA v0.9.4';
  end if;
  if to_regprocedure('public.create_profile_for_user()') is null
     or to_regprocedure('public.get_shared_contact(uuid)') is null
     or to_regprocedure('public.arauka_alert_on_interest()') is null
     or to_regprocedure('public.arauka_alert_on_job()') is null
     or to_regprocedure('public.arauka_alert_on_interest_consent()') is null
     or to_regprocedure('public.set_primary_experience(public.arauka_experience)') is null
     or to_regprocedure('public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)') is null
     or to_regprocedure('public.upsert_my_company_profile(text,text,text,text,text,text,text,text,text,text,text,text[],text[])') is null
     or to_regprocedure('public.is_administrative_reviewer()') is null
     or to_regprocedure('public.review_company_verification(uuid,public.arauka_verification_status)') is null
     or to_regprocedure('public.complete_initial_company_activation()') is null then
    raise exception 'Faltan RPC o funciones requeridas de v0.9-v0.9.4';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='auth_user_id')
     or to_regclass('public.account_deletion_requests') is not null
     or to_regclass('public.review_retention_queue') is not null then
    raise exception 'v0.9.5 ya parece instalada o existen objetos parciales; no reejecutar';
  end if;
  if exists(select 1 from public.profiles p left join auth.users u on u.id=p.id where u.id is null) then
    raise exception 'Existen profiles sin auth.users antes de v0.9.5';
  end if;
  if not exists(select 1 from pg_constraint c where c.conrelid='public.profiles'::regclass
    and c.contype='f' and c.confrelid='auth.users'::regclass and c.confdeltype='c'
    and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='id')]::smallint[]) then
    raise exception 'La FK profiles.id -> auth.users CASCADE no coincide con el esquema esperado';
  end if;
  if exists(
    with expected(table_name,column_name,foreign_table,delete_code) as (values
      ('jobs','client_id','profiles','c'),('jobs','selected_pro_id','profiles','a'),
      ('interests','job_id','jobs','c'),('interests','pro_id','profiles','c'),
      ('portfolio','pro_id','profiles','c'),('reviews','job_id','jobs','c'),
      ('reviews','client_id','profiles','c'),('reviews','pro_id','profiles','c'),
      ('verifications','pro_id','profiles','c')
    )
    select 1 from expected e where not exists(
      select 1 from pg_constraint c
      where c.conrelid=format('public.%I',e.table_name)::regclass and c.contype='f'
        and c.confrelid=format('public.%I',e.foreign_table)::regclass and c.confdeltype=e.delete_code::"char"
        and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname=e.column_name)]::smallint[]
    )
  ) then raise exception 'La topologia de FK de trabajos, postulaciones o evaluaciones difiere de la esperada'; end if;
  if not exists(select 1 from pg_constraint c where c.conrelid='public.commercial_profiles'::regclass
       and c.contype='f' and c.confrelid='auth.users'::regclass and c.confdeltype='a'
       and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='verification_reviewed_by')]::smallint[])
     or not exists(select 1 from pg_constraint c where c.conrelid='public.administrative_reviewers'::regclass
       and c.contype='f' and c.confrelid='auth.users'::regclass and c.confdeltype='a'
       and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='granted_by')]::smallint[]) then
    raise exception 'Las FK de trazabilidad administrativa difieren de v0.9.3';
  end if;
end $$;

-- profiles pasa a ser también el actor histórico estable. Para cuentas activas,
-- id y auth_user_id son iguales. Al borrar Auth, auth_user_id queda NULL y el actor
-- anonimizado conserva las relaciones legítimas de terceros.
alter table public.profiles add column auth_user_id uuid;
alter table public.profiles add column deleted_at timestamptz;
update public.profiles set auth_user_id=id where auth_user_id is null
  and exists(select 1 from auth.users u where u.id=profiles.id);
alter table public.profiles add constraint profiles_active_or_historical_check check(
  (auth_user_id=id) or (auth_user_id is null and deleted_at is not null)
);

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.profiles'::regclass and contype='f' and confrelid='auth.users'::regclass
  loop execute format('alter table public.profiles drop constraint %I',c.conname); end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass
    and contype='f' and confrelid='auth.users'::regclass and confdeltype='n') then
    alter table public.profiles add constraint profiles_auth_user_id_fkey
      foreign key(auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;
create unique index profiles_auth_user_id_unique on public.profiles(auth_user_id) where auth_user_id is not null;

-- El actor histórico no es un perfil público. Las relaciones internas conservan su
-- UUID, pero descubrimiento y acceso anónimo dejan de devolverlo inmediatamente.
drop policy if exists "profiles public select" on public.profiles;
create policy "profiles public select" on public.profiles for select to anon,authenticated
using(deleted_at is null);

create or replace function public.current_actor_id() returns uuid
language sql stable security definer set search_path=pg_catalog,public as $$
  select p.id from public.profiles p
  where p.auth_user_id=auth.uid() and p.deleted_at is null;
$$;
revoke all on function public.current_actor_id() from public,anon,service_role;
grant execute on function public.current_actor_id() to authenticated;

-- Las autorizaciones sobre historia usan el vínculo Auth vigente, no la mera
-- existencia de un profiles.id que podría pertenecer a una cuenta eliminada.
drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert" on public.profiles for insert to authenticated
with check(id=auth.uid() and auth_user_id=auth.uid() and deleted_at is null);
drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update" on public.profiles for update to authenticated
using(id=public.current_actor_id()) with check(id=public.current_actor_id() and deleted_at is null);

drop policy if exists "jobs client update" on public.jobs;
create policy "jobs client update" on public.jobs for update to authenticated
using(client_id=public.current_actor_id()) with check(client_id=public.current_actor_id());
drop policy if exists "jobs hiring capability insert" on public.jobs;
create policy "jobs hiring capability insert" on public.jobs for insert to authenticated with check(
  client_id=public.current_actor_id() and status='open' and selected_pro_id is null and client_contact_consent=false and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('cliente','empresa')));

drop policy if exists "interests participant select" on public.interests;
create policy "interests participant select" on public.interests for select to authenticated using(
  pro_id=public.current_actor_id() or exists(select 1 from public.jobs j where j.id=job_id and j.client_id=public.current_actor_id()));
drop policy if exists "interests offering capability insert" on public.interests;
create policy "interests offering capability insert" on public.interests for insert to authenticated with check(
  pro_id=public.current_actor_id() and pro_contact_consent=false and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('maestro','empresa')) and
  exists(select 1 from public.jobs j where j.id=job_id and j.status='open' and j.client_id<>public.current_actor_id()));
drop policy if exists "interests professional update" on public.interests;
create policy "interests professional update" on public.interests for update to authenticated
using(pro_id=public.current_actor_id()) with check(pro_id=public.current_actor_id());

drop policy if exists "portfolio offering capability insert" on public.portfolio;
create policy "portfolio offering capability insert" on public.portfolio for insert to authenticated with check(
  pro_id=public.current_actor_id() and image_path like auth.uid()::text||'/%' and
  exists(select 1 from public.account_experiences e where e.user_id=auth.uid() and e.experience in ('maestro','empresa')));
drop policy if exists "portfolio professional delete" on public.portfolio;
create policy "portfolio professional delete" on public.portfolio for delete to authenticated using(pro_id=public.current_actor_id());

drop policy if exists "reviews client after completed work" on public.reviews;
create policy "reviews client after completed work" on public.reviews for insert to authenticated with check(
  client_id=public.current_actor_id() and exists(select 1 from public.jobs j
  where j.id=job_id and j.client_id=public.current_actor_id() and j.selected_pro_id=pro_id and j.status='completed'));

create or replace function public.link_profile_auth_user() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.auth_user_id is null then new.auth_user_id:=new.id; end if;
  if new.auth_user_id<>new.id then raise exception 'Vinculo Auth de perfil invalido'; end if;
  return new;
end $$;
revoke all on function public.link_profile_auth_user() from public,anon,authenticated,service_role;
drop trigger if exists link_profile_auth_user_before_insert on public.profiles;
create trigger link_profile_auth_user_before_insert before insert on public.profiles
for each row execute function public.link_profile_auth_user();

-- Endurecimiento compatible de funciones SECURITY DEFINER instaladas previamente.
-- ALTER FUNCTION conserva cuerpo, propietario y grants; sólo elimina pg_temp del path.
alter function public.create_profile_for_user() set search_path=pg_catalog,public;
alter function public.get_shared_contact(uuid) set search_path=pg_catalog,public;
alter function public.arauka_alert_on_interest() set search_path=pg_catalog,public;
alter function public.arauka_alert_on_job() set search_path=pg_catalog,public;
alter function public.arauka_alert_on_interest_consent() set search_path=pg_catalog,public;
alter function public.set_primary_experience(public.arauka_experience) set search_path=pg_catalog,public;
alter function public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text) set search_path=pg_catalog,public;
alter function public.is_administrative_reviewer() set search_path=pg_catalog,public;
alter function public.upsert_my_company_profile(text,text,text,text,text,text,text,text,text,text,text,text[],text[]) set search_path=pg_catalog,public;
alter function public.review_company_verification(uuid,public.arauka_verification_status) set search_path=pg_catalog,public;
alter function public.complete_initial_company_activation() set search_path=pg_catalog,public;
revoke all on function public.arauka_alert_on_interest(),public.arauka_alert_on_job(),public.arauka_alert_on_interest_consent() from public,anon,authenticated,service_role;
do $$ begin
  if to_regprocedure('public.claim_notification_email(uuid)') is not null then
    alter function public.claim_notification_email(uuid) set search_path=pg_catalog,public;
  end if;
  if to_regprocedure('public.dispatch_notification_email_batch(integer)') is not null then
    alter function public.dispatch_notification_email_batch(integer) set search_path=pg_catalog,public,extensions,net,vault;
  end if;
end $$;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  actor_profile_id uuid not null references public.profiles(id),
  status text not null default 'requested' check(status in
    ('requested','blocked_active_agreement','storage_pending','processing','database_anonymized','auth_pending','completed','failed')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error_code text check(last_error_code is null or char_length(last_error_code)<=80),
  check(user_id is null or user_id=actor_profile_id)
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.account_deletion_requests to service_role;

-- El texto original se retira de exposición pública, pero no se destruye antes de
-- evaluación. Esta cola es privada y exige definir plazo jurídico antes de operar.
create table public.review_retention_queue (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  deletion_request_id uuid not null references public.account_deletion_requests(id),
  original_comment text not null,
  status text not null default 'pending_review' check(status in ('pending_review','published_redacted','retired')),
  redacted_comment text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  legal_retention_until timestamptz,
  created_at timestamptz not null default now(),
  check(status='pending_review' or reviewed_at is not null)
);
alter table public.review_retention_queue enable row level security;
revoke all on public.review_retention_queue from public,anon,authenticated,service_role;
grant select,insert,update on public.review_retention_queue to service_role;

-- Las decisiones y fechas se conservan; la identidad Auth del revisor se retira.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.commercial_profiles'::regclass
    and contype='f' and confrelid='auth.users'::regclass and conkey=array[(select attnum from pg_attribute where attrelid='public.commercial_profiles'::regclass and attname='verification_reviewed_by')]::smallint[]
  loop execute format('alter table public.commercial_profiles drop constraint %I',c.conname); end loop;
  alter table public.commercial_profiles add constraint commercial_profiles_verification_reviewed_by_fkey
    foreign key(verification_reviewed_by) references auth.users(id) on delete set null;
  for c in select conname from pg_constraint where conrelid='public.administrative_reviewers'::regclass
    and contype='f' and confrelid='auth.users'::regclass and conkey=array[(select attnum from pg_attribute where attrelid='public.administrative_reviewers'::regclass and attname='granted_by')]::smallint[]
  loop execute format('alter table public.administrative_reviewers drop constraint %I',c.conname); end loop;
  alter table public.administrative_reviewers add constraint administrative_reviewers_granted_by_fkey
    foreign key(granted_by) references auth.users(id) on delete set null;
end $$;

-- Solo diagnóstico del titular. No inicia ni ejecuta eliminación.
create or replace function public.my_account_deletion_preflight() returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select case when auth.uid() is null then jsonb_build_object('authenticated',false) else jsonb_build_object(
    'authenticated',true,
    'matched_jobs',count(distinct j.id) filter(where j.status='matched'),
    'open_jobs',count(distinct j.id) filter(where j.client_id=p.id and j.status='open'),
    'completed_jobs',count(distinct j.id) filter(where j.status='completed'),
    'reviews',count(distinct r.id),
    'reviewer_references',(select count(*) from public.commercial_profiles c where c.verification_reviewed_by=auth.uid())
  ) end
  from public.profiles p
  left join public.jobs j on j.client_id=p.id or j.selected_pro_id=p.id
  left join public.reviews r on r.client_id=p.id or r.pro_id=p.id
  where p.auth_user_id=auth.uid();
$$;
revoke all on function public.my_account_deletion_preflight() from public,anon,service_role;
grant execute on function public.my_account_deletion_preflight() to authenticated;

-- Operación interna idempotente. No borra Auth ni Storage. Debe invocarse solamente
-- desde el futuro orquestador después de reautenticación y limpieza verificada.
create or replace function public.anonymize_account_for_deletion(p_user_id uuid,p_request_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Operacion de servidor requerida'; end if;
  if not exists(select 1 from public.account_deletion_requests where id=p_request_id and user_id=p_user_id
    and actor_profile_id=p_user_id and status in ('storage_pending','processing','failed')) then
    raise exception 'Solicitud de eliminacion no valida';
  end if;
  if exists(select 1 from public.jobs where status='matched' and (client_id=p_user_id or selected_pro_id=p_user_id)) then
    update public.account_deletion_requests set status='blocked_active_agreement',updated_at=now(),last_error_code='ACTIVE_MATCHED_JOB' where id=p_request_id;
    return;
  end if;
  update public.account_deletion_requests set status='processing',updated_at=now(),last_error_code=null where id=p_request_id;
  update public.jobs set status=case when status='open' then 'cancelled' else status end,
    title=case when client_id=p_user_id then 'Trabajo de cuenta eliminada' else title end,
    description=case when client_id=p_user_id then 'Contenido retirado por eliminación de cuenta.' else description end,
    client_contact_consent=false where client_id=p_user_id;
  update public.interests set note='Contenido retirado por eliminación de cuenta.',pro_contact_consent=false
    where pro_id=p_user_id or job_id in(select id from public.jobs where client_id=p_user_id);
  insert into public.review_retention_queue(review_id,deletion_request_id,original_comment)
    select id,p_request_id,comment from public.reviews
    where (client_id=p_user_id or pro_id=p_user_id) and nullif(btrim(comment),'') is not null
    on conflict(review_id) do nothing;
  update public.reviews set comment='Comentario temporalmente retirado para revisión de privacidad.'
    where client_id=p_user_id or pro_id=p_user_id;
  delete from public.portfolio where pro_id=p_user_id;
  delete from public.verifications where pro_id=p_user_id;
  update public.profiles set display_name='Cuenta eliminada',company_name=null,bio='',is_professional=false,
    categories='{}',service_localities='{}',deleted_at=coalesce(deleted_at,now()) where id=p_user_id;
  update public.account_deletion_requests set status='database_anonymized',updated_at=now() where id=p_request_id;
end $$;
revoke all on function public.anonymize_account_for_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.anonymize_account_for_deletion(uuid,uuid) to service_role;

notify pgrst,'reload schema';
commit;
