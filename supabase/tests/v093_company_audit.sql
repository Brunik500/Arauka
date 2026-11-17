-- SOLO LECTURA. Ejecutar despues de migration_v0.9.3_company_registration.sql.

select to_regclass('public.administrative_reviewers') administrative_reviewers,
       to_regclass('public.commercial_profiles') commercial_profiles,
       to_regclass('public.company_documents') company_documents,
       to_regclass('public.verified_companies') verified_companies;

select c.relname,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('administrative_reviewers','commercial_profiles','company_documents');

-- Firmas reales instaladas. Debe existir exactamente una fila por funcion.
select p.oid::regprocedure as installed_signature,p.pronargs,
       oidvectortypes(p.proargtypes) as identity_argument_types
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('upsert_my_company_profile','review_company_verification','is_administrative_reviewer')
order by p.proname;

-- Todas las columnas *_ok deben ser true. El OID evita que una firma ausente
-- convierta esta auditoria de solo lectura en un error 42883 poco informativo.
with functions as (
  select
    max(p.oid) filter(where p.proname='upsert_my_company_profile' and p.pronargs=13
      and oidvectortypes(p.proargtypes)='text, text, text, text, text, text, text, text, text, text, text, text[], text[]') owner_oid,
    max(p.oid) filter(where p.proname='review_company_verification' and p.pronargs=2
      and oidvectortypes(p.proargtypes)='uuid, arauka_verification_status') review_oid,
    max(p.oid) filter(where p.proname='is_administrative_reviewer' and p.pronargs=0) admin_check_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
)
select
  owner_oid is not null and has_function_privilege('authenticated',owner_oid,'EXECUTE') as owner_rpc_ok,
  owner_oid is not null and not has_function_privilege('anon',owner_oid,'EXECUTE') as anon_owner_rpc_denied_ok,
  review_oid is not null and has_function_privilege('authenticated',review_oid,'EXECUTE') as review_rpc_authenticated_ok,
  review_oid is not null and not has_function_privilege('anon',review_oid,'EXECUTE') as anon_review_rpc_denied_ok,
  admin_check_oid is not null and has_function_privilege('authenticated',admin_check_oid,'EXECUTE') as auth_admin_check_ok,
  admin_check_oid is not null and not has_function_privilege('anon',admin_check_oid,'EXECUTE') as anon_admin_check_denied_ok,
  not has_table_privilege('authenticated','public.administrative_reviewers','SELECT') as auth_admin_list_denied_ok,
  not has_table_privilege('anon','public.administrative_reviewers','SELECT') as anon_admin_list_denied_ok,
  (has_table_privilege('service_role','public.administrative_reviewers','SELECT') and
   has_table_privilege('service_role','public.administrative_reviewers','INSERT') and
   has_table_privilege('service_role','public.administrative_reviewers','DELETE')) as service_admin_provision_ok,
  not has_column_privilege('authenticated','public.commercial_profiles','verification_status','UPDATE') as auth_self_verify_denied_ok,
  has_table_privilege('anon','public.verified_companies','SELECT') as anon_verified_view_ok,
  has_table_privilege('authenticated','public.verified_companies','SELECT') as auth_verified_view_ok
from functions;

-- La vista publica debe contener solo estas tres columnas, nunca datos privados.
select column_name
from information_schema.columns
where table_schema='public' and table_name='verified_companies'
order by ordinal_position;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in ('administrative_reviewers','commercial_profiles','company_documents'))
   or (schemaname='storage' and tablename='objects' and policyname like 'company documents%')
order by schemaname,tablename,cmd,policyname;

-- administrative_reviewers debe tener RLS habilitado y cero policies directas.
select count(*)=0 as admin_table_has_no_user_policies_ok
from pg_policies where schemaname='public' and tablename='administrative_reviewers';

-- Conteos de conservacion para comparar con el postflight v0.9 anterior.
select (select count(*) from public.profiles) profiles,
       (select count(*) from public.jobs) jobs,
       (select count(*) from public.interests) interests,
       (select count(*) from public.reviews) reviews,
       (select count(*) from public.portfolio) portfolio,
       (select count(*) from public.notifications) notifications;
