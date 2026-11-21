import assert from 'node:assert/strict'
import test from 'node:test'
import {filterPublicProviders,parsePublicProviderRows,presentPublicProvider,publicProviderEmptyPresentation,publicProviderKindLabel} from './publicProviders.ts'
import type {Portfolio,PublicProviderRpcRow,Review} from './types.ts'

const row:PublicProviderRpcRow={user_id:'provider-1',profile_kind:'business',public_name:'Taller Lago',bio:'Carpintería a medida',services:['Carpintería'],coverage:['Villarrica'],is_company_verified:false}
const portfolio:Portfolio[]=[{id:'photo-1',pro_id:'provider-1',image_path:'provider-1/work.jpg',caption:'Mesa terminada',created_at:'2026-01-01T00:00:00Z'}]
const reviews:Review[]=[{id:'review-1',job_id:'job-1',client_id:'client-1',pro_id:'provider-1',rating:5,comment:'Buen trabajo',created_at:'2026-01-02T00:00:00Z'}]

test('adapta los siete campos seguros de la RPC sin datos privados',()=>{
  const [parsed]=parsePublicProviderRows([row])
  assert.deepEqual(Object.keys(parsed).sort(),['bio','coverage','is_company_verified','profile_kind','public_name','services','user_id'].sort())
  const provider=presentPublicProvider({row:parsed,portfolio,reviews})
  assert.deepEqual(Object.keys(provider).sort(),['averageRating','description','id','isCompanyVerified','portfolio','profileKind','publicName','reviewCount','reviews','serviceAreas','services'].sort())
  assert.equal(provider.publicName,'Taller Lago')
  assert.equal(provider.profileKind,'business')
  for(const forbidden of ['tax_id','tax_address','representative_name','contact_email','business_phone','verification_reviewed_by','phone','email'])assert.equal(forbidden in provider,false)
})

test('representa Profesional, Negocio y Empresa únicamente desde profile_kind',()=>{
  for(const [profile_kind,label] of [['professional','Profesional independiente'],['business','Negocio independiente'],['company','Empresa']] as const){
    const provider=presentPublicProvider({row:{...row,profile_kind,public_name:'Nombre neutral'},portfolio:[],reviews:[]})
    assert.equal(provider.profileKind,profile_kind)
    assert.equal(publicProviderKindLabel(profile_kind),label)
  }
})

test('adapta la presentación vacía a la identidad pública sin modificar biografías',()=>{
  assert.equal(publicProviderEmptyPresentation('professional'),'Este profesional aún está preparando su presentación')
  assert.equal(publicProviderEmptyPresentation('business'),'Este negocio aún está preparando su presentación')
  assert.equal(publicProviderEmptyPresentation('company'),'Esta empresa aún está preparando su presentación')
  assert.equal(presentPublicProvider({row:{...row,bio:'Biografía real'},portfolio:[],reviews:[]}).description,'Biografía real')
})

test('una Empresa pendiente no recibe insignia y una aprobada sí',()=>{
  const pending=presentPublicProvider({row:{...row,profile_kind:'company',is_company_verified:false},portfolio:[],reviews:[]})
  const verified=presentPublicProvider({row:{...row,profile_kind:'company',is_company_verified:true},portfolio:[],reviews:[]})
  assert.equal(pending.isCompanyVerified,false)
  assert.equal(verified.isCompanyVerified,true)
})

test('la verificación nunca se aplica a Profesional o Negocio',()=>{
  for(const profile_kind of ['professional','business'] as const)assert.equal(presentPublicProvider({row:{...row,profile_kind,is_company_verified:true},portfolio:[],reviews:[]}).isCompanyVerified,false)
})

test('rechaza Cliente puro, clases desconocidas y respuestas incompatibles',()=>{
  assert.throws(()=>parsePublicProviderRows([{...row,profile_kind:'personal'}]),/Respuesta pública incompatible/)
  assert.throws(()=>parsePublicProviderRows([{...row,services:null}]),/Respuesta pública incompatible/)
  assert.throws(()=>parsePublicProviderRows(null),/Respuesta pública incompatible/)
})

test('un directorio vacío real se conserva como colección vacía',()=>assert.deepEqual(parsePublicProviderRows([]),[]))

test('solo incorpora fotografías y evaluaciones del UUID proyectado',()=>{
  const provider=presentPublicProvider({row,portfolio:[...portfolio,{...portfolio[0],id:'other-photo',pro_id:'other'}],reviews:[...reviews,{...reviews[0],id:'other-review',pro_id:'other'}]})
  assert.deepEqual(provider.portfolio.map(item=>item.id),['photo-1'])
  assert.deepEqual(provider.reviews.map(item=>item.id),['review-1'])
  assert.equal(provider.averageRating,5)
})

test('filtra por nombre, servicio y localidad sin alterar la colección',()=>{
  const provider=presentPublicProvider({row,portfolio,reviews})
  assert.equal(filterPublicProviders([provider],'taller','Carpintería','Villarrica').length,1)
  assert.equal(filterPublicProviders([provider],'electricidad','','').length,0)
  assert.equal(filterPublicProviders([provider],'','Carpintería','Pucón').length,0)
})
