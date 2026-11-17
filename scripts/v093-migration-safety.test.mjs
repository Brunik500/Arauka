import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migration=new URL('../supabase/migration_v0.9.3_company_registration.sql',import.meta.url)

test('v0.9.3 es transaccional y no contiene operaciones destructivas sobre datos existentes',async()=>{
  const sql=(await readFile(migration,'utf8')).toLowerCase()
  assert.match(sql,/\bbegin\s*;/)
  assert.match(sql,/\bcommit\s*;/)
  assert.doesNotMatch(sql,/\btruncate\b|\bdrop\s+table\b|\bdelete\s+from\s+public\.(profiles|jobs|interests|reviews|portfolio|notifications)\b/)
})

test('v0.9.3 no concede escritura empresarial directa a usuarios normales',async()=>{
  const sql=(await readFile(migration,'utf8')).toLowerCase()
  assert.doesNotMatch(sql,/grant\s+(insert|update|delete)[^;]*commercial_profiles[^;]*authenticated/)
  assert.match(sql,/revoke all on function %s from public,anon/)
  assert.match(sql,/grant execute on function %s to authenticated/)
})

test('la revisión exige allowlist administrativa y solo acepta verified o rejected',async()=>{
  const sql=(await readFile(migration,'utf8')).toLowerCase()
  assert.match(sql,/is_administrative_reviewer\(\)[\s\S]*administrative_reviewers[\s\S]*auth\.uid\(\)/)
  assert.match(sql,/p_decision not in \('verified','rejected'\)/)
})

test('las firmas SQL declaradas coinciden con sus referencias y validaciones ACL',async()=>{
  const sql=await readFile(migration,'utf8')
  const declaration=(name)=>{
    const match=sql.match(new RegExp(`create or replace function public\\.${name}\\(([\\s\\S]*?)\\) returns`,'i'))
    assert.ok(match,`falta declaración de ${name}`)
    if(!match[1].trim())return []
    return match[1].split(',').map(argument=>argument.trim().split(/\s+/).slice(1).join(' ').toLowerCase())
  }
  const ownerTypes=['text','text','text','text','text','text','text','text','text','text','text','text[]','text[]']
  assert.deepEqual(declaration('upsert_my_company_profile'),ownerTypes)
  assert.deepEqual(declaration('review_company_verification'),['uuid','public.arauka_verification_status'])
  assert.deepEqual(declaration('is_administrative_reviewer'),[])
  assert.match(sql,/p\.pronargs=13/)
  assert.ok(sql.includes(`oidvectortypes(p.proargtypes)='${ownerTypes.join(', ')}'`))
  for(const match of sql.matchAll(/(?:grant execute|revoke all) on function public\.([a-z0-9_]+)\(([^)]*)\)/gi)){
    const referenced=match[2].trim()?match[2].split(',').map(type=>type.trim().toLowerCase()):[]
    assert.deepEqual(referenced,declaration(match[1]),`firma ACL distinta para ${match[1]}`)
  }
})
