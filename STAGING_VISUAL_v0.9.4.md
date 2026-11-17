# ARAUKA v0.9.4 — Entorno visual Staging

Esta variante está preparada para conectarse exclusivamente a un proyecto declarado como Staging. La aplicación bloquea antes de crear el cliente Supabase una URL cuyo Project Ref no coincida, una configuración remota sin `VITE_APP_ENV=staging`, y cualquier clave `sb_secret_` o JWT con rol `service_role`.

## Configuración local

1. Copiar `config/staging.env.example` como `.env.staging.local` en la raíz. Este último archivo está ignorado por Git.
2. Completar únicamente:

```dotenv
VITE_APP_ENV=staging
VITE_SUPABASE_PROJECT_REF=PROJECT_REF_DE_ARAUKA_STAGING
VITE_SUPABASE_URL=https://PROJECT_REF_DE_ARAUKA_STAGING.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_CLAVE_PUBLICA_DE_STAGING
```

También se admite temporalmente la clave `anon` JWT heredada. Nunca usar `sb_secret_`, `service_role`, contraseñas ni tokens de usuario en archivos `VITE_*`: Vite incorpora esas variables al navegador.

3. Confirmar que URL y Project Ref corresponden al panel de `arauka-staging`.
4. Iniciar desde la terminal integrada de VS Code:

```powershell
npm run dev:staging
```

5. Abrir la URL local informada por Vite. Debe aparecer permanentemente la barra `STAGING · MODO DE PRUEBA · DATOS DE ENSAYO` y el título de pestaña `ARAUKA · Staging`.

Si la configuración es inconsistente, el acceso remoto queda bloqueado y la barra cambia a un aviso rojo. No corregirlo apuntando a producción: revisar el Project Ref y la clave pública de Staging.

## Validación local previa

```powershell
npm run typecheck
npm test
npm run build
```

Para validar específicamente el empaquetado con `.env.staging.local`:

```powershell
npm run build:staging
```

El último comando incluye el escaneo existente del directorio `dist` para detectar secretos. No despliega ni realiza operaciones SQL.
