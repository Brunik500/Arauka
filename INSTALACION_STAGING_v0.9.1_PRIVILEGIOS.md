# ARAUKA staging — corrección de privilegios v0.9.1

## Causa

`service_role` omite RLS, pero PostgreSQL exige además privilegios SQL. v0.9 no concedía a ese rol INSERT/UPDATE sobre `commercial_profiles`, por lo que el arnés falló con `42501` al crear los perfiles empresariales ficticios.

## Operaciones por tabla

| Tabla | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `account_identities` | Ninguna | SELECT propio por RLS | SELECT |
| `account_experiences` | Ninguna | SELECT propio por RLS | SELECT |
| `commercial_profiles` | Ninguna | SELECT propio por RLS | SELECT; INSERT por columnas empresariales; UPDATE solo de verificación |
| `company_documents` | Ninguna | SELECT/INSERT propio y solo Empresa por RLS | SELECT |

No se concede DELETE sobre ninguna tabla nueva. `authenticated` no recibe INSERT/UPDATE de `commercial_profiles`, por lo que no puede autoverificarse. Las activaciones y experiencia principal siguen pasando por RPC `SECURITY DEFINER`.

## Instalación en `arauka-staging`

1. No repetir todavía el arnés.
2. Revisar los usuarios residuales del run fallido con la consulta exacta indicada abajo.
3. Ejecutar completo `supabase/migration_v0.9.1_privileges.sql` desde SQL Editor. Es incremental, transaccional y no modifica filas ni policies.
4. Ejecutar completo `supabase/tests/v09_privileges_audit.sql`.
5. Confirmar que todas las columnas terminadas en `_ok` devuelven `true`, que `anon` no aparece con grants y que no aparecen secuencias nuevas.
6. Volver a ejecutar `supabase/tests/v09_postflight_audit.sql`; los cuatro conteos de integridad deben seguir en cero.
7. Solo después, configurar nuevamente las variables de staging y ejecutar una vez el arnés.

`NOTIFY pgrst, 'reload schema'` está incluido para refrescar la caché de PostgREST después de los GRANT.

## Revisión exacta del run residual

Ejecutar primero esta consulta de solo lectura:

```sql
select id,email,created_at,last_sign_in_at,
       raw_user_meta_data->>'display_name' as display_name
from auth.users
where email like 'arauka-v09-6b587c36-e090-4f4e-a2e5-4818607699ba-%@example.invalid'
order by created_at desc;
```

Por el punto exacto del fallo, el arnés probablemente alcanzó a crear las seis cuentas Auth y luego falló al insertar el primer `commercial_profiles`. El bloque `finally` debió intentar borrarlas, pero hay que comprobarlo.

Si aparecen filas, revisar individualmente UUID, correo, fecha, nombre y `runId`. Eliminar cada cuenta confirmada desde Auth > Users. No ejecutar DELETE SQL, no seleccionar otros runs y no hacer limpieza por dominio.

## Dependencias

- No hay secuencias: los identificadores usan UUID y `gen_random_uuid()`.
- Los triggers y funciones `SECURITY DEFINER` usan privilegios del propietario y no necesitan grants de escritura para `authenticated`.
- `service_role` necesita `USAGE` del esquema y privilegios PostgREST explícitos; omitir RLS no sustituye esos GRANT.
- Los objetos de `storage` no cambian en v0.9.1.
