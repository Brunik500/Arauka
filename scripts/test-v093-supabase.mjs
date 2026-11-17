import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import {validateRemoteTestEnvironment} from './v09-test-safety.mjs'
import {createDiagnosticFetch,safeFailureMessage} from './v09-network-diagnostics.mjs'

const {url,anonKey,serviceKey}=validateRemoteTestEnvironment(process.env)
const transport=createDiagnosticFetch({timeoutMs:20000})
const options={global:{fetch:transport.fetch},auth:{persistSession:false,autoRefreshToken:false}}
const admin=createClient(url,serviceKey,options)
const created=new Map(),createdByKind=new Map(),uncertainEmails=new Set(),storagePaths=[]
const runId=crypto.randomUUID(),password=`Test-${crypto.randomUUID()}-aA1!`
let reviewerGrant=null
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const email=kind=>`arauka-v093-${runId}-${kind}-${crypto.randomUUID()}@example.invalid`

async function actor(kind,initialExperience){
  const address=email(kind)
  const {data,error}=await admin.auth.admin.createUser({email:address,password,email_confirm:true,user_metadata:{display_name:`Prueba ${kind}`,initial_experience:initialExperience}})
  if(error){if(Number(error.status)===0||Number(error.status)>=500)uncertainEmails.add(address);throw new Error(safeFailureMessage(`createUser(${kind})`,error,transport.snapshot()))}
  const record={id:data.user.id,address,kind}
  created.set(data.user.id,record);createdByKind.set(kind,record)
  const client=createClient(url,anonKey,options)
  const signed=await client.auth.signInWithPassword({email:address,password})
  if(signed.error)throw signed.error
  return {id:data.user.id,client}
}
async function denied(label,promise){const result=await promise;assert.ok(result.error,`${label}: debía ser denegado`)}
const companyPayload={p_legal_name:'Empresa Ficticia de Ensayo SpA',p_tax_id:'12.345.678-5',p_legal_type:'SpA',p_public_name:'Empresa Ensayo',p_economic_activity:'Servicios de mantención',p_tax_address:'Dirección ficticia 123',p_municipality:'Villarrica',p_region:'La Araucanía',p_representative_name:'Representante Ficticio',p_contact_email:'empresa@example.invalid',p_business_phone:'+56911111111',p_services:['Mantención'],p_coverage:['Villarrica']}

async function verifyReadOnlyAccess(){
  const settings=await transport.fetch(`${url}/auth/v1/settings`,{headers:{apikey:anonKey}})
  if(!settings.ok)throw new Error(`Preflight clave pública: HTTP ${settings.status}`)
  const listed=await admin.auth.admin.listUsers({page:1,perPage:1})
  if(listed.error)throw new Error(safeFailureMessage('Preflight service-role',listed.error,transport.snapshot()))
  const reviewers=await admin.from('administrative_reviewers').select('user_id',{count:'exact',head:true})
  if(reviewers.error)throw new Error(safeFailureMessage('Preflight administrative privileges',reviewers.error,transport.snapshot()))
}

