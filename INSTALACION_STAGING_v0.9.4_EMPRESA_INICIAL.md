# ARAUKA v0.9.4 — Registro inicial de Empresa

## Diagnóstico

La evidencia real mostró `raw_user_meta_data.initial_experience=client`. El backend no cambió Empresa a Cliente: recibió Cliente. En el frontend, `registrationChoice` comenzaba en `client` y algunas entradas abrían Crear cuenta mediante `requestAuth()` sin fijar la intención según el panel. Al mismo tiempo, la pantalla de confirmación mostraba `activeIdentityLabel`, derivado de la ruta Empresa, no el valor efectivamente enviado. Así podía informar Empresa mientras `signUp` persistía `client`.

La corrección frontend hace que el selector, la apertura del modal, el payload de `signUp`, el texto posterior y el destino inmediato usen una única elección capturada. Los valores de Auth son `client`, `professional`, `business` y `company`; las rutas y enums SQL siguen usando `cliente`, `maestro` y `empresa`.

En v0.9, `create_profile_for_user` sigue siendo el punto que convierte esa elección en una experiencia. Tras confirmar el correo no había reconciliación: `activate_experience` permite Cliente, Profesional y Negocio, pero excluye Empresa, y el frontend confiaba en `my_account_experiences`.

La corrección no es una redirección. v0.9.4 registra una intención inicial privada durante el trigger, conserva Cliente, crea Empresa como `company`, y expone una RPC idempotente para completar esa intención después de autenticar. La RPC no crea un perfil comercial, no toca documentos y no concede verificación.

## Instalación en Staging

1. Validar primero el frontend corregido localmente y confirmar en sus pruebas que una selección Empresa produce exactamente `initial_experience=company`. La migración no corrige un payload `client`.
2. Confirmar respaldo y conteos de `profiles`, `account_identities`, `account_experiences`, `commercial_profiles` y `company_documents`.
3. Ejecutar `supabase/migration_v0.9.4_initial_company_registration.sql` una sola vez en SQL Editor.
4. Ejecutar `supabase/tests/v094_initial_company_audit.sql`. Todas las columnas `_ok` deben devolver `true`; `invalid_company_experiences` debe ser cero. `company_experiences_without_recorded_initial_intent` es un conteo diagnóstico para cuentas anteriores a v0.9.4 y no debe corregirse masivamente.
5. Publicar o ejecutar localmente el frontend v0.9.4 solamente después de instalar la migración. La versión nueva invoca `complete_initial_company_activation` al ingresar una cuenta cuya selección inicial fue Empresa.
6. Repetir el arnés empresarial solo después de la auditoría. El arnés comprueba dos invocaciones idempotentes, coexistencia Cliente/Empresa, denegación a Negocio y estado empresarial `pending`.

## Cuenta ficticia afectada

No modificarla hasta ejecutar la consulta comentada de diagnóstico en `v094_initial_company_audit.sql` con su UUID exacto.

- Para la cuenta observada, `auth_metadata_choice=client`; por tanto, el frontend corregido y la RPC no deben convertirla automáticamente en Empresa. Hace falta revisión administrativa de la evidencia antes de provisionar una intención mediante SQL revisado y ejecutado por el propietario de la base; `service_role` no tiene INSERT, UPDATE ni DELETE sobre esta tabla.
- Si otra cuenta tiene `auth_metadata_choice=company` pero `recorded_intent` vacío, tampoco se recupera automáticamente porque confiar retrospectivamente en metadata editable debilitaría la autorización. Un administrador autorizado puede registrar, después de verificar identidad, fecha y evidencia del QA, una única intención exacta en `account_registration_intents`; luego el propio usuario ejecuta la RPC al iniciar sesión.
- Si ya existe `recorded_intent=company`, basta iniciar sesión con el frontend corregido; la RPC agrega la experiencia de forma idempotente.

La provisión administrativa debe dirigirse a un UUID único, quedar documentada y evitar cualquier operación masiva. Este repositorio no incluye un `INSERT` listo para ejecutar para impedir que se use sin la revisión previa.

## Reversión

Si la instalación falla antes de `COMMIT`, PostgreSQL revierte todo el parche. Si falla la aplicación después de instalarlo, volver temporalmente al frontend anterior; la tabla y RPC nuevas son aditivas. No eliminar experiencias creadas. Para retirar definitivamente la RPC, dejar primero de invocarla y restaurar la función del trigger desde v0.9 bajo una ventana de mantenimiento revisada.
