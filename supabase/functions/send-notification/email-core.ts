export type NotificationKind = 'interest' | 'selected' | 'contact_ready'
export type WebhookEnvelope = { type?:unknown; schema?:unknown; table?:unknown; record?:{id?:unknown} }

export const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const ALLOWED_KINDS=new Set<NotificationKind>(['interest','selected','contact_ready'])

export function constantTimeEquals(left:string,right:string){
  const encoder=new TextEncoder(),a=encoder.encode(left),b=encoder.encode(right)
  let difference=a.length^b.length
  for(let i=0;i<Math.max(a.length,b.length);i+=1)difference|=(a[i]??0)^(b[i]??0)
  return difference===0
}

export function notificationIdFromEnvelope(payload:WebhookEnvelope){
  if(payload?.schema!=='public'||payload?.table!=='notifications'||!['INSERT','RETRY'].includes(String(payload?.type)))return null
  const id=payload?.record?.id
  return typeof id==='string'&&UUID_PATTERN.test(id)?id:null
}

export function escapeHtml(value:string){return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!))}
export function publicSiteUrl(raw:string){const url=new URL(raw);if(url.protocol!=='https:'||['localhost','127.0.0.1','::1'].includes(url.hostname))throw new Error('ARAUKA_PUBLIC_SITE_URL debe ser una URL pública HTTPS');return url.toString().replace(/\/$/,'')}
export function emailCopy(kind:NotificationKind,destination:string,title:string,body:string){
  const action=kind==='interest'?'Revisar postulación':kind==='selected'?'Ver selección':'Ver contacto autorizado'
  const safeTitle=escapeHtml(title),safeBody=escapeHtml(body),safeDestination=escapeHtml(destination)
  return {subject:`ARAUKA · ${title}`,text:`${title}\n\n${body}\n\n${action}: ${destination}\n\nPuedes administrar estos correos desde Mi cuenta en ARAUKA.`,html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f8f6;font-family:Arial,sans-serif;color:#183f3c"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfeae5;border-radius:16px"><tr><td style="padding:28px"><p style="margin:0 0 22px;color:#0b806b;font-size:22px;font-weight:700">arauka.</p><h1 style="margin:0 0 14px;font-size:24px;color:#123d40">${safeTitle}</h1><p style="margin:0 0 24px;line-height:1.6;color:#526f68">${safeBody}</p><a href="${safeDestination}" style="display:inline-block;background:#118875;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">${action}</a><p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:#82958f">Puedes administrar estos correos desde Mi cuenta en ARAUKA. Este mensaje no contiene teléfonos ni datos privados de contacto.</p></td></tr></table></td></tr></table></body></html>`}
}

export function classifyResendFailure(status:number,providerCode=''){
  const code=providerCode.toLowerCase()
  if(code.includes('invalid_idempotent')||code.includes('different'))return 'unknown' as const
  if(status===409)return code.includes('concurrent')?'transient' as const:'unknown' as const
  if(status===429||status>=500)return 'transient' as const
  return 'permanent' as const
}

export async function sha256(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
}
