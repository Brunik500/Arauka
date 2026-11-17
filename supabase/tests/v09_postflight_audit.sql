-- SOLO LECTURA. Ejecutar despues de v0.9 en ENSAYO y comparar conteos con preflight.

select to_regclass('public.account_identities') account_identities,
       to_regclass('public.account_experiences') account_experiences,
       to_regclass('public.commercial_profiles') commercial_profiles,
       to_regclass('public.company_documents') company_documents;

select count(*) profiles,(select count(*) from public.account_identities) identities
from public.profiles;
select count(*) missing_identity from public.profiles p left join public.account_identities i on i.user_id=p.id where i.user_id is null;
select count(*) missing_client from public.profiles p left join public.account_experiences e on e.user_id=p.id and e.experience='cliente' where e.user_id is null;
select count(*) missing_legacy_professional from public.profiles p left join public.account_experiences e on e.user_id=p.id and e.experience='maestro' where p.is_professional and e.user_id is null;
select count(*) invalid_primary from public.account_identities i left join public.account_experiences e on e.user_id=i.user_id and e.experience=i.primary_experience where i.primary_experience is not null and e.user_id is null;

select schemaname,tablename,policyname,cmd,roles,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('account_identities','account_experiences','commercial_profiles','company_documents','profiles','jobs','interests','portfolio'))
   or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,cmd,policyname;

select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee='authenticated' and table_name in ('account_identities','account_experiences','commercial_profiles','company_documents','profiles')
order by table_name,privilege_type;

select count(*) jobs from public.jobs;
select count(*) interests from public.interests;
select count(*) reviews from public.reviews;
select count(*) portfolio from public.portfolio;
