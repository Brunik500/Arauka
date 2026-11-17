import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const fk=await readFile(new URL('../supabase/tests/v095_fk_topology_audit.sql',import.meta.url),'utf8')
const structural=await readFile(new URL('../supabase/tests/v095_structural_preflight.sql',import.meta.url),'utf8')
const backup=await readFile(new URL('../RESPALDO_RESTAURACION_STAGING_v0.9.5.md',import.meta.url),'utf8')

const executableLines=(sql)=>sql.split(/\r?\n/).filter(line=>!line.trim().startsWith('--')).join('\n')

test('la matriz FK cubre dependencias criticas y detecta diferencias',()=>{
  assert.match(fk,/\('public','profiles','id','auth','users','id','CASCADE',true\)/)
  assert.match(fk,/commercial_profiles','verification_reviewed_by'.*'NO ACTION'/)
  assert.match(fk,/administrative_reviewers','granted_by'.*'NO ACTION'/)
  assert.match(fk,/account_registration_intents','user_id'.*'CASCADE'/)
  assert.match(fk,/full join actual/)
  assert.match(fk,/ADICIONAL/)
  assert.match(fk,/FALTANTE/)
  assert.match(fk,/INCOMPATIBLE/)
  assert.match(fk,/installation_blockers/)
})

test('los SQL preflight son exclusivamente de lectura',()=>{
  for(const sql of [fk,structural]) {
    const executable=executableLines(sql)
    assert.doesNotMatch(executable,/\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|call|do)\b\s+(into|table|function|policy|trigger|on|from|\$\$)/i)
    assert.match(executable,/\bselect\b/i)
  }
})

test('el preflight estructural valida v094, ausencia v095, Auth y Storage',()=>{
  assert.match(structural,/complete_initial_company_activation\(\)/)
  assert.match(structural,/trigger_create_arauka_profile/)
  assert.match(structural,/profiles\.auth_user_id/)
  assert.match(structural,/account_deletion_requests/)
  assert.match(structural,/profiles sin auth\.users/)
  assert.match(structural,/\('portfolio',true\),\('company-documents',false\)/)
  assert.match(structural,/jobs status matched/)
  assert.match(structural,/preflight_structural_ok/)
})

test('la guia distingue PostgreSQL, Auth y binarios Storage sin secretos',()=>{
  assert.match(backup,/CSV de tablas no basta/)
  assert.match(backup,/esquemas administrados como `auth` y `storage`/)
  assert.match(backup,/no los archivos Storage/)
  assert.match(backup,/Restore to a New Project/)
  assert.match(backup,/checksums/i)
  assert.match(backup,/qviiiomipsulvjpstyzw/)
  assert.doesNotMatch(backup,/sb_secret_|service_role\s*[=:]|postgres(?:ql)?:\/\/[^\s]*:[^@\s]+@/i)
})
