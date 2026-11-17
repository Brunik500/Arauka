# Auditoría de migración ARAUKA v0.9

Fecha de revisión local: 11 de noviembre de 2026. No se consultó ni modificó ningún proyecto remoto.

## Resultado ejecutivo

La versión original de `migration_v0.9_identity_experiences.sql` no debía instalarse: no era transaccional ni reejecutable, declaraba dependencias innecesarias sobre v0.5–v0.7 y conservaba una vía heredada para modificar `profiles.is_professional`. La versión corregida incluye transacción, preflight, DDL tolerante a reejecución, detección de policies INSERT desconocidas, permisos de columnas y policies de portafolio basadas en experiencias.

La migración conserva filas históricas: solo agrega estructuras, hace backfill con `INSERT ... ON CONFLICT DO NOTHING`, reemplaza policies y reemplaza el trigger de alta. No elimina usuarios, trabajos, postulaciones, evaluaciones, portafolios ni notificaciones.

## Hallazgos

| Gravedad | Hallazgo | Corrección/estado |
|---|---|---|
| Crítica | `profiles owner update` más un permiso UPDATE de tabla permitía cambiar `is_professional`; además el portafolio heredado confiaba en ese campo. | v0.9 revoca UPDATE de tabla, concede solo columnas editables y reemplaza las policies de portafolio por comprobaciones de `account_experiences`. |
| Alta | El archivo original podía quedar aplicado parcialmente ante un error. | `BEGIN/COMMIT`; cualquier error revierte DDL, backfill, funciones y policies. |
| Alta | `CREATE TYPE/TABLE/POLICY` fallaba al reintentar. | Tipos toleran `duplicate_object`, tablas usan `IF NOT EXISTS`, policies conocidas se eliminan y recrean. |
| Alta | Policies permisivas se combinan con OR; una policy INSERT personalizada podía eludir las nuevas condiciones. | El preflight aborta ante policies INSERT/ALL desconocidas en `jobs`, `interests` o `portfolio`. Las policies de `storage.objects` deben revisarse con la consulta preflight porque pueden pertenecer a otros buckets. |
| Media | Se asumía que v0.5, v0.6 y v0.7 estaban instaladas por existir sus archivos. | v0.9 solo exige el esquema base y `pgcrypto`. Los scripts de auditoría detectan objetos reales. |
| Media | El frontend seguía enviando `is_professional` al guardar el perfil y activándolo mediante UPDATE directo. | Se retiró el campo del guardado y la activación usa `activate_experience`. La RPC mantiene el booleano únicamente como compatibilidad. |
| Media | El registro Empresa crea la experiencia, pero el frontend todavía no recopila todos los antecedentes para `commercial_profiles`; hasta entonces no existe fila empresarial completa. | No bloquea RLS, pero debe completarse antes de abrir registro empresarial al público. No confundir ausencia de antecedentes con verificación. |
| Media | `activate_experience` permite al propietario activar Cliente, Profesional o Negocio; no permite crear Empresa ni conceder `verified`. | Es una activación expresamente permitida. Empresa y verificación quedan fuera de esa RPC. |
| Baja | No existe una tabla formal de historial/versiones de migración. | Registrar manualmente fecha, checksum y operador, o adoptar Supabase CLI migrations antes de producción. |

## Migraciones anteriores: detección real

- Esquema base: deben existir `profiles`, `jobs`, `interests`, `portfolio`, `reviews`, `verifications`, triggers base y `pgcrypto`.
- v0.5: requiere ambas tablas de notificaciones, sus cinco policies y tres triggers. Que exista solo `notifications` no basta.
- v0.6: reemplaza `validate_job_update`. Comparar `pg_get_functiondef`; la versión correcta impide editar contenido después de seleccionar profesional.
- v0.7: solo puede considerarse aplicada si existen columnas `email_attempt*`, estados adicionales, las dos funciones, extensiones necesarias y permisos exclusivos de `service_role`. Es opcional para identidad v0.9.

Si v0.5 no está instalada, v0.9 funciona, pero la bandeja de notificaciones del frontend no tendrá backend. v0.7 nunca debe ejecutarse antes de v0.5. v0.6 es recomendable antes de v0.9 por la protección adicional de edición, aunque v0.9 no depende sintácticamente de ella.

## Matriz de autorización esperada

| Operación | Cliente | Profesional/Negocio | Empresa | Administrador/service role |
|---|---:|---:|---:|---:|
| Publicar trabajo | Sí | No, salvo Cliente adicional | Sí | Sí |
| Postular | No | Sí | Sí | Sí |
| Activar Cliente/Profesional/Negocio propio | Sí, mediante RPC | Sí, mediante RPC | Según experiencias | Sí |
| Crear experiencia Empresa | No mediante RPC pública | No | Solo alta inicial/flujo controlado | Sí |
| Cambiar experiencia principal | Solo a una propia activa | Igual | Igual | Sí |
| Marcar Empresa verificada | No | No | No | Sí |
| Leer documentos ajenos | No | No | No | Sí |

Las operaciones de selección, consentimiento, contacto compartido y evaluación conservan las policies y triggers anteriores. `get_shared_contact` sigue comprobando trabajo, selección, estado, doble consentimiento y participación. Las notificaciones v0.5 siguen aisladas por `recipient_id`; v0.9 no las reemplaza.

