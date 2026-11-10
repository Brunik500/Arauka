# ARAUKA v0.7 — activación segura de correos

La implementación procesa solamente filas creadas en `public.notifications`. React nunca entrega destinatarios, asuntos ni contenido a la Edge Function.

## Compatibilidad con v0.5

`migration_v0.5_notifications.sql` define `pending`, `sending`, `sent`, `error` y `disabled`; v0.7 conserva los cinco y añade:

- `failed`: Resend o los datos almacenados produjeron un error permanente.
- `delivery_unknown`: no es seguro reenviar porque venció la ventana idempotente o cambió el payload.

Las políticas RLS de v0.5 permanecen intactas. Los usuarios autenticados conservan lectura de sus avisos y solo pueden actualizar `read_at`; la Edge Function opera con `service_role`. Los triggers de postulaciones, selección y contacto tampoco cambian.

## Orden exacto de activación

1. Confirma que v0.5 esté aplicada. No vuelvas a ejecutar `schema.sql`.
2. Revisa y ejecuta manualmente `supabase/migration_v0.7_transactional_email.sql`.
3. Configura los secretos de la Edge Function:

   ```powershell
   supabase secrets set RESEND_API_KEY="re_..."
   supabase secrets set ARAUKA_EMAIL_FROM="ARAUKA <notificaciones@arauka.cl>"
   supabase secrets set ARAUKA_PUBLIC_SITE_URL="https://arauka.cl"
   supabase secrets set ARAUKA_WEBHOOK_SECRET="<secreto-aleatorio-largo>"
   ```

4. Despliega manualmente `send-notification`. `supabase/config.toml` contiene `verify_jwt = false` para esta función:

   ```powershell
   supabase functions deploy send-notification
   ```

   La ausencia de JWT no hace público el correo: cada petición exige `x-arauka-webhook-secret`, un envelope válido de `public.notifications` y un UUID que la función vuelve a reclamar desde PostgreSQL. No se aceptan correos, asuntos ni cuerpos desde HTTP.

5. En Database Webhooks crea el webhook de `INSERT` para `public.notifications`:

   - URL: `https://<project-ref>.supabase.co/functions/v1/send-notification`
   - Header: `x-arauka-webhook-secret: <mismo-secreto>`

6. En Supabase Vault crea dos secretos. Hazlo desde el panel Vault para evitar guardarlos en archivos:

   - `arauka_edge_function_url` = `https://<project-ref>.supabase.co/functions/v1/send-notification`
   - `arauka_webhook_secret` = el mismo secreto del webhook

7. Verifica primero el despachador manualmente desde SQL Editor:

   ```sql
   select public.dispatch_notification_email_batch(10);
   ```

8. Solo después programa el reintento cada cinco minutos:

   ```sql
   select cron.schedule(
     'arauka-email-retries',
     '*/5 * * * *',
     $$select public.dispatch_notification_email_batch(25);$$
   );
   ```

9. Habilita la preferencia de correo en las cuentas de prueba y realiza las pruebas funcionales.

## Fiabilidad

- Cada reclamación genera `email_attempt_token`. Todas las escrituras posteriores exigen el mismo ID, estado `sending` y token; una ejecución antigua no puede sobrescribir una nueva.
- Cada actualización comprueba mediante `UPDATE ... RETURNING` que PostgreSQL modificó exactamente el intento esperado.
- `event_key` evita eventos duplicados en PostgreSQL y el ID de notificación forma la clave idempotente de Resend.
- La huella SHA-256 congela el payload lógico. Si una versión nueva de la plantilla cambia durante un reintento, el envío pasa a `delivery_unknown`.
- Respuestas perdidas, HTTP 409, 429 y 5xx se reintentan con la misma clave solo dentro de 23 horas. Este margen queda por debajo de las 24 horas de idempotencia de Resend.
- Vencida esa ventana no se reenvía: se usa `delivery_unknown` para evitar un duplicado potencial.
- HTTP 4xx permanentes usan `failed`. Hay un máximo de cinco intentos.
- Cron vuelve a invocar notificaciones `pending`, `error` o `sending` estancadas más de diez minutos.

## Pruebas posteriores a la activación

1. Dos invocaciones simultáneas con el mismo ID: solo una debe obtener token y contactar Resend.
2. Simula 500/429/409 y confirma `error`, aumento de intentos y reintento por Cron.
3. Simula pérdida de respuesta y confirma que se conserva la misma clave idempotente.
4. Cambia la huella o supera 23 horas y confirma `delivery_unknown`, sin un nuevo envío.
5. Deshabilita la preferencia y confirma `disabled`.
6. Comprueba postulación, selección y autorización mutua con dos cuentas reales.
7. Revisa `email_attempts`, `email_attempt_token`, `email_error`, `email_provider_id` y los logs, sin publicar correos o secretos.

## Comandos de prueba local

Con Deno instalado:

```powershell
deno test supabase/functions/send-notification/email-core.test.ts
deno check supabase/functions/send-notification/index.ts
```

Las pruebas de concurrencia real y Cron requieren un proyecto Supabase de staging. No deben ejecutarse contra producción sin respaldos y cuentas de prueba.

No guardes secretos en `.env.local`, variables `VITE_`, React, Git o capturas. Esta preparación no ejecuta SQL, no despliega funciones y no crea el Cron automáticamente.
