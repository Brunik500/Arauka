import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const panel=await readFile(new URL('../src/components/AccountDeletionPanel.tsx',import.meta.url),'utf8')
const endpoint=await readFile(new URL('../supabase/functions/delete-account/index.ts',import.meta.url),'utf8')
const migration=await readFile(new URL('../supabase/migration_v0.9.5_account_deletion_foundation.sql',import.meta.url),'utf8')

test('la interfaz distingue cuenta completa, exige confirmación y permite cancelar',()=>{
  assert.match(panel,/Eliminar toda mi cuenta/)
  assert.match(panel,/ELIMINAR/)
  assert.match(panel,/Contraseña actual/)
  assert.match(panel,/>Cancelar</)
  assert.match(panel,/todas? mi cuenta|cuenta completa/i)
})

test('la eliminación permanece bloqueada y no envía secretos ni solicitudes',()=>{
  assert.match(panel,/Eliminar permanentemente<\/button>/)
  assert.match(panel,/danger-action" disabled/)
  assert.doesNotMatch(panel,/functions\.invoke|service_role|sb_secret|localStorage|sessionStorage/)
  assert.match(endpoint,/ACCOUNT_DELETION_NOT_ENABLED/)
  assert.doesNotMatch(endpoint,/deleteUser|storage\.from|auth\.admin|SUPABASE_SERVICE_ROLE_KEY/)
})

test('cerrar limpia contraseña y confirmación',()=>{
  assert.match(panel,/const close=\(\)=>\{setOpen\(false\);setConfirmation\(''\);setPassword\(''\)\}/)
})

test('la base conserva actores históricos y bloquea acuerdos activos',()=>{
  assert.match(migration,/auth_user_id uuid/)
  assert.match(migration,/on delete set null/)
  assert.match(migration,/status='matched'/)
  assert.match(migration,/blocked_active_agreement/)
  assert.match(migration,/Cuenta eliminada/)
  assert.match(migration,/deleted_at=coalesce\(deleted_at,now\(\)\)/)
  assert.match(migration,/using\(deleted_at is null\)/)
  assert.match(migration,/review_retention_queue/)
  assert.match(migration,/Comentario temporalmente retirado para revisión de privacidad/)
  assert.doesNotMatch(migration,/delete\s+from\s+auth\.users/i)
})

test('la anonimización es sólo de servidor y no toca Storage ni Auth',()=>{
  assert.match(migration,/auth\.role\(\) is distinct from 'service_role'/)
  assert.match(migration,/revoke all on function public\.anonymize_account_for_deletion\(uuid,uuid\) from public,anon,authenticated/)
  assert.doesNotMatch(migration,/storage\.objects|auth\.admin/)
})

test('RLS resuelve un actor Auth activo y oculta el histórico',()=>{
  assert.match(migration,/create or replace function public\.current_actor_id\(\)/)
  assert.match(migration,/where p\.auth_user_id=auth\.uid\(\) and p\.deleted_at is null/)
  assert.match(migration,/client_id=public\.current_actor_id\(\)/)
  assert.match(migration,/pro_id=public\.current_actor_id\(\)/)
  assert.doesNotMatch(migration,/using\(id=auth\.uid\(\)\)/)
})

test('la migración rechaza esquema inesperado y una segunda instalación',()=>{
  assert.match(migration,/v0\.9\.5 ya parece instalada o existen objetos parciales; no reejecutar/)
  assert.match(migration,/FK profiles\.id -> auth\.users CASCADE no coincide/)
  assert.match(migration,/La topologia de FK de trabajos, postulaciones o evaluaciones difiere/)
  assert.match(migration,/Las FK de trazabilidad administrativa difieren/)
  assert.doesNotMatch(migration,/alter table public\.profiles add column if not exists/)
})

test('Auth sólo puede desligarse después de marcar el perfil eliminado',()=>{
  assert.match(migration,/profiles_active_or_historical_check/)
  assert.match(migration,/auth_user_id is null and deleted_at is not null/)
})

test('instalar la base no invoca anonimización ni elimina Auth',()=>{
  assert.match(migration,/^begin;/m)
  assert.match(migration,/commit;/)
  assert.doesNotMatch(migration,/select\s+public\.anonymize_account_for_deletion|call\s+public\.anonymize_account_for_deletion/i)
  assert.doesNotMatch(migration,/delete\s+from\s+auth\.users/i)
})

test('endurece funciones privilegiadas instaladas y tolera v0.7 ausente',()=>{
  assert.match(migration,/alter function public\.create_profile_for_user\(\) set search_path=pg_catalog,public/)
  assert.match(migration,/if to_regprocedure\('public\.claim_notification_email\(uuid\)'\) is not null/)
  assert.match(migration,/dispatch_notification_email_batch\(integer\) set search_path=pg_catalog,public,extensions,net,vault/)
  assert.doesNotMatch(migration,/set search_path=[^;\n]*pg_temp/)
})
