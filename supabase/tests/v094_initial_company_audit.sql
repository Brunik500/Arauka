-- SOLO LECTURA. Ejecutar despues de migration_v0.9.4_initial_company_registration.sql.

select p.oid::regprocedure installed_signature,p.prosecdef,
       r.rolname function_owner,p.proconfig,
       pg_get_functiondef(p.oid) function_definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='public' and p.proname in
  ('create_profile_for_user','complete_initial_company_activation')
order by p.proname;

select
  has_function_privilege('authenticated','public.complete_initial_company_activation()','EXECUTE') as auth_company_activation_ok,
  not has_function_privilege('anon','public.complete_initial_company_activation()','EXECUTE') as anon_company_activation_denied_ok,
  not has_function_privilege('service_role','public.complete_initial_company_activation()','EXECUTE') as service_company_activation_denied_ok,
  not has_function_privilege('authenticated','public.create_profile_for_user()','EXECUTE') as auth_trigger_direct_denied_ok,
  not has_function_privilege('anon','public.create_profile_for_user()','EXECUTE') as anon_trigger_direct_denied_ok;

select count(*)=2 as secure_definer_functions_ok
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='public'
  and p.proname in ('create_profile_for_user','complete_initial_company_activation')
  and p.prosecdef
  and p.proconfig @> array['search_path=pg_catalog, public']
  and r.rolname not in ('anon','authenticated','service_role');

-- El search_path privilegiado no debe resolver objetos temporales ni depender del
-- search_path de quien invoca la funcion.
select count(*)=0 as secure_definer_has_no_temp_path_ok
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('create_profile_for_user','complete_initial_company_activation')
  and coalesce(array_to_string(p.proconfig,','),'') ~ '(^|,| )pg_temp(,|$)';

select c.relrowsecurity as registration_intents_rls_ok,
       not (has_table_privilege('authenticated','public.account_registration_intents','SELECT') or
            has_table_privilege('authenticated','public.account_registration_intents','INSERT') or
            has_table_privilege('authenticated','public.account_registration_intents','UPDATE') or
            has_table_privilege('authenticated','public.account_registration_intents','DELETE')) as auth_intents_denied_ok,
       not (has_table_privilege('anon','public.account_registration_intents','SELECT') or
            has_table_privilege('anon','public.account_registration_intents','INSERT') or
            has_table_privilege('anon','public.account_registration_intents','UPDATE') or
            has_table_privilege('anon','public.account_registration_intents','DELETE')) as anon_intents_denied_ok,
       (has_table_privilege('service_role','public.account_registration_intents','SELECT') and
        not has_table_privilege('service_role','public.account_registration_intents','INSERT') and
        not has_table_privilege('service_role','public.account_registration_intents','UPDATE') and
        not has_table_privilege('service_role','public.account_registration_intents','DELETE')) as service_intents_provision_ok
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='account_registration_intents';

select count(*)=1 as auth_trigger_link_ok
from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid='auth.users'::regclass and t.tgname='trigger_create_arauka_profile'
  and not t.tgisinternal and n.nspname='public' and p.proname='create_profile_for_user';

select count(*)=0 as registration_intents_has_no_user_policies_ok
from pg_policies where schemaname='public' and tablename='account_registration_intents';

select r.rolname not in ('anon','authenticated','service_role') as registration_intents_owner_ok
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_roles r on r.oid=c.relowner
where n.nspname='public' and c.relname='account_registration_intents';

-- Diagnostico dirigido para una cuenta afectada. Reemplazar el UUID solo en Staging.
-- No modifica datos y no debe compartirse el resultado fuera del equipo autorizado.
-- select u.id,u.raw_user_meta_data->>'initial_experience' auth_metadata_choice,
--        r.initial_experience recorded_intent,
--        i.primary_experience,e.experience,e.profile_kind
-- from auth.users u
-- left join public.account_registration_intents r on r.user_id=u.id
-- left join public.account_identities i on i.user_id=u.id
-- left join public.account_experiences e on e.user_id=u.id
-- where u.id='00000000-0000-0000-0000-000000000000'::uuid;

select count(*) filter(where e.experience='empresa' and e.profile_kind='company') company_experiences,
       count(*) filter(where e.experience='empresa' and e.profile_kind<>'company') invalid_company_experiences
from public.account_experiences e;

select count(*) filter(where r.initial_experience='company' and e.user_id is null) company_intents_pending_reconciliation
from public.account_registration_intents r
left join public.account_experiences e on e.user_id=r.user_id and e.experience='empresa' and e.profile_kind='company';

-- Es diagnostico, no prueba de fraude: instalaciones anteriores pueden contener
-- empresas legitimas creadas antes de que existiera la tabla de intenciones.
select count(*) as company_experiences_without_recorded_initial_intent
from public.account_experiences e
left join public.account_registration_intents r on r.user_id=e.user_id
where e.experience='empresa' and e.profile_kind='company'
  and r.initial_experience is distinct from 'company';
