-- SOLO LECTURA. Ejecutar antes de migration_v0.9.5_account_deletion_foundation.sql.
-- Todas las filas bloqueantes deben tener matches=true.
with required_tables(object_name) as (values
 ('public.profiles'),('public.jobs'),('public.interests'),('public.reviews'),('public.portfolio'),
 ('public.verifications'),('public.private_contacts'),('public.notifications'),
 ('public.notification_preferences'),('public.account_identities'),('public.account_experiences'),
 ('public.commercial_profiles'),('public.company_documents'),('public.administrative_reviewers'),
 ('public.account_registration_intents'),('storage.buckets'),('storage.objects')
), required_functions(signature) as (values
 ('public.create_profile_for_user()'),('public.get_shared_contact(uuid)'),
 ('public.arauka_alert_on_interest()'),('public.arauka_alert_on_job()'),
 ('public.arauka_alert_on_interest_consent()'),
 ('public.set_primary_experience(public.arauka_experience)'),
 ('public.activate_experience(public.arauka_experience,public.arauka_profile_kind,text)'),
 ('public.upsert_my_company_profile(text,text,text,text,text,text,text,text,text,text,text,text[],text[])'),
 ('public.is_administrative_reviewer()'),
 ('public.review_company_verification(uuid,public.arauka_verification_status)'),
 ('public.complete_initial_company_activation()')
), checks as (
  select 'tabla' category,object_name check_name,'existe' expected,
         coalesce(to_regclass(object_name)::text,'ausente') observed,
         to_regclass(object_name) is not null matches,true blocker from required_tables
  union all
  select 'funcion',signature,'existe',coalesce(to_regprocedure(signature)::text,'ausente'),
         to_regprocedure(signature) is not null,true from required_functions
  union all
  select 'trigger_auth','trigger_create_arauka_profile','exactamente 1 enlazado a public.create_profile_for_user',
         count(*)::text,count(*)=1,true
  from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
  where t.tgrelid='auth.users'::regclass and t.tgname='trigger_create_arauka_profile'
    and not t.tgisinternal and n.nspname='public' and p.proname='create_profile_for_user'
  union all
  select 'ausencia_v095','profiles.auth_user_id','ausente',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='auth_user_id') then 'presente' else 'ausente' end,
         not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='auth_user_id'),true
  union all
  select 'ausencia_v095','profiles.deleted_at','ausente',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='deleted_at') then 'presente' else 'ausente' end,
         not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='deleted_at'),true
  union all
  select 'ausencia_v095',x.object_name,'ausente',case when x.present then 'presente' else 'ausente' end,not x.present,true
  from (values
    ('public.account_deletion_requests',to_regclass('public.account_deletion_requests') is not null),
    ('public.review_retention_queue',to_regclass('public.review_retention_queue') is not null),
    ('public.current_actor_id()',to_regprocedure('public.current_actor_id()') is not null),
    ('public.my_account_deletion_preflight()',to_regprocedure('public.my_account_deletion_preflight()') is not null),
    ('public.anonymize_account_for_deletion(uuid,uuid)',to_regprocedure('public.anonymize_account_for_deletion(uuid,uuid)') is not null)
  ) x(object_name,present)
  union all
  select 'ausencia_v095','trigger link_profile_auth_user_before_insert','ausente',count(*)::text,count(*)=0,true
  from pg_trigger where tgrelid='public.profiles'::regclass and tgname='link_profile_auth_user_before_insert' and not tgisinternal
  union all
  select 'integridad','profiles sin auth.users','0',count(*)::text,count(*)=0,true
  from public.profiles p left join auth.users u on u.id=p.id where u.id is null
  union all
  select 'storage_bucket',b.id||' configuracion','existe; public='||b.expected_public::text,
         coalesce('existe; public='||s.public::text,'ausente'),s.id is not null and s.public=b.expected_public,true
  from (values ('portfolio',true),('company-documents',false)) b(id,expected_public)
  left join storage.buckets s on s.id=b.id
), metrics as (
  select 'conteo' category,x.name check_name,'informativo' expected,x.value::text observed,true matches,false blocker
  from (values
    ('profiles',(select count(*) from public.profiles)),('jobs',(select count(*) from public.jobs)),
    ('interests',(select count(*) from public.interests)),('reviews',(select count(*) from public.reviews)),
    ('portfolio',(select count(*) from public.portfolio)),('verifications',(select count(*) from public.verifications)),
    ('commercial_profiles',(select count(*) from public.commercial_profiles)),
    ('company_documents',(select count(*) from public.company_documents)),
    ('notifications',(select count(*) from public.notifications)),
    ('account_identities',(select count(*) from public.account_identities)),
    ('account_experiences',(select count(*) from public.account_experiences)),
    ('account_registration_intents',(select count(*) from public.account_registration_intents)),
    ('administrative_reviewers',(select count(*) from public.administrative_reviewers)),
    ('private_contacts',(select count(*) from public.private_contacts)),
    ('notification_preferences',(select count(*) from public.notification_preferences)),
    ('jobs status matched',(select count(*) from public.jobs where status='matched')),
    ('jobs con selected_pro_id',(select count(*) from public.jobs where selected_pro_id is not null)),
    ('reviews entre cuentas',(select count(*) from public.reviews where client_id<>pro_id)),
    ('commercial_profiles con revisor',(select count(*) from public.commercial_profiles where verification_reviewed_by is not null)),
    ('administrative_reviewers con granted_by',(select count(*) from public.administrative_reviewers where granted_by is not null))
  ) x(name,value)
  union all
  select 'storage_conteo',b.id,'informativo',count(o.id)::text,true,false
  from (values ('portfolio'),('company-documents')) b(id)
  left join storage.objects o on o.bucket_id=b.id group by b.id
), all_results as (select * from checks union all select * from metrics), totals as (
  select count(*) total_checks,count(*) filter(where matches) matches,
         count(*) filter(where not matches) differences,
         count(*) filter(where blocker and not matches) blockers from all_results
)
select r.category,r.check_name,r.expected,r.observed,r.matches,r.blocker,
       t.total_checks,t.matches total_matches,t.differences,t.blockers,
       t.blockers=0 preflight_structural_ok
from all_results r cross join totals t
order by not r.matches,r.blocker desc,r.category,r.check_name;
