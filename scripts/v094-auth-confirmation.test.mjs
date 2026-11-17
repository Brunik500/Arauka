import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')

test('registro sin sesión abre confirmación y conserva la experiencia elegida',()=>{
  assert.match(app,/const submittedChoice=registrationChoice/)
  assert.match(app,/const signupMetadata=registrationMetadata\(submittedChoice,authFields\.name\)/)
  assert.match(app,/signUp\(\{email,password:authFields\.password,options:\{data:signupMetadata\}\}\)/)
  assert.match(app,/if\(!data\.session\)\{setPendingConfirmationEmail\(email\);setPendingConfirmationChoice\(submittedChoice\)/)
  assert.match(app,/Tu experiencia <strong>\{registrationChoiceLabel\(pendingConfirmationChoice\?\?'client'\)\}<\/strong>/)
  assert.match(app,/¡Tu cuenta está casi lista!/)
})

test('registro con sesión válida entra sin mostrar confirmación',()=>{
  assert.match(app,/else \{setPendingConfirmationEmail\(null\);setPendingConfirmationChoice\(null\);goRoute\('inicio',modeForRegistrationChoice\(submittedChoice\)/)
})

test('reenvío usa la API pública, tiene enfriamiento y respuesta no enumerativa',()=>{
  assert.match(app,/auth\.resend\(\{type:'signup',email:pendingConfirmationEmail\}\)/)
  assert.match(app,/const \{error\}=await supabase\.auth\.resend/)
  assert.match(app,/if\(error\)\{[\s\S]*setResendMessage\(resendErrorMessage\(\)\)[\s\S]*return/)
  assert.match(app,/setResendCooldown\(60\)/)
  assert.match(app,/Por seguridad, el reenvío tiene una espera entre solicitudes y la respuesta no confirma si una dirección ya estaba registrada/)
  assert.equal(app.match(/supabase\.auth\.resend\(/g)?.length,1)
  assert.doesNotMatch(app,/service_role|sb_secret_/)
})

test('los rechazos de correo no muestran éxito ni detalles del proveedor',()=>{
  assert.match(app,/setError\(signupErrorMessage\(e\)\)/)
  assert.match(app,/setResendMessage\(resendErrorMessage\(\)\)/)
  assert.doesNotMatch(app,/límites de frecuencia de Supabase|email rate limit exceeded/)
})

test('la contraseña se limpia y nunca se persiste localmente',()=>{
  assert.match(app,/setAuthFields\(fields=>\(\{\.\.\.fields,password:''\}\)\)/)
  assert.doesNotMatch(app,/localStorage\.setItem\([^\n]*(password|authFields)/)
})
