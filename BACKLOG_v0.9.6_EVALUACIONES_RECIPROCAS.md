# ARAUKA v0.9.6 — Evaluaciones recíprocas

- Modelar `reviewer_profile_id`, `subject_profile_id`, dirección (`client_to_provider` o `provider_to_client`) y `job_id`.
- Unicidad por trabajo, dirección y participantes. Definir ventana y reglas de edición; conservar historial de moderación.
- Verificar en backend que ambos actores participaron en un trabajo finalizado. La ruta o metadata nunca autorizan una evaluación.
- Calcular reputación de Cliente y proveedor por separado. Los proveedores podrán consultar reputación mínima del Cliente antes de aceptar, sin exponer contacto privado.
- Conservar calificación válida cuando una cuenta se elimina; sustituir autor o sujeto por el actor histórico anonimizado y retirar texto libre que contenga datos personales.
- Incorporar denuncia, moderación, derecho a impugnación, bloqueo de represalias y registro de decisiones administrativas.
- No describir pagos, montos ni cumplimiento financiero como verificados si ARAUKA no procesó o comprobó la transacción.
- Diseñar índices y RLS para impedir evaluaciones duplicadas, autoevaluaciones y acceso a expedientes de moderación.
