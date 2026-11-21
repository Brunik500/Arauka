-- ARAUKA v0.9.4.1 - proyeccion publica de prestadores.
-- Instalacion autorizada UNICAMENTE en arauka-staging (qviiiomipsulvjpstyzw).
-- NO ejecutar en Produccion. Requiere v0.9-v0.9.4.
-- Solo crea una RPC de lectura; no modifica tablas, filas, RLS ni experiencias.

begin;

do $$
declare v_missing text;
declare v_runner_can_bypass boolean;
begin
  select required.name into v_missing
  from (values ('profiles'),('account_experiences'),('commercial_profiles')) required(name)
  where to_regclass('public.'||required.name) is null limit 1;
  if v_missing is not null then
    raise exception 'Falta public.%; instalar primero v0.9-v0.9.4',v_missing;
  end if;
  if to_regtype('public.arauka_profile_kind') is null or to_regtype('public.arauka_experience') is null then
    raise exception 'Faltan tipos de identidad v0.9';
  end if;
  if current_user in ('anon','authenticated','service_role') then
    raise exception 'Rol de instalacion no confiable: %',current_user;
  end if;
  select rolsuper or rolbypassrls into v_runner_can_bypass from pg_roles where rolname=current_user;
  if not coalesce(v_runner_can_bypass,false) then
    raise exception 'El rol de instalacion % no puede ser propietario efectivo de una RPC SECURITY DEFINER con RLS desactivado',current_user;
  end if;
  if not has_table_privilege(current_user,'public.profiles','SELECT')
     or not has_table_privilege(current_user,'public.account_experiences','SELECT')
     or not has_table_privilege(current_user,'public.commercial_profiles','SELECT')
     or not has_table_privilege(current_user,'auth.users','SELECT') then
    raise exception 'El rol de instalacion carece de SELECT sobre una dependencia de la RPC';
  end if;
  if has_table_privilege('anon','public.account_experiences','SELECT')
     or has_table_privilege('anon','public.commercial_profiles','SELECT')
     or has_table_privilege('anon','public.account_identities','SELECT') then
    raise exception 'Anon tiene acceso directo inesperado a tablas de identidad protegidas';
  end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='list_public_providers' and p.pronargs<>0
  ) then
    raise exception 'Existe una sobrecarga inesperada de public.list_public_providers';
  end if;
  if exists(
    select 1 from public.account_experiences
    where (experience='maestro' and profile_kind not in ('professional','business'))
       or (experience='empresa' and profile_kind<>'company')
  ) then raise exception 'Existen combinaciones de experiencia comercial incompatibles'; end if;
  if exists(
    select user_id from public.account_experiences
    where experience in ('maestro','empresa') group by user_id having count(*)>1
  ) then raise exception 'Una cuenta tiene Maestro y Empresa simultaneamente; resolver identidad publica antes de instalar'; end if;
end $$;

create or replace function public.list_public_providers()
returns table(
  user_id uuid,
  profile_kind text,
  public_name text,
  bio text,
  services text[],
  coverage text[],
  is_company_verified boolean
)
language sql
stable
security definer
set search_path=pg_catalog,public
set row_security=off
as $$
  with ranked_experiences as (
    select e.*,
           row_number() over(
             partition by e.user_id
             order by case when e.experience='empresa' and e.profile_kind='company' then 0 else 1 end,e.enabled_at
           ) as public_rank
    from public.account_experiences e
    where (e.experience='maestro' and e.profile_kind in ('professional','business'))
       or (e.experience='empresa' and e.profile_kind='company')
  )
  select
    p.id as user_id,
    e.profile_kind::text,
    coalesce(nullif(btrim(c.public_name),''),nullif(btrim(p.company_name),''),nullif(btrim(p.display_name),''),'Prestador') as public_name,
    p.bio,
    p.categories as services,
    p.service_localities as coverage,
    coalesce(
      e.profile_kind='company' and c.verification_status='verified',
      false
    ) as is_company_verified
  from ranked_experiences e
  join public.profiles p on p.id=e.user_id
  join auth.users u on u.id=p.id
  left join public.commercial_profiles c on c.user_id=e.user_id and c.profile_kind=e.profile_kind
  where e.public_rank=1
    -- Compatible con el esquema actual y con deleted_at cuando v0.9.5 sea revisada:
    -- una columna ausente o NULL produce NULL; una fecha de eliminacion excluye la fila.
    and (to_jsonb(p)->>'deleted_at') is null;
$$;

-- CREATE OR REPLACE conserva el propietario anterior. Reasignarlo al rol confiable
-- que ejecuta esta migracion hace explicito el contexto efectivo de SECURITY DEFINER.
alter function public.list_public_providers() owner to current_user;
revoke all on function public.list_public_providers() from public,anon,authenticated,service_role;
grant execute on function public.list_public_providers() to anon,authenticated;
comment on function public.list_public_providers() is
  'Proyeccion publica minima de prestadores activos. No expone datos tributarios, contactos, documentos ni estados administrativos.';

do $$
declare v_owner name;
declare v_owner_bypasses boolean;
begin
  select r.rolname,r.rolsuper or r.rolbypassrls into v_owner,v_owner_bypasses
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
  where n.nspname='public' and p.proname='list_public_providers' and p.pronargs=0;
  if v_owner is distinct from current_user or not coalesce(v_owner_bypasses,false) then
    raise exception 'Propietario efectivo inseguro para list_public_providers: %',coalesce(v_owner,'missing');
  end if;
  if not has_function_privilege('anon','public.list_public_providers()','EXECUTE')
     or not has_function_privilege('authenticated','public.list_public_providers()','EXECUTE')
     or has_function_privilege('service_role','public.list_public_providers()','EXECUTE') then
    raise exception 'ACL inesperada en list_public_providers';
  end if;
end $$;

notify pgrst,'reload schema';
commit;