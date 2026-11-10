# ARAUKA v0.5 — navegación estable y avisos

## Qué cambia

- Las páginas conservan su ubicación al pulsar **F5**. Se usan rutas `#/cliente/trabajo/<id>` y `#/maestro/trabajo/<id>`. Son rutas hash para funcionar también en alojamientos HTML estáticos, sin reglas de reescritura especiales.
- El encabezado muestra una sola experiencia (Cliente o Maestro). Cambia de espacio desde **Mi cuenta → Tipo de cuenta**, evitando pulsaciones accidentales.
- En **Mi cuenta → Mis notificaciones** verás avisos por postulaciones, selección y autorización mutua; la bandeja se actualiza al volver a la pestaña y cada 30 segundos mientras está abierta.
- La preferencia de correo es **desactivada por defecto** y se habilita con una casilla de consentimiento. Aun habilitada, solo llegarán correos una vez configurada la Edge Function y el proveedor.

## Actualizar el proyecto que ya usas en VS Code

1. **Haz una copia de seguridad** de tu carpeta actual `ARAUKA`. No borres tu `.env.local`, ni tus ajustes locales.
2. Detén Vite (`Ctrl + C`). De este ZIP copia **`src/App.tsx`**, **`src/styles.css`** y **`supabase/migration_v0.5_notifications.sql`** a la carpeta equivalente de tu proyecto actual. Los dos primeros sustituyen los del v0.4; el SQL es **nuevo**. Los ajustes que hiciste para la carga condicional de `interests` están incorporados en el nuevo `App.tsx`.
3. Copia también **`supabase/functions/send-notification/index.ts`** si deseas activar correo después.
4. En tu proyecto abre una terminal y ejecuta `npm run build` para comprobar TypeScript. Después `npm run dev`.
5. En Supabase → **SQL Editor** pega y ejecuta **solamente** `supabase/migration_v0.5_notifications.sql`. **NO vuelvas a ejecutar `schema.sql` ni borres tablas**. Esta migración agrega tablas y disparadores sin destruir tus datos anteriores.
6. Entra en ARAUKA; en **Mi cuenta** verás los avisos y la opción para cambiar de espacio. No se borrarán las cuentas ni las postulaciones existentes.

## Prueba de F5 (sin tocar Supabase)

1. Cliente → Mis trabajos → abrir un trabajo. Verifica que la dirección termine en `#/cliente/trabajo/<uuid>`.
2. Pulsa **F5**: debe conservar el trabajo, el modo y el registro en pantalla.
3. Mi cuenta → Tipo de cuenta → Ir a mi espacio de maestro → Oportunidades → abre un trabajo.
4. Pulsa F5. La URL debe seguir en `#/maestro/trabajo/<uuid>` y la pantalla en el trabajo de maestro.
5. Copia la URL y ábrela en otra pestaña del mismo navegador: debe llevar al mismo detalle. Sin sesión, puede limitar la información privada.

## Prueba de avisos internos

1. Desde una cuenta de **maestro distinta** de la cuenta cliente, manifiesta interés en una **nueva** solicitud (los eventos anteriores a la migración no generan avisos retroactivos).
2. Regresa a la cuenta cliente → Mi cuenta → Mis notificaciones (o cambia de pestaña y vuelve). Aparecerá «Un profesional está interesado».
3. El cliente selecciona al profesional. El maestro debe recibir un aviso.
4. Cuando ambos autorizan compartir sus datos, ambos reciben un aviso. Los teléfonos **no se incluyen en ningún correo**.

## Activar el envío de correo (configuración adicional, NO automática)

La migración por sí sola **no envía correos**. Para activarlos hace falta un dominio verificado y un servicio de envío, por ejemplo Resend, más una Edge Function desplegada en Supabase.

1. Registra y verifica tu dominio de remitente con el proveedor de correo (DNS SPF/DKIM según proveedor). Usa un remitente del estilo `notificaciones@tu-dominio-verificado.cl`.
2. Crea en Supabase **Edge Functions** una función `send-notification` usando el archivo `supabase/functions/send-notification/index.ts`; despliega con verificación JWT **desactivada solo en esa función** porque recibirá eventos del webhook, pero **exige el secreto `x-arauka-webhook-secret`**. No desactives autenticación de otras funciones.
3. En los **Secrets** de la Edge Function, configura `RESEND_API_KEY`, `ARAUKA_EMAIL_FROM`, `ARAUKA_PUBLIC_SITE_URL` (dirección pública final), `ARAUKA_WEBHOOK_SECRET` (cadena aleatoria fuerte). Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son secretos del entorno de funciones; confirma su disponibilidad. **No guardes ninguno de estos secretos en `VITE_...` ni en el código React.**
4. En Supabase → **Database → Webhooks**, crea un webhook para la tabla `public.notifications`, evento **INSERT**, URL `https://<project-ref>.supabase.co/functions/v1/send-notification` y encabezado HTTP `x-arauka-webhook-secret` exactamente igual al secreto configurado. Esto solo se debe crear **después** de desplegar la función.
5. En Mi cuenta de cada usuario, marca **«Quiero recibir notificaciones por correo»**. Hasta entonces los avisos permanecen en la bandeja web.
6. Realiza la prueba de interés con un nuevo trabajo y revisa los logs de la Edge Function y la tabla `notifications` (`email_status`: `sent`, `disabled` o `error`). El código evita el procesamiento simultáneo del mismo aviso; en caso de error deja `email_status='error'` para revisión y reintento controlado. Para producción falta probar políticas de reintentos, límites y observabilidad del proveedor.

**IMPORTANTE:** no habilites el webhook con un secreto vacío. No publiques ni compartas `service_role`, contraseñas ni tokens administrativos. Nunca publiques correos/teléfonos en datos de perfiles o trabajos.

## Notas de implementación

- La aplicación usa **React + Vite + Supabase**, sigue compilando una web estática (`npm run build` → `dist/`). Supabase se encarga del backend dinámico.
- La bandeja no es push del sistema operativo; utiliza consultas periódicas y actualización al recuperar el foco. Los correos se disparan desde la base de datos cuando se configura el webhook.
- No hemos desplegado las Edge Functions ni configurado tus DNS, servicios de correo o webhook: requieren acceso a tus cuentas.
