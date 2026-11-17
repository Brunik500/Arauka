import type { Mode } from './types'

export type RegistrationChoice='client'|'professional'|'business'|'company'

export function registrationChoiceForMode(mode:Mode,current:RegistrationChoice):RegistrationChoice{
  if(mode==='empresa')return 'company'
  if(mode==='maestro')return current==='business'?'business':'professional'
  return 'client'
}

export function registrationChoiceLabel(choice:RegistrationChoice):string{
  if(choice==='company')return 'Empresa'
  if(choice==='business')return 'Negocio independiente'
  if(choice==='professional')return 'Profesional independiente'
  return 'Cliente'
}

export function modeForRegistrationChoice(choice:RegistrationChoice):Mode{
  if(choice==='company')return 'empresa'
  if(choice==='professional'||choice==='business')return 'maestro'
  return 'cliente'
}

export function registrationMetadata(choice:RegistrationChoice,displayName:string){
  return {display_name:displayName.trim()||'Usuario ARAUKA',initial_experience:choice}
}
