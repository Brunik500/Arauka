export function validateRemoteTestEnvironment(env){
  const required=['SUPABASE_TEST_URL','SUPABASE_TEST_ANON_KEY','SUPABASE_TEST_SERVICE_ROLE_KEY','SUPABASE_TEST_PROJECT_REF','SUPABASE_PRODUCTION_PROJECT_REF','ARAUKA_STAGING_CONFIRMATION']
  if(env.ARAUKA_ALLOW_REMOTE_TESTS!=='YES')throw new Error('Protección activa: ARAUKA_ALLOW_REMOTE_TESTS debe ser exactamente YES')
  const missing=required.filter(name=>!env[name])
  if(missing.length)throw new Error(`Faltan variables de ensayo: ${missing.join(', ')}`)
  const expectedRef=env.SUPABASE_TEST_PROJECT_REF
  const productionRef=env.SUPABASE_PRODUCTION_PROJECT_REF
  if(!/^[a-z0-9]{8,64}$/.test(expectedRef))throw new Error('SUPABASE_TEST_PROJECT_REF tiene un formato inesperado')
  if(expectedRef===productionRef)throw new Error('Bloqueado: la referencia de ensayo coincide con producción')
  if(env.ARAUKA_STAGING_CONFIRMATION!==`arauka-staging:${expectedRef}`)throw new Error('Confirmación inválida: usa arauka-staging:<PROJECT_REF_ENSAYO>')
  let parsed
  try{parsed=new URL(env.SUPABASE_TEST_URL)}catch{throw new Error('SUPABASE_TEST_URL no es un URL válido')}
  if(parsed.protocol!=='https:'||parsed.hostname!==`${expectedRef}.supabase.co`||parsed.port||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash){
    throw new Error('SUPABASE_TEST_URL debe ser exactamente https://<PROJECT_REF_ENSAYO>.supabase.co')
  }
  if(parsed.hostname===`${productionRef}.supabase.co`)throw new Error('Bloqueado: el URL corresponde a producción')
  const anonKey=validateKey(env.SUPABASE_TEST_ANON_KEY,'anon',expectedRef)
  const serviceKey=validateKey(env.SUPABASE_TEST_SERVICE_ROLE_KEY,'service_role',expectedRef)
  return {url:parsed.origin,anonKey,serviceKey,expectedRef}
}

function jwtPayload(key){
  const parts=key.split('.')
  if(parts.length!==3)return null
  try{return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch{return null}
}

function validateKey(raw,expectedRole,expectedRef){
  if(raw!==raw.trim()||/[\r\n\t ]/.test(raw))throw new Error(`La clave ${expectedRole} contiene espacios o saltos de línea`)
  if(expectedRole==='anon'&&raw.startsWith('sb_secret_'))throw new Error('La clave pública no puede ser una sb_secret')
  if(expectedRole==='service_role'&&raw.startsWith('sb_publishable_'))throw new Error('La clave administrativa no puede ser una sb_publishable')
  if(expectedRole==='anon'&&raw.startsWith('sb_publishable_'))return raw
  if(expectedRole==='service_role'&&raw.startsWith('sb_secret_'))return raw
  const payload=jwtPayload(raw)
  if(!payload)throw new Error(`Formato de clave ${expectedRole} no reconocido`)
  if(payload.role!==expectedRole)throw new Error(`La clave esperada para ${expectedRole} declara role=${String(payload.role)}`)
  if(payload.ref&&payload.ref!==expectedRef)throw new Error(`La clave ${expectedRole} pertenece a otra referencia Supabase`)
  return raw
}
