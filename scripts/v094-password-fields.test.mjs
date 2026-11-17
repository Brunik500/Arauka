import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
const styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8')

test('registro muestra contraseña y confirmación, mientras ingreso solo muestra contraseña',()=>{
  assert.match(app,/<label htmlFor="auth-password">Contraseña<\/label>/)
  assert.match(app,/authKind==='registro'&&<div className="field"><label htmlFor="auth-confirm-password">Confirmar contraseña<\/label>/)
  assert.doesNotMatch(app,/authKind==='login'&&[^\n]*Confirmar contraseña/)
})

test('ambos campos están ocultos inicialmente y sus controles son independientes',()=>{
  assert.match(app,/const \[showPassword,setShowPassword\]=useState\(false\)/)
  assert.match(app,/const \[showConfirmPassword,setShowConfirmPassword\]=useState\(false\)/)
  assert.match(app,/type=\{showPassword\?'text':'password'\} value=\{authFields\.password\}/)
  assert.match(app,/type=\{showConfirmPassword\?'text':'password'\} value=\{confirmPassword\}/)
  assert.match(app,/onClick=\{\(\)=>setShowPassword\(value=>!value\)\}/)
  assert.match(app,/onClick=\{\(\)=>setShowConfirmPassword\(value=>!value\)\}/)
  assert.match(app,/aria-label=\{showPassword\?'Ocultar contraseña':'Mostrar contraseña'\}/)
  assert.match(app,/aria-label=\{showConfirmPassword\?'Ocultar contraseña':'Mostrar contraseña'\}/)
  assert.equal(app.match(/className="password-toggle"/g)?.length,2)
})

test('mostrar u ocultar no modifica los valores ni envía el formulario',()=>{
  const toggles=app.match(/<button type="button" className="password-toggle"[^>]*>/g)??[]
  assert.equal(toggles.length,2)
  assert.doesNotMatch(toggles.join(''),/setAuthFields|setConfirmPassword/)
})

test('la validación de coincidencia ocurre antes de iniciar la solicitud remota',()=>{
  const mismatch=app.indexOf("if(authKind==='registro'&&authFields.password!==confirmPassword){setError('Las contraseñas no coinciden');return}")
  const signup=app.indexOf('supabase.auth.signUp')
  assert.ok(mismatch>=0)
  assert.ok(mismatch<signup)
  assert.match(app,/password:authFields\.password/)
  assert.doesNotMatch(app,/signUp\([^\n]*confirmPassword/)
})

test('cambiar modo, cerrar o completar autenticación limpia confirmación y visibilidad',()=>{
  assert.match(app,/const resetAuthSecrets=\(\)=>\{setAuthFields\(fields=>\(\{\.\.\.fields,password:''\}\)\);setConfirmPassword\(''\);setShowPassword\(false\);setShowConfirmPassword\(false\)\}/)
  assert.match(app,/const closeAuth=\(\)=>\{resetAuthSecrets\(\);setAuthOpen\(false\)/)
  assert.match(app,/const changeAuthKind=\(kind:AuthKind\)=>\{if\(kind==='registro'\)setRegistrationChoice\(current=>registrationChoiceForMode\(mode,current\)\);setAuthKind\(kind\);setConfirmPassword\(''\);setShowPassword\(false\);setShowConfirmPassword\(false\)/)
  assert.match(app,/setAuthOpen\(false\)\s*\n\s*resetAuthSecrets\(\)/)
  assert.doesNotMatch(app,/localStorage\.setItem\([^\n]*(password|confirmPassword|authFields)/i)
  assert.doesNotMatch(app,/sessionStorage\.setItem\([^\n]*(password|confirmPassword|authFields)/i)
})

test('los controles conservan área táctil y el modal cabe en móvil',()=>{
  assert.match(styles,/\.password-toggle\{[^}]*width:44px;height:44px/)
  assert.match(styles,/@media\(max-width:760px\)\{\.auth-modal\{max-height:calc\(100dvh - 30px\);overflow-y:auto\}/)
  assert.match(styles,/\.password-field input\{padding-right:56px\}/)
})
