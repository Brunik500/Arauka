import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('consulta la RPC pública y conserva navegación por hash y filtros',async()=>{
  const app=await read('src/App.tsx')
  assert.match(app,/supabase\.rpc\('list_public_providers'\)/)
  assert.match(app,/parsePublicProviderRows/)
  assert.match(app,/goRoute\('profesional',mode,null,provider\.id\)/)
  assert.match(app,/onBack=\{\(\)=>navigate\('buscar'\)\}/)
  assert.match(app,/filterPublicProviders\(publicProviders,filterQuery,filterCategory,filterLocality\)/)
})

test('la navegación visible usa Prestadores sin cambiar la ruta buscar',async()=>{
  const app=await read('src/App.tsx')
  assert.match(app,/key==='buscar'\?'Prestadores':label/)
  assert.match(app,/key:'buscar',icon:Search,label:'Prestadores'/)
  assert.equal((app.match(/key:'buscar',icon:Users,label:'Prestadores'/g)??[]).length,2)
  assert.match(app,/Buscar prestadores/)
})

test('no reconstruye identidades con perfiles ni consulta fuentes públicas alternativas',async()=>{
  const model=await read('src/lib/publicProviders.ts')
  const app=await read('src/App.tsx')
  assert.match(model,/profileKind:row\.profile_kind/)
  assert.match(model,/row\.profile_kind==='company'&&row\.is_company_verified/)
  assert.doesNotMatch(model,/is_professional|company_name|verifiedCompanyIds/)
  assert.doesNotMatch(app,/from\('verified_companies'\)/)
  assert.doesNotMatch(app,/profiles\.filter\([^)]*is_professional/)
  assert.doesNotMatch(app,/\.select\('\*'\)/)
})

test('muestra identidades correctas y una sola insignia empresarial',async()=>{
  const [badge,model]=await Promise.all([read('src/components/ProviderIdentityBadge.tsx'),read('src/lib/publicProviders.ts')])
  assert.match(model,/Profesional independiente/)
  assert.match(model,/Negocio independiente/)
  assert.match(model,/:\s*'Empresa'/)
  assert.equal((badge.match(/Empresa verificada/g)??[]).length,1)
  assert.match(badge,/profileKind==='company'&&isCompanyVerified/)
})

test('distingue fallo con reintento, vacío real, filtros sin resultados y perfil inexistente',async()=>{
  const app=await read('src/App.tsx')
  assert.match(app,/No pudimos cargar el directorio/)
  assert.match(app,/retryPublicProviders/)
  assert.match(app,/'Reintentar'/)
  assert.match(app,/Aún no hay prestadores públicos/)
  assert.match(app,/No encontramos perfiles con estos filtros/)
  assert.match(app,/Perfil inexistente/)
})

test('componentes públicos no contienen campos privados ni mensajes negativos',async()=>{
  const sources=await Promise.all(['src/lib/publicProviders.ts','src/components/PublicProviderCard.tsx','src/components/PublicProviderProfile.tsx','src/components/ProviderIdentityBadge.tsx'].map(read))
  const joined=sources.join('\n').toLowerCase()
  for(const forbidden of ['tax_id','tax_address','representative_name','contact_email','business_phone','verification_reviewed_by','rut','dirección tributaria','sin verificar','no verificada'])assert.doesNotMatch(joined,new RegExp(forbidden))
})

test('incluye fallback de imágenes y reglas móviles aprobadas',async()=>{
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

test('el frontend no contiene credenciales administrativas',async()=>{
  const files=await Promise.all(['src/App.tsx','src/lib/publicProviders.ts','src/components/PublicProviderCard.tsx','src/components/PublicProviderProfile.tsx'].map(read))
  assert.doesNotMatch(files.join('\n'),/service_role|sb_secret_/i)
})
