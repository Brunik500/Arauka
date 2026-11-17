-- ARAUKA v0.9.2 - privilegios SQL integrales para esquema base y notificaciones.
-- Aplicar despues de v0.9.1. Solo modifica GRANT/REVOKE; no cambia filas ni RLS.

begin;

do $$
declare missing_table text;
begin
  select name into missing_table
  from unnest(array[
    'profiles','jobs','interests','reviews','portfolio','verifications',
    'private_contacts','notifications','notification_preferences',
    'account_identities','account_experiences','commercial_profiles','company_documents'
  ]) as required(name)
  where to_regclass('public.'||name) is null
  limit 1;
  if missing_table is not null then
    raise exception 'Falta tabla requerida public.%',missing_table;
  end if;
end $$;

grant usage on schema public to anon,authenticated,service_role;

-- Reinicio de privilegios de tabla base. RLS y policies permanecen habilitados.
revoke all on table
  public.profiles,public.jobs,public.interests,public.reviews,public.portfolio,
  public.verifications,public.private_contacts,public.notifications,
  public.notification_preferences
from public,anon,authenticated,service_role;

-- Lectura publica deliberada: solo tablas cuyo contenido ya tiene policy publica.
grant select on public.profiles,public.jobs,public.reviews,public.portfolio,public.verifications to anon;

-- Usuario autenticado: privilegios necesarios para la app y el arnes. Las policies
-- RLS siguen decidiendo que filas puede operar y los triggers validan transiciones.
grant select on public.profiles,public.jobs,public.reviews,public.portfolio,public.verifications to authenticated;
grant update(display_name,company_name,bio,categories,service_localities) on public.profiles to authenticated;

grant insert,update on public.jobs to authenticated;

grant select,insert,update on public.interests to authenticated;

grant insert on public.reviews to authenticated;

grant insert,delete on public.portfolio to authenticated;

grant select,insert,update on public.private_contacts to authenticated;

grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

grant select,insert on public.notification_preferences to authenticated;
grant update(email_enabled,updated_at) on public.notification_preferences to authenticated;

-- service_role no recibe acceso general a estas tablas. Sus operaciones del arnes
-- siguen limitadas a Auth Admin y commercial_profiles segun v0.9.1.

notify pgrst,'reload schema';
commit;
