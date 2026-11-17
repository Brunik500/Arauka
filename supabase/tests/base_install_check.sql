-- ARAUKA: comprobacion de solo lectura despues de schema.sql y antes de v0.9.
-- Las columnas *_ok deben devolver true. No modifica datos.

select exists(select 1 from pg_extension where extname='pgcrypto') as pgcrypto_ok;

select expected.object_name,to_regclass(expected.object_name) is not null as exists_ok
from (values ('public.profiles'),('public.private_contacts'),('public.jobs'),
             ('public.interests'),('public.portfolio'),('public.reviews'),
             ('public.verifications')) expected(object_name);

select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('profiles','private_contacts','jobs','interests','portfolio','reviews','verifications')
order by c.relname;

select expected.function_name,to_regprocedure(expected.function_name) is not null as exists_ok
from (values ('public.create_profile_for_user()'),('public.validate_job_update()'),
             ('public.validate_interest_update()'),('public.get_shared_contact(uuid)')) expected(function_name);

select expected.trigger_name,exists(
  select 1 from information_schema.triggers t where t.trigger_name=expected.trigger_name
) as exists_ok
from (values ('trigger_create_arauka_profile'),('trigger_job_update'),
             ('trigger_interest_update')) expected(trigger_name);

select exists(select 1 from storage.buckets where id='portfolio' and public=true) as portfolio_bucket_ok;

select expected.policy_name,exists(
  select 1 from pg_policies p where p.policyname=expected.policy_name
) as exists_ok
from (values
  ('profiles public select'),('profiles owner insert'),('profiles owner update'),
  ('contacts owner select'),('contacts owner insert'),('contacts owner update'),
  ('jobs public select'),('jobs client insert'),('jobs client update'),
  ('interests participant select'),('interests professional insert'),('interests professional update'),
  ('portfolio public select'),('portfolio professional insert'),('portfolio professional delete'),
  ('reviews public select'),('reviews client after completed work'),('verifications public select'),
  ('portfolio images public'),('portfolio images owner upload'),('portfolio images owner remove')
) expected(policy_name);

-- v0.6: debe devolver true despues de aplicar migration_v0.6_job_editing.sql.
select position('Solo se puede editar una solicitud abierta' in pg_get_functiondef('public.validate_job_update()'::regprocedure))>0 as v06_job_editing_ok;

-- v0.5: estos valores son false si se decidio omitir notificaciones.
select to_regclass('public.notifications') is not null as v05_notifications_table,
       to_regclass('public.notification_preferences') is not null as v05_preferences_table,
       exists(select 1 from information_schema.triggers where trigger_name='arauka_interest_alert') as v05_interest_trigger,
       exists(select 1 from information_schema.triggers where trigger_name='arauka_job_alert') as v05_job_trigger,
       exists(select 1 from information_schema.triggers where trigger_name='arauka_consent_alert') as v05_consent_trigger;
