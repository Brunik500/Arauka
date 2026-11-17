# Pruebas autenticadas v0.9.5 — Preparación

No ejecutar hasta autorizar la migración candidata. Estas pruebas deben usar cuentas nuevas con un `runId`; ninguna cuenta preexistente se elimina.

## Compatibilidad antes de probar eliminación

1. Cliente activo: leer/editar perfil propio, publicar y editar trabajo; otro usuario no puede editarlo.
2. Profesional: postular, actualizar consentimiento propio, cargar/eliminar portfolio; Cliente sólo ve postulaciones de su trabajo.
3. Negocio y Empresa: conservar activación, formularios, documentos privados y permisos ya validados.
4. Contacto compartido: sólo participantes seleccionados con doble consentimiento obtienen el contacto.
5. Actor histórico simulado en una transacción de ensayo: `auth_user_id NULL`, `deleted_at` no nulo; no aparece en consulta pública y no puede autorizar ninguna escritura.

## Eliminación futura

- Reautenticación correcta e incorrecta; token vencido; UUID del token distinto del reautenticado.
- Cuenta sin actividad, con trabajo abierto, finalizado y `matched`.
- Profesional seleccionado; Empresa pendiente/verificada; revisor administrativo.
- Objetos válidos en ambos buckets y objeto señuelo de otro UUID que debe permanecer intacto.
- Interrupción después de cada estado y reanudación por el mismo `request_id`.
- Respuesta ambigua de `deleteUser`: consultar Auth antes de reintentar.
- Confirmar que la fila de solicitud persiste con `user_id NULL` y puede marcarse `completed` por `request_id`.
- Confirmar rating conservado, comentario fuera de exposición pública y caso en `review_retention_queue`.
- Confirmar que las contrapartes conservan trabajos e historial y que el perfil eliminado no aparece en directorios.

## Matriz esperada

| Caso | Resultado |
|---|---|
| Ruta manipulada o UUID ajeno | Denegado antes de preflight |
| Reautenticación fallida | Sin solicitud ni cambios |
| Trabajo `matched` | `blocked_active_agreement`, sin Storage ni anonimización |
| Fallo Storage | Estado reintentable, Auth intacto, sin éxito UI |
| Fallo SQL | `failed/processing`, Auth intacto, sin éxito UI |
| SQL completo, Auth pendiente | Reanudar desde `auth_pending` |
| Auth ausente y verificaciones correctas | Marcar `completed` y recién entonces despedida |
