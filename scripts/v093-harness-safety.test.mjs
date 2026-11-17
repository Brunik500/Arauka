import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const harness=new URL('./test-v093-supabase.mjs',import.meta.url)

test('v0.9.3 valida destino y privilegios antes de crear usuarios',async()=>{
  const source=await readFile(harness,'utf8')
  assert.ok(source.indexOf('validateRemoteTestEnvironment(process.env)')<source.indexOf('createClient(url,serviceKey'))
  const main=source.slice(source.indexOf('async function main()'))
  assert.ok(main.indexOf('await verifyReadOnlyAccess()')<main.indexOf("await actor('empresa'"))
  assert.match(source,/administrative_reviewers'\)\.select\('user_id',\{count:'exact',head:true\}\)/)
})

test('v0.9.3 limpia Storage, empresas, grant y revisor en orden de dependencias',async()=>{
  const source=await readFile(harness,'utf8')
  const cleanup=source.slice(source.indexOf('finally{'))
  const storage=cleanup.indexOf("company-documents').remove(storagePaths)")
  const owner=cleanup.indexOf("deleteActor('empresa')")
  const otherCompany=cleanup.indexOf("deleteActor('otra-empresa')")
  const grant=cleanup.indexOf("administrative_reviewers').delete()")
  const references=cleanup.indexOf("eq('verification_reviewed_by',reviewerRecord.id)")
  const reviewer=cleanup.indexOf("deleteActor('revisor')")
  assert.ok(storage>=0&&storage<owner&&owner<otherCompany&&otherCompany<grant&&grant<references&&references<reviewer)
  assert.match(cleanup,/existing\.data\.note!==reviewerGrant\.note/)
  assert.match(cleanup,/administrative_reviewers'\)\.delete\(\)\.eq\('user_id',reviewerGrant\.userId\)\.eq\('note',reviewerGrant\.note\)/)
  assert.match(cleanup,/if\(companiesRemoved&&businessRemoved&&reviewerGrantRemoved&&referencesCleared\)await deleteActor\('revisor'\)/)
  assert.doesNotMatch(cleanup,/created\.entries\(\)\]\.reverse/)
  assert.match(source,/lookup\.data\.user\?\.id!==record\.id\|\|lookup\.data\.user\?\.email!==record\.address/)
  assert.match(source,/record\.address\.startsWith\(expectedPrefix\)/)
})

test('v0.9.3 no borra el revisor si falla una empresa o quedan referencias',async()=>{
  const source=await readFile(harness,'utf8')
  assert.match(source,/const companiesRemoved=ownerRemoved&&otherCompanyRemoved/)
  assert.match(source,/references\.data\.length[\s\S]*referencesCleared=true/)
  assert.match(source,/else console\.error\(`Revisor ficticio conservado para evitar romper integridad referencial/)
})

test('v0.9.3 no imprime claves, contrasena ni tokens',async()=>{
  const source=await readFile(harness,'utf8')
  for(const call of source.matchAll(/console\.(?:log|error)\(([^\n]*)/g))assert.doesNotMatch(call[1],/serviceKey|anonKey|password|token/i)
})
