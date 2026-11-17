# Instalación segura de `arauka-staging`

Este procedimiento corresponde a un proyecto Supabase vacío. Todos los archivos se ejecutan completos desde SQL Editor, uno por uno, esperando éxito antes de continuar. No ejecutar los dos archivos duplicados de v0.5.

Si `schema.sql` falla a mitad de ejecución, no continuar ni volver a ejecutarlo a ciegas: sus tablas usan `IF NOT EXISTS`, pero sus policies no son reejecutables. Al ser staging vacío, la recuperación más segura es restablecer/recrear la base vacía y comenzar nuevamente; alternativamente, inventariar y retirar de forma explícita solo los objetos parciales.

## Secuencia recomendada

1. `supabase/schema.sql` — obligatorio. Crea el esquema funcional v0.4, extensión `pgcrypto`, tablas base, índices, triggers, RLS, bucket `portfolio` y RPC de contacto.
2. `supabase/migration_v0.6_job_editing.sql` — obligatorio para el baseline seguro usado por las pruebas v0.9. Depende de `jobs`, `interests`, `validate_job_update` y su trigger creados por `schema.sql`.
3. `supabase/migration_v0.5_notifications.sql` — obligatorio para reproducir la aplicación completa y probar notificaciones; técnicamente opcional para las tablas de identidad v0.9. Depende de `auth.users`, `jobs` e `interests` del esquema base. No ejecutar también `ARAUKA_migracion_v0.5_notifications.sql`: tiene el mismo SHA-256 y es una copia histórica.
4. `supabase/tests/base_install_check.sql` — solo lectura. Debe confirmar esquema base, RLS, v0.6 y, si se eligió v0.5, sus tablas y tres triggers.
5. `supabase/tests/v09_preflight_audit.sql` — solo lectura. Este es el preflight exacto: se ejecuta después de instalar todo el baseline elegido y justo antes de v0.9.
6. `supabase/migration_v0.9_identity_experiences.sql` — obligatorio. Ejecutarlo completo; contiene su propia transacción y aborta sin cambios si detecta una precondición inválida.
7. `supabase/tests/v09_postflight_audit.sql` — solo lectura e inmediatamente después de v0.9. No crear usuarios de prueba antes de comprobar que `missing_identity`, `missing_client`, `missing_legacy_professional` e `invalid_primary` son cero.
8. `npm.cmd run test:supabase:v09` — prueba autenticada manual posterior al postflight; no es SQL Editor y requiere exclusivamente credenciales del proyecto de ensayo.

## Migración v0.7

`supabase/migration_v0.7_transactional_email.sql` no es dependencia de v0.9. Depende obligatoriamente de v0.5 y además intenta habilitar `pg_cron` y `pg_net`; sus funciones esperan secretos posteriores en Supabase Vault. Para la primera validación de identidad/RLS debe omitirse. Instalarla después de v0.5 solamente si el alcance incluye entrega transaccional de correo, y comprobar por separado extensiones, funciones, permisos de `service_role` y Vault. No es necesario programar cron para probar identidades.

## Criterio de aprobación por etapa

- Tras `schema.sql`: siete tablas base, RLS activo en todas, cuatro funciones, tres triggers, policies nombradas y bucket público `portfolio`.
- Tras v0.6: `pg_get_functiondef(public.validate_job_update())` contiene la restricción de edición de solicitudes abiertas sin profesional seleccionado.
- Tras v0.5: existen `notifications`, `notification_preferences`, cinco policies y tres triggers de notificación. El frontend puede leer su bandeja.
- Tras preflight: no hay policies INSERT/ALL inesperadas en `jobs`, `interests` o `portfolio`; los conteos base quedan registrados.
- Tras v0.9: existen cuatro tablas nuevas, todos los perfiles históricos tienen identidad y Cliente, los profesionales históricos tienen Maestro y ninguna experiencia principal apunta a una capacidad ausente.

## RLS automático de Supabase

Los scripts no dependen de una opción automática de la interfaz: `schema.sql` y v0.9 ejecutan explícitamente `ENABLE ROW LEVEL SECURITY` y crean sus policies. En un proyecto vacío creado desde SQL Editor esto es compatible.

La posible interferencia no es que RLS esté habilitado dos veces —esa operación es idempotente— sino que el proyecto haya creado policies adicionales. Las policies permisivas se combinan mediante OR. Por eso:

- revisar `pg_policies` con `base_install_check.sql` y el preflight;
- no crear tablas ARAUKA previamente desde Table Editor;
- no aceptar plantillas automáticas que agreguen policies INSERT amplias;
- si v0.9 aborta por una policy desconocida, detenerse y revisarla; no borrarla a ciegas.

Si la interfaz muestra RLS activo pero sin policies antes del paso 1, no afecta. Si ya existen tablas o policies ARAUKA, el proyecto no debe tratarse como vacío y hay que inventariarlo antes de ejecutar `schema.sql`, porque las policies base de ese archivo no usan `DROP POLICY IF EXISTS`.

## Estado de archivos base

No falta SQL base. `supabase/schema.sql` contiene todas las estructuras que las migraciones v0.5, v0.6 y v0.9 referencian. No se creó un esquema alternativo para evitar divergencias.
