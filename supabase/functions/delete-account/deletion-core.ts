export type DeletionStatus='requested'|'blocked_active_agreement'|'storage_pending'|'processing'|'database_anonymized'|'auth_pending'|'completed'|'failed'

export const resumableStatuses:ReadonlySet<DeletionStatus>=new Set(['requested','storage_pending','processing','database_anonymized','auth_pending','failed'])

export function storageObjectBelongsToUser(bucket:string,name:string,userId:string){
  return (bucket==='portfolio'||bucket==='company-documents')&&name.startsWith(`${userId}/`)&&name.length>userId.length+1&&!name.includes('..')
}

export function nextDeletionStep(status:DeletionStatus){
  if(status==='requested'||status==='failed')return 'preflight'
  if(status==='storage_pending')return 'storage'
  if(status==='processing')return 'database'
  if(status==='database_anonymized')return 'auth'
  if(status==='auth_pending')return 'verify_auth_and_complete'
  return 'stop'
}

export function safeDeletionDiagnostic(error:unknown){
  const value=error as {code?:unknown;status?:unknown}
  return {code:typeof value?.code==='string'?value.code.slice(0,80):'UNKNOWN',status:typeof value?.status==='number'?value.status:undefined}
}
