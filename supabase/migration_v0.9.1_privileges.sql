-- ARAUKA v0.9.1 - correccion incremental de privilegios SQL.
-- Aplicar SOLO despues de migration_v0.9_identity_experiences.sql.
-- No modifica filas, policies RLS, estados de verificacion ni documentos.

begin;

do $$
begin
  if to_regclass('public.account_identities') is null
     or to_regclass('public.account_experiences') is null
     or to_regclass('public.commercial_profiles') is null
     or to_regclass('public.company_documents') is null then
    raise exception 'Falta una o mas tablas v0.9; aplicar primero migration_v0.9_identity_experiences.sql';
  end if;
end $$;

-- Reinicia los privilegios de tabla de las cuatro estructuras nuevas. Las policies
-- permanecen intactas. No se concede ninguna operacion a anon.
revoke all on table public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents from public,anon,authenticated,service_role;
revoke usage on type public.arauka_profile_kind,public.arauka_experience,public.arauka_verification_status from public,anon;
grant usage on type public.arauka_profile_kind,public.arauka_experience,public.arauka_verification_status to authenticated,service_role;

-- Usuario normal: lectura limitada por RLS y alta de metadatos documentales propios.
grant select on public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents to authenticated;
grant insert on public.company_documents to authenticated;

-- Administración de ensayo/backend: RLS bypass no sustituye los GRANT SQL.
-- Solo lectura general y las columnas necesarias para crear/revisar una empresa.
grant usage on schema public to service_role;
grant select on public.account_identities,public.account_experiences,public.commercial_profiles,public.company_documents to service_role;
grant insert(user_id,profile_kind,public_name,legal_name,tax_id,legal_type,economic_activity,tax_address,municipality,region,representative_name,contact_email,business_phone,coverage,services,verification_status)
  on public.commercial_profiles to service_role;
grant update(verification_status,verification_reviewed_at,verification_reviewed_by)
  on public.commercial_profiles to service_role;

-- No hay secuencias nuevas: todos los identificadores usan UUID/gen_random_uuid().
-- Las RPC SECURITY DEFINER conservan sus grants EXECUTE definidos por v0.9.

notify pgrst,'reload schema';
commit;
