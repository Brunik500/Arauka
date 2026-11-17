import type {Mode} from './types'

export type SharedProfileDraft={display_name:string;company_name:string;bio:string;categories:string[];service_localities:string[]}

export function profilePatchForExperience(mode:Mode,profileKind:string|undefined,draft:SharedProfileDraft){
  if(mode==='cliente')return {display_name:draft.display_name.trim()||'Usuario ARAUKA'}
  if(mode==='maestro'&&profileKind==='business')return {company_name:draft.company_name.trim()||null,bio:draft.bio.trim(),categories:draft.categories,service_localities:draft.service_localities}
  if(mode==='maestro')return {bio:draft.bio.trim(),categories:draft.categories,service_localities:draft.service_localities}
  return null
}
