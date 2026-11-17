-- SOLO LECTURA. Ejecutar únicamente después de instalar la base v0.9.5 en Staging.
select column_name,is_nullable,data_type from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name in ('auth_user_id','deleted_at') order by column_name;

select rc.delete_rule,tc.table_name,kcu.column_name,ccu.table_name foreign_table
from information_schema.referential_constraints rc
join information_schema.table_constraints tc on tc.constraint_schema=rc.constraint_schema and tc.constraint_name=rc.constraint_name
join information_schema.key_column_usage kcu on kcu.constraint_schema=tc.constraint_schema and kcu.constraint_name=tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_schema=rc.unique_constraint_schema and ccu.constraint_name=rc.unique_constraint_name
where tc.table_schema='public' and ((tc.table_name='profiles' and kcu.column_name='auth_user_id')
 or (tc.table_name='commercial_profiles' and kcu.column_name='verification_reviewed_by')
 or (tc.table_name='administrative_reviewers' and kcu.column_name='granted_by'));

select
 count(*) filter(where c.conrelid='public.profiles'::regclass and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='id')]::smallint[] and c.confrelid='auth.users'::regclass)=0 as legacy_profile_cascade_removed_ok,
 count(*) filter(where c.conrelid='public.profiles'::regclass and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='auth_user_id')]::smallint[] and c.confrelid='auth.users'::regclass and c.confdeltype='n')=1 as auth_link_set_null_ok,
 count(*) filter(where c.conrelid='public.jobs'::regclass and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='client_id')]::smallint[] and c.confrelid='public.profiles'::regclass and c.confdeltype='c')=1 as jobs_client_cascade_unchanged_ok,
 count(*) filter(where c.conrelid='public.jobs'::regclass and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='selected_pro_id')]::smallint[] and c.confrelid='public.profiles'::regclass and c.confdeltype='a')=1 as jobs_selected_no_action_unchanged_ok
from pg_constraint c where c.contype='f';

select c.relrowsecurity deletion_requests_rls_ok,
  not (has_table_privilege('authenticated','public.account_deletion_requests','SELECT') or has_table_privilege('authenticated','public.account_deletion_requests','INSERT') or has_table_privilege('authenticated','public.account_deletion_requests','UPDATE') or has_table_privilege('authenticated','public.account_deletion_requests','DELETE')) auth_direct_access_denied_ok,
  not (has_table_privilege('anon','public.account_deletion_requests','SELECT') or has_table_privilege('anon','public.account_deletion_requests','INSERT') or has_table_privilege('anon','public.account_deletion_requests','UPDATE') or has_table_privilege('anon','public.account_deletion_requests','DELETE')) anon_direct_access_denied_ok
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='account_deletion_requests';

select
 has_function_privilege('authenticated','public.my_account_deletion_preflight()','EXECUTE') auth_preflight_ok,
 not has_function_privilege('anon','public.my_account_deletion_preflight()','EXECUTE') anon_preflight_denied_ok,
 has_function_privilege('service_role','public.anonymize_account_for_deletion(uuid,uuid)','EXECUTE') service_anonymize_ok,
 not has_function_privilege('authenticated','public.anonymize_account_for_deletion(uuid,uuid)','EXECUTE') auth_anonymize_denied_ok;

select p.oid::regprocedure,p.prosecdef,p.proconfig,r.rolname owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname='public' and p.proname in ('link_profile_auth_user','current_actor_id','my_account_deletion_preflight','anonymize_account_for_deletion')
order by p.proname;

select count(*)=4 as secure_definer_configuration_ok
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname='public'
  and p.proname in ('link_profile_auth_user','current_actor_id','my_account_deletion_preflight','anonymize_account_for_deletion')
  and p.prosecdef and p.proconfig @> array['search_path=pg_catalog, public']
  and r.rolname not in ('anon','authenticated','service_role');

select count(*)=0 as no_security_definer_uses_pg_temp_ok
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and coalesce(array_to_string(p.proconfig,','),'') like '%pg_temp%';

select count(*) profiles_without_auth_link from public.profiles where auth_user_id is null;
select count(*) profiles_with_mismatched_auth_link from public.profiles where auth_user_id is distinct from id;
select count(*) duplicated_auth_links from (select auth_user_id from public.profiles where auth_user_id is not null group by auth_user_id having count(*)>1) x;
select count(*) deletion_requests from public.account_deletion_requests;
select count(*) review_retention_cases from public.review_retention_queue;

select
 not (has_table_privilege('authenticated','public.review_retention_queue','SELECT') or has_table_privilege('authenticated','public.review_retention_queue','INSERT') or has_table_privilege('authenticated','public.review_retention_queue','UPDATE') or has_table_privilege('authenticated','public.review_retention_queue','DELETE')) auth_review_queue_denied_ok,
 not (has_table_privilege('anon','public.review_retention_queue','SELECT') or has_table_privilege('anon','public.review_retention_queue','INSERT') or has_table_privilege('anon','public.review_retention_queue','UPDATE') or has_table_privilege('anon','public.review_retention_queue','DELETE')) anon_review_queue_denied_ok,
 (has_table_privilege('service_role','public.review_retention_queue','SELECT') and has_table_privilege('service_role','public.review_retention_queue','INSERT') and has_table_privilege('service_role','public.review_retention_queue','UPDATE')) service_review_queue_ok;

select count(*)=1 as deleted_profiles_hidden_from_public_policy_ok
from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles public select'
  and cmd='SELECT' and qual like '%deleted_at IS NULL%';

select count(*)=1 as active_or_historical_constraint_ok
from pg_constraint c where c.conrelid='public.profiles'::regclass and c.contype='c'
  and c.conname='profiles_active_or_historical_check'
  and pg_get_constraintdef(c.oid) like '%auth_user_id%deleted_at%';

select policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('profiles','jobs','interests','portfolio','reviews')
order by tablename,cmd,policyname;

select
 has_function_privilege('authenticated','public.current_actor_id()','EXECUTE') auth_current_actor_ok,
 not has_function_privilege('anon','public.current_actor_id()','EXECUTE') anon_current_actor_denied_ok,
 not has_column_privilege('authenticated','public.profiles','auth_user_id','UPDATE') auth_link_update_denied_ok,
 not has_column_privilege('authenticated','public.profiles','deleted_at','UPDATE') auth_deleted_at_update_denied_ok;

select count(*)=1 as profile_link_trigger_ok
from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid='public.profiles'::regclass and t.tgname='link_profile_auth_user_before_insert'
  and not t.tgisinternal and n.nspname='public' and p.proname='link_profile_auth_user';

select count(*)=0 as historical_actor_write_policies_without_resolver_ok
from pg_policies where schemaname='public' and tablename in ('profiles','jobs','interests','portfolio','reviews')
  and cmd in ('INSERT','UPDATE','DELETE') and coalesce(qual,'')||coalesce(with_check,'') like '%auth.uid()%'
  and coalesce(qual,'')||coalesce(with_check,'') not like '%current_actor_id()%'
  and policyname not in ('profiles owner insert');

select (select count(*) from public.profiles) profiles,
       (select count(*) from public.jobs) jobs,
       (select count(*) from public.interests) interests,
       (select count(*) from public.reviews) reviews,
       (select count(*) from public.portfolio) portfolio,
       (select count(*) from public.verifications) verifications,
       (select count(*) from public.commercial_profiles) commercial_profiles,
       (select count(*) from public.company_documents) company_documents,
       (select count(*) from public.notifications) notifications;
