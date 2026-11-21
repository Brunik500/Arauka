import {ArrowRight, ImageOff, MapPin, Star} from 'lucide-react'
import {useState} from 'react'
import type {PublicProvider} from '../lib/types'
import {publicProviderEmptyPresentation} from '../lib/publicProviders'
import {ProviderIdentityBadge} from './ProviderIdentityBadge'

type Props={provider:PublicProvider;imageUrl:(path:string)=>string;onOpen:()=>void}
export function PublicProviderCard({provider,imageUrl,onOpen}:Props){
  const [imageFailed,setImageFailed]=useState(false)
  const cover=provider.portfolio[0]
  return <article className="provider-card">
    <div className={`provider-card-media ${!cover||imageFailed?'provider-card-media-empty':''}`}>
      {cover&&!imageFailed?<img src={imageUrl(cover.imagePath)} alt={cover.caption||`Trabajo de ${provider.publicName}`} onError={()=>setImageFailed(true)}/>:<div className="provider-image-fallback"><ImageOff size={25}/><span>Fotografías próximamente</span></div>}
    </div>
    <div className="provider-card-body">
      <div className="provider-card-heading"><div><ProviderIdentityBadge profileKind={provider.profileKind} isCompanyVerified={provider.isCompanyVerified}/><h3>{provider.publicName}</h3></div>{provider.averageRating!==null&&<span className="provider-rating" aria-label={`${provider.averageRating.toFixed(1)} de 5`}><Star size={14} fill="currentColor"/>{provider.averageRating.toFixed(1)}</span>}</div>
      <p className="provider-services">{provider.services.slice(0,3).join(' · ')||'Servicios por definir'}</p>
      <p className="provider-description">{provider.description||publicProviderEmptyPresentation(provider.profileKind)}</p>
      <div className="provider-areas"><MapPin size={14}/><span>{provider.serviceAreas.join(', ')||'Zona por definir'}</span></div>
      {provider.reviewCount>0&&<p className="provider-review-count">{provider.reviewCount} {provider.reviewCount===1?'evaluación real':'evaluaciones reales'}</p>}
      <button type="button" className="text-link provider-open" onClick={onOpen} aria-label={`Ver perfil de ${provider.publicName}`}>Ver perfil<ArrowRight size={16}/></button>
    </div>
  </article>
}
