import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseExperience, experienceLabel, experienceNavigationMessage, experiencePanelLabel, legacyExperiences, primaryExperience, validateProfessionalActivation } from './identity.ts'

const professional={id:'p',display_name:'Ana',company_name:null,bio:'',is_professional:true,categories:[],service_localities:[]}
test('perfil profesional historico abre Profesional aunque la URL previa fuera Cliente',()=>{
  const experiences=legacyExperiences(professional)
  assert.equal(primaryExperience(experiences),'maestro')
  assert.equal(canUseExperience(experiences,'maestro'),true)
})
test('un negocio se presenta de forma positiva',()=>{
  const experiences=legacyExperiences({...professional,company_name:'NOBRO'})
  assert.equal(experienceLabel(experiences.find(item=>item.experience==='maestro')),'Negocio independiente')
})
test('una experiencia ausente no queda autorizada por navegación',()=>{
  const experiences=legacyExperiences({...professional,is_professional:false})
  assert.equal(canUseExperience(experiences,'maestro'),false)
  assert.equal(canUseExperience(experiences,'empresa'),false)
})

test('la activacion profesional exige datos operativos antes de habilitarse',()=>{
  const complete={displayName:'Ana',businessName:'',bio:'Instalaciones y reparaciones domiciliarias.',categories:['Electricidad'],localities:['Villarrica']}
  assert.equal(validateProfessionalActivation('professional',complete),null)
  assert.match(validateProfessionalActivation('professional',{...complete,categories:[]})??'',/oficio/)
  assert.match(validateProfessionalActivation('professional',{...complete,bio:'Breve'})??'',/20 caracteres/)
})
test('negocio independiente exige nombre comercial',()=>{
  const draft={displayName:'Ana',businessName:'',bio:'Fabricación y reparaciones a medida.',categories:['Carpintería'],localities:['Villarrica']}
  assert.match(validateProfessionalActivation('business',draft)??'',/nombre comercial/)
  assert.equal(validateProfessionalActivation('business',{...draft,businessName:'NOBRO'}),null)
})
test('las cuatro identidades visibles conservan su nombre exacto',()=>{
  assert.equal(experiencePanelLabel({experience:'cliente',profile_kind:'personal',is_primary:true,public_name:'Ana',legal_name:null,verification_status:'not_applicable'}),'Cliente')
  assert.equal(experiencePanelLabel({experience:'maestro',profile_kind:'professional',is_primary:true,public_name:'Ana',legal_name:null,verification_status:'not_applicable'}),'Profesional independiente')
  assert.equal(experiencePanelLabel({experience:'maestro',profile_kind:'business',is_primary:true,public_name:'NOBRO',legal_name:null,verification_status:'not_applicable'}),'Negocio independiente')
  assert.equal(experiencePanelLabel({experience:'empresa',profile_kind:'company',is_primary:true,public_name:'Empresa',legal_name:'Empresa SpA',verification_status:'verified'}),'Empresa')
})
test('la navegacion usa textos naturales y no promete cambios inexistentes',()=>{
  const business={experience:'maestro' as const,profile_kind:'business' as const,is_primary:true,public_name:'NOBRO',legal_name:null,verification_status:'not_applicable' as const}
  assert.match(experienceNavigationMessage(business,true),/volver a Cliente/)
  assert.match(experienceNavigationMessage(business,false),/única experiencia activada/)
  assert.doesNotMatch(experienceNavigationMessage(business,true),/ruta|capacidad técnica|registro persistido/i)
})