async function main(){
  await verifyReadOnlyAccess()
  console.log(`Run ficticio ARAUKA v0.9.3: ${runId}`)
  const owner=await actor('empresa','company'),other=await actor('otra-empresa','company'),business=await actor('negocio','business'),reviewer=await actor('revisor','client')

  const firstActivation=await owner.client.rpc('complete_initial_company_activation')
  if(firstActivation.error)throw firstActivation.error
  const repeatedActivation=await owner.client.rpc('complete_initial_company_activation')
  if(repeatedActivation.error)throw repeatedActivation.error
  await denied('negocio no completa alta inicial de Empresa',business.client.rpc('complete_initial_company_activation'))
  const initialExperiences=await owner.client.from('my_account_experiences').select('experience,profile_kind,is_primary')
  if(initialExperiences.error)throw initialExperiences.error
  assert.ok(initialExperiences.data.some(item=>item.experience==='cliente'&&item.profile_kind==='personal'))
  assert.ok(initialExperiences.data.some(item=>item.experience==='empresa'&&item.profile_kind==='company'&&item.is_primary))

  const createdProfile=await owner.client.rpc('upsert_my_company_profile',companyPayload)
  if(createdProfile.error)throw createdProfile.error
  assert.equal(createdProfile.data.verification_status,'pending')
  const updated=await owner.client.rpc('upsert_my_company_profile',{...companyPayload,p_public_name:'Empresa Ensayo Actualizada'})
  if(updated.error)throw updated.error
  assert.equal(updated.data.public_name,'Empresa Ensayo Actualizada')
  await denied('otra empresa no modifica perfil ajeno',other.client.from('commercial_profiles').update({public_name:'Intrusión'}).eq('user_id',owner.id))
  await denied('negocio independiente no crea Empresa',business.client.rpc('upsert_my_company_profile',companyPayload))
  await denied('propietario no se autoverifica',owner.client.from('commercial_profiles').update({verification_status:'verified'}).eq('user_id',owner.id))
  await denied('usuario no autorizado no revisa',owner.client.rpc('review_company_verification',{p_company_user_id:owner.id,p_decision:'verified'}))

  const reviewerNote=`Revisor ficticio ${runId}`
  reviewerGrant={userId:reviewer.id,note:reviewerNote}
  const provision=await admin.from('administrative_reviewers').insert({user_id:reviewer.id,note:reviewerNote})
  if(provision.error)throw provision.error
  const review=await reviewer.client.rpc('review_company_verification',{p_company_user_id:owner.id,p_decision:'verified'})
  if(review.error)throw review.error
  const verified=await owner.client.from('commercial_profiles').select('verification_status,verification_reviewed_at,verification_reviewed_by').single()
  if(verified.error)throw verified.error
  assert.equal(verified.data.verification_status,'verified');assert.equal(verified.data.verification_reviewed_by,reviewer.id);assert.ok(verified.data.verification_reviewed_at)

  const path=`${owner.id}/${crypto.randomUUID()}.pdf`;storagePaths.push(path)
  const upload=await owner.client.storage.from('company-documents').upload(path,new Blob(['%PDF-1.4 ensayo'],{type:'application/pdf'}),{contentType:'application/pdf'})
  if(upload.error)throw upload.error
  const metadata=await owner.client.from('company_documents').insert({user_id:owner.id,storage_path:path,document_type:'application/pdf'})
  if(metadata.error)throw metadata.error
  const ownerDownload=await owner.client.storage.from('company-documents').download(path)
  if(ownerDownload.error)throw ownerDownload.error
  const reviewerMetadata=await reviewer.client.from('company_documents').select('id').eq('user_id',owner.id)
  if(reviewerMetadata.error)throw reviewerMetadata.error
  assert.equal(reviewerMetadata.data.length,1,'el revisor autorizado debe leer la metadata privada')
  const reviewerDownload=await reviewer.client.storage.from('company-documents').download(path)
  if(reviewerDownload.error)throw reviewerDownload.error
  const hidden=await other.client.from('company_documents').select('id').eq('user_id',owner.id)
  if(hidden.error)throw hidden.error
  assert.equal(hidden.data.length,0)
  const privateDownload=await other.client.storage.from('company-documents').download(path)
  assert.ok(privateDownload.error,'otro usuario no debe descargar documentos privados')

  const ownerExperiences=await owner.client.from('my_account_experiences').select('profile_kind').eq('experience','empresa').single()
  const businessExperiences=await business.client.from('my_account_experiences').select('profile_kind').eq('experience','maestro').single()
  assert.equal(ownerExperiences.data?.profile_kind,'company');assert.equal(businessExperiences.data?.profile_kind,'business')
  console.log('ARAUKA v0.9.3: registro, revisión y privacidad aprobados en ensayo.')
}

