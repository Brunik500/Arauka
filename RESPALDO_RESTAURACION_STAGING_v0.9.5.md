# Respaldo y restauración de `arauka-staging` antes de v0.9.5

Proyecto exclusivo: `arauka-staging` (`qviiiomipsulvjpstyzw`). Esta guía prepara el respaldo; no autoriza ejecutarlo ni instalar v0.9.5.

## Qué constituye un respaldo recuperable

Un CSV de tablas no basta. El punto de recuperación debe cubrir coordinadamente:

1. PostgreSQL: esquema, datos, roles, funciones, triggers, RLS, grants, tipos y secuencias.
2. Auth: usuarios, identidades y metadatos Auth. El volcado lógico estándar de Supabase CLI excluye por defecto esquemas administrados como `auth` y `storage`; no debe presentarse como respaldo Auth completo.
3. Storage: los binarios reales de `portfolio` y `company-documents`, además de `storage.buckets`, `storage.objects`, rutas, MIME, tamaño y checksum. Los backups de base de datos conservan metadatos, no los archivos Storage.
4. Configuración no contenida en la base: Auth, URLs de redirección, proveedores, secretos, Edge Functions y variables. Inventariar nombres y valores no secretos; los secretos se restauran desde el gestor autorizado.

Referencias oficiales: [Database backups](https://supabase.com/docs/guides/platform/backups), [backup/restore mediante CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [restaurar a un proyecto nuevo](https://supabase.com/docs/guides/platform/clone-project) y [descarga de objetos Storage](https://supabase.com/docs/guides/storage/management/download-objects).

## Preparación segura

- Crear una carpeta cifrada fuera del repositorio y fuera de carpetas sincronizadas públicamente.
- Instalar una versión fija y registrada de Supabase CLI y comprobar `supabase --version`.
- Obtener el connection string de Staging en el Dashboard. No copiarlo a `.env`, scripts, historial ni documentación.
- Usar credenciales de Staging de duración mínima y limpiar las variables del proceso al terminar.
- Pausar escrituras de ensayo durante el punto de respaldo para que PostgreSQL, Auth y Storage representen el mismo instante lógico.
- Guardar los CSV producidos por `v095_fk_topology_audit.sql`, `v095_structural_preflight.sql` y `v095_account_deletion_dependencies.sql`.

## Captura PostgreSQL lógica complementaria

En una consola situada en la carpeta cifrada externa, adaptar los comandos oficiales a la versión instalada:

```powershell
$backupRoot = Read-Host 'Ruta absoluta de la carpeta cifrada de respaldo'
$dbUrlSecure = Read-Host 'Connection string de arauka-staging' -AsSecureString
$dbUrlPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbUrlSecure)
try {
  $env:ARAUKA_STAGING_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbUrlPtr)
  supabase db dump --remote="$env:ARAUKA_STAGING_DB_URL" -f "$backupRoot\roles.sql" --role-only
  supabase db dump --remote="$env:ARAUKA_STAGING_DB_URL" -f "$backupRoot\schema.sql"
  supabase db dump --remote="$env:ARAUKA_STAGING_DB_URL" -f "$backupRoot\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
} finally {
  Remove-Item Env:ARAUKA_STAGING_DB_URL -ErrorAction SilentlyContinue
  if ($dbUrlPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbUrlPtr) }
  $dbUrlSecure = $null
}
```

No ejecutar estos comandos desde el directorio del repositorio. Confirmar en la documentación de la versión fijada si los esquemas administrados quedaron excluidos; este conjunto es una capa lógica complementaria, no reemplaza el backup administrado para Auth.

## Auth y punto de recuperación administrado

Antes de la ventana, confirmar en Dashboard que existe un backup administrado/PITR suficientemente reciente y registrar su hora UTC e identificador sin copiar datos personales. Cuando el plan lo permita, realizar un ensayo de **Restore to a New Project**: la copia de base incluye registros Auth y hashes, pero no archivos Storage ni toda la configuración del proyecto.

No exportar contraseñas en claro (Supabase no las entrega), no recrear usuarios manualmente y no usar una exportación CSV de `auth.users` como sustituto de restauración. La prueba de recuperación debe verificar inicio de sesión con cuentas ficticias autorizadas, conteos de `auth.users`/`auth.identities` y correspondencia con `profiles`.

## Storage

1. Exportar el inventario de ambos buckets: nombre completo, bucket, tamaño, MIME, fecha y metadatos; añadir checksum local al descargar.
2. Descargar los objetos con la herramienta oficial Storage CLI o un cliente S3 compatible, conservando exactamente la ruta. `company-documents` debe permanecer privado y el respaldo cifrado con acceso mínimo.
3. Comparar cantidad, suma de tamaños y checksums entre inventario y archivos. Cero diferencias es obligatorio.
4. No incluir archivos Storage ni inventarios con nombres sensibles en Git.

## Ensayo de restauración

Restaurar primero en un proyecto Supabase nuevo y aislado, nunca sobre `arauka-staging` como primera prueba. Aplicar el procedimiento oficial en este orden: roles/esquema/datos según la herramienta aprobada; configuración Auth; archivos Storage; configuración de buckets/policies; secretos por canal seguro. Luego ejecutar los postflight v0.9–v0.9.4 y comparar:

- conteos de todas las tablas y Auth;
- matriz FK, funciones, triggers, RLS y grants;
- inventario/checksums Storage;
- inicio de sesión y flujos ficticios Cliente, Profesional, Negocio y Empresa;
- privacidad de `company-documents`.

La restauración se considera verificada sólo con evidencia de un ensayo aislado exitoso. Si falta Auth recuperable, algún binario Storage o la comparación de checksums, v0.9.5 sigue bloqueada.

## Manifiesto mínimo

Guardar fuera de Git: fecha UTC, Project Ref, versión CLI, identificador del backup administrado, nombres/tamaños/SHA-256 de los dumps, CSV de auditorías, inventario/checksums Storage y resultado del ensayo. Generar hashes con `Get-FileHash -Algorithm SHA256` sin imprimir contenido ni credenciales.
