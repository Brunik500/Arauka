import {BriefcaseBusiness, ShieldCheck} from 'lucide-react'
import type {PublicProviderIdentity} from '../lib/types'

export function ProviderIdentityBadge({identity}:{identity:PublicProviderIdentity}){
  if(identity==='verified_company')return <span className="provider-badge provider-badge-verified"><ShieldCheck size={13}/>Empresa verificada</span>
  return <span className="provider-badge"><BriefcaseBusiness size={13}/>Prestador</span>
}
