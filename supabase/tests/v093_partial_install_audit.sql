-- SOLO LECTURA. Ejecutar antes de reintentar v0.9.3.
-- Si el intento anterior se ejecuto completo dentro de BEGIN/COMMIT y fallo, todos
-- los objetos v0.9.3 deben aparecer ausentes. No elimina ni modifica nada.

select to_regclass('public.administrative_reviewers') administrative_reviewers,
       to_regclass('public.verified_companies') verified_companies;

select p.oid::regprocedure as installed_signature,p.pronargs,
       oidvectortypes(p.proargtypes) as identity_argument_types,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('upsert_my_company_profile','review_company_verification','is_administrative_reviewer')
order by p.proname,p.oid;

select schemaname,tablename,policyname,cmd
from pg_policies
where (schemaname='public' and policyname='documents administrative read')
   or (schemaname='storage' and policyname='company documents administrative read')
order by schemaname,tablename,policyname;

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('administrative_reviewers','verified_companies')
  and grantee in ('anon','authenticated','service_role')
order by table_name,grantee,privilege_type;
