# ARAUKA v0.9 — identidad y experiencias

## Modelo

- `auth.users`: única identidad autenticada.
- `profiles`: perfil personal histórico, conservado sin cambios destructivos.
- `account_identities`: experiencia principal elegida explícitamente.
- `account_experiences`: capacidades habilitadas (`cliente`, `maestro`, `empresa`) y clase pública del perfil.
- `commercial_profiles`: datos profesionales, de negocio o empresa separados de los datos personales.
- `company_documents` y bucket privado `company-documents`: metadatos y archivos de respaldo.
- `verification_status`: solo administración puede cambiarlo a `verified`; validar el RUT no verifica existencia.

El hash conserva navegación y F5, pero no concede capacidades. Supabase decide qué experiencias y acciones están autorizadas.

## Orden exacto de despliegue

1. En un proyecto vacío, instalar `supabase/schema.sql` y después v0.6. Instalar v0.5 si se probarán notificaciones. v0.7 es opcional y no es dependencia de identidad.
2. Ejecutar `supabase/tests/base_install_check.sql` y `supabase/tests/v09_preflight_audit.sql`.
3. En ensayo, ejecutar `supabase/migration_v0.9_identity_experiences.sql` completo desde SQL Editor con un rol administrativo.
4. Ejecutar inmediatamente `supabase/tests/v09_postflight_audit.sql`.
5. Comprobar las filas generadas en `account_identities` y `account_experiences`; no clasificar manualmente todavía ninguna cuenta como empresa.
6. Identificar a NOBRO por su UUID confirmado por el propietario, nunca por texto o correo. Cambiar su fila `maestro` de `professional` a `business` y su `commercial_profiles.profile_kind` a `business` en una revisión manual. Esta asignación queda pendiente.
7. Probar cuentas de ensayo y las llamadas directas rechazadas por RLS.
8. Publicar el frontend solo después de aprobar ensayo. Tiene fallback de lectura para el esquema anterior, pero las garantías nuevas del backend existen únicamente después de v0.9.
9. No hacer pública documentación empresarial. La revisión administrativa de documentos requiere un flujo separado con service role fuera del navegador.

## Compatibilidad

Los perfiles existentes reciben Cliente para conservar su capacidad histórica de publicar. Los que tienen `is_professional=true` reciben además Profesional y esta queda principal. Esto no los convierte en empresa. Trabajos, postulaciones, evaluaciones, portafolio y notificaciones no se modifican.

La migración no tiene rollback automático para evitar borrar datos posteriores. El procedimiento técnico está comentado al final del SQL y exige restaurar primero las políticas anteriores.

## Pendientes antes de producción

- Completar y revisar el formulario detallado de antecedentes empresariales y su RPC de actualización por campos permitidos.
- Implementar el flujo administrativo autenticado para revisar documentos y otorgar `verified`.
- Confirmar el UUID real de NOBRO y aplicar su clasificación manual.
- Ejecutar pruebas RLS con usuarios reales de ensayo en Supabase; no se simularon conexiones remotas.
