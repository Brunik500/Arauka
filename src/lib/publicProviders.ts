import type {Portfolio, PublicProvider, PublicProviderKind, PublicProviderRpcRow, Review} from './types'

export type PublicProviderSource = {
  row:PublicProviderRpcRow
  portfolio:readonly Portfolio[]
  reviews:readonly Review[]
}

const providerKinds:readonly PublicProviderKind[]=['professional','business','company']
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)
const isStringArray=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==='string')

export function parsePublicProviderRows(value:unknown):PublicProviderRpcRow[]{
  if(!Array.isArray(value))throw new Error('Respuesta pública incompatible')
  return value.map(item=>{
    if(!isRecord(item)||typeof item.user_id!=='string'||!item.user_id||
      typeof item.profile_kind!=='string'||!providerKinds.includes(item.profile_kind as PublicProviderKind)||
      typeof item.public_name!=='string'||typeof item.bio!=='string'||
      !isStringArray(item.services)||!isStringArray(item.coverage)||typeof item.is_company_verified!=='boolean'){
      throw new Error('Respuesta pública incompatible')
    }
    return {user_id:item.user_id,profile_kind:item.profile_kind as PublicProviderKind,public_name:item.public_name,
      bio:item.bio,services:[...item.services],coverage:[...item.coverage],is_company_verified:item.is_company_verified}
  })
}

export function presentPublicProvider({row,portfolio,reviews}:PublicProviderSource):PublicProvider{
  const providerReviews=reviews.filter(item=>item.pro_id===row.user_id)
  const reviewCount=providerReviews.length
  return {
    id:row.user_id,
    publicName:row.public_name.trim()||'Prestador',
    description:row.bio.trim(),
    services:[...row.services],
    serviceAreas:[...row.coverage],
    profileKind:row.profile_kind,
    isCompanyVerified:row.profile_kind==='company'&&row.is_company_verified,
    portfolio:portfolio.filter(item=>item.pro_id===row.user_id).map(item=>({id:item.id,imagePath:item.image_path,caption:item.caption})),
    reviews:providerReviews.map(item=>({id:item.id,rating:item.rating,comment:item.comment,createdAt:item.created_at})),
    reviewCount,
    averageRating:reviewCount?providerReviews.reduce((total,item)=>total+item.rating,0)/reviewCount:null
  }
}

export function publicProviderKindLabel(kind:PublicProviderKind){
  return kind==='professional'?'Profesional independiente':kind==='business'?'Negocio independiente':'Empresa'
}

export function publicProviderEmptyPresentation(kind:PublicProviderKind){
  return kind==='professional'?'Este profesional aún está preparando su presentación':
    kind==='business'?'Este negocio aún está preparando su presentación':
      'Esta empresa aún está preparando su presentación'
}

export function filterPublicProviders(providers:readonly PublicProvider[],query:string,service:string,locality:string){
  const normalized=query.trim().toLocaleLowerCase('es-CL')
  return providers.filter(provider=>(!service||provider.services.includes(service))&&
    (!locality||provider.serviceAreas.includes(locality))&&
    (!normalized||[provider.publicName,provider.description,...provider.services,...provider.serviceAreas].join(' ').toLocaleLowerCase('es-CL').includes(normalized)))
}
