-- SOLO LECTURA. Ejecutar en el SQL Editor del proyecto de ENSAYO antes de v0.9.
-- No contiene secretos ni modifica datos.

select current_database() database_name, now() checked_at;

select required.object_name, to_regclass(required.object_name) exists_as
from (values ('public.profiles'),('public.jobs'),('public.interests'),('public.portfolio'),
             ('public.reviews'),('public.verifications')) required(object_name);

-- v0.5 esta aplicada solo si existen tablas, columnas, triggers y policies; el archivo local no lo demuestra.
select to_regclass('public.notifications') notifications,
       to_regclass('public.notification_preferences') notification_preferences;
select trigger_name,event_object_table from information_schema.triggers
where trigger_schema='public' and trigger_name in ('arauka_interest_alert','arauka_job_alert','arauka_consent_alert','trigger_job_update');

-- Indicadores de v0.6 y v0.7. Revisar ademas pg_get_functiondef, no solo el nombre.
select p.oid::regprocedure function_name,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('validate_job_update','claim_notification_email','dispatch_notification_email_batch');
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='notifications' and column_name like 'email_%' order by column_name;

-- Toda policy permisiva INSERT/ALL se combina por OR y debe revisarse.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in ('profiles','jobs','interests','portfolio','reviews','verifications'))
   or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,cmd,policyname;

select table_schema,table_name,privilege_type,grantee
from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated')
order by table_schema,table_name,grantee,privilege_type;

select count(*) profiles from public.profiles;
select count(*) jobs from public.jobs;
select count(*) interests from public.interests;
select count(*) reviews from public.reviews;
select count(*) portfolio from public.portfolio;
