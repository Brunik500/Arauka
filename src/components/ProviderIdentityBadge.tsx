import {BriefcaseBusiness, ShieldCheck} from 'lucide-react'
import type {PublicProviderKind} from '../lib/types'
import {publicProviderKindLabel} from '../lib/publicProviders'

export function ProviderIdentityBadge({profileKind,isCompanyVerified}:{profileKind:PublicProviderKind;isCompanyVerified:boolean}){
  if(profileKind==='company'&&isCompanyVerified)return <span className="provider-badge provider-badge-company provider-badge-verified"><ShieldCheck size={13}/>Empresa verificada</span>
  return <span className={`provider-badge provider-badge-${profileKind}`}><BriefcaseBusiness size={13}/>{publicProviderKindLabel(profileKind)}</span>
}
