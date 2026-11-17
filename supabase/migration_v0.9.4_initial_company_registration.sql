-- ARAUKA v0.9.4 - alta inicial y recuperacion segura de Empresa.
-- PRECONDICION: v0.9, v0.9.1, v0.9.2 y v0.9.3 instaladas.
-- No verifica empresas, no modifica perfiles comerciales y no elimina datos.

begin;

do $$
begin
  if to_regclass('public.account_identities') is null
     or to_regclass('public.account_experiences') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Falta el esquema de identidad v0.9';
  end if;
  if not exists(
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid=t.tgfoid
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where t.tgrelid='auth.users'::regclass
      and t.tgname='trigger_create_arauka_profile'
      and not t.tgisinternal
      and n.nspname='public'
      and p.proname='create_profile_for_user'
      and p.pronargs=0
      and p.prorettype='pg_catalog.trigger'::pg_catalog.regtype
  ) then
    raise exception 'El trigger de alta no existe o no apunta a public.create_profile_for_user';
  end if;
end $$;

-- Intencion inmutable capturada por el trigger de alta. No se consulta ni modifica
-- desde el navegador y evita usar metadata editable como autorizacion posterior.
create table if not exists public.account_registration_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initial_experience text not null check(initial_experience in ('client','professional','business','company')),
  created_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS no valida la forma de un objeto preexistente. Abortamos
-- antes de instalar funciones privilegiadas si el nombre ya estaba ocupado por una
-- estructura incompatible o si se perdieron las restricciones de integridad.
do $$
begin
  if not exists(
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid='public.account_registration_intents'::pg_catalog.regclass
      and a.attname='user_id' and a.atttypid='pg_catalog.uuid'::pg_catalog.regtype
      and a.attnotnull and not a.attisdropped
  ) or not exists(
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid='public.account_registration_intents'::pg_catalog.regclass
      and a.attname='initial_experience' and a.atttypid='pg_catalog.text'::pg_catalog.regtype
      and a.attnotnull and not a.attisdropped
  ) or not exists(
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid='public.account_registration_intents'::pg_catalog.regclass
      and a.attname='created_at' and a.atttypid='pg_catalog.timestamptz'::pg_catalog.regtype
      and a.attnotnull and not a.attisdropped
  ) or not exists(
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.account_registration_intents'::pg_catalog.regclass
      and c.contype='p' and c.conkey=array[
        (select a.attnum from pg_catalog.pg_attribute a
         where a.attrelid=c.conrelid and a.attname='user_id' and not a.attisdropped)
      ]::smallint[]
  ) or not exists(
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid='public.account_registration_intents'::pg_catalog.regclass
      and c.contype='f' and c.confrelid='auth.users'::pg_catalog.regclass
      and c.confdeltype='c'
      and c.conkey=array[
        (select a.attnum from pg_catalog.pg_attribute a
         where a.attrelid=c.conrelid and a.attname='user_id' and not a.attisdropped)
      ]::smallint[]
      and c.confkey=array[
        (select a.attnum from pg_catalog.pg_attribute a
         where a.attrelid=c.confrelid and a.attname='id' and not a.attisdropped)
      ]::smallint[]
  ) or not exists(
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid='public.account_registration_intents'::pg_catalog.regclass
      and c.contype='c'
      and pg_catalog.pg_get_expr(c.conbin,c.conrelid) like '%initial_experience%'
      and pg_catalog.pg_get_expr(c.conbin,c.conrelid) like '%client%'
      and pg_catalog.pg_get_expr(c.conbin,c.conrelid) like '%professional%'
      and pg_catalog.pg_get_expr(c.conbin,c.conrelid) like '%business%'
      and pg_catalog.pg_get_expr(c.conbin,c.conrelid) like '%company%'
  ) then
    raise exception 'account_registration_intents existe con una estructura incompatible';
  end if;
end $$;
alter table public.account_registration_intents enable row level security;
revoke all on table public.account_registration_intents from public,anon,authenticated,service_role;
grant select on table public.account_registration_intents to service_role;

-- Toda cuenta conserva Cliente. La seleccion inicial adicional queda como primaria,
-- pero Empresa nace solo como capacidad company, nunca como empresa verificada.
create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_choice text:=coalesce(new.raw_user_meta_data->>'initial_experience','client');
  v_exp public.arauka_experience;
  v_kind public.arauka_profile_kind;
begin
  if v_choice='professional' then v_exp:='maestro';v_kind:='professional';
  elsif v_choice='business' then v_exp:='maestro';v_kind:='business';
  elsif v_choice='company' then v_exp:='empresa';v_kind:='company';
  else v_exp:='cliente';v_kind:='personal'; end if;

  insert into public.profiles(id,display_name,is_professional)
  values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Usuario ARAUKA'),100),v_exp in ('maestro','empresa'))
  on conflict(id) do nothing;
  insert into public.account_registration_intents(user_id,initial_experience)
  values(new.id,case when v_choice in ('client','professional','business','company') then v_choice else 'client' end)
  on conflict(user_id) do nothing;
  insert into public.account_identities(user_id,primary_experience)
  values(new.id,v_exp) on conflict(user_id) do nothing;
  insert into public.account_experiences(user_id,experience,profile_kind)
  values(new.id,'cliente','personal') on conflict(user_id,experience) do nothing;
  if v_exp<>'cliente' then
    insert into public.account_experiences(user_id,experience,profile_kind)
    values(new.id,v_exp,v_kind) on conflict(user_id,experience) do nothing;
  end if;
  return new;
end $$;
-- Es una funcion de trigger, no una RPC. El trigger conserva su ejecucion interna.
revoke all on function public.create_profile_for_user() from public,anon,authenticated,service_role;

-- Reconciliacion posterior a la confirmacion. Solo acepta la eleccion company que
-- quedo registrada en Auth; navegar a /empresa no satisface esta condicion.
create or replace function public.complete_initial_company_activation() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Autenticacion requerida'; end if;
  if not exists(
    select 1 from public.account_registration_intents
    where user_id=v_user and initial_experience='company'
  ) then
    raise exception 'La cuenta no registra una seleccion inicial de Empresa';
  end if;
  if not exists(select 1 from public.profiles where id=v_user) then
    raise exception 'Perfil base inexistente';
  end if;

  insert into public.account_identities(user_id,primary_experience)
  values(v_user,'empresa') on conflict(user_id) do nothing;
  insert into public.account_experiences(user_id,experience,profile_kind)
  values(v_user,'cliente','personal') on conflict(user_id,experience) do nothing;
  insert into public.account_experiences(user_id,experience,profile_kind)
  values(v_user,'empresa','company') on conflict(user_id,experience) do nothing;

  if exists(
    select 1 from public.account_experiences
    where user_id=v_user and experience='empresa' and profile_kind<>'company'
  ) then raise exception 'La experiencia Empresa tiene un tipo incompatible'; end if;

  -- La eleccion inicial fue explicita. Repetir la RPC conserva el mismo resultado.
  update public.account_identities set primary_experience='empresa',updated_at=now()
  where user_id=v_user and primary_experience<>'empresa';
  update public.profiles set is_professional=true where id=v_user and not is_professional;
end $$;

revoke all on function public.complete_initial_company_activation() from public,anon;
revoke all on function public.complete_initial_company_activation() from service_role;
grant execute on function public.complete_initial_company_activation() to authenticated;

notify pgrst,'reload schema';
commit;

-- Reversion funcional: el frontend debe dejar de invocar la RPC antes de retirarla.
-- drop function public.complete_initial_company_activation();
-- La version anterior de create_profile_for_user debe restaurarse desde v0.9.
