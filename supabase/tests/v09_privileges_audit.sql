-- SOLO LECTURA. Ejecutar despues de migration_v0.9.1_privileges.sql.

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('account_identities','account_experiences','commercial_profiles','company_documents')
  and grantee in ('anon','authenticated','service_role')
order by grantee,table_name,privilege_type;

select grantee,table_name,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public'
  and table_name='commercial_profiles'
  and grantee in ('anon','authenticated','service_role')
order by grantee,privilege_type,column_name;

-- Matriz esperada. Todas las columnas *_ok deben devolver true.
select
  not (has_table_privilege('anon','public.account_identities','SELECT') or has_table_privilege('anon','public.account_identities','INSERT') or has_table_privilege('anon','public.account_identities','UPDATE') or has_table_privilege('anon','public.account_identities','DELETE')) as anon_identities_denied_ok,
  not (has_table_privilege('anon','public.account_experiences','SELECT') or has_table_privilege('anon','public.account_experiences','INSERT') or has_table_privilege('anon','public.account_experiences','UPDATE') or has_table_privilege('anon','public.account_experiences','DELETE')) as anon_experiences_denied_ok,
  not (has_table_privilege('anon','public.commercial_profiles','SELECT') or has_table_privilege('anon','public.commercial_profiles','INSERT') or has_table_privilege('anon','public.commercial_profiles','UPDATE') or has_table_privilege('anon','public.commercial_profiles','DELETE')) as anon_commercial_denied_ok,
  not (has_table_privilege('anon','public.company_documents','SELECT') or has_table_privilege('anon','public.company_documents','INSERT') or has_table_privilege('anon','public.company_documents','UPDATE') or has_table_privilege('anon','public.company_documents','DELETE')) as anon_documents_denied_ok;

select
  has_table_privilege('authenticated','public.account_identities','SELECT') as auth_identities_select_ok,
  not (has_table_privilege('authenticated','public.account_identities','INSERT') or has_table_privilege('authenticated','public.account_identities','UPDATE') or has_table_privilege('authenticated','public.account_identities','DELETE')) as auth_identities_write_denied_ok,
  has_table_privilege('authenticated','public.account_experiences','SELECT') as auth_experiences_select_ok,
  not (has_table_privilege('authenticated','public.account_experiences','INSERT') or has_table_privilege('authenticated','public.account_experiences','UPDATE') or has_table_privilege('authenticated','public.account_experiences','DELETE')) as auth_experiences_write_denied_ok,
  has_table_privilege('authenticated','public.commercial_profiles','SELECT') as auth_commercial_select_ok,
  not (has_table_privilege('authenticated','public.commercial_profiles','INSERT') or has_table_privilege('authenticated','public.commercial_profiles','UPDATE') or has_table_privilege('authenticated','public.commercial_profiles','DELETE')) as auth_commercial_write_denied_ok,
  (has_table_privilege('authenticated','public.company_documents','SELECT') and
   has_table_privilege('authenticated','public.company_documents','INSERT')) as auth_documents_read_insert_ok,
  not (has_table_privilege('authenticated','public.company_documents','UPDATE') or has_table_privilege('authenticated','public.company_documents','DELETE')) as auth_documents_update_delete_denied_ok;

select
  has_table_privilege('service_role','public.account_identities','SELECT') as service_identities_select_ok,
  not (has_table_privilege('service_role','public.account_identities','INSERT') or has_table_privilege('service_role','public.account_identities','UPDATE') or has_table_privilege('service_role','public.account_identities','DELETE')) as service_identities_write_denied_ok,
  has_table_privilege('service_role','public.account_experiences','SELECT') as service_experiences_select_ok,
  not (has_table_privilege('service_role','public.account_experiences','INSERT') or has_table_privilege('service_role','public.account_experiences','UPDATE') or has_table_privilege('service_role','public.account_experiences','DELETE')) as service_experiences_write_denied_ok,
  has_table_privilege('service_role','public.commercial_profiles','SELECT') as service_commercial_select_ok,
  has_column_privilege('service_role','public.commercial_profiles','user_id','INSERT') as service_commercial_insert_ok,
  has_column_privilege('service_role','public.commercial_profiles','verification_status','UPDATE') as service_verification_update_ok,
  not has_column_privilege('authenticated','public.commercial_profiles','verification_status','UPDATE') as auth_verification_update_denied_ok,
  has_table_privilege('service_role','public.company_documents','SELECT') as service_documents_select_ok,
  not (has_table_privilege('service_role','public.company_documents','INSERT') or has_table_privilege('service_role','public.company_documents','UPDATE') or has_table_privilege('service_role','public.company_documents','DELETE')) as service_documents_write_denied_ok;

-- Las funciones no requieren privilegios de tabla para authenticated porque son
-- SECURITY DEFINER. Deben ser ejecutables por authenticated y no por anon.
select
  has_function_privilege('authenticated','public.set_primary_experience(public.arauka_experience)','EXECUTE') as auth_set_primary_rpc_ok,
  has_function_privilege('authenticated','public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)','EXECUTE') as auth_activate_rpc_ok,
  not has_function_privilege('anon','public.set_primary_experience(public.arauka_experience)','EXECUTE') as anon_set_primary_denied_ok,
  not has_function_privilege('anon','public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)','EXECUTE') as anon_activate_denied_ok;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename in
  ('account_identities','account_experiences','commercial_profiles','company_documents')
order by tablename,cmd,policyname;

select sequence_schema,sequence_name
from information_schema.sequences
where sequence_schema='public' and sequence_name like any(array['account_%','commercial_%','company_%']);

select
  has_type_privilege('authenticated','public.arauka_profile_kind','USAGE') as auth_profile_kind_usage_ok,
  has_type_privilege('authenticated','public.arauka_experience','USAGE') as auth_experience_usage_ok,
  has_type_privilege('service_role','public.arauka_verification_status','USAGE') as service_verification_type_usage_ok,
  not has_type_privilege('anon','public.arauka_profile_kind','USAGE') as anon_profile_kind_usage_denied_ok,
  not has_type_privilege('anon','public.arauka_experience','USAGE') as anon_experience_usage_denied_ok;
