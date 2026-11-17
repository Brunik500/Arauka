# ARAUKA v0.9.5 — Auditoría de eliminación de cuenta

## Dictamen

La eliminación no debe habilitarse todavía. La decisión de producto permite preparar una separación entre credencial Auth y actor histórico anonimizado, pero falta validar el procedimiento completo y definir plazos jurídicos. La interfaz y la Edge Function quedan bloqueadas deliberadamente.

## Matriz de conservación

| Datos | Tratamiento aprobado | Motivo/condición |
|---|---|---|
| Auth, correo y credenciales | Eliminar | Al finalizar el proceso |
| Contacto privado y preferencias | Eliminar | Datos personales operativos |
| Perfil público | Anonimizar y retirar de descubrimiento | Conservar sólo actor técnico para FKs |
| Experiencias, identidad e intención inicial | Eliminar | Cascada al borrar Auth |
| Perfil y documentos empresariales | Eliminar | RUT, dirección y antecedentes privados |
| Portfolio y objetos | Eliminar | Archivos personales; verificar ambos buckets |
| Trabajos abiertos | Cancelar y anonimizar texto | No deben seguir aceptando participantes |
| Trabajos emparejados | Bloquear eliminación automática | Requieren cierre/acuerdo o resolución |
| Trabajos finalizados | Conservar estructura anonimizada | Historial legítimo de contraparte |
| Postulaciones y acuerdos | Conservar relación; retirar texto y consentimientos | Integridad de terceros sin contacto vigente |
| Evaluaciones | Conservar rating; retirar comentario libre | Reputación legítima sin datos personales |
| Revisión empresarial | Conservar decisión y fecha; retirar UUID del revisor | Auditoría mínima sujeta a plazo legal |
| Notificaciones propias | Eliminar | Cascada por destinatario Auth |

## Dependencias reales

- `profiles`, `private_contacts`, `notification_preferences`, `notifications`, `account_identities`, `account_experiences`, `commercial_profiles`, `company_documents`, `administrative_reviewers.user_id` y `account_registration_intents` dependen de `auth.users` con `CASCADE`.
- `jobs.client_id -> profiles` usa `CASCADE`: borrar un cliente borra sus trabajos, y por cascada también postulaciones y evaluaciones asociadas, incluidas las de otras cuentas.
- `interests.pro_id`, `portfolio.pro_id`, `reviews.client_id`, `reviews.pro_id` y `verifications.pro_id` usan `CASCADE` desde `profiles`.
- `jobs.selected_pro_id -> profiles` no declara acción: es `NO ACTION` y bloquea borrar al profesional seleccionado.
- `notifications.job_id -> jobs` usa `SET NULL`, pero las notificaciones del titular se borran por `recipient_id CASCADE`.
- `commercial_profiles.verification_reviewed_by -> auth.users` y `administrative_reviewers.granted_by -> auth.users` son `NO ACTION`; preservan trazabilidad y pueden bloquear al revisor.
- Storage no sigue las cascadas SQL. `portfolio` es público y `company-documents` privado; ambos usan el UUID como primera carpeta y requieren eliminación separada de objetos.

## Clasificación propuesta, pendiente de aprobación

- Eliminable: credenciales Auth, contactos privados, preferencias, notificaciones propias, intenciones, experiencias, perfil comercial privado y archivos propios.
- Requiere anonimización: trabajos con participantes, postulaciones, selecciones, acuerdos de contacto y evaluaciones. Deben conservar coherencia y derechos de terceros sin mantener nombre, correo, teléfono, RUT, dirección ni documentos del titular.
- Requiere retención/auditoría definida: revisiones empresariales y concesiones administrativas. Debe decidirse un identificador pseudónimo y plazo de conservación.
- No debe conservarse sin justificación: contraseñas, tokens, documentos empresariales ni objetos de portafolio.

## Diseño requerido antes de activar

1. Aprobar política y plazos de conservación/anominización.
2. Crear un procedimiento servidor idempotente con estado (`requested`, `processing`, `blocked`, `storage_cleaned`, `completed`, `failed`) y diagnóstico sin secretos.
3. Reautenticar al titular y comprobar que el usuario reautenticado coincide con `auth.uid()`.
4. Preflight transaccional de relaciones compartidas y referencias de auditoría.
5. Anonimizar historia aprobada; eliminar objetos de ambos buckets por prefijo UUID; verificar ausencia; eliminar Auth al final.
6. Si falla Storage o SQL, conservar estado reintentable y nunca informar éxito.
7. No aceptar UUID objetivo desde el navegador ni exponer `service_role`.

La operación entre PostgreSQL, Auth y Storage no puede ser atómica. Debe existir un trabajador de recuperación administrativo antes de habilitarla en producción. La migración `migration_v0.9.5_account_deletion_foundation.sql` sólo prepara el actor histórico, estados, preflight y anonimización interna; no elimina Auth ni Storage y no habilita el frontend.
