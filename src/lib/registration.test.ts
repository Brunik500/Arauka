import test from 'node:test'
import assert from 'node:assert/strict'
import {modeForRegistrationChoice,registrationChoiceForMode,registrationChoiceLabel,registrationMetadata} from './registration.ts'

test('Empresa conserva la misma elección en ruta, texto y payload',()=>{
  const choice=registrationChoiceForMode('empresa','client')
  assert.equal(choice,'company')
  assert.equal(registrationChoiceLabel(choice),'Empresa')
  assert.equal(modeForRegistrationChoice(choice),'empresa')
  assert.deepEqual(registrationMetadata(choice,'Empresa QA'),{display_name:'Empresa QA',initial_experience:'company'})
})

test('Cliente, Profesional y Negocio usan los vocabularios aceptados por el trigger',()=>{
  assert.equal(registrationChoiceForMode('cliente','company'),'client')
  assert.equal(registrationChoiceForMode('maestro','client'),'professional')
  assert.equal(registrationChoiceForMode('maestro','business'),'business')
  assert.deepEqual(['client','professional','business','company'].map(choice=>registrationChoiceLabel(choice as Parameters<typeof registrationChoiceLabel>[0])),['Cliente','Profesional independiente','Negocio independiente','Empresa'])
})

test('el payload usa inglés y nunca mezcla cliente o empresa',()=>{
  const company=registrationMetadata('company','Empresa')
  assert.equal(company.initial_experience,'company')
  assert.notEqual(company.initial_experience,'empresa')
  assert.notEqual(company.initial_experience,'client')
})
