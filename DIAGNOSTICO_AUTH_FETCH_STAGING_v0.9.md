# Diagnóstico de `admin.createUser` en ARAUKA staging

## Interpretación del error observado

`AuthRetryableFetchError: fetch failed`, `status: 0`, significa que Auth JS no recibió una respuesta HTTP utilizable. La versión local instalada de `@supabase/auth-js` es 2.119.0 y `admin.createUser` hace una única petición `POST /auth/v1/admin/users`; el nombre `Retryable` clasifica el error, pero este método no reintenta automáticamente.

Un `GET /auth/v1/health` con HTTP 401 demuestra que DNS, TLS y una petición GET básica llegan a Supabase. No verifica la clave pública, la clave administrativa, los encabezados `apikey` y `Authorization`, el endpoint `/auth/v1/admin/users`, ni una solicitud POST con JSON.

## Diagnóstico añadido

Antes de crear usuarios se ejecutan dos comprobaciones remotas de solo lectura:

1. `GET /auth/v1/settings` con la clave pública. Debe responder 2xx.
2. `admin.listUsers({page:1,perPage:1})` con la clave administrativa. No imprime ni usa los usuarios devueltos; valida acceso administrativo real.

Solo después se permite el primer `createUser`. Cada `fetch` tiene timeout de 20 segundos y registra únicamente método, pathname, estado HTTP y categoría técnica. Nunca registra URL completa, encabezados, cuerpo, contraseña, claves o tokens.

Categorías posibles:

- `dns`: resolución de nombre;
- `tls`: certificado, CA, hostname o negociación TLS;
- `timeout`: conexión, cabeceras o cuerpo excedieron el límite;
- `connection`: conexión rechazada, reiniciada, socket roto o red inaccesible;
- `network`: error de transporte sin código más específico;
- `HTTP N`: Supabase respondió; 401/403 apunta normalmente a clave/rol/proyecto, 400 a payload/configuración, 429 a límite y 5xx a infraestructura.

## Claves aceptadas

La clave pública puede ser nueva `sb_publishable_...` o JWT legado con `role=anon`. La administrativa puede ser nueva `sb_secret_...` o JWT legado con `role=service_role`. Para JWT legados, un claim `ref` debe coincidir con staging. Se rechazan espacios, saltos de línea y tipos intercambiados.

El cliente administrativo usa la clave administrativa como segundo argumento de `createClient`. La librería la envía como `apikey` y, sin sesión, como `Authorization: Bearer ...`. El preflight `listUsers` confirma que Staging la reconoce antes de cualquier escritura.

## Causas posibles

1. Copia incompleta, espacio o salto de línea en la clave; ahora se bloquea localmente.
2. Clave de otro proyecto o clave pública usada como administrativa.
3. Proxy, antivirus o firewall que permite GET de health pero bloquea POST, `/admin/users`, JSON o `Authorization`.
4. Reset de conexión, DNS intermitente, ruta IPv6 o timeout transitorio.
5. Problema TLS/CA específico de Node o inspección HTTPS; menos probable si Node obtuvo 401, pero posible en otra conexión.
6. Incidencia de Supabase/Cloudflare. Con respuesta suele aparecer como HTTP 5xx, no `status: 0`.
7. Configuración de Auth, email inválido o rate limit; normalmente produce HTTP 4xx/429.

## Prohibición de reintento ciego

El arnés no reintenta `createUser`. Si no hubo respuesta HTTP o hubo 5xx, registra el correo como “creación incierta”: Supabase podría haber confirmado la transacción y haberse perdido la respuesta. Antes de repetir hay que buscar ese correo en Auth > Users.

El `runId` se imprime al comenzar las escrituras. Los correos tienen formato:

```text
arauka-v09-<runId>-<tipo>-<uuid>@example.invalid
```

Para inventariar residuos se puede ejecutar la consulta de solo lectura `supabase/tests/v09_residual_test_users.sql`. Eliminar solo cuentas individuales cuyo correo, fecha y `runId` correspondan al ensayo. No hacer DELETE masivo ni eliminar por dominio.

## Reanudación segura

1. Ejecutar `npm.cmd test` y `node --check scripts/test-v09-supabase.mjs`.
2. Revisar residuos con `v09_residual_test_users.sql` o Auth > Users.
3. Confirmar URL y referencias de staging y producción.
4. Configurar variables según `PRUEBAS_AUTENTICADAS_STAGING_v0.9.md`.
5. Ejecutar una sola vez `npm.cmd run test:supabase:v09`.
6. Si falla el preflight público o admin, no se crearon usuarios; corregir clave/red según la categoría.
7. Si falla `createUser` como incierto, no reintentar hasta revisar el correo indicado.
