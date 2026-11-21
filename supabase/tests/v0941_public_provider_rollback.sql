-- ROLLBACK CANDIDATO. MODIFICA ESQUEMA: ejecutar solo con aprobacion separada.
-- Primero restaurar el frontend anterior; esta operacion no modifica datos.
begin;
do $$ begin
  if to_regprocedure('public.list_public_providers()') is null then
    raise exception 'public.list_public_providers() no existe; no hay nada que retirar';
  end if;
end $$;
revoke all on function public.list_public_providers() from public,anon,authenticated,service_role;
drop function public.list_public_providers();
notify pgrst,'reload schema';
commit;