## Preparación del proyecto Supabase de ensayo

Para el proyecto vacío `arauka-staging`, la secuencia normativa está en `INSTALACION_ARAUKA_STAGING_v0.9.md`. La lista siguiente conserva los criterios generales de auditoría.

1. Crear un proyecto nuevo, con región y versión de Postgres equivalentes a producción. No reutilizar producción ni clonar secretos.
2. Guardar URL, anon key y service-role key únicamente como variables de sesión locales. La service-role key se usa solo por el arnés administrativo y nunca entra al frontend ni al repositorio.
3. Aplicar `supabase/schema.sql` en una base vacía.
4. Para reproducir el baseline seguro de la aplicación en staging, aplicar v0.6 y v0.5. Instalar v0.7 únicamente si se probará correo, con extensiones/Vault configurados por separado. En producción, decidir siempre a partir del inventario real.
5. Ejecutar `supabase/tests/v09_preflight_audit.sql` y guardar el resultado sin tokens ni datos personales.
6. Ejecutar `supabase/migration_v0.9_identity_experiences.sql` completo en una sola operación.
7. Ejecutar `supabase/tests/v09_postflight_audit.sql`; los conteos históricos deben coincidir y los cuatro conteos de inconsistencias deben ser cero.
8. Configurar variables solo en la terminal de ensayo y ejecutar manualmente el arnés. Ejemplo PowerShell, usando valores obtenidos del proyecto de ensayo:

```powershell
$env:SUPABASE_TEST_URL='https://REF_ENSAYO.supabase.co'
$env:SUPABASE_TEST_PROJECT_REF='REF_ENSAYO'
$env:SUPABASE_TEST_ANON_KEY='<anon de ensayo>'
$env:SUPABASE_TEST_SERVICE_ROLE_KEY='<service role de ensayo>'
$env:ARAUKA_ALLOW_REMOTE_TESTS='YES'
npm.cmd run test:supabase:v09
Remove-Item Env:SUPABASE_TEST_SERVICE_ROLE_KEY,Env:SUPABASE_TEST_ANON_KEY,Env:ARAUKA_ALLOW_REMOTE_TESTS
```

El arnés crea seis usuarios ficticios, usa sesiones autenticadas para operaciones permitidas/denegadas, prueba activación y experiencia principal, intenta modificar `is_professional`, intenta autoverificación y comprueba privacidad documental. Finalmente elimina únicamente los usuarios que él creó. La doble barrera `ARAUKA_ALLOW_REMOTE_TESTS` y `SUPABASE_TEST_PROJECT_REF` evita una ejecución casual, pero el operador sigue siendo responsable de confirmar visualmente el proyecto.

## Respaldo previo

1. Confirmar que Supabase muestra un backup reciente y anotar su fecha/retención.
2. Obtener además un dump lógico mediante una conexión de solo respaldo: esquema completo y datos de `profiles`, `jobs`, `interests`, `portfolio`, `reviews`, `verifications`, `notifications` y preferencias si existen.
3. Cifrar el dump, guardarlo fuera del repositorio y verificarlo restaurándolo en un proyecto vacío.
4. Registrar conteos preflight y checksum SHA-256 del archivo SQL que se instalará.
5. No copiar contraseñas de Auth, documentos privados ni secretos a ensayo.

## Despliegue por fases

1. Inventario remoto de solo lectura y backup verificado.
2. Ensayo desde una copia anonimizada o datos sintéticos; ejecutar toda la matriz.
3. Aplicar v0.6 si el inventario demuestra que falta. Aplicar v0.5 solo si se requiere notificaciones; v0.7 solo después de v0.5 y de preparar extensiones/Vault.
4. Aplicar v0.9. La versión pública anterior seguirá abriendo: el trigger mantiene `is_professional`; sin embargo, su botón antiguo de activación profesional fallaría porque ya no puede editar ese campo.
5. Reducir esa ventana publicando inmediatamente el frontend v0.9 ya preparado, que activa mediante RPC y tolera ausencia temporal de la vista con fallback legado.
6. Ejecutar postflight, pruebas autenticadas y smoke tests de selección, consentimiento, evaluación y notificaciones.
7. Habilitar registro Empresa solo después de completar el formulario de antecedentes y el procedimiento administrativo.

No publicar primero el frontend v0.9 durante un periodo largo: un alta Profesional contra la base antigua ignora `initial_experience` y quedaría inicialmente como Cliente. El orden preferido es base v0.9 y, tras postflight, frontend v0.9 en la misma ventana controlada.

## Recuperación

- Error antes de `COMMIT`: PostgreSQL revierte toda v0.9. Investigar, corregir y reejecutar; no borrar objetos manualmente.
- Error de postflight con transacción confirmada: detener nuevas altas y volver temporalmente al frontend anterior. No ejecutar un DROP automático.
- Si hay corrupción o pérdida de filas históricas, restaurar el backup en un proyecto nuevo y cambiar tráfico solo después de comparar conteos.
- Si únicamente falla una policy, preparar una migración correctiva transaccional revisada; no editar producción de forma improvisada.
- El rollback destructivo de tablas v0.9 solo es aceptable si no se crearon datos nuevos bajo ellas. Primero restaurar policies anteriores y el trigger anterior, después retirar vista, tablas y tipos en orden inverso.
