# ARAUKA v0.9.2 — privilegios base y validacion en Staging

## Diagnostico

`schema.sql` habilitaba RLS y creaba policies, pero no concedia a `anon` ni a
`authenticated` los privilegios SQL de las tablas base. PostgreSQL comprueba el
`GRANT` antes de evaluar RLS; por eso el `INSERT` autenticado en `jobs` termino
con `42501`, aunque la policy de capacidad de contratacion era correcta.

El parche v0.9.2 solo modifica privilegios. No deshabilita RLS, no crea policies
permisivas, no modifica datos y no concede privilegios administrativos.

## Matriz efectiva esperada

Leyenda: `S` SELECT, `I` INSERT, `U` UPDATE, `D` DELETE. Una operacion concedida
sigue limitada por RLS y, donde corresponde, por triggers.

| Objeto | anon | authenticated | service_role |
|---|---|---|---|
| profiles | S | S, U solo columnas publicas editables | — |
| jobs | S | S, I, U | — |
| interests | — | S, I, U | — |
| reviews | S | S, I | — |
| portfolio | S | S, I, D | — |
| verifications | S | S | — |
| private_contacts | — | S, I, U | — |
| notifications | — | S, U solo `read_at` | — |
| notification_preferences | — | S, I, U solo `email_enabled`, `updated_at` | — |
| account_identities | — | S | S |
| account_experiences | — | S | S |
| commercial_profiles | — | S | S; I/U solo columnas administrativas de v0.9.1 |
| company_documents | — | S, I | S |
| my_account_experiences | — | S | — |

`service_role` no recibe acceso general a las tablas base. El arnes lo usa para
Auth Admin y para preparar/revisar `commercial_profiles`; las acciones normales
se ejecutan con la sesion JWT de cada usuario ficticio.

No hay secuencias propias: las claves primarias del modelo usan UUID. Los enums
v0.9 conservan `USAGE` para `authenticated` y `service_role`, pero no para
`anon`. Los RPC `get_shared_contact`, `activate_experience` y
`set_primary_experience` son ejecutables por `authenticated`, no por `anon`.

## Por que los GRANT no eluden RLS

- `jobs` I exige por policy que el usuario sea dueño y tenga experiencia
  `cliente` o `empresa` activa. Un profesional sin esa capacidad sigue denegado.
- `interests` I exige experiencia `maestro` o `empresa`, un trabajo abierto y
  que el postulante no sea su dueño.
- `profiles` U queda restringido tanto por fila propia como por columnas; no se
  concede `is_professional`.
- `commercial_profiles.verification_status` no es actualizable por
  `authenticated`; solo las columnas administrativas expresas de `service_role`.
- Contactos, notificaciones y documentos conservan policies de propietario.
- Evaluaciones requieren un trabajo completado y seleccionado.

## Instalacion segura en `arauka-staging`

1. No reutilizar una pestaña del SQL Editor conectada a otro proyecto. Confirmar
   visualmente que el proyecto activo es `arauka-staging`.
2. Ejecutar primero, sin modificaciones,
   `supabase/migration_v0.9.2_base_privileges.sql`. Debe finalizar sin filas
   afectadas y sin excepciones. Si falta cualquiera de las 13 tablas requeridas,
   la transaccion aborta completamente.
3. Ejecutar `supabase/tests/v09_full_privileges_audit.sql`. Es solo lectura.
   Todas las columnas terminadas en `_ok` deben ser `true`, las 13 tablas deben
   mostrar `exists_ok=true` y `rls_enabled=true`, y la consulta final de
   secuencias debe devolver cero filas.
4. Revisar que el listado de policies siga conteniendo las policies existentes;
   v0.9.2 no debe haber agregado ni eliminado ninguna.
5. Ejecutar `supabase/tests/v09_residual_test_users.sql`. Para el run
   `6a85d18f-fe15-41bb-845a-20b12a8af0cb`, revisar cada correo, UUID y fecha. El
   `finally` del arnes normalmente elimina sus seis cuentas, pero el fallo pudo
   interrumpir o dejar una limpieza incierta.
6. Si hay residuales, eliminarlos uno por uno desde **Auth > Users**, solo tras
   comprobar que el correo comienza exactamente con
   `arauka-v09-6a85d18f-fe15-41bb-845a-20b12a8af0cb-` y termina en
   `@example.invalid`. No ejecutar `DELETE` masivo.
7. Solo después de que la auditoria sea totalmente correcta y no haya cuentas
   residuales dudosas, ejecutar desde la terminal integrada de VS Code:

   ```powershell
   npm run test:supabase:v09
   ```

El resultado esperado es la aprobacion de las pruebas principales y la limpieza
individual de las seis cuentas del nuevo run. Si vuelve a aparecer `42501`, no
agregar un GRANT ad hoc: conservar el run ID, detenerse y comparar el objeto y la
operacion con la matriz.

## Instalaciones limpias futuras

`supabase/schema.sql` incorpora ahora los privilegios de las siete tablas base.
`migration_v0.5_notifications.sql` mantiene los grants de notificaciones y
preferencias. `migration_v0.9_identity_experiences.sql` mantiene los grants de
identidad, experiencias y empresa. El parche v0.9.1 sigue siendo necesario para
una base v0.9 ya instalada con la version previa; v0.9.2 corrige bases existentes
que instalaron el esquema base sin grants.
