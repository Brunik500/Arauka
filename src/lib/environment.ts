export type BrowserEnvironmentConfig={
  appEnvironment?:string
  url?:string
  publishableKey?:string
  projectRef?:string
}

function legacyJwtRole(key:string){
  const parts=key.split('.')
  if(parts.length!==3)return null
  try{return JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))).role as string|undefined}catch{return null}
}

export function validateStagingBrowserConfig(config:BrowserEnvironmentConfig){
  const appEnvironment=config.appEnvironment?.trim().toLowerCase()
  const projectRef=config.projectRef?.trim()
  const url=config.url?.trim()
  const key=config.publishableKey?.trim()
  if(!url&&!key&&!projectRef)return {configured:false,isStaging:false,error:null,projectRef:null,url:null,key:null}
  if(appEnvironment!=='staging')return {configured:false,isStaging:false,error:'La conexión remota del frontend está permitida únicamente en modo staging.',projectRef:null,url:null,key:null}
  if(!projectRef||!/^[a-z0-9]{8,64}$/.test(projectRef))return {configured:false,isStaging:true,error:'Falta un Project Ref válido de Staging.',projectRef:null,url:null,key:null}
  let parsed:URL
  try{parsed=new URL(url??'')}catch{return {configured:false,isStaging:true,error:'La URL de Supabase Staging no es válida.',projectRef,url:null,key:null}}
  if(parsed.href!==`https://${projectRef}.supabase.co/`)return {configured:false,isStaging:true,error:'La URL no coincide exactamente con el Project Ref de Staging.',projectRef,url:null,key:null}
  if(!key)return {configured:false,isStaging:true,error:'Falta la clave pública de Staging.',projectRef,url:parsed.origin,key:null}
  if(key.startsWith('sb_secret_')||legacyJwtRole(key)==='service_role')return {configured:false,isStaging:true,error:'Se bloqueó una clave administrativa en el frontend.',projectRef,url:parsed.origin,key:null}
  if(!key.startsWith('sb_publishable_')&&legacyJwtRole(key)!=='anon')return {configured:false,isStaging:true,error:'La clave de Staging no tiene un formato público reconocido.',projectRef,url:parsed.origin,key:null}
  return {configured:true,isStaging:true,error:null,projectRef,url:parsed.origin,key}
}
