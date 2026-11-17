# Ejecución segura del arnés ARAUKA v0.9

## Variables requeridas

El proceso se detiene antes de crear el cliente Supabase si falta o no coincide cualquiera de estas variables:

- `SUPABASE_TEST_URL`: exactamente `https://<REF_STAGING>.supabase.co`, sin path, query ni credenciales.
- `SUPABASE_TEST_ANON_KEY`: anon/publishable key de staging.
- `SUPABASE_TEST_SERVICE_ROLE_KEY`: service-role key de staging; nunca usar una clave del frontend.
- `SUPABASE_TEST_PROJECT_REF`: referencia de staging tomada de su URL.
- `SUPABASE_PRODUCTION_PROJECT_REF`: referencia de producción, no es una clave secreta y debe ser distinta.
- `ARAUKA_ALLOW_REMOTE_TESTS`: exactamente `YES`.
- `ARAUKA_STAGING_CONFIRMATION`: exactamente `arauka-staging:<REF_STAGING>`.

Las protecciones comprueban simultáneamente URL exacta, referencia de staging, diferencia con producción, nombre explícito `arauka-staging` y habilitación `YES`. La validación ocurre antes de cualquier llamada de red.

También se valida el tipo local: `sb_publishable_` o JWT `role=anon` para la clave pública; `sb_secret_` o JWT `role=service_role` para administración. Se rechazan espacios, saltos de línea y claves intercambiadas.

## Configuración desde VS Code en Windows

Abrir una terminal PowerShell nueva en la raíz del repositorio. No guardar estas variables en `.env`, `.env.local`, tareas de VS Code, configuraciones de depuración ni archivos del proyecto. `.env*` está ignorado, pero una service-role key no debe persistirse innecesariamente en disco.

Los valores secretos se solicitan sin eco y no quedan escritos literalmente en el historial de PowerShell:

```powershell
$stagingRef = '<REF_REAL_DE_ARAUKA_STAGING>'
$productionRef = '<REF_REAL_DE_PRODUCCION>'
$env:SUPABASE_TEST_URL = "https://$stagingRef.supabase.co"
$env:SUPABASE_TEST_PROJECT_REF = $stagingRef
$env:SUPABASE_PRODUCTION_PROJECT_REF = $productionRef
$env:ARAUKA_ALLOW_REMOTE_TESTS = 'YES'
$env:ARAUKA_STAGING_CONFIRMATION = "arauka-staging:$stagingRef"

$anonSecure = Read-Host 'Anon/publishable key de arauka-staging' -AsSecureString
$serviceSecure = Read-Host 'Service-role key de arauka-staging' -AsSecureString
$env:SUPABASE_TEST_ANON_KEY = [Net.NetworkCredential]::new('', $anonSecure).Password
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', $serviceSecure).Password
```

Antes del comando remoto, comprobar únicamente valores no secretos:

```powershell
$env:SUPABASE_TEST_URL
$env:SUPABASE_TEST_PROJECT_REF
$env:SUPABASE_PRODUCTION_PROJECT_REF
$env:ARAUKA_STAGING_CONFIRMATION
```

No ejecutar `Get-ChildItem Env:` ni imprimir las variables de claves.

## Comando final

```powershell
try {
  npm.cmd run test:supabase:v09
} finally {
  Remove-Item Env:SUPABASE_TEST_URL,Env:SUPABASE_TEST_PROJECT_REF,Env:SUPABASE_PRODUCTION_PROJECT_REF,Env:SUPABASE_TEST_ANON_KEY,Env:SUPABASE_TEST_SERVICE_ROLE_KEY,Env:ARAUKA_ALLOW_REMOTE_TESTS,Env:ARAUKA_STAGING_CONFIRMATION -ErrorAction SilentlyContinue
  $anonSecure = $null
  $serviceSecure = $null
  $stagingRef = $null
  $productionRef = $null
}
```

## Creación y limpieza

- Se genera un `runId` aleatorio, una contraseña aleatoria en memoria y seis correos bajo el prefijo `arauka-v09-<runId>-...@example.invalid`.
- `admin.createUser` crea exactamente Cliente, Profesional, Negocio, Empresa pendiente, Empresa verificada y cuenta múltiple.
- Cada UUID se agrega a un `Map` solamente después de que `createUser` devuelve éxito.
- El bloque `finally` itera exclusivamente ese `Map`; no lista ni busca todos los usuarios.
- Antes de borrar cada UUID, `getUserById` confirma que su correo coincide exactamente con el registrado y con el `runId` actual. Si no coincide, omite la eliminación.
- No existe `deleteMany`, filtro por dominio, limpieza por fecha ni borrado masivo.
- Los `ON DELETE CASCADE` eliminan únicamente los datos ficticios asociados a esas seis cuentas.

Si Node o VS Code se cierran forzosamente, `finally` podría no ejecutarse. En ese caso, identificar manualmente las cuentas por el prefijo único mostrado arriba y revisar cada UUID antes de eliminarlas; nunca hacer limpieza masiva.

## Salida y seguridad de secretos

El script no imprime contraseña, anon key, service-role key ni tokens de sesión. La salida de éxito esperada es:

```text
Run ficticio ARAUKA v0.9: <uuid-del-run>
ARAUKA v0.9: pruebas de autorización principales aprobadas en el proyecto de ensayo.
```

El proceso debe terminar con código `0`. Si una aserción falla, termina con código distinto de cero y aun así intenta limpiar únicamente las cuentas registradas por ese run. Los únicos datos que podría mostrar durante un problema de limpieza son el UUID ficticio y el mensaje de Supabase, nunca las claves configuradas.

## Pruebas locales previas

```powershell
npm.cmd test
node --check scripts/test-v09-supabase.mjs
```

`npm test` incluye pruebas del bloqueo de destino, tipo de claves y clasificación local de fallos DNS, TLS, timeout y conexión.

Antes de escribir, el arnés valida ambas claves mediante `GET /auth/v1/settings` y `admin.listUsers`. El procedimiento de diagnóstico está en `DIAGNOSTICO_AUTH_FETCH_STAGING_v0.9.md`.
