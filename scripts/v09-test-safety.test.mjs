import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRemoteTestEnvironment } from './v09-test-safety.mjs'

const ref='abcdefghijklmnopqrst'
const production='zyxwvutsrqponmlkjihg'
const valid={ARAUKA_ALLOW_REMOTE_TESTS:'YES',SUPABASE_TEST_URL:`https://${ref}.supabase.co`,SUPABASE_TEST_ANON_KEY:'sb_publishable_placeholder',SUPABASE_TEST_SERVICE_ROLE_KEY:'sb_secret_placeholder',SUPABASE_TEST_PROJECT_REF:ref,SUPABASE_PRODUCTION_PROJECT_REF:production,ARAUKA_STAGING_CONFIRMATION:`arauka-staging:${ref}`}

test('acepta solamente la combinación explícita de staging',()=>assert.equal(validateRemoteTestEnvironment(valid).expectedRef,ref))
test('bloquea sin habilitación explícita',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,ARAUKA_ALLOW_REMOTE_TESTS:'NO'}),/Protección activa/))
test('bloquea cuando staging coincide con producción',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,SUPABASE_PRODUCTION_PROJECT_REF:ref}),/coincide con producción/))
test('bloquea un URL que no coincide exactamente con la referencia',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,SUPABASE_TEST_URL:`https://${production}.supabase.co`}),/debe ser exactamente/))
test('bloquea una confirmación que no nombra arauka-staging',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,ARAUKA_STAGING_CONFIRMATION:`otro:${ref}`}),/Confirmación inválida/))
test('bloquea una clave pública secreta',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,SUPABASE_TEST_ANON_KEY:'sb_secret_error'}),/clave pública/))
test('bloquea una clave administrativa publicable',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,SUPABASE_TEST_SERVICE_ROLE_KEY:'sb_publishable_error'}),/clave administrativa/))
test('bloquea espacios o saltos de línea en claves',()=>assert.throws(()=>validateRemoteTestEnvironment({...valid,SUPABASE_TEST_SERVICE_ROLE_KEY:'sb_secret_error\n'}),/espacios o saltos/))
