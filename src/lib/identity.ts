import type { Experience, Mode, Profile } from './types'

export function legacyExperiences(profile?: Profile): Experience[] {
  if (!profile) return []
  const base: Experience[] = [{experience:'cliente',profile_kind:'personal',is_primary:!profile.is_professional,public_name:profile.display_name,legal_name:null,verification_status:'not_applicable'}]
  if (profile.is_professional) base.push({experience:'maestro',profile_kind:profile.company_name?'business':'professional',is_primary:true,public_name:profile.company_name || profile.display_name,legal_name:null,verification_status:'not_applicable'})
  return base
}

export function primaryExperience(experiences: Experience[]): Mode | null {
  return experiences.find(item=>item.is_primary)?.experience ?? experiences[0]?.experience ?? null
}

export function canUseExperience(experiences: Experience[], mode: Mode): boolean {
  return experiences.some(item=>item.experience===mode)
}

export function experienceLabel(item?: Experience): string {
  if (!item) return 'Experiencia no activada'
  if (item.profile_kind==='business') return 'Negocio independiente'
  if (item.profile_kind==='company') return item.verification_status==='verified'?'Empresa verificada':'Empresa'
  return item.experience==='cliente'?'Cliente particular':'Profesional independiente'
}

export function experiencePanelLabel(item?: Experience): string {
  if(!item)return 'Experiencia no activada'
  if(item.profile_kind==='business')return 'Negocio independiente'
  if(item.profile_kind==='professional')return 'Profesional independiente'
  if(item.profile_kind==='company')return 'Empresa'
  return 'Cliente'
}

export function experienceNavigationMessage(item:Experience|undefined,hasOther:boolean):string{
  const label=experiencePanelLabel(item)
  if(!item)return 'Revisa las experiencias disponibles en tu cuenta.'
  if(!hasOther){
    if(item.profile_kind==='business')return 'Estás utilizando ARAUKA como Negocio independiente. Esta es la única experiencia activada en tu cuenta.'
    if(item.profile_kind==='professional')return 'Estás utilizando ARAUKA como Profesional independiente. Esta es la única experiencia activada en tu cuenta.'
    if(item.profile_kind==='company')return 'Estás utilizando ARAUKA como Empresa. Esta es la única experiencia activada en tu cuenta.'
    return 'Estás utilizando ARAUKA como Cliente. Esta es la única experiencia activada en tu cuenta.'
  }
  if(item.profile_kind==='business')return 'Estás utilizando ARAUKA como Negocio independiente. Puedes volver a Cliente sin perder la información de tu negocio.'
  if(item.profile_kind==='professional')return 'Estás utilizando ARAUKA como Profesional independiente. Puedes volver a Cliente sin perder tu información profesional.'
  if(item.profile_kind==='company')return 'Estás utilizando ARAUKA como Empresa. Puedes cambiar a tus otras experiencias activadas sin perder tu información empresarial.'
  return `Estás utilizando ARAUKA como ${label}. Puedes cambiar a tus otras experiencias activadas cuando quieras.`
}

export type ProfessionalActivationDraft={
  displayName:string
  businessName:string
  bio:string
  categories:string[]
  localities:string[]
}

export function validateProfessionalActivation(kind:'professional'|'business',draft:ProfessionalActivationDraft): string | null {
  if(!draft.displayName.trim())return 'Ingresa tu nombre para mostrar.'
  if(kind==='business'&&!draft.businessName.trim())return 'Ingresa el nombre comercial de tu negocio.'
  if(draft.bio.trim().length<20)return 'Agrega una presentación de al menos 20 caracteres.'
  if(!draft.categories.length)return 'Selecciona al menos un oficio o servicio.'
  if(!draft.localities.length)return 'Selecciona al menos una localidad de cobertura.'
  return null
}
