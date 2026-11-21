-- SOLO LECTURA. Ejecutar despues de instalar la candidata v0.9.4.1.
with target as (
  select p.oid,p.prosecdef,p.provolatile,p.proconfig,r.rolname owner_name,
         (r.rolsuper or r.rolbypassrls) owner_bypasses_rls,
         pg_get_function_result(p.oid) function_result
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
  where n.nspname='public' and p.proname='list_public_providers' and p.pronargs=0
)
select
  count(*)=1 as one_signature_ok,
  coalesce(bool_and(prosecdef),false) as security_definer_ok,
  coalesce(bool_and(provolatile='s'),false) as stable_ok,
  coalesce(bool_and(proconfig @> array['search_path=pg_catalog, public','row_security=off']),false) as secure_config_ok,
  coalesce(bool_and(owner_name not in ('anon','authenticated','service_role')),false) as trusted_owner_ok,
  coalesce(bool_and(owner_bypasses_rls),false) as owner_bypasses_rls_ok,
  coalesce(bool_and(function_result='TABLE(user_id uuid, profile_kind text, public_name text, bio text, services text[], coverage text[], is_company_verified boolean)'),false) as result_contract_ok
from target;

with target as (
  select p.oid,not exists(
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) public_execute_denied
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='list_public_providers' and p.pronargs=0
)
select
  oid is not null and has_function_privilege('anon',oid,'EXECUTE') as anon_execute_ok,
  oid is not null and has_function_privilege('authenticated',oid,'EXECUTE') as authenticated_execute_ok,
  oid is not null and not has_function_privilege('service_role',oid,'EXECUTE') as service_execute_denied_ok,
  oid is not null and public_execute_denied as public_execute_denied_ok
from target;

select
  not has_table_privilege('anon','public.account_experiences','SELECT') as anon_experiences_still_private_ok,
  not has_table_privilege('anon','public.commercial_profiles','SELECT') as anon_commercial_still_private_ok,
  not has_table_privilege('anon','public.account_identities','SELECT') as anon_identities_still_private_ok;

with projected as (select * from public.list_public_providers())
select
  count(*) as provider_count,
  count(*)=count(distinct user_id) as no_duplicates_ok,
  count(*) filter(where profile_kind='professional') as professionals,
  count(*) filter(where profile_kind='business') as businesses,
  count(*) filter(where profile_kind='company') as companies,
  count(*) filter(where is_company_verified) as verified_companies,
  count(*) filter(where is_company_verified is null)=0 as verification_never_null_ok,
  count(*) filter(where profile_kind<>'company' and is_company_verified)=0 as verification_only_company_ok,
  count(*) filter(where profile_kind not in ('professional','business','company'))=0 as only_provider_kinds_ok
from projected;

select count(*)=0 as pure_clients_excluded_ok
from public.list_public_providers() projected
where not exists(
  select 1 from public.account_experiences e where e.user_id=projected.user_id and e.experience in ('maestro','empresa')
);

with target as (
  select p.oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='list_public_providers' and p.pronargs=0
)
select parameters.parameter_name as column_name,
       parameters.data_type,
       parameters.ordinal_position
from information_schema.parameters parameters
join target on parameters.specific_name='list_public_providers_'||target.oid::text
where parameters.specific_schema='public' and parameters.parameter_mode='OUT'
order by parameters.ordinal_position;
