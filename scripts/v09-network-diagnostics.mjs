const DNS_CODES=new Set(['ENOTFOUND','EAI_AGAIN','EAI_FAIL'])
const TLS_CODES=new Set(['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','ERR_SSL_WRONG_VERSION_NUMBER'])
const TIMEOUT_CODES=new Set(['ETIMEDOUT','ESOCKETTIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'])
const CONNECTION_CODES=new Set(['ECONNREFUSED','ECONNRESET','EPIPE','ENETUNREACH','EHOSTUNREACH','UND_ERR_SOCKET'])

function errorChain(error){
  const result=[]
  const seen=new Set()
  let current=error
  while(current&&typeof current==='object'&&!seen.has(current)&&result.length<6){seen.add(current);result.push(current);current=current.cause}
  return result
}

export function classifyTransportError(error,timedOut=false){
  const chain=errorChain(error)
  const codes=chain.map(item=>item.code).filter(Boolean)
  const names=chain.map(item=>item.name).filter(Boolean)
  if(timedOut||names.some(name=>name==='AbortError'||name==='TimeoutError')||codes.some(code=>TIMEOUT_CODES.has(code)))return {category:'timeout',code:codes[0]??null}
  if(codes.some(code=>DNS_CODES.has(code)))return {category:'dns',code:codes.find(code=>DNS_CODES.has(code))}
  if(codes.some(code=>TLS_CODES.has(code))||codes.some(code=>String(code).startsWith('ERR_TLS')||String(code).startsWith('ERR_SSL')||String(code).startsWith('CERT_')))return {category:'tls',code:codes.find(code=>TLS_CODES.has(code))??codes[0]??null}
  if(codes.some(code=>CONNECTION_CODES.has(code)))return {category:'connection',code:codes.find(code=>CONNECTION_CODES.has(code))}
  return {category:'network',code:codes[0]??null}
}

export function createDiagnosticFetch({timeoutMs=20000}={}){
  let last={kind:'none'}
  const diagnosticFetch=async(input,init={})=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
    const method=(init.method??(typeof input==='object'&&'method' in input?input.method:'GET')).toUpperCase()
    const controller=new AbortController()
    let timedOut=false
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs)
    timer.unref?.()
    const signals=[controller.signal,init.signal].filter(Boolean)
    const signal=signals.length===1?signals[0]:AbortSignal.any(signals)
    try{
      const response=await fetch(input,{...init,signal})
      last={kind:'http',method,path:url.pathname,status:response.status}
      return response
    }catch(error){
      const classified=classifyTransportError(error,timedOut)
      last={kind:'transport',method,path:url.pathname,...classified}
      throw error
    }finally{clearTimeout(timer)}
  }
  return {fetch:diagnosticFetch,snapshot:()=>({...last})}
}

export function safeFailureMessage(label,error,transport){
  const status=Number(error?.status)||0
  if(transport?.kind==='transport')return `${label}: fallo de ${transport.category}${transport.code?` (${transport.code})`:''} en ${transport.method} ${transport.path}; no hubo respuesta HTTP`
  if(status||transport?.kind==='http')return `${label}: respuesta HTTP ${status||transport.status} en ${transport?.method??'solicitud'} ${transport?.path??'Auth API'}`
  return `${label}: fallo de red sin respuesta HTTP clasificable`
}
