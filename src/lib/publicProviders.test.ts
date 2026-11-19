import assert from 'node:assert/strict'
import test from 'node:test'
import {filterPublicProviders,presentPublicProvider} from './publicProviders.ts'
import type {Portfolio,Profile,Review} from './types.ts'

const profile:Profile={id:'provider-1',display_name:'Ana',company_name:'Taller Lago',bio:'Carpintería a medida',is_professional:true,categories:['Carpintería'],service_localities:['Villarrica']}
const portfolio:Portfolio[]=[{id:'photo-1',pro_id:'provider-1',image_path:'provider-1/work.jpg',caption:'Mesa terminada',created_at:'2026-01-01T00:00:00Z'}]
const reviews:Review[]=[{id:'review-1',job_id:'job-1',client_id:'client-1',pro_id:'provider-1',rating:5,comment:'Buen trabajo',created_at:'2026-01-02T00:00:00Z'}]

test('crea una proyección pública con una lista cerrada de campos seguros',()=>{
  const provider=presentPublicProvider({profile,portfolio,reviews,verifiedCompanyIds:[]})
  assert.deepEqual(Object.keys(provider).sort(),['averageRating','description','id','identity','portfolio','publicName','reviewCount','reviews','serviceAreas','services'].sort())
  assert.equal(provider.publicName,'Taller Lago')
  assert.equal(provider.reviewCount,1)
  assert.equal(provider.averageRating,5)
  for(const forbidden of ['tax_id','tax_address','representative_name','contact_email','business_phone','verification_reviewed_by','phone','email'])assert.equal(forbidden in provider,false)
})

test('no infiere Profesional, Negocio o Empresa desde nombre, categorías o descripción',()=>{
  const provider=presentPublicProvider({profile:{...profile,company_name:'Empresa Construcciones Sur',bio:'Empresa con documentos',categories:['Construcción']},portfolio:[],reviews:[],verifiedCompanyIds:[]})
  assert.equal(provider.identity,'provider')
  assert.equal(provider.reviewCount,0)
  assert.equal(provider.averageRating,null)
})

test('muestra Empresa verificada únicamente con evidencia de verified_companies',()=>{
  assert.equal(presentPublicProvider({profile,portfolio:[],reviews:[],verifiedCompanyIds:['provider-1']}).identity,'verified_company')
  assert.equal(presentPublicProvider({profile,portfolio:[],reviews:[],verifiedCompanyIds:['another-id']}).identity,'provider')
})

test('solo incorpora fotografías y evaluaciones pertenecientes al prestador',()=>{
  const provider=presentPublicProvider({profile,portfolio:[...portfolio,{...portfolio[0],id:'other-photo',pro_id:'other'}],reviews:[...reviews,{...reviews[0],id:'other-review',pro_id:'other'}],verifiedCompanyIds:[]})
  assert.deepEqual(provider.portfolio.map(item=>item.id),['photo-1'])
  assert.deepEqual(provider.reviews.map(item=>item.id),['review-1'])
})

test('filtra por texto, servicio y localidad sin alterar la colección',()=>{
  const provider=presentPublicProvider({profile,portfolio,reviews,verifiedCompanyIds:[]})
  assert.equal(filterPublicProviders([provider],'medida','Carpintería','Villarrica').length,1)
  assert.equal(filterPublicProviders([provider],'electricidad','','').length,0)
  assert.equal(filterPublicProviders([provider],'','Carpintería','Pucón').length,0)
})
