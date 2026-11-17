-- SOLO LECTURA. Ejecutar despues de migration_v0.9.2_base_privileges.sql.

-- Existencia y RLS: todas deben existir y tener rls_enabled=true.
select required.name as table_name,to_regclass('public.'||required.name) is not null as exists_ok,
       coalesce(c.relrowsecurity,false) as rls_enabled
from unnest(array[
  'profiles','jobs','interests','reviews','portfolio','verifications','private_contacts',
  'notifications','notification_preferences','account_identities','account_experiences',
  'commercial_profiles','company_documents'
]) as required(name)
left join pg_class c on c.oid=to_regclass('public.'||required.name)
order by required.name;

-- Grants efectivos de tabla y columna.
select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','service_role')
  and table_name in (
    'profiles','jobs','interests','reviews','portfolio','verifications','private_contacts',
    'notifications','notification_preferences','account_identities','account_experiences',
    'commercial_profiles','company_documents')
order by grantee,table_name,privilege_type;

select grantee,table_name,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public' and grantee in ('anon','authenticated','service_role')
  and table_name in ('profiles','notifications','notification_preferences','commercial_profiles')
order by grantee,table_name,privilege_type,column_name;

-- Matriz anon: solo SELECT en las cinco tablas publicas.
select
  has_table_privilege('anon','public.profiles','SELECT') as anon_profiles_select_ok,
  has_table_privilege('anon','public.jobs','SELECT') as anon_jobs_select_ok,
  has_table_privilege('anon','public.reviews','SELECT') as anon_reviews_select_ok,
  has_table_privilege('anon','public.portfolio','SELECT') as anon_portfolio_select_ok,
  has_table_privilege('anon','public.verifications','SELECT') as anon_verifications_select_ok,
  not has_table_privilege('anon','public.jobs','INSERT') as anon_jobs_insert_denied_ok,
  not has_table_privilege('anon','public.interests','SELECT') as anon_interests_select_denied_ok,
  not has_table_privilege('anon','public.private_contacts','SELECT') as anon_contacts_select_denied_ok,
  not has_table_privilege('anon','public.notifications','SELECT') as anon_notifications_select_denied_ok,
  not has_table_privilege('anon','public.commercial_profiles','SELECT') as anon_commercial_select_denied_ok;

-- Matriz authenticated para operaciones reales de la app/arnes.
select
  has_table_privilege('authenticated','public.profiles','SELECT') as auth_profiles_select_ok,
  has_column_privilege('authenticated','public.profiles','display_name','UPDATE') as auth_profiles_safe_update_ok,
  not has_column_privilege('authenticated','public.profiles','is_professional','UPDATE') as auth_is_professional_update_denied_ok,
  has_table_privilege('authenticated','public.jobs','SELECT') as auth_jobs_select_ok,
  has_table_privilege('authenticated','public.jobs','INSERT') as auth_jobs_insert_ok,
  has_table_privilege('authenticated','public.jobs','UPDATE') as auth_jobs_update_ok,
  not has_table_privilege('authenticated','public.jobs','DELETE') as auth_jobs_delete_denied_ok,
  has_table_privilege('authenticated','public.interests','SELECT') as auth_interests_select_ok,
  has_table_privilege('authenticated','public.interests','INSERT') as auth_interests_insert_ok,
  has_table_privilege('authenticated','public.interests','UPDATE') as auth_interests_update_ok,
  not has_table_privilege('authenticated','public.interests','DELETE') as auth_interests_delete_denied_ok,
  has_table_privilege('authenticated','public.reviews','SELECT') as auth_reviews_select_ok,
  has_table_privilege('authenticated','public.reviews','INSERT') as auth_reviews_insert_ok,
  not has_table_privilege('authenticated','public.reviews','UPDATE') as auth_reviews_update_denied_ok,
  has_table_privilege('authenticated','public.portfolio','SELECT') as auth_portfolio_select_ok,
  has_table_privilege('authenticated','public.portfolio','INSERT') as auth_portfolio_insert_ok,
  has_table_privilege('authenticated','public.portfolio','DELETE') as auth_portfolio_delete_ok,
  has_table_privilege('authenticated','public.verifications','SELECT') as auth_verifications_select_ok,
  not has_table_privilege('authenticated','public.verifications','INSERT') as auth_verifications_insert_denied_ok;

select
  has_table_privilege('authenticated','public.private_contacts','SELECT') as auth_contacts_select_ok,
  has_table_privilege('authenticated','public.private_contacts','INSERT') as auth_contacts_insert_ok,
  has_table_privilege('authenticated','public.private_contacts','UPDATE') as auth_contacts_update_ok,
  not has_table_privilege('authenticated','public.private_contacts','DELETE') as auth_contacts_delete_denied_ok,
  has_table_privilege('authenticated','public.notifications','SELECT') as auth_notifications_select_ok,
  has_column_privilege('authenticated','public.notifications','read_at','UPDATE') as auth_notification_read_update_ok,
  not has_column_privilege('authenticated','public.notifications','recipient_id','UPDATE') as auth_notification_recipient_update_denied_ok,
  has_table_privilege('authenticated','public.notification_preferences','SELECT') as auth_preferences_select_ok,
  has_table_privilege('authenticated','public.notification_preferences','INSERT') as auth_preferences_insert_ok,
  has_column_privilege('authenticated','public.notification_preferences','email_enabled','UPDATE') as auth_preferences_update_ok,
  not has_column_privilege('authenticated','public.notification_preferences','user_id','UPDATE') as auth_preferences_user_update_denied_ok;

