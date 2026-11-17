import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migration=await readFile(new URL('../supabase/migration_v0.9.4_initial_company_registration.sql',import.meta.url),'utf8')
const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
const harness=await readFile(new URL('./test-v093-supabase.mjs',import.meta.url),'utf8')

test('v0.9.4 es transaccional, incremental y no reescribe datos históricos',()=>{
  assert.match(migration,/^begin;/m)
  assert.match(migration,/commit;/)
  assert.doesNotMatch(migration,/drop\s+table|truncate|delete\s+from|update\s+public\.commercial_profiles/i)
})

test('el trigger conserva Cliente y agrega Empresa company como selección inicial',()=>{
  assert.match(migration,/values\(new\.id,'cliente','personal'\)/)
  assert.match(migration,/elsif v_choice='company' then v_exp:='empresa';v_kind:='company'/)
  assert.match(migration,/values\(new\.id,v_exp,v_kind\)/)
  assert.match(migration,/values\(new\.id,v_exp\) on conflict\(user_id\) do nothing/)
})

test('la reconciliación exige una intención inmutable y nunca verifica la empresa',()=>{
  assert.match(migration,/account_registration_intents/)
  assert.match(migration,/where user_id=v_user and initial_experience='company'/)
  assert.equal(migration.match(/security definer set search_path=pg_catalog,public/g)?.length,2)
  assert.doesNotMatch(migration,/security definer set search_path=[^\n]*pg_temp/i)
  assert.doesNotMatch(migration,/verification_status\s*=|values\s*\([^)]*'verified'/i)
  assert.match(migration,/revoke all on function public\.complete_initial_company_activation\(\) from public,anon/)
  assert.match(migration,/revoke all on function public\.complete_initial_company_activation\(\) from service_role/)
  assert.match(migration,/grant execute on function public\.complete_initial_company_activation\(\) to authenticated/)
})

test('preflight valida el trigger y ninguna API puede fabricar intenciones',()=>{
  assert.match(migration,/t\.tgrelid='auth\.users'::regclass/)
  assert.match(migration,/t\.tgname='trigger_create_arauka_profile'/)
  assert.match(migration,/p\.proname='create_profile_for_user'/)
  assert.match(migration,/revoke all on table public\.account_registration_intents from public,anon,authenticated,service_role/)
  assert.match(migration,/grant select on table public\.account_registration_intents to service_role/)
  assert.doesNotMatch(migration,/grant\s+(?:select,)?insert[^;]*account_registration_intents/i)
  assert.match(migration,/revoke all on function public\.create_profile_for_user\(\) from public,anon,authenticated,service_role/)
  assert.match(migration,/account_registration_intents existe con una estructura incompatible/)
  assert.match(migration,/c\.confdeltype='c'/)
  assert.match(migration,/pg_catalog\.pg_get_expr\(c\.conbin,c\.conrelid\)/)
})

test('el inicio de sesión reconcilia solo la selección company antes de navegar',()=>{
  const intent=app.indexOf("if(initialExperience==='company')")
  const rpc=app.indexOf("supabase.rpc('complete_initial_company_activation')")
  const refresh=app.indexOf('await refresh()',rpc)
  const route=app.indexOf("const destination=initialExperience==='company'?'empresa':mode")
  assert.ok(intent>=0&&rpc>intent&&refresh>rpc&&route>refresh)
  assert.doesNotMatch(app,/from\('account_experiences'\)\.insert/)
})

test('todas las entradas de registro capturan la intención visible antes de signUp',()=>{
  assert.match(app,/function chooseExperience\(role:Mode,choice:RegistrationChoice='client'\)\{goRoute\('inicio',role,null,null\);requestAuth\('registro',choice\)\}/)
  assert.match(app,/const requestAuth=\(kind:AuthKind='registro',choice\?:RegistrationChoice\)=>\{[^\n]*choice\?\?registrationChoiceForMode\(mode,current\)/)
  assert.match(app,/if\(kind==='registro'\)setRegistrationChoice\(current=>registrationChoiceForMode\(mode,current\)\)/)
  assert.doesNotMatch(app,/auth\.updateUser|user_metadata\s*:/)
})

test('el arnés cubre idempotencia, coexistencia, denegación y estado pendiente',()=>{
  assert.equal(harness.match(/rpc\('complete_initial_company_activation'\)/g)?.length,3)
  assert.match(harness,/experience==='cliente'&&item\.profile_kind==='personal'/)
  assert.match(harness,/experience==='empresa'&&item\.profile_kind==='company'&&item\.is_primary/)
  assert.match(harness,/assert\.equal\(createdProfile\.data\.verification_status,'pending'\)/)
})
