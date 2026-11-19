import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('usa componentes públicos reutilizables y conserva navegación por hash',async()=>{
  const app=await read('src/App.tsx')
  for(const component of ['PublicProviderCard','PublicProviderProfile','presentPublicProvider','filterPublicProviders'])assert.match(app,new RegExp(component))
  assert.match(app,/goRoute\('profesional',mode,null,provider\.id\)/)
  assert.match(app,/onBack=\{\(\)=>navigate\('buscar'\)\}/)
})

test('la identidad no se deduce con heurísticas y la verificación usa la vista segura',async()=>{
  const model=await read('src/lib/publicProviders.ts')
  assert.match(model,/verifiedCompanyIds\.includes\(profile\.id\)\?'verified_company':'provider'/)
  assert.doesNotMatch(model,/identity:\s*profile\.(?:is_professional|company_name|categories|bio)/)
  const app=await read('src/App.tsx')
  assert.match(app,/from\('verified_companies'\)\.select\('user_id'\)/)
  assert.doesNotMatch(app,/from\('account_experiences'\)/)
})

test('componentes públicos no contienen campos privados ni mensajes negativos',async()=>{
  const sources=await Promise.all(['src/lib/publicProviders.ts','src/components/PublicProviderCard.tsx','src/components/PublicProviderProfile.tsx','src/components/ProviderIdentityBadge.tsx'].map(read))
  const joined=sources.join('\n').toLowerCase()
  for(const forbidden of ['tax_id','tax_address','representative_name','contact_email','business_phone','verification_reviewed_by','rut','dirección tributaria','sin verificar','no verificada','credenciales no'])assert.doesNotMatch(joined,new RegExp(forbidden))
})

test('distingue error, cero resultados y perfil inexistente',async()=>{
  const app=await read('src/App.tsx')
  assert.match(app,/No pudimos cargar el directorio/)
  assert.match(app,/No encontramos perfiles con estos filtros/)
  assert.match(app,/Perfil inexistente/)
})

test('incluye fallback de imágenes y reglas móviles a 360 px',async()=>{
  const card=await read('src/components/PublicProviderCard.tsx')
  const profile=await read('src/components/PublicProviderProfile.tsx')
  const css=await read('src/styles.css')
  assert.match(card,/onError=\{\(\)=>setImageFailed\(true\)\}/)
  assert.match(card,/provider-card-media-empty/)
  assert.match(profile,/onError=\{\(\)=>setFailed\(true\)\}/)
  assert.match(css,/@media\(max-width:480px\).*?\.provider-card\{display:flex;grid-template-columns:none\}/s)
  assert.match(css,/\.provider-card-media-empty\{height:94px\}/)
  assert.match(css,/@media\(max-width:390px\)/)
  assert.match(css,/overflow-wrap:anywhere/)
})

test('el frontend no usa service_role',async()=>{
  const files=await Promise.all(['src/App.tsx','src/lib/publicProviders.ts','src/components/PublicProviderCard.tsx','src/components/PublicProviderProfile.tsx'].map(read))
  assert.doesNotMatch(files.join('\n'),/service_role|sb_secret_/i)
})
