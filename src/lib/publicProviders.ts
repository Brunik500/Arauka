import type {Portfolio, Profile, PublicProvider, Review} from './types'

export type PublicProviderSource = {
  profile:Profile
  portfolio:readonly Portfolio[]
  reviews:readonly Review[]
  verifiedCompanyIds:readonly string[]
}

export function presentPublicProvider({profile,portfolio,reviews,verifiedCompanyIds}:PublicProviderSource):PublicProvider{
  const providerReviews=reviews.filter(item=>item.pro_id===profile.id)
  const reviewCount=providerReviews.length
  return {
    id:profile.id,
    publicName:profile.company_name?.trim()||profile.display_name?.trim()||'Prestador',
    description:profile.bio?.trim()||'',
    services:[...profile.categories],
    serviceAreas:[...profile.service_localities],
    identity:verifiedCompanyIds.includes(profile.id)?'verified_company':'provider',
    portfolio:portfolio.filter(item=>item.pro_id===profile.id).map(item=>({id:item.id,imagePath:item.image_path,caption:item.caption})),
    reviews:providerReviews.map(item=>({id:item.id,rating:item.rating,comment:item.comment,createdAt:item.created_at})),
    reviewCount,
    averageRating:reviewCount?providerReviews.reduce((total,item)=>total+item.rating,0)/reviewCount:null
  }
}

export function filterPublicProviders(providers:readonly PublicProvider[],query:string,service:string,locality:string){
  const normalized=query.trim().toLocaleLowerCase('es-CL')
  return providers.filter(provider=>(!service||provider.services.includes(service))&&
    (!locality||provider.serviceAreas.includes(locality))&&
    (!normalized||[provider.publicName,provider.description,...provider.services,...provider.serviceAreas].join(' ').toLocaleLowerCase('es-CL').includes(normalized)))
}
