# ARAUKA v0.9.3 — instalación segura en Staging

## Alcance

La migración agrega registro empresarial por RPC, una allowlist administrativa,
revisión aprobada/rechazada y una vista pública mínima de empresas verificadas.
No elimina ni transforma datos existentes. La dirección tributaria, RUT,
contactos y documentos no forman parte de la vista pública.

No se implementa una consola administrativa en el frontend público. La identidad
de revisor se provisiona explícitamente en backend y no puede derivarse de
metadata de Auth ni de campos editables por el usuario.

## Orden en `arauka-staging`

1. Confirmar visualmente el proyecto `arauka-staging` en SQL Editor.
2. Después de un intento fallido, ejecutar primero
   `supabase/tests/v093_partial_install_audit.sql`. Si el archivo completo falló
   dentro de su transacción, todos los objetos v0.9.3 deben aparecer ausentes.
   Si aparece alguno, detenerse: probablemente se ejecutó solo una selección; no
   borrar ni recrear tablas.
3. Ejecutar `supabase/tests/v09_postflight_audit.sql` y guardar sus conteos.
4. Abrir nuevamente desde disco y ejecutar **el archivo completo**, desde
   `begin;` hasta `commit;`, `supabase/migration_v0.9.3_company_registration.sql`.
   No ejecutar solamente el bloque de permisos. Una excepción revierte todo.
5. Ejecutar `supabase/tests/v093_company_audit.sql`.
6. Confirmar que todas las columnas `_ok` sean `true`, RLS esté habilitado y la
   vista `verified_companies` tenga solo `user_id`, `public_name` y
   `verification_reviewed_at`.
7. Comparar los conteos de perfiles, trabajos, postulaciones, evaluaciones,
   portafolios y notificaciones con el paso 3.

## Provisionar un revisor real

Esta operación es administrativa y debe realizarse solo después de verificar la
identidad del responsable. Obtener su UUID desde Auth > Users y ejecutar en SQL
Editor, sustituyendo ambos UUID por valores revisados:

```sql
insert into public.administrative_reviewers(user_id,granted_by,note)
values ('UUID_REVISOR','UUID_RESPONSABLE_QUE_AUTORIZA','Revisor autorizado');
```

No usar un correo, nombre de perfil ni metadata como prueba de autorización. Para
revocar acceso se elimina exclusivamente la fila del UUID correspondiente. La
interfaz administrativa permanece pendiente hasta disponer de una aplicación
backend separada que autentique y audite a estos revisores.

La decisión se ejecuta mediante `review_company_verification`. Solo acepta
`verified` o `rejected`; registra automáticamente fecha y `auth.uid()` del
revisor. Una empresa verificada vuelve a `pending` al modificar sus antecedentes.

## Pruebas autenticadas

Primero ejecutar localmente:

```powershell
npm test
npm run typecheck
npm run build
```

Después de instalar y auditar Staging, usar las mismas variables protegidas del
arnés v0.9 y ejecutar:

```powershell
npm run test:supabase:v093
```

El arnés crea únicamente cuentas `arauka-v093-<runId>-...@example.invalid`,
provisiona un revisor ficticio mediante `service_role`, prueba operaciones
permitidas y denegadas, y finalmente elimina el documento de ensayo y cada cuenta
individual. No debe ejecutarse contra producción.

### Orden de limpieza del arnés

La limpieza respeta la FK `commercial_profiles.verification_reviewed_by`:

1. elimina los objetos ficticios de `company-documents`;
2. verifica UUID y correo y elimina primero `empresa` y `otra-empresa`;
3. elimina el negocio ficticio;
4. verifica UUID, `runId` y nota exacta antes de retirar el grant del revisor;
5. consulta que no queden filas con `verification_reviewed_by` igual al revisor;
6. elimina al revisor al final.

Si falla la eliminación de una empresa, del grant o la consulta de referencias,
el revisor se conserva deliberadamente y el error se informa sin credenciales.

### Residuo del run 65477c78-16a5-4a79-926f-f775705c36e8

Ejecutar primero `supabase/tests/v09_residual_test_users.sql`. La consulta dirigida
debe mostrar el correo exacto del run, `verification_references = 0` y ausencia de
`administrative_grant`. Si quedan referencias, identificar y eliminar primero
solo las empresas ficticias del mismo run desde Auth > Users. Si queda un grant,
retirarlo únicamente después de confirmar UUID y nota exacta. Finalmente eliminar
el revisor individual desde Auth > Users. No utilizar un borrado masivo ni tocar
una cuenta cuyo correo no contenga exactamente ese runId.

## Recuperación

Si la migración falla antes de `commit`, no hacer cambios manuales: PostgreSQL
revierte la transacción. Si ya fue confirmada, mantenerla instalada y corregir
con otra migración incremental. No eliminar tablas o funciones mientras el
frontend v0.9.3 esté publicado. La versión anterior del frontend ignora los
objetos nuevos y continúa usando el esquema v0.9.
