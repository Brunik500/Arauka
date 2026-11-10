import { assertEquals,assertMatch,assertThrows } from 'jsr:@std/assert@1'
import { classifyResendFailure,constantTimeEquals,emailCopy,notificationIdFromEnvelope,publicSiteUrl,sha256 } from './email-core.ts'

Deno.test('acepta solo envelopes legítimos de notifications',()=>{
  const id='123e4567-e89b-42d3-a456-426614174000'
  assertEquals(notificationIdFromEnvelope({type:'INSERT',schema:'public',table:'notifications',record:{id}}),id)
  assertEquals(notificationIdFromEnvelope({type:'INSERT',schema:'public',table:'profiles',record:{id}}),null)
  assertEquals(notificationIdFromEnvelope({type:'DELETE',schema:'public',table:'notifications',record:{id}}),null)
})
Deno.test('comparación de secretos exige igualdad completa',()=>{assertEquals(constantTimeEquals('secreto','secreto'),true);assertEquals(constantTimeEquals('secreto','secreto2'),false)})
Deno.test('URL pública exige HTTPS y rechaza localhost',()=>{assertEquals(publicSiteUrl('https://arauka.cl/'),'https://arauka.cl');assertThrows(()=>publicSiteUrl('http://localhost:5173'))})
Deno.test('plantilla escapa contenido dinámico',()=>{const copy=emailCopy('interest','https://arauka.cl/#/cliente/trabajo/1','Título <script>','Texto & detalle');assertMatch(copy.html,/&lt;script&gt;/);assertMatch(copy.html,/Texto &amp; detalle/)})
Deno.test('distingue concurrencia y conflicto idempotente',()=>{assertEquals(classifyResendFailure(409,'concurrent_idempotent_requests'),'transient');assertEquals(classifyResendFailure(409,'invalid_idempotent_request'),'unknown');assertEquals(classifyResendFailure(429),'transient');assertEquals(classifyResendFailure(503),'transient');assertEquals(classifyResendFailure(400),'permanent')})
Deno.test('huella SHA-256 es estable',async()=>{assertEquals(await sha256('payload'),await sha256('payload'))})
