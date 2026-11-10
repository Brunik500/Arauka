import { createClient } from 'npm:@supabase/supabase-js@2'
import { ALLOWED_KINDS,classifyResendFailure,constantTimeEquals,emailCopy,notificationIdFromEnvelope,publicSiteUrl,sha256,type NotificationKind,type WebhookEnvelope } from './email-core.ts'

type ClaimedNotification={id:string;recipient_id:string;job_id:string;kind:NotificationKind;event_key:string;title:string;body:string;email_attempts:number;attempt_token:string;provider_requested_at:string|null;payload_hash:string|null}
type StoredJob={client_id:string;selected_pro_id:string|null}

function json(message:string,status=200){return new Response(JSON.stringify({message}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

Deno.serve(async(request)=>{
  if(request.method!=='POST')return json('Method not allowed',405)
  const expectedSecret=Deno.env.get('ARAUKA_WEBHOOK_SECRET')??'',suppliedSecret=request.headers.get('x-arauka-webhook-secret')??''
  if(!expectedSecret||!suppliedSecret||!constantTimeEquals(suppliedSecret,expectedSecret))return json('Unauthorized',401)

  let notificationId:string|null=null
  try{notificationId=notificationIdFromEnvelope(await request.json() as WebhookEnvelope)}catch{return json('Invalid JSON',400)}
  if(!notificationId)return json('Invalid webhook envelope',400)

  const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!supabaseUrl||!serviceRoleKey)return json('Server configuration error',503)
  const client=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:claimRows,error:claimError}=await client.rpc('claim_notification_email',{p_notification_id:notificationId})
  if(claimError)return json('Could not claim notification',500)
  const notice=(claimRows?.[0]??null) as ClaimedNotification|null
  if(!notice)return json('Notification disabled, completed, busy, expired or retry limit reached')

  const updateAttempt=async(values:Record<string,unknown>)=>{
    const {data,error}=await client.from('notifications').update({...values,email_updated_at:new Date().toISOString()}).eq('id',notice.id).eq('email_status','sending').eq('email_attempt_token',notice.attempt_token).select('id').maybeSingle()
    if(error)throw error
    return Boolean(data?.id)
  }
  const finishAttempt=async(status:'error'|'failed'|'delivery_unknown',message:string)=>updateAttempt({email_status:status,email_error:message.slice(0,1000),email_attempt_token:null})

  if(!ALLOWED_KINDS.has(notice.kind)||!notice.job_id){
    const recorded=await finishAttempt('failed','Evento de notificación almacenado no permitido')
    return json(recorded?'Invalid stored notification':'Attempt superseded',recorded?422:409)
  }

  try{
    const resendApiKey=Deno.env.get('RESEND_API_KEY'),emailFrom=Deno.env.get('ARAUKA_EMAIL_FROM'),configuredSite=Deno.env.get('ARAUKA_PUBLIC_SITE_URL')
    if(!resendApiKey||!emailFrom||!configuredSite)throw new Error('Faltan secretos de correo')
    const site=publicSiteUrl(configuredSite)
    const [{data:recipient,error:recipientError},{data:jobData,error:jobError}]=await Promise.all([client.auth.admin.getUserById(notice.recipient_id),client.from('jobs').select('client_id,selected_pro_id').eq('id',notice.job_id).single()])
    const job=jobData as StoredJob|null
    if(recipientError||!recipient?.user?.email)throw new Error('El destinatario no tiene correo disponible')
    if(jobError||!job)throw new Error('La solicitud relacionada no está disponible')
    if(notice.recipient_id!==job.client_id&&notice.recipient_id!==job.selected_pro_id)throw new Error('El destinatario no participa en la solicitud')

    const role=notice.recipient_id===job.selected_pro_id?'maestro':'cliente'
    const destination=`${site}/#/${role}/trabajo/${encodeURIComponent(notice.job_id)}`
    const template=emailCopy(notice.kind,destination,notice.title,notice.body)
    const resendPayload={from:emailFrom,to:[recipient.user.email],subject:template.subject,text:template.text,html:template.html}
    const payloadHash=await sha256(JSON.stringify(resendPayload))

    if(notice.payload_hash&&notice.payload_hash!==payloadHash){
      const recorded=await finishAttempt('delivery_unknown','El contenido cambió durante la ventana idempotente; envío detenido')
      return json(recorded?'Payload changed':'Attempt superseded',409)
    }
    const providerMarked=await updateAttempt({email_payload_hash:payloadHash,...(!notice.provider_requested_at?{email_provider_requested_at:new Date().toISOString()}:{})})
    if(!providerMarked)return json('Attempt superseded before provider request',409)

    let resendResponse:Response
    try{
      resendResponse=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${resendApiKey}`,'content-type':'application/json','idempotency-key':`arauka-notification-${notice.id}`},body:JSON.stringify(resendPayload)})
    }catch{
      const recorded=await finishAttempt('error','No se recibió respuesta de Resend; se reintentará dentro de la ventana idempotente')
      return json(recorded?'Provider response lost':'Attempt superseded',recorded?502:409)
    }

    const resendBody=await resendResponse.json().catch(()=>({})) as {id?:string;message?:string;name?:string}
    if(!resendResponse.ok||!resendBody.id){
      const providerCode=`${resendBody.name??''} ${resendBody.message??''}`
      const detail=`Resend ${resendResponse.status}: ${resendBody.message??resendBody.name??'respuesta no válida'}`
      const classification=classifyResendFailure(resendResponse.status,providerCode)
      const state=classification==='transient'?'error':classification==='unknown'?'delivery_unknown':'failed'
      const recorded=await finishAttempt(state,detail)
      return json(recorded?'Provider rejected request':'Attempt superseded',recorded?(state==='error'?502:422):409)
    }

    const sentRecorded=await updateAttempt({email_status:'sent',email_sent_at:new Date().toISOString(),email_provider_id:resendBody.id,email_error:null,email_attempt_token:null})
    if(!sentRecorded)return json('Email accepted but attempt was superseded; inspect delivery state',409)
    return json('Sent')
  }catch(error){
    const message=error instanceof Error?error.message:'Error de envío desconocido'
    try{
      const recorded=await finishAttempt('error',message)
      return json(recorded?'Send failed':'Attempt superseded',recorded?502:409)
    }catch{return json('Send failed and status could not be recorded',500)}
  }
})
