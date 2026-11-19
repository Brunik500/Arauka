import {ArrowLeft, ArrowRight, ImageOff, MapPin, MessageCircle} from 'lucide-react'
import {useState} from 'react'
import type {PublicProvider} from '../lib/types'
import {ProviderIdentityBadge} from './ProviderIdentityBadge'

const formatDate=(iso:string)=>new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso))
function PortfolioImage({src,alt}:{src:string;alt:string}){
  const [failed,setFailed]=useState(false)
  return failed?<div className="provider-image-fallback provider-image-fallback-detail"><ImageOff size={22}/><span>Imagen no disponible</span></div>:<img src={src} alt={alt} onError={()=>setFailed(true)}/>
}
type Props={provider:PublicProvider;imageUrl:(path:string)=>string;onBack:()=>void;onRequest:()=>void}
export function PublicProviderProfile({provider,imageUrl,onBack,onRequest}:Props){
  return <section className="page narrow provider-profile-page">
    <button type="button" className="back" onClick={onBack}><ArrowLeft size={17}/>Volver al directorio</button>
    <article className="detail-card provider-profile">
      <header className="provider-profile-header"><div><ProviderIdentityBadge identity={provider.identity}/><h1>{provider.publicName}</h1><p>{provider.services.join(' · ')||'Servicios por definir'}</p></div></header>
      {provider.serviceAreas.length>0&&<div className="pills" aria-label="Zonas de atención">{provider.serviceAreas.map(area=><span className="pill" key={area}><MapPin size={13}/>{area}</span>)}</div>}
      <p className="detail-desc">{provider.description||'Este prestador aún está preparando su presentación.'}</p>
      <div className="divider"/>
      <h2>Trabajos y fotografías</h2>
      {provider.portfolio.length?<div className="portfolio-grid">{provider.portfolio.map(item=><figure key={item.id}><PortfolioImage src={imageUrl(item.imagePath)} alt={item.caption||`Trabajo de ${provider.publicName}`}/><figcaption>{item.caption}</figcaption></figure>)}</div>:<div className="subtle-box"><ImageOff size={20}/>Aún no hay fotografías públicas en este perfil.</div>}
      {provider.reviews.length>0&&<><h2>Evaluaciones de clientes</h2>{provider.reviews.map(review=><div className="review" key={review.id}><span className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span>{review.comment&&<p>{review.comment}</p>}<small>{formatDate(review.createdAt)} · Trabajo registrado</small></div>)}</>}
      <div className="notice friendly"><MessageCircle size={20}/><span>Los datos de contacto se comparten únicamente después del flujo de solicitud y consentimiento mutuo.</span></div>
      <button type="button" className="btn btn-primary provider-request" onClick={onRequest}>Solicitar servicio<ArrowRight size={18}/></button>
    </article>
  </section>
}
