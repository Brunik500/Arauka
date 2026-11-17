# Instalación estructural v0.9.5 — Sólo Staging

Esta guía no autoriza la eliminación de cuentas ni el despliegue de la Edge Function.

## Antes de la ventana

1. Detener registros y escrituras de prueba durante la instalación.
2. Preparar y verificar el punto de recuperación descrito en `RESPALDO_RESTAURACION_STAGING_v0.9.5.md`; un CSV no equivale a un respaldo.
3. Ejecutar `v095_fk_topology_audit.sql` y exportar el resultado a CSV. Exigir cero diferencias y cero bloqueos.
4. Ejecutar `v095_structural_preflight.sql` y exportar el resultado a CSV. Exigir `preflight_structural_ok=true` en todas las filas.
5. Ejecutar `v095_account_deletion_dependencies.sql` como inventario bruto complementario.
6. Confirmar `profiles_without_auth_user = 0` y que no existe ningún objeto parcial v0.9.5. Ante una diferencia, detenerse; no ejecutar fragmentos.
7. Completar `PREFLIGHT_STAGING_v0.9.5.md` y obtener una autorización separada. Esta guía por sí sola no autoriza instalar.

## Instalación

1. Ejecutar el archivo completo `migration_v0.9.5_account_deletion_foundation.sql` en una sola operación.
2. No cerrar SQL Editor hasta recibir `COMMIT`.
3. La migración puede tomar locks fuertes al agregar columnas, cambiar la FK de `profiles`, validar nuevas FK, crear el índice único y reemplazar policies. Ejecutarla sin tráfico y con tiempo de espera controlado.
4. Ante cualquier error, verificar que la transacción revirtió. No corregir manualmente a mitad de instalación.

## Postflight

1. Ejecutar `v095_account_deletion_audit.sql` completo.
2. Todos los campos `_ok` deben ser `true`.
3. Antes de cualquier eliminación: `profiles_without_auth_link`, `profiles_with_mismatched_auth_link`, `duplicated_auth_links`, solicitudes y casos de retención deben ser cero.
4. Comparar los nueve conteos con el preflight; deben ser idénticos.
5. Ejecutar las pruebas autenticadas de compatibilidad de `PRUEBAS_AUTENTICADAS_STAGING_v0.9.5.md` sin probar eliminación.

## Reversión antes de eliminar

Sólo si no existen solicitudes, perfiles eliminados ni casos de retención: restaurar en una transacción las policies previas, retirar funciones/triggers/tablas v0.9.5, eliminar la FK `auth_user_id`, restaurar `profiles.id -> auth.users(id) ON DELETE CASCADE` y retirar las columnas/índice nuevos. Comparar conteos y repetir los arneses v0.9–v0.9.4.

No usar esta reversión después de anonimizar, borrar Storage o eliminar Auth. En ese punto se requiere restauración coordinada desde respaldo.
