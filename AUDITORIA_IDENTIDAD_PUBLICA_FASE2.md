# ARAUKA — Auditoría y diseño de identidad pública, Fase 2

Estado: propuesta local. `migration_v0.9.4.1_public_provider_projection.sql` **NO está autorizada** para Staging ni Producción. v0.9.5 continúa NO AUTORIZADA.

## Diagnóstico de arquitectura

### Fuente de verdad

La fuente de verdad es `public.account_experiences`, no `profiles.is_professional`:

| Experiencia | `profile_kind` | Identidad pública propuesta |
|---|---|---|
| `maestro` | `professional` | Profesional independiente |
| `maestro` | `business` | Negocio independiente |
| `empresa` | `company` | Empresa |
| `cliente` | `personal` | No aparece como prestador |

`profiles.is_professional` quedó documentado en v0.9 como compatibilidad heredada. Puede estar desincronizado y no debe decidir identidad ni autorización. `account_identities.primary_experience` determina la experiencia principal de navegación, pero no si una capacidad comercial existe.

Una cuenta Cliente + Empresa se proyecta una sola vez como Empresa. Cliente permanece como capacidad de contratación, no como segunda ficha. La candidata bloquea la instalación si una misma cuenta tiene simultáneamente `maestro` y `empresa`: el esquema actual solo permite un `commercial_profiles` por usuario y no puede representar dos identidades comerciales sin ambigüedad. No existe hoy una RPC de desactivación; las activaciones son persistentes y un cambio `professional` ↔ `business` requiere un flujo dedicado.

### Datos públicos mínimos

La salida propuesta contiene exclusivamente:

- `user_id`;
- `profile_kind` como texto;
- `public_name`;
- `bio`;
- `services`;
- `coverage`;
- `is_company_verified` como booleano.

El nombre público usa `commercial_profiles.public_name` cuando corresponde al mismo `profile_kind`, con fallback a los campos públicos históricos de `profiles`. Servicios, cobertura y biografía provienen de `profiles`, que ya son públicos y son sincronizados por el registro Empresa. No se proyecta el estado `pending` o `rejected`: ambos producen solamente `is_company_verified=false`.

Quedan fuera RUT, razón social, tipo tributario, dirección, representante, correo, teléfono, contactos, documentos, fechas o responsables de revisión, motivos, notas, Auth metadata y tokens.

### Clientes, cuentas históricas y v0.9.5

- Un Cliente puro queda fuera porque no tiene `maestro` ni `empresa`.
- La RPC exige una fila vigente en `auth.users`; un perfil histórico desligado de Auth no aparece.
- También evalúa `to_jsonb(profiles)->>'deleted_at'`: funciona cuando la columna todavía no existe y excluye inmediatamente un perfil marcado como eliminado si v0.9.5 llegara a instalarse después de su revisión.
- La propuesta no concede capacidad: solo refleja filas ya autorizadas por los flujos existentes.

## Vista versus RPC

| Criterio | Vista | RPC propuesta |
|---|---|---|
| RLS de tablas privadas | `security_invoker` no puede leerlas para anon; una vista con privilegios del propietario introduce bypass implícito | Bypass explícito, limitado al cuerpo y contrato de una función |
| Contrato | Columnas visibles, pero sensible a propiedad y opciones de vista | `RETURNS TABLE` cerrado y auditable |
| `search_path` | No ofrece el mismo control por llamada | Fijado a `pg_catalog,public` |
| Privilegios | Requiere `SELECT` sobre vista y cuidar comportamiento definer/invoker | Solo `EXECUTE`; sin nuevos grants sobre tablas |
| PostgREST | Compatible | Compatible mediante `rpc/list_public_providers` y rangos HTTP |
| Enumeración | Similar al directorio público existente | Similar; no acepta UUID ni permite consultar una cuenta arbitraria |
| Mantenimiento | Consulta sencilla | Algo más explícita, pero concentra seguridad, salida y filtros |

Recomendación: RPC `SECURITY DEFINER`, `STABLE`, sin parámetros, `row_security=off`, propietario confiable y `search_path` seguro. `row_security=off` hace que una propiedad/configuración incorrecta falle en vez de devolver un conjunto parcial engañoso. La función recibe `EXECUTE` solo para `anon` y `authenticated`; `PUBLIC` y `service_role` quedan revocados.

## Matriz de privilegios y privacidad

