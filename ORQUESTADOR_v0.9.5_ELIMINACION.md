# Orquestador recuperable v0.9.5

La Edge Function desplegable aún no está implementada: `index.ts` responde 503. Este documento define el contrato que debe superar una revisión adicional.

1. Validar destino Staging y `Authorization`; obtener el usuario con el cliente del token.
2. Reautenticar en servidor. Para contraseña, realizar un inicio de sesión efímero con clave pública, comparar estrictamente el UUID resultante y descartar tokens. OAuth necesita un mecanismo de reautenticación específico antes de habilitarse.
3. Crear o recuperar una única solicitud por `user_id`; nunca aceptar un UUID objetivo del body.
4. Ejecutar preflight. `matched` produce `blocked_active_agreement`; no se toca Storage ni SQL.
5. Marcar `storage_pending`. Listar paginado únicamente `portfolio/<uuid>/` y `company-documents/<uuid>/`; rechazar cualquier nombre que no supere `storageObjectBelongsToUser`.
6. Eliminar lotes, volver a listar y exigir cero objetos. Un timeout deja el mismo estado para reintento.
7. Marcar `processing` e invocar `anonymize_account_for_deletion(uuid,request_id)` con service role sólo en servidor.
8. Verificar `database_anonymized`, perfil oculto, cola de comentarios y ausencia de datos públicos identificables.
9. Marcar `auth_pending`; ejecutar `admin.deleteUser` una vez. Ante respuesta ambigua, consultar `getUserById` antes de repetir.
10. Como `account_deletion_requests.user_id` usa `SET NULL`, la fila persiste después de Auth. Actualizar por `request_id` a `completed`, fijar `completed_at` y verificar Auth ausente.
11. Responder éxito únicamente después de esas verificaciones. El frontend entonces limpia sesión y muestra la despedida.

El trabajador de recuperación usa estados, nunca contraseña ni tokens persistidos. Registra sólo `request_id`, estado y códigos técnicos acotados.

## Revisión jurídica chilena pendiente

Debe revisarse con asesoría aplicable en Chile: base y finalidad de conservación; derechos de acceso, rectificación, cancelación/oposición según corresponda; tratamiento de RUT y documentos; conservación contractual y probatoria; plazos de prescripción aplicables al caso real; deberes tributarios si ARAUKA llega a intermediar pagos; tratamiento de denuncias/moderación; encargados y transferencias de datos. Este proyecto no fija plazos hasta recibir esa revisión.