async function deleteActor(kind){
  const record=createdByKind.get(kind)
  if(!record)return true
  const expectedPrefix=`arauka-v093-${runId}-${kind}-`
  if(!uuidPattern.test(record.id)||!record.address.startsWith(expectedPrefix)||!record.address.endsWith('@example.invalid')){
    console.error(`Limpieza omitida para ${kind}: UUID o correo no coincide con este run`);return false
  }
  const lookup=await admin.auth.admin.getUserById(record.id)
  if(lookup.error){console.error(safeFailureMessage(`Verificación de limpieza de ${kind}`,lookup.error,transport.snapshot()));return false}
  if(lookup.data.user?.id!==record.id||lookup.data.user?.email!==record.address){console.error(`Limpieza omitida para ${kind}: identidad Auth no coincide con este run`);return false}
  const removed=await admin.auth.admin.deleteUser(record.id)
  if(removed.error){console.error(safeFailureMessage(`Limpieza de ${kind} (${record.id})`,removed.error,transport.snapshot()));return false}
  created.delete(record.id);createdByKind.delete(kind);return true
}

try{await main()}finally{
  if(storagePaths.length){const cleanup=await admin.storage.from('company-documents').remove(storagePaths);if(cleanup.error)console.error(safeFailureMessage('Limpieza de documentos ficticios',cleanup.error,transport.snapshot()))}

  // Primero desaparecen las empresas que pueden referenciar al revisor.
  const ownerRemoved=await deleteActor('empresa')
  const otherCompanyRemoved=await deleteActor('otra-empresa')
  const businessRemoved=await deleteActor('negocio')
  const companiesRemoved=ownerRemoved&&otherCompanyRemoved

  let reviewerGrantRemoved=true
  const reviewerRecord=createdByKind.get('revisor')
  if(reviewerGrant){
    const exactGrant=reviewerRecord&&uuidPattern.test(reviewerGrant.userId)&&reviewerGrant.userId===reviewerRecord.id&&reviewerGrant.note===`Revisor ficticio ${runId}`
    if(!exactGrant){console.error('Limpieza omitida para la autorización administrativa ficticia: UUID, runId o nota no coincide');reviewerGrantRemoved=false}
    else{
      const existing=await admin.from('administrative_reviewers').select('user_id,note').eq('user_id',reviewerGrant.userId).maybeSingle()
      if(existing.error){console.error(safeFailureMessage('Revisión de limpieza del revisor ficticio',existing.error,transport.snapshot()));reviewerGrantRemoved=false}
      else if(existing.data&&existing.data.note!==reviewerGrant.note){console.error(`Limpieza omitida para el revisor ficticio ${reviewerGrant.userId}: la nota no coincide`);reviewerGrantRemoved=false}
      else if(existing.data){
        const removed=await admin.from('administrative_reviewers').delete().eq('user_id',reviewerGrant.userId).eq('note',reviewerGrant.note)
        if(removed.error){console.error(safeFailureMessage('Limpieza del revisor ficticio',removed.error,transport.snapshot()));reviewerGrantRemoved=false}
        else{
          const remaining=await admin.from('administrative_reviewers').select('user_id').eq('user_id',reviewerGrant.userId).maybeSingle()
          if(remaining.error||remaining.data){console.error('No se pudo confirmar la eliminación de la autorización administrativa ficticia');reviewerGrantRemoved=false}
        }
      }
    }
  }

  let referencesCleared=false
  if(reviewerRecord&&uuidPattern.test(reviewerRecord.id)){
    const references=await admin.from('commercial_profiles').select('user_id').eq('verification_reviewed_by',reviewerRecord.id)
    if(references.error)console.error(safeFailureMessage('Comprobación de referencias al revisor ficticio',references.error,transport.snapshot()))
    else if(references.data.length)console.error(`Revisor ficticio conservado: existen ${references.data.length} verificaciones que todavía lo referencian`)
    else referencesCleared=true
  }else referencesCleared=!reviewerRecord

  if(reviewerRecord){
    if(companiesRemoved&&businessRemoved&&reviewerGrantRemoved&&referencesCleared)await deleteActor('revisor')
    else console.error(`Revisor ficticio conservado para evitar romper integridad referencial: ${reviewerRecord.id}`)
  }
  for(const address of uncertainEmails)console.error(`Creación incierta; revisar manualmente en Auth > Users: ${address}`)
}