-- Tablas v0.9 y verificacion: confirma que v0.9.1 sigue vigente.
select
  has_table_privilege('authenticated','public.account_identities','SELECT') as auth_identities_select_ok,
  not has_table_privilege('authenticated','public.account_identities','UPDATE') as auth_identities_update_denied_ok,
  has_table_privilege('authenticated','public.account_experiences','SELECT') as auth_experiences_select_ok,
  not has_table_privilege('authenticated','public.account_experiences','INSERT') as auth_experiences_insert_denied_ok,
  has_table_privilege('authenticated','public.commercial_profiles','SELECT') as auth_commercial_select_ok,
  not has_column_privilege('authenticated','public.commercial_profiles','verification_status','UPDATE') as auth_self_verify_denied_ok,
  has_column_privilege('service_role','public.commercial_profiles','user_id','INSERT') as service_commercial_insert_ok,
  has_column_privilege('service_role','public.commercial_profiles','verification_status','UPDATE') as service_verify_update_ok,
  has_table_privilege('authenticated','public.company_documents','SELECT') as auth_documents_select_ok,
  has_table_privilege('authenticated','public.company_documents','INSERT') as auth_documents_insert_ok,
  has_table_privilege('authenticated','public.my_account_experiences','SELECT') as auth_experiences_view_select_ok;

-- service_role no simula operaciones de usuario sobre el esquema base.
select
  not (has_table_privilege('service_role','public.profiles','SELECT') or
       has_table_privilege('service_role','public.profiles','INSERT') or
       has_table_privilege('service_role','public.profiles','UPDATE') or
       has_table_privilege('service_role','public.profiles','DELETE')) as service_profiles_general_denied_ok,
  not (has_table_privilege('service_role','public.jobs','SELECT') or
       has_table_privilege('service_role','public.jobs','INSERT') or
       has_table_privilege('service_role','public.jobs','UPDATE') or
       has_table_privilege('service_role','public.jobs','DELETE')) as service_jobs_general_denied_ok,
  not (has_table_privilege('service_role','public.notifications','SELECT') or
       has_table_privilege('service_role','public.notifications','INSERT') or
       has_table_privilege('service_role','public.notifications','UPDATE') or
       has_table_privilege('service_role','public.notifications','DELETE')) as service_notifications_general_denied_ok;

-- Policies existentes: v0.9.2 no crea ni modifica ninguna.
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename in (
  'profiles','jobs','interests','reviews','portfolio','verifications','private_contacts',
  'notifications','notification_preferences','account_identities','account_experiences',
  'commercial_profiles','company_documents')
order by tablename,cmd,policyname;

-- RPC y tipos.
select
  has_schema_privilege('anon','public','USAGE') as anon_schema_usage_ok,
  has_schema_privilege('authenticated','public','USAGE') as auth_schema_usage_ok,
  has_schema_privilege('service_role','public','USAGE') as service_schema_usage_ok;

select
  has_function_privilege('authenticated','public.get_shared_contact(uuid)','EXECUTE') as auth_shared_contact_rpc_ok,
  has_function_privilege('authenticated','public.set_primary_experience(public.arauka_experience)','EXECUTE') as auth_set_primary_rpc_ok,
  has_function_privilege('authenticated','public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)','EXECUTE') as auth_activate_rpc_ok,
  not has_function_privilege('anon','public.get_shared_contact(uuid)','EXECUTE') as anon_shared_contact_rpc_denied_ok,
  not has_function_privilege('anon','public.set_primary_experience(public.arauka_experience)','EXECUTE') as anon_set_primary_rpc_denied_ok,
  not has_function_privilege('anon','public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)','EXECUTE') as anon_activate_rpc_denied_ok,
  has_type_privilege('authenticated','public.arauka_profile_kind','USAGE') as auth_profile_kind_type_ok,
  has_type_privilege('authenticated','public.arauka_experience','USAGE') as auth_experience_type_ok,
  has_type_privilege('authenticated','public.arauka_verification_status','USAGE') as auth_verification_type_ok,
  has_type_privilege('service_role','public.arauka_profile_kind','USAGE') as service_profile_kind_type_ok,
  has_type_privilege('service_role','public.arauka_experience','USAGE') as service_experience_type_ok,
  has_type_privilege('service_role','public.arauka_verification_status','USAGE') as service_verification_type_ok,
  not has_type_privilege('anon','public.arauka_profile_kind','USAGE') as anon_profile_kind_type_denied_ok,
  not has_type_privilege('anon','public.arauka_experience','USAGE') as anon_experience_type_denied_ok,
  not has_type_privilege('anon','public.arauka_verification_status','USAGE') as anon_verification_type_denied_ok;

-- Debe devolver cero filas: ninguna columna de estas tablas depende de secuencias.
select n.nspname as sequence_schema,s.relname as sequence_name,
       tn.nspname as table_schema,t.relname as table_name,a.attname as column_name
from pg_class s
join pg_namespace n on n.oid=s.relnamespace
join pg_depend d on d.objid=s.oid and d.deptype in ('a','i')
join pg_class t on t.oid=d.refobjid
join pg_namespace tn on tn.oid=t.relnamespace
join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid
where s.relkind='S' and tn.nspname='public'
  and t.relname in (
    'profiles','jobs','interests','reviews','portfolio','verifications','private_contacts',
    'notifications','notification_preferences','account_identities','account_experiences',
    'commercial_profiles','company_documents');
