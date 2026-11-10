# ARAUKA v0.8 — publicación estática en Cloudflare Pages

## Arquitectura

ARAUKA se compila como archivos estáticos en `dist`. Las rutas son fragmentos (`#/cliente/...` y `#/maestro/...`): el navegador siempre solicita `/` al servidor y resuelve la pantalla localmente. Por eso F5 y los enlaces directos no necesitan una regla SPA `/* → /index.html`.

`public/_headers` se copia a `dist/_headers` y configura CSP, HTTPS/HSTS, protección contra iframes y caché. Los archivos con hash bajo `/assets/` son inmutables por un año; `/` e `index.html` no se cachean para que cada publicación tome el HTML nuevo.

## Variables públicas de producción

Configura en Cloudflare Pages → Settings → Environment variables, para Production y Preview según corresponda:

- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-o-anon-key>`

Todo valor `VITE_` se incorpora al JavaScript descargado por el navegador. No agregues `service_role`, `sb_secret_`, contraseña de base de datos, `RESEND_API_KEY`, `ARAUKA_WEBHOOK_SECRET` ni otros secretos. El comando `npm run build` termina con un escaneo del contenido de `dist` y falla si detecta patrones sensibles conocidos.

## Supabase Authentication → URL Configuration

Antes de probar registro o confirmación de correo:

1. Define **Site URL** como `https://arauka.cl`.
2. Añade a **Redirect URLs**:
   - `https://arauka.cl`
   - `https://arauka.cl/**`
3. Para staging, añade solamente la URL exacta que usarás, por ejemplo:
   - `https://<nombre-del-proyecto>.pages.dev/**`
4. Si pruebas una URL de preview por rama, registra esa URL concreta y retírala al terminar. Evita comodines más amplios de lo necesario.
5. Mantén `http://localhost:5173/**` únicamente si todavía se necesita desarrollo local.

El registro actual no envía un `emailRedirectTo` arbitrario: Supabase utiliza la Site URL configurada. La sesión sigue siendo una sola para Cliente y Maestro.

## Publicación conectando un repositorio

1. Sube el proyecto a un repositorio privado sin `.env.local` ni secretos.
2. En Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git, selecciona el repositorio.
3. Configura:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
   - Node.js: una versión LTS compatible con el lockfile.
4. Agrega las dos variables públicas de Supabase.
5. Publica primero como preview y ejecuta la lista de pruebas.
6. Cuando esté aprobado, agrega `arauka.cl` en Custom domains siguiendo el asistente de Cloudflare. Activa redirección HTTP→HTTPS/Always Use HTTPS desde Cloudflare; no cambies registros DNS de Resend.

## Publicación manual de `dist`

Después de ejecutar localmente `npm ci && npm run build`, se puede:

- Usar Cloudflare Pages Direct Upload y arrastrar la carpeta `dist`.
- O ejecutar manualmente, con una sesión autorizada de Wrangler:

  ```powershell
  npx wrangler pages deploy dist --project-name arauka
  ```

Este repositorio no ejecuta ese comando automáticamente.

## Acceso restringido durante pruebas

La opción recomendada es usar un proyecto Supabase de staging con datos ficticios y proteger el dominio de preview mediante Cloudflare Zero Trust Access, permitiendo solo correos del equipo. Otra opción es no conectar aún `arauka.cl` y compartir únicamente el preview restringido.

Cloudflare Access no reemplaza RLS: la publishable key sigue siendo pública y toda privacidad depende de las políticas de Supabase. No copies teléfonos, usuarios o trabajos reales a staging. No relajes RLS para facilitar pruebas.

## Enlaces de notificaciones

Los enlaces deben usar:

- `https://arauka.cl/#/cliente/trabajo/<uuid>`
- `https://arauka.cl/#/maestro/trabajo/<uuid>`

Al activar posteriormente v0.7, `ARAUKA_PUBLIC_SITE_URL` debe ser `https://arauka.cl`. No actives todavía el webhook, Cron o Resend durante esta fase.

## Pruebas manuales posteriores al despliegue

1. Abrir `/`, elegir Cliente y Maestro y confirmar el encabezado correcto.
2. Navegar a una solicitud en cada modo, pulsar F5 y confirmar que conserva modo, página e ID.
3. Abrir ambos enlaces hash anteriores en una ventana privada y en otro navegador.
4. Registrar, confirmar correo, cerrar sesión e iniciar sesión nuevamente.
5. Verificar que cerrar sesión conserva el modo seleccionado.
6. Publicar y editar una solicitud abierta con una cuenta de prueba.
7. Postular con otra cuenta, seleccionar profesional y probar consentimiento mutuo.
8. Revisar notificaciones internas y apertura del trabajo relacionado.
9. Subir/mostrar una imagen de portafolio de prueba para validar CSP y Supabase Storage.
10. Revisar en DevTools que no haya errores CSP, contenido mixto ni secretos; confirmar headers y caché en Network.
11. Confirmar que `/assets/*` usa caché inmutable y `/`/`index.html` no-cache.
12. Verificar diseño móvil y escritorio.

No se requieren migraciones SQL para publicar v0.8.
