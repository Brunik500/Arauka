import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { validateRemoteTestEnvironment } from './v09-test-safety.mjs'
import { createDiagnosticFetch, safeFailureMessage } from './v09-network-diagnostics.mjs'

const {url,anonKey,serviceKey}=validateRemoteTestEnvironment(process.env)
const transport=createDiagnosticFetch({timeoutMs:20000})

const clientOptions={global:{fetch:transport.fetch},auth:{persistSession:false,autoRefreshToken:false}}
const admin=createClient(url,serviceKey,clientOptions)
const created=new Map()
const uncertainEmails=new Set()
const runId=crypto.randomUUID()
const password=`Test-${crypto.randomUUID()}-aA1!`
const email=(kind)=>`arauka-v09-${runId}-${kind}-${crypto.randomUUID()}@example.invalid`

async function createActor(kind,initialExperience){
  const address=email(kind)
  const {data,error}=await admin.auth.admin.createUser({email:address,password,email_confirm:true,user_metadata:{display_name:`Prueba ${kind}`,initial_experience:initialExperience}})
  if(error){
    if(Number(error.status)===0||Number(error.status)>=500)uncertainEmails.add(address)
    throw new Error(safeFailureMessage(`createUser(${kind})`,error,transport.snapshot()))
  }
  created.set(data.user.id,address)
  const client=createClient(url,anonKey,clientOptions)
  const signed=await client.auth.signInWithPassword({email:address,password})
  if(signed.error)throw signed.error
  return {id:data.user.id,client}
}

async function verifyReadOnlyAccess(){
  let settings
  try{settings=await transport.fetch(`${url}/auth/v1/settings`,{headers:{apikey:anonKey}})}
  catch(error){throw new Error(safeFailureMessage('Preflight clave pública',error,transport.snapshot()))}
  if(!settings.ok)throw new Error(`Preflight clave pública: respuesta HTTP ${settings.status} en GET /auth/v1/settings`)
  const listed=await admin.auth.admin.listUsers({page:1,perPage:1})
  if(listed.error)throw new Error(safeFailureMessage('Preflight service-role',listed.error,transport.snapshot()))
}

async function expectDenied(label,promise){
  const result=await promise
  assert.ok(result.error,`${label}: la operación debía ser denegada`)
}

