import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('la candidata es transaccional, solo crea una RPC y no toca v0.9.5',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  assert.match(sql,/^begin;/m);assert.match(sql,/commit;/)
  assert.match(sql,/create or replace function public\.list_public_providers\(\)/)
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|truncate|alter table|create table|drop table)\b/i)
  assert.doesNotMatch(sql,/account_deletion|anonymize_account|migration_v0\.9\.5/i)
})

test('la RPC usa definer endurecido y privilegios mínimos',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  assert.match(sql,/security definer/i)
  assert.match(sql,/set search_path=pg_catalog,public/i)
  assert.match(sql,/set row_security=off/i)
  assert.match(sql,/alter function public\.list_public_providers\(\) owner to current_user/i)
  assert.match(sql,/rolsuper or rolbypassrls/i)
  assert.match(sql,/revoke all on function public\.list_public_providers\(\) from public,anon,authenticated,service_role/i)
  assert.match(sql,/grant execute on function public\.list_public_providers\(\) to anon,authenticated/i)
  assert.doesNotMatch(sql,/grant select on (?:public\.)?(?:account_experiences|commercial_profiles|account_identities)/i)
})

test('el contrato público es cerrado y no filtra campos privados',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  for(const field of ['user_id uuid','profile_kind text','public_name text','bio text','services text[]','coverage text[]','is_company_verified boolean'])assert.match(sql,new RegExp(field.replace(/[\[\]]/g,'\\$&')))
  const signature=sql.slice(sql.indexOf('returns table('),sql.indexOf('language sql'))
  for(const forbidden of ['tax_id','legal_name','legal_type','tax_address','representative_name','contact_email','business_phone','verification_status','verification_reviewed','document','token'])assert.doesNotMatch(signature,new RegExp(forbidden,'i'))
})

test('Cliente puro queda fuera y la identidad proviene de account_experiences',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  assert.match(sql,/from public\.account_experiences e/)
  assert.match(sql,/e\.experience='maestro'.*e\.profile_kind in \('professional','business'\)/s)
  assert.match(sql,/e\.experience='empresa'.*e\.profile_kind='company'/s)
  assert.doesNotMatch(sql,/p\.is_professional/)
})

test('la reejecución es segura y la salida mantiene una fila por usuario',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  assert.match(sql,/create or replace function/)
  assert.doesNotMatch(sql,/list_public_providers\(\) ya existe/)
  assert.match(sql,/row_number\(\) over\(/)
  assert.match(sql,/partition by e\.user_id/)
  assert.match(sql,/where e\.public_rank=1/)
})

test('la verificación solo produce booleano y no expone pending o rejected',async()=>{
  const sql=await read('supabase/migration_v0.9.4.1_public_provider_projection.sql')
  assert.match(sql,/e\.profile_kind='company' and c\.verification_status='verified'/)
  const selectBody=sql.slice(sql.indexOf('select\n    p.id'),sql.indexOf('from ranked_experiences'))
  assert.doesNotMatch(selectBody,/pending|rejected/)
})

test('preflight y postflight son de lectura; rollback solo retira la RPC',async()=>{
  const pre=await read('supabase/tests/v0941_public_provider_preflight.sql')
  const post=await read('supabase/tests/v0941_public_provider_postflight.sql')
  for(const audit of [pre,post])assert.doesNotMatch(audit,/\b(?:insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/i)
  const rollback=await read('supabase/tests/v0941_public_provider_rollback.sql')
  assert.match(rollback,/drop function public\.list_public_providers\(\)/)
  assert.doesNotMatch(rollback,/\b(?:delete|truncate|drop table|alter table)\b/i)
})

test('el postflight usa columnas reales de information_schema.parameters y el OID exacto',async()=>{
  const post=await read('supabase/tests/v0941_public_provider_postflight.sql')
  assert.doesNotMatch(post,/select\s+column_name\s+from\s+information_schema\.parameters/i)
  assert.match(post,/parameters\.parameter_name as column_name/)
  assert.match(post,/parameters\.specific_name='list_public_providers_'\|\|target\.oid::text/)
  assert.match(post,/parameters\.ordinal_position/)
})
