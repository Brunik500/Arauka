import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTransportError, safeFailureMessage } from './v09-network-diagnostics.mjs'

test('clasifica DNS desde la causa interna de fetch',()=>assert.equal(classifyTransportError(new TypeError('fetch failed',{cause:Object.assign(new Error('dns'),{code:'ENOTFOUND'})})).category,'dns'))
test('clasifica TLS',()=>assert.equal(classifyTransportError(Object.assign(new Error('tls'),{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'})).category,'tls'))
test('clasifica timeout',()=>assert.equal(classifyTransportError(Object.assign(new Error('timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'})).category,'timeout'))
test('clasifica conexión rechazada',()=>assert.equal(classifyTransportError(Object.assign(new Error('connection'),{code:'ECONNREFUSED'})).category,'connection'))
test('formatea HTTP sin incluir el mensaje potencialmente sensible',()=>assert.equal(safeFailureMessage('Admin',{status:401,message:'token secreto'},{kind:'http',method:'GET',path:'/auth/v1/admin/users',status:401}),'Admin: respuesta HTTP 401 en GET /auth/v1/admin/users'))
