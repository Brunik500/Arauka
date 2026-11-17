import test from 'node:test'
import assert from 'node:assert/strict'
import {profilePatchForExperience} from './profileForms.ts'

const draft={display_name:' Ana ',company_name:' NOBRO ',bio:' Servicios locales ',categories:['Carpintería'],service_localities:['Villarrica']}

test('Cliente escribe solamente el nombre personal',()=>{
  assert.deepEqual(profilePatchForExperience('cliente','personal',draft),{display_name:'Ana'})
})

test('Profesional conserva campos profesionales sin tocar nombre personal ni comercial',()=>{
  assert.deepEqual(profilePatchForExperience('maestro','professional',draft),{bio:'Servicios locales',categories:['Carpintería'],service_localities:['Villarrica']})
})

test('Negocio guarda identidad comercial sin tocar nombre personal',()=>{
  assert.deepEqual(profilePatchForExperience('maestro','business',draft),{company_name:'NOBRO',bio:'Servicios locales',categories:['Carpintería'],service_localities:['Villarrica']})
})

test('Empresa no utiliza el formulario compartido',()=>{
  assert.equal(profilePatchForExperience('empresa','company',draft),null)
})
