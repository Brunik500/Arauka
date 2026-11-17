import {assertEquals} from 'jsr:@std/assert@1'
import {nextDeletionStep,safeDeletionDiagnostic,storageObjectBelongsToUser} from './deletion-core.ts'

Deno.test('solo acepta objetos bajo el UUID exacto y buckets permitidos',()=>{
  const id='11111111-1111-4111-8111-111111111111'
  assertEquals(storageObjectBelongsToUser('portfolio',`${id}/foto.jpg`,id),true)
  assertEquals(storageObjectBelongsToUser('portfolio',`otro/${id}/foto.jpg`,id),false)
  assertEquals(storageObjectBelongsToUser('otro',`${id}/foto.jpg`,id),false)
  assertEquals(storageObjectBelongsToUser('company-documents',`${id}/../otro.pdf`,id),false)
})

Deno.test('reanuda por estado sin repetir pasos completados',()=>{
  assertEquals(nextDeletionStep('storage_pending'),'storage')
  assertEquals(nextDeletionStep('database_anonymized'),'auth')
  assertEquals(nextDeletionStep('completed'),'stop')
})

Deno.test('diagnóstico no copia mensajes ni secretos',()=>{
  assertEquals(safeDeletionDiagnostic({code:'42501',status:403,message:'token secreto'}),{code:'42501',status:403})
})
