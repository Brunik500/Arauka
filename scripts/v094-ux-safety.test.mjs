import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
const styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8')

test('la activacion adicional usa la RPC autorizada sin cambiar la experiencia principal',()=>{
  const start=app.indexOf("async function activateProfessionalExperience")
  const end=app.indexOf('async function savePhone',start)
  assert.ok(start>0&&end>start)
  const flow=app.slice(start,end)
  assert.match(flow,/rpc\('activate_experience'/)
  assert.match(flow,/from\('profiles'\)\.update/)
  assert.doesNotMatch(flow,/set_primary_experience/)
  assert.doesNotMatch(flow,/service_role|sb_secret_/)
})

test('el bloqueo ofrece una ruta explicita y conserva Empresa como flujo separado',()=>{
  assert.match(app,/Preparar y activar Profesional o Negocio/)
  assert.match(app,/Empresa utiliza un registro empresarial distinto/)
  assert.match(app,/canUseExperience\(experiences,'maestro'\)/)
})

test('el avatar duplicado del encabezado no se muestra ni puede recibir foco',()=>{
  assert.match(styles,/\.account-pill\{display:none\}/)
  assert.match(app,/className="current-role" onClick=\{\(\)=>navigate\('cuenta'\)\}/)
})

test('Cliente oculta formularios profesionales y el portafolio',()=>{
  assert.match(styles,/data-arauka-mode="cliente"[^\n]+label\.field:nth-of-type\(n\+2\)/)
  assert.match(styles,/data-arauka-mode="cliente"[^\n]+label\.upload-btn/)
  assert.match(app,/profilePatchForExperience\(mode,activeExperience\?\.profile_kind,profileForm\)/)
})

test('la experiencia activa sigue determinada por capacidades persistidas',()=>{
  assert.match(app,/my_account_experiences/)
  assert.match(app,/canUseExperience\(experiences,mode\)/)
  assert.match(app,/setExperiences\(/)
})

test('Profesional y Negocio comparten capacidad pero no rotulo visible',()=>{
  assert.match(app,/experiencePanelLabel\(item\)/)
  assert.match(app,/profile_kind==='business'/)
  assert.match(app,/experienceNavigationMessage\(activeExperience,experiences\.length>1\)/)
  assert.match(app,/path\[0\]==='maestro'/)
  assert.doesNotMatch(styles,/content:'Panel Profesional'/)
})

test('Mi cuenta contiene un solo selector y separa cambiar, activar y hacer principal',()=>{
  assert.equal((app.match(/className="experience-switcher"/g)??[]).length,1)
  assert.doesNotMatch(app,/Experiencia visible actual|capacidad técnica|registro persistido/)
  assert.match(app,/Activar nueva experiencia/)
  assert.match(app,/Usar \{activeIdentityLabel\} como experiencia principal/)
  assert.match(app,/disabled=\{item\.experience===mode\}/)
})

test('la experiencia activa deshabilitada usa cursor normal y conserva su estado principal',()=>{
  assert.match(app,/aria-pressed=\{item\.experience===mode\} disabled=\{item\.experience===mode\}/)
  assert.match(app,/item\.is_primary\?' · Principal':''/)
  assert.match(styles,/:root\[data-arauka-mode\] \.experience-switcher \.btn\[aria-pressed="true"\]:disabled\{cursor:default\}/)
})
