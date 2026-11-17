# Prueba futura de eliminación en Staging

No desplegar ni habilitar el flujo actual. La política funcional está definida, pero aún deben aprobarse plazos legales y completarse el orquestador recuperable.

Cuando exista aprobación:

1. Respaldar Auth, esquema y conteos. Ejecutar primero `v095_account_deletion_dependencies.sql` y guardar el resultado.
2. En una ventana exclusiva de Staging, instalar `migration_v0.9.5_account_deletion_foundation.sql` completa. No ejecutar fragmentos.
3. Ejecutar `v095_account_deletion_audit.sql`: todos los campos `_ok` deben ser `true`, enlaces duplicados cero y solicitudes cero.
4. Repetir pruebas autenticadas de registro, perfiles, trabajos, postulaciones, evaluaciones y Empresa antes de desplegar cualquier función.
5. Completar y auditar el orquestador. La Edge Function incluida ahora es un bloqueo 503 y no elimina nada.
6. Desplegar la versión operativa únicamente en `arauka-staging` y verificar el Project ID.
7. Crear una cuenta ficticia nueva y registrar su `runId`, UUID y correo controlado.
8. Probar Cliente, Profesional, Negocio, Empresa pendiente y verificada. Crear además casos separados con trabajo compartido y revisor.
9. Reautenticar, escribir `ELIMINAR` y ejecutar una sola vez. No reintentar hasta consultar el estado.
10. Comprobar individualmente Auth, todas las tablas y los prefijos `<uuid>/` en ambos buckets.
11. Confirmar que el actor histórico está anonimizado y que ninguna contraparte perdió trabajos, participación o rating.
12. Sólo entonces intentar registrar nuevamente el mismo correo.

## Recuperación

- Antes de `database_anonymized`: corregir el fallo y reanudar por el mismo `request_id`.
- En `database_anonymized` con Auth presente: no informar éxito; completar cascadas privadas y eliminación Auth.
- Auth eliminado con Storage pendiente no es aceptable para habilitación: el futuro trabajador debe poder retomar por `request_id` sin sesión del usuario.
- `blocked_active_agreement` requiere resolver el trabajo emparejado; nunca forzar el borrado desde el navegador.

## Respaldo y reversión

Antes de instalar la base candidata, exportar esquema y datos de `profiles`, `jobs`, `interests`, `reviews`, `portfolio`, `verifications`, tablas v0.9, revisores, notificaciones y Auth; inventariar objetos de ambos buckets y guardar conteos. El respaldo debe mantenerse fuera del repositorio y con acceso restringido.

Antes de ejecutar cualquier anonimización, la reversión estructural puede restaurar la FK `profiles.id -> auth.users(id) ON DELETE CASCADE` sólo si `account_deletion_requests` está vacía, ningún perfil tiene `deleted_at` y todos los perfiles tienen un Auth correspondiente. Se deben restaurar además las policies desde v0.9/v0.9.2 y retirar funciones/tablas v0.9.5 en una transacción revisada.

Después de anonimizar o borrar Auth no existe reversión lógica segura: se requiere restauración completa desde respaldo coordinando PostgreSQL, Auth y Storage. Por eso la primera prueba debe hacerse únicamente con datos ficticios descartables y un proyecto Staging respaldado.

La consulta `supabase/tests/v095_account_deletion_dependencies.sql` es de solo lectura. No usar borrados masivos para limpiar residuos.