async function main(){
  await verifyReadOnlyAccess()
  console.log(`Run ficticio ARAUKA v0.9: ${runId}`)
  const client=await createActor('cliente','client')
  const professional=await createActor('profesional','professional')
  const business=await createActor('negocio','business')
  const pending=await createActor('empresa-pendiente','company')
  const verified=await createActor('empresa-verificada','company')
  const multi=await createActor('multi','client')

  for(const company of [pending,verified]){
    const {error}=await admin.from('commercial_profiles').insert({user_id:company.id,profile_kind:'company',public_name:'Empresa de ensayo',legal_name:'Empresa Ficticia SpA',tax_id:'12345678-5',verification_status:'pending'})
    if(error)throw error
  }
  const verifiedUpdate=await admin.from('commercial_profiles').update({verification_status:'verified',verification_reviewed_at:new Date().toISOString(),verification_reviewed_by:verified.id}).eq('user_id',verified.id)
  if(verifiedUpdate.error)throw verifiedUpdate.error

  const activation=await multi.client.rpc('activate_experience',{p_experience:'maestro',p_profile_kind:'professional',p_public_name:'Profesional multi'})
  if(activation.error)throw activation.error
  const primary=await multi.client.rpc('set_primary_experience',{p_experience:'maestro'})
  if(primary.error)throw primary.error

  const targetJob=await multi.client.from('jobs').insert({client_id:multi.id,title:'Trabajo ficticio de ensayo',description:'Descripción ficticia suficientemente extensa para autorización.',category:'Otros',locality:'Villarrica'}).select('id').single()
  if(targetJob.error)throw targetJob.error
  await expectDenied('cliente no postula',client.client.from('interests').insert({job_id:targetJob.data.id,pro_id:client.id,note:'Mensaje ficticio suficientemente largo',pro_contact_consent:false}))
  const allowedInterest=await professional.client.from('interests').insert({job_id:targetJob.data.id,pro_id:professional.id,note:'Postulación profesional ficticia válida',pro_contact_consent:false}).select('id').single()
  if(allowedInterest.error)throw allowedInterest.error
  const businessInterest=await business.client.from('interests').insert({job_id:targetJob.data.id,pro_id:business.id,note:'Postulación de negocio ficticia válida',pro_contact_consent:false})
  if(businessInterest.error)throw businessInterest.error
  const companyInterest=await pending.client.from('interests').insert({job_id:targetJob.data.id,pro_id:pending.id,note:'Postulación empresarial ficticia válida',pro_contact_consent:false})
  if(companyInterest.error)throw companyInterest.error
  const companyJob=await pending.client.from('jobs').insert({client_id:pending.id,title:'Contratación empresarial ficticia',description:'Solicitud empresarial de ensayo suficientemente extensa.',category:'Otros',locality:'Villarrica'})
  if(companyJob.error)throw companyJob.error
  await expectDenied('profesional no publica',professional.client.from('jobs').insert({client_id:professional.id,title:'Trabajo ficticio',description:'Descripción ficticia suficientemente extensa.',category:'Otros',locality:'Villarrica'}))
  await expectDenied('cliente no cambia is_professional',client.client.from('profiles').update({is_professional:true}).eq('id',client.id))
  await expectDenied('empresa no se autoverifica',pending.client.from('commercial_profiles').update({verification_status:'verified'}).eq('user_id',pending.id))

  const selectProfessional=await multi.client.from('jobs').update({selected_pro_id:professional.id,status:'matched'}).eq('id',targetJob.data.id)
  if(selectProfessional.error)throw selectProfessional.error
  const multiPhone=await multi.client.from('private_contacts').insert({user_id:multi.id,phone:'+56911111111'})
  if(multiPhone.error)throw multiPhone.error
  const proPhone=await professional.client.from('private_contacts').insert({user_id:professional.id,phone:'+56922222222'})
  if(proPhone.error)throw proPhone.error
  const clientConsent=await multi.client.from('jobs').update({client_contact_consent:true}).eq('id',targetJob.data.id)
  if(clientConsent.error)throw clientConsent.error
  const proConsent=await professional.client.from('interests').update({pro_contact_consent:true}).eq('id',allowedInterest.data.id)
  if(proConsent.error)throw proConsent.error
  const shared=await professional.client.rpc('get_shared_contact',{p_job_id:targetJob.data.id})
  if(shared.error)throw shared.error
  assert.equal(shared.data?.[0]?.phone,'+56911111111')
  const completed=await multi.client.from('jobs').update({status:'completed'}).eq('id',targetJob.data.id)
  if(completed.error)throw completed.error
  const review=await multi.client.from('reviews').insert({job_id:targetJob.data.id,client_id:multi.id,pro_id:professional.id,rating:5,comment:'Evaluación ficticia para comprobar permisos'})
  if(review.error)throw review.error

  const notificationTable=await multi.client.from('notifications').select('id',{count:'exact',head:true})
  if(notificationTable.error)throw notificationTable.error
  assert.ok((notificationTable.count??0)>=1,'v0.5 instalada debe generar notificaciones para el destinatario autenticado')

  const ownDoc=await pending.client.from('company_documents').insert({user_id:pending.id,storage_path:`${pending.id}/antecedente.pdf`,document_type:'ensayo'})
  if(ownDoc.error)throw ownDoc.error
  const otherDoc=await client.client.from('company_documents').select('id').eq('user_id',pending.id)
  if(otherDoc.error)throw otherDoc.error
  assert.equal(otherDoc.data.length,0,'otro usuario no debe leer documentos empresariales')

  const upload=await pending.client.storage.from('company-documents').upload(`${pending.id}/prueba.txt`,new Blob(['dato ficticio'],{type:'text/plain'}))
  assert.ok(upload.error,'MIME no autorizado debe rechazarse')

  const experiences=await multi.client.from('my_account_experiences').select('*')
  if(experiences.error)throw experiences.error
  assert.deepEqual(new Set(experiences.data.map(x=>x.experience)),new Set(['cliente','maestro']))
  assert.equal(experiences.data.find(x=>x.experience==='maestro')?.is_primary,true)

  const labels={client:client.id,professional:professional.id,business:business.id,pending:pending.id,verified:verified.id,multi:multi.id}
  assert.equal(Object.keys(labels).length,6)
  console.log('ARAUKA v0.9: pruebas de autorización principales aprobadas en el proyecto de ensayo.')
}

try{await main()}finally{
  for(const [id,address] of [...created.entries()].reverse()){
    const lookup=await admin.auth.admin.getUserById(id)
    if(lookup.error||lookup.data.user?.email!==address||!address.startsWith(`arauka-v09-${runId}-`)){
      console.error(`Limpieza omitida para el usuario ficticio ${id}: no coincide con este run`)
      continue
    }
    const {error}=await admin.auth.admin.deleteUser(id)
    if(error)console.error(safeFailureMessage(`No se pudo limpiar el usuario ficticio ${id}`,error,transport.snapshot()))
  }
  for(const address of uncertainEmails)console.error(`Creación incierta; revisar manualmente en Auth > Users antes de reintentar: ${address}`)
}
