import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isEmailConfirmationPending,isEmailDeliveryRateError,loginErrorMessage,
  resendErrorMessage,safeAuthDiagnostic,signupErrorMessage
} from './authUx.ts'

test('traduce Email not confirmed sin mostrar el error técnico',()=>{
  const error={message:'Email not confirmed',code:'email_not_confirmed',status:400}
  assert.equal(isEmailConfirmationPending(error),true)
  assert.equal(loginErrorMessage(error),'Tu correo electrónico aún no está confirmado. Revisa tu bandeja de entrada y confirma tu cuenta antes de ingresar.')
  assert.doesNotMatch(loginErrorMessage(error),/Email not confirmed/)
})

test('registro y credenciales usan mensajes que no enumeran cuentas',()=>{
  assert.doesNotMatch(signupErrorMessage(),/ya existe|registrado|pertenece/i)
  assert.doesNotMatch(loginErrorMessage({message:'User already registered'}),/already|registrado|existe/i)
})

test('registro y reenvío rechazados usan mensajes independientes del proveedor',()=>{
  const error={message:'email rate limit exceeded',code:'over_email_send_rate_limit',status:429}
  const signupMessage=signupErrorMessage(error)
  const resendMessage=resendErrorMessage()
  assert.equal(isEmailDeliveryRateError(error),true)
  assert.equal(signupMessage,'No pudimos completar tu registro. En este momento no fue posible enviar el correo de confirmación. Por favor, inténtalo nuevamente más tarde')
  assert.equal(resendMessage,'No fue posible procesar el reenvío del correo de confirmación. Por favor, inténtalo nuevamente más tarde')
  for(const message of [signupMessage,resendMessage])assert.doesNotMatch(message,/supabase|resend|cuota|límite|rate limit|proveedor/i)
})

test('el diagnóstico de desarrollo conserva metadatos técnicos sin datos sensibles',()=>{
  const diagnostic=safeAuthDiagnostic('signup',{
    message:'email rate limit exceeded for persona@example.com with token secreto',
    code:'over_email_send_rate_limit',status:429,password:'no-debe-aparecer'
  })
  assert.deepEqual(diagnostic,{operation:'signup',category:'email_delivery_rate_limited',status:429,code:'over_email_send_rate_limit'})
  assert.doesNotMatch(JSON.stringify(diagnostic),/persona@example|secreto|password|token/i)
})
