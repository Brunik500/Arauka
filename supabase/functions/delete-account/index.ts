// v0.9.5: bloqueo deliberado. No desplegar hasta aprobar retención/anonimización
// y reemplazar este guard por el orquestador revisado, con reautenticación reciente.
function json(message:string,status:number){return new Response(JSON.stringify({code:'ACCOUNT_DELETION_NOT_ENABLED',message}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

Deno.serve(async request=>{
  if(request.method!=='POST')return json('Method not allowed',405)
  return json('La eliminación de cuentas todavía no está habilitada.',503)
})
