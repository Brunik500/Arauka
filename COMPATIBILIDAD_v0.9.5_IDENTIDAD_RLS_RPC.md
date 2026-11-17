# Compatibilidad v0.9.5 — Identidad, RLS y RPC

## Invariante

Una cuenta activa conserva `profiles.id = profiles.auth_user_id = auth.uid()`. Un actor eliminado conserva `profiles.id`, pero tiene `auth_user_id IS NULL` y `deleted_at IS NOT NULL`. Ninguna autorización puede depender solamente de `profiles.id`.

## Matriz

| Área | Antes | Ajuste v0.9.5 | Resultado esperado |
|---|---|---|---|
| Perfil público | `profiles` visible para todos | policy exige `deleted_at IS NULL` | actor histórico no aparece públicamente |
| Edición de perfil | `id=auth.uid()` | `id=current_actor_id()` | sólo vínculo Auth activo |
| Publicar/editar trabajo | `client_id=auth.uid()` | `client_id=current_actor_id()` | actor eliminado no autoriza |
| Postulaciones | `pro_id=auth.uid()` | `pro_id=current_actor_id()` y capacidad Auth vigente | conserva autorización actual |
| Portfolio DB | `pro_id=auth.uid()` | actor activo explícito | historial no concede escritura |
| Evaluaciones actuales | Cliente por UUID Auth | Cliente por actor activo | misma capacidad, sin perfiles históricos |
| Storage | carpeta `auth.uid()` más experiencia Auth | sin cambio | experiencias caen al borrar Auth; carpeta se limpia por servidor |
| Identidades/experiencias | FK directa a Auth | sin cambio | se eliminan con Auth, no pertenecen al actor histórico |
| Empresa/RPC | `auth.uid()` y experiencia directa Auth | sin cambio funcional | no existe experiencia después de borrar Auth |
| Frontend | usa UUID de sesión como profile id | invariante preservada para cuentas activas | no requiere cambio de payload |

## Acoplamientos todavía válidos

`account_identities`, `account_experiences`, `commercial_profiles`, documentos, contactos, preferencias, notificaciones y membresía administrativa representan una cuenta activa y deben seguir referenciando `auth.users`. No deben migrarse al actor histórico.

`get_shared_contact` y las RPC existentes comparan UUID Auth con actor. Funcionan mientras se mantiene la invariante activa; después de eliminar Auth no existe sesión ni contacto privado. Antes de autorizar Staging debe agregarse una prueba autenticada que confirme publicación, selección, consentimiento y lectura de contacto con `auth_user_id` poblado.

Las consultas frontend siguen usando el UUID de sesión para buscar el perfil propio. Esto continúa siendo válido para cuentas activas porque el trigger impide crear un vínculo donde `auth_user_id <> id`. Los perfiles históricos quedan fuera del `SELECT` público por `deleted_at IS NULL`; las pantallas de historial deben tolerar que el perfil relacionado no esté en el conjunto público y mostrar una etiqueta neutral.

La migración no modifica las FK de `jobs`, `interests`, `reviews`, `portfolio` ni `verifications` hacia `profiles`: sus UUID históricos se conservan. Sólo sustituye `profiles.id -> auth.users CASCADE` por `profiles.auth_user_id -> auth.users SET NULL` y cambia a `SET NULL` las dos referencias de trazabilidad administrativa que antes bloqueaban el borrado.

## Riesgo de reutilización

Un actor histórico no puede reactivarse: `auth_user_id` sólo se asigna en el trigger de alta cuando coincide con el nuevo `profiles.id`; el perfil histórico conserva su UUID y Auth no reutiliza ese UUID. No se ofrece RPC para vincular un Auth nuevo a un actor existente.