| Objeto | anon | authenticated | service_role | Observación |
|---|---|---|---|---|
| `list_public_providers()` | EXECUTE | EXECUTE | Sin EXECUTE | Directorio público, salida cerrada |
| `account_experiences` | Sin SELECT | SELECT sujeto a RLS propietario | Conserva grants previos | La candidata no cambia permisos |
| `commercial_profiles` | Sin SELECT | SELECT sujeto a RLS propietario | Conserva grants administrativos mínimos | No se hace pública |
| `account_identities` | Sin SELECT | SELECT sujeto a RLS propietario | Conserva grants previos | No participa en la salida |
| `profiles` | SELECT público existente | SELECT público existente | Sin cambios | Solo se usan columnas ya públicas |
| Datos empresariales privados | Sin acceso nuevo | Sin acceso nuevo | Sin cambios | Nunca forman parte del retorno |

La función no acepta parámetros, por lo que no agrega una vía para sondear UUID, errores diferenciados o información privada por cuenta. La enumeración de prestadores es deliberada y equivalente al directorio público.

## Archivos SQL candidatos

1. `supabase/tests/v0941_public_provider_preflight.sql`: lectura consolidada; bloquea combinaciones ambiguas, dependencias faltantes o permisos públicos inesperados.
2. `supabase/migration_v0.9.4.1_public_provider_projection.sql`: candidata transaccional; crea únicamente la RPC.
3. `supabase/tests/v0941_public_provider_postflight.sql`: verifica firma, propietario, configuración, ACL, privacidad, duplicados y tipos.
4. `supabase/tests/v0941_public_provider_rollback.sql`: rollback de esquema; retira únicamente la RPC. Requiere aprobación independiente y frontend anterior activo.

La migración rechaza una segunda ejecución si la función ya existe. No modifica datos, RLS, tablas, identidades ni v0.9.5. La operación `CREATE FUNCTION` toma bloqueos de catálogo breves; no recorre ni reescribe tablas durante la instalación. Las lecturas del directorio sí dependen de índices primarios existentes por `user_id`; el volumen actual no justifica índices adicionales.

## Compatibilidad frontend pendiente

No se implementó integración dependiente de la RPC. Después de una instalación controlada y postflight aprobado, el cambio mínimo sería:

1. Crear un tipo de transporte para la fila RPC con `profile_kind: 'professional' | 'business' | 'company'`.
2. Sustituir el filtro público `profiles.is_professional` y la consulta separada a `verified_companies` por `supabase.rpc('list_public_providers')`.
3. Mapear `professional` → «Profesional independiente», `business` → «Negocio independiente», `company` → «Empresa».
4. Mantener azul para Profesional/Negocio y morado para Empresa.
5. Mostrar una sola insignia «Empresa verificada» únicamente si `profile_kind='company' && is_company_verified`.
6. Conservar portfolio y reviews públicos por `user_id`, filtros, navegación y fallback actuales.
7. Mantener un modo compatible durante el despliegue: base primero, verificar RPC, publicar frontend después. El frontend actual continúa funcionando mientras tanto.

No debe mantenerse el fallback heurístico de identidad. Si la RPC falla, el directorio debe mostrar estado de error, no reconstruir tipos desde `company_name`, `is_professional` o categorías.

## Riesgos y bloqueos

- **Bloqueante:** cualquier cuenta con `maestro` y `empresa` simultáneos debe resolverse mediante decisión de producto antes de instalar.
- **Bloqueante:** propietario de la función perteneciente a `anon`, `authenticated` o `service_role`.
- **Bloqueante:** `anon` con SELECT directo sobre `account_experiences` o `commercial_profiles`.
- **Bloqueante:** contrato o ACL diferente al postflight.
- **Riesgo controlado:** el directorio permite enumerar prestadores activos, comportamiento necesario y ya existente en Fase 1.
- **Riesgo de despliegue:** el frontend nuevo no debe publicarse antes de que la RPC exista y pase postflight.
- **Limitación actual:** una cuenta no puede publicar dos identidades comerciales simultáneas con `commercial_profiles` 1:1.

## Orden eventual de ensayo (no autorizado todavía)

1. Confirmar respaldo y punto de reversión.
2. Ejecutar el preflight de solo lectura y exportar el resultado.
3. Exigir cero bloqueos y revisar conteos por tipo.
4. Instalar la migración candidata en una ventana de Staging.
5. Ejecutar el postflight completo.
6. Probar la RPC como anon y authenticated con datos ficticios autorizados.
7. Solo entonces implementar/publicar el frontend consumidor.
8. Ante fallo antes del frontend, ejecutar el rollback aprobado. Después del frontend, restaurar primero la versión anterior de la aplicación.

## Dictamen

**READY para revisión estática y para ejecutar preflight de solo lectura. BLOCKED para instalación** hasta disponer de resultados reales del preflight de Staging, respaldo verificado y autorización expresa. La propuesta no autoriza v0.9.5 ni modifica su estado.
