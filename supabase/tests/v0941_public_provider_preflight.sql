-- SOLO LECTURA. Ejecutar y exportar antes de considerar v0.9.4.1.
-- Cualquier fila blocker=true y matches=false bloquea la instalacion.
with checks(check_name,expected,observed,matches,blocker) as (
  select 'profiles existe','present',coalesce(to_regclass('public.profiles')::text,'missing'),to_regclass('public.profiles') is not null,true union all
  select 'account_experiences existe','present',coalesce(to_regclass('public.account_experiences')::text,'missing'),to_regclass('public.account_experiences') is not null,true union all
  select 'commercial_profiles existe','present',coalesce(to_regclass('public.commercial_profiles')::text,'missing'),to_regclass('public.commercial_profiles') is not null,true union all
  select 'RPC aun no instalada','absent',coalesce(to_regprocedure('public.list_public_providers()')::text,'absent'),to_regprocedure('public.list_public_providers()') is null,true union all
  select 'anon sin account_experiences','no SELECT',has_table_privilege('anon','public.account_experiences','SELECT')::text,not has_table_privilege('anon','public.account_experiences','SELECT'),true union all
  select 'anon sin commercial_profiles','no SELECT',has_table_privilege('anon','public.commercial_profiles','SELECT')::text,not has_table_privilege('anon','public.commercial_profiles','SELECT'),true union all
  select 'experiencias comerciales invalidas','0',count(*)::text,count(*)=0,true from public.account_experiences
    where (experience='maestro' and profile_kind not in ('professional','business')) or (experience='empresa' and profile_kind<>'company') union all
  select 'cuentas con Maestro y Empresa','0',count(*)::text,count(*)=0,true from (
    select user_id from public.account_experiences where experience in ('maestro','empresa') group by user_id having count(*)>1
  ) ambiguous union all
  select 'experiencias sin perfil','0',count(*)::text,count(*)=0,true from public.account_experiences e left join public.profiles p on p.id=e.user_id where p.id is null union all
  select 'prestadores sin Auth activo','0',count(*)::text,count(*)=0,true from public.account_experiences e left join auth.users u on u.id=e.user_id
    where e.experience in ('maestro','empresa') and u.id is null union all
  select 'clientes puros existentes','informativo',count(*)::text,true,false from public.account_experiences client
    where client.experience='cliente' and not exists(select 1 from public.account_experiences offering where offering.user_id=client.user_id and offering.experience in ('maestro','empresa')) union all
  select 'perfiles comerciales activos','informativo',count(*)::text,true,false from public.account_experiences where experience in ('maestro','empresa')
), result as (
  select * from checks
  union all
  select 'RESUMEN',count(*)||' comprobaciones',count(*) filter(where matches)||' coincidencias; '||count(*) filter(where not matches)||' diferencias',bool_and(matches or not blocker),true from checks
)
select * from result order by case when check_name='RESUMEN' then 1 else 0 end,check_name;
