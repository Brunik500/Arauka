import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidRut, normalizeRut, rutCheckDigit } from './rut.ts'

test('normaliza puntos, guion y K',()=>assert.equal(normalizeRut('12.345.678-k'),'12345678-K'))
test('calcula digito verificador modulo 11',()=>assert.equal(rutCheckDigit('12345678'),'5'))
test('acepta RUT validos en formatos habituales',()=>{
  assert.equal(isValidRut('12.345.678-5'),true)
  assert.equal(isValidRut('6.076.986-9'),true)
})
test('rechaza RUT invalidos o incompletos',()=>{
  assert.equal(isValidRut('12.345.678-9'),false)
  assert.equal(isValidRut('1-9'),false)
  assert.equal(isValidRut('texto'),false)
})
