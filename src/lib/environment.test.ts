import test from 'node:test'
import assert from 'node:assert/strict'
import {validateStagingBrowserConfig} from './environment.ts'

const base={appEnvironment:'staging',projectRef:'abcdefghijklmnopqrst',url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_test'}
test('acepta una configuración pública que coincide exactamente con Staging',()=>assert.equal(validateStagingBrowserConfig(base).configured,true))
test('bloquea conexión fuera del modo staging',()=>assert.match(validateStagingBrowserConfig({...base,appEnvironment:'production'}).error!,/únicamente/))
test('bloquea URL de otro proyecto',()=>assert.match(validateStagingBrowserConfig({...base,url:'https://zyxwvutsrqponmlkjihg.supabase.co'}).error!,/no coincide/))
test('bloquea sb_secret en frontend',()=>assert.match(validateStagingBrowserConfig({...base,publishableKey:'sb_secret_no'}).error!,/administrativa/))
test('permite el modo demostración sin variables remotas',()=>assert.equal(validateStagingBrowserConfig({}).configured,false))
