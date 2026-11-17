# Preflight Staging v0.9.5 — estado y autorización

Estado: **NO AUTORIZADO**. No instalar `migration_v0.9.5_account_deletion_foundation.sql` hasta completar y revisar esta lista.

## Evidencia disponible

- Proyecto declarado: `arauka-staging`, ref `qviiiomipsulvjpstyzw`.
- Lectura manual informada: 5 perfiles y 0 perfiles sin Auth.
- Las relaciones informadas para `profiles`, `jobs`, `interests`, `reviews` y `notifications` coinciden con el modelo candidato.
- Se corrigió el nombre de tabla del inventario: es `public.interests`, no `public.job_interests`.

Esto aún no prueba la topología completa, las dependencias administrativas, la ausencia de instalación parcial, Storage ni la recuperabilidad del respaldo.

## Orden de lectura y evidencia

1. Ejecutar `supabase/tests/v095_fk_topology_audit.sql`; exportar el único resultado a CSV. Requisito: todas las filas `matches=true`, `installation_blockers=0` y `preflight_fk_ok=true`.
2. Ejecutar `supabase/tests/v095_structural_preflight.sql`; exportar a CSV. Requisito: toda fila bloqueante coincide, `blockers=0` y `preflight_structural_ok=true`.
3. Ejecutar `supabase/tests/v095_account_deletion_dependencies.sql` para guardar el inventario bruto y explicar cualquier fila adicional.
4. Preparar y verificar el respaldo conforme a `RESPALDO_RESTAURACION_STAGING_v0.9.5.md`.
5. Revisión humana conjunta de los tres CSV y del manifiesto del respaldo. Sólo entonces puede emitirse una autorización separada.

## Bloqueos automáticos

- FK faltante, acción `ON DELETE` distinta o FK adicional no explicada en el alcance auditado.
- Tabla/RPC requerida ausente o trigger Auth distinto de uno.
- Cualquier objeto/columna/trigger v0.9.5 ya presente: indica instalación parcial o previa.
- Perfil sin `auth.users` antes de separar identidades.
- Bucket ausente o visibilidad incorrecta (`portfolio` público; `company-documents` privado).
- Backup administrado/Auth no verificable, Storage incompleto o restauración no ensayada en proyecto aislado.
- Escrituras activas durante la ventana o diferencias de conteos sin explicación.

Los trabajos emparejados, evaluaciones entre cuentas y referencias administrativas se reportan como métricas, no como fallo estructural automático. Deben revisarse porque aumentan el riesgo operativo y condicionan futuras eliminaciones; la instalación base no debe modificar sus datos.

## Decisión

Con la información actual no hay una diferencia confirmada, pero faltan resultados automatizados y un respaldo restaurable verificado. Por ello la migración continúa **NO AUTORIZADA** y el control «Eliminar mi cuenta» debe permanecer deshabilitado.
