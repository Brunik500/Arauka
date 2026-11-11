import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Bell, BriefcaseBusiness, Check, CheckCircle2, ChevronRight, Clock3, Compass, Hammer, HeartHandshake, LayoutDashboard, LockKeyhole, LogIn, LogOut, MapPin, Menu, MessageCircle, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, UserCircle2, Users, X, ImagePlus, Phone, CircleHelp } from 'lucide-react'
import { supabase, configured } from './lib/supabase'
import { CATEGORIES, LOCALITIES, type Job, type Interest, type Mode, type Page, type Portfolio, type Profile, type Review, type Verification } from './lib/types'

type Store = { profiles: Profile[]; jobs: Job[]; interests: Interest[]; reviews: Review[]; portfolio: Portfolio[]; verifications: Verification[] }
type Screen = Page | 'profesional' | 'detalle'
type NotificationItem = { id:string; recipient_id:string; job_id:string|null; kind:string; title:string; body:string; read_at:string|null; created_at:string }
const allowedScreens:Screen[]=['inicio','buscar','publicar','trabajos','cuenta','detalle','profesional']
const hasExperienceRoute=()=>/^#\/(cliente|maestro)(?:\/|$)/.test(location.hash)
function parseRoute(){
  const path=location.hash.startsWith('#/')?location.hash.slice(2).split('/').filter(Boolean):[]
  const role:Mode=path[0]==='maestro'?'maestro':'cliente'
  const route=path[1]??'inicio'
  const view:Screen=route==='trabajo'?'detalle':route==='pro'?'profesional':allowedScreens.includes(route as Screen)?route as Screen:'inicio'
  return {mode:role,screen:view,jobId:route==='trabajo'?path[2]??null:null,proId:route==='pro'?path[2]??null:null}
}
function routeHash(mode:Mode,screen:Screen,jobId:string|null,proId:string|null){
  return `#/${mode}/${screen==='detalle'?'trabajo/'+(jobId??''):screen==='profesional'?'pro/'+(proId??''):screen}`
}
type AuthKind = 'login' | 'registro'
const demoClient = 'demo-cliente'
const demoPro = 'demo-nobro'
const formatDate = (iso: string) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(iso))
const demoId = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
const initialDemo: Store = {
  profiles: [
    {id:demoClient,display_name:'Cliente de prueba',company_name:null,bio:'',is_professional:false,categories:[],service_localities:[]},
    {id:demoPro,display_name:'Equipo NOBRO',company_name:'NOBRO',bio:'Acero, madera y diseño. Fabricación de portones, estructuras y mobiliario a medida.',is_professional:true,categories:['Portones','Carpintería','Construcción','Muebles'],service_localities:['Villarrica','Pucón','Lican Ray']},
    {id:'demo-limpieza',display_name:'Equipo de limpieza',company_name:'Limpieza local · ejemplo',bio:'Perfil ficticio para probar la categoría Limpieza. Pendiente de incorporar una empresa real con su autorización.',is_professional:true,categories:['Limpieza'],service_localities:['Villarrica','Pucón']},
    {id:'demo-tecnico',display_name:'Profesional de ejemplo',company_name:null,bio:'Perfil de prueba sin validación de identidad ni credenciales.',is_professional:true,categories:['Electricidad','Gasfitería'],service_localities:['Panguipulli','Coñaripe']},
    {id:'demo-otrocliente',display_name:'Vecino de ejemplo',company_name:null,bio:'',is_professional:false,categories:[],service_localities:[]}
  ],
  jobs: [{ id:'demo-trabajo-1',client_id:'demo-otrocliente',title:'Reparación de portón metálico',description:'Necesito revisar las ruedas y el deslizamiento de un portón corredera. Se pueden enviar fotos al coordinar.',category:'Portones',locality:'Villarrica',status:'open',selected_pro_id:null,client_contact_consent:false,created_at:new Date().toISOString() }],
  interests:[],reviews:[],portfolio:[],verifications:[]
}
function readDemo(): Store { try { const raw = localStorage.getItem('arauka-v04-demo'); return raw ? JSON.parse(raw) as Store : initialDemo } catch { return initialDemo } }
function CategoryIcon({ category, size=21 }: {category: string; size?:number}) {
  if (category === 'Limpieza') return <Sparkles size={size}/>
  if (category === 'Carpintería' || category === 'Portones' || category === 'Muebles') return <Hammer size={size}/>
  if (category === 'Construcción') return <BriefcaseBusiness size={size}/>
  return <SlidersHorizontal size={size}/>
}
function statusName(status:Job['status']) {return ({open:'Publicado',matched:'Profesional seleccionado',completed:'Finalizado',cancelled:'Cancelado'} as const)[status]}
const getPublicProfessionalName=(p?:Profile)=> p?.company_name?.trim() || p?.display_name || 'Profesional'
const getAccountName=(p?:Profile)=>p?.display_name || 'Usuario ARAUKA'
function emptyForm() { return { title:'', description:'', category:'', locality:'Villarrica' } }
export default function App(){
  const [mode,setMode]=useState<Mode>(()=>parseRoute().mode)
  const [screen,setScreen]=useState<Screen>(()=>parseRoute().screen)
  const [demo,setDemo]=useState<Store>(readDemo)
  const [store,setStore]=useState<Store>(initialDemo)
  const [userId,setUserId]=useState<string|null>(configured ? null : demoClient)
  const [authOpen,setAuthOpen]=useState(false)
  const [authKind,setAuthKind]=useState<AuthKind>('registro')
  const [experienceChosen,setExperienceChosen]=useState(hasExperienceRoute)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(configured)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [filterCategory,setFilterCategory]=useState('')
  const [filterLocality,setFilterLocality]=useState('')
  const [filterQuery,setFilterQuery]=useState('')
  const [selectedPro,setSelectedPro]=useState<string|null>(()=>parseRoute().proId)
  const [selectedJob,setSelectedJob]=useState<string|null>(()=>parseRoute().jobId)
  const [jobForm,setJobForm]=useState(emptyForm)
  const [editJobForm,setEditJobForm]=useState(emptyForm)
  const [editingJobId,setEditingJobId]=useState<string|null>(null)
  const [jobError,setJobError]=useState('')
  const [interestNote,setInterestNote]=useState('Hola, puedo ayudarte con este trabajo. Me gustaría conocer más detalles.')
  const [reviewRating,setReviewRating]=useState(5)
  const [reviewComment,setReviewComment]=useState('')
  const [contactResult,setContactResult]=useState<{name:string,phone:string}|null>(null)
  const [myPhone,setMyPhone]=useState('')
  const [allNotifications,setNotifications]=useState<NotificationItem[]>([])
  const [emailEnabled,setEmailEnabled]=useState(false)
  const [authFields,setAuthFields]=useState({name:'',email:'',password:''})
  const [profileForm,setProfileForm]=useState({display_name:'',company_name:'',bio:'',categories:[] as string[],service_localities:[] as string[]})
  const data = configured ? store : demo
  const currentId = configured ? userId : mode==='cliente'?demoClient:demoPro
  const currentProfile=data.profiles.find(p=>p.id===currentId)
  const getName=(profile?:Profile)=>screen==='cuenta'&&profile?.id===currentId?getAccountName(profile):getPublicProfessionalName(profile)
  const pro=data.profiles.find(p=>p.id===selectedPro)
  const job=data.jobs.find(j=>j.id===selectedJob)
  const signedIn = Boolean(currentId)
  const isPro = Boolean(currentProfile?.is_professional)
  const myJobs=data.jobs.filter(j=>j.client_id===currentId).sort((a,b)=>b.created_at.localeCompare(a.created_at))
  const myInterests=data.interests.filter(i=>i.pro_id===currentId)
  const openOpportunities=data.jobs.filter(j=>j.status==='open' && j.client_id!==currentId && (!currentProfile?.categories.length || currentProfile.categories.includes(j.category)) && (!currentProfile?.service_localities.length || currentProfile.service_localities.includes(j.locality)))
  const modeDescription = mode === 'cliente' ? 'Encuentra soluciones cerca de ti' : 'Conecta con nuevas oportunidades'
  const notificationExperience=(notice:NotificationItem):Mode|null=>{
    if(notice.kind==='interest')return 'cliente'
    if(notice.kind==='selected')return 'maestro'
    if(notice.kind==='contact_ready'){
      const related=data.jobs.find(item=>item.id===notice.job_id)
      if(related?.client_id===currentId)return 'cliente'
      if(related?.selected_pro_id===currentId)return 'maestro'
    }
    return null
  }
  const notifications=allNotifications.filter(notice=>notificationExperience(notice)===mode)

  const notify=(value:string)=>{setMessage(value);setError('');window.scrollTo({top:0,behavior:'smooth'})}
  const warn=(value:string)=>{setError(value);setMessage('');window.scrollTo({top:0,behavior:'smooth'})}
  // Hash routing survives F5 on static hosting without a server rewrite.
  const goRoute=(next:Screen,role:Mode=mode,jobId:string|null=selectedJob,proId:string|null=selectedPro)=>{
    const url=routeHash(role,next,jobId,proId)
    setExperienceChosen(true)
    if(location.hash!==url) location.hash=url
    applyRoute()
    setMessage('');setError('');setJobError('');setContactResult(null)
    window.scrollTo({top:0,behavior:'smooth'})
  }
  const navigate=(next:Screen)=>goRoute(next)
  function applyRoute(){const route=parseRoute();if(hasExperienceRoute())setExperienceChosen(true);setMode(route.mode);setScreen(route.screen);setSelectedJob(route.jobId);setSelectedPro(route.proId)}
  useEffect(()=>{const handle=()=>{applyRoute();setContactResult(null)};window.addEventListener('hashchange',handle);return ()=>window.removeEventListener('hashchange',handle)},[])
  useEffect(()=>{document.documentElement.dataset.araukaMode=mode},[mode])
  function changeRole(role:Mode){goRoute(screen,role,selectedJob,selectedPro)}
  function chooseExperience(role:Mode){goRoute('inicio',role,null,null);requestAuth('registro')}
  const requestAuth=(kind:AuthKind='registro')=>{setAuthKind(kind);setAuthOpen(true);setError('');setMessage('')}
  const requireUser=()=>{if(!signedIn){requestAuth('registro');return false} return true}
  const clearUserState=()=>{
    setStore(initialDemo);setNotifications([]);setEmailEnabled(false);setMyPhone('');setContactResult(null)
    setSelectedJob(null);setSelectedPro(null);setEditingJobId(null);setJobError('');setAuthFields({name:'',email:'',password:''})
  }
  const resetToExperienceSelector=()=>{
    clearUserState();setUserId(null);setExperienceChosen(false);setAuthOpen(false);setMode('cliente');setScreen('inicio')
    setMessage('');setError('');history.replaceState(null,'',`${location.pathname}${location.search}`)
    document.documentElement.dataset.araukaMode='cliente';window.scrollTo({top:0,behavior:'smooth'})
  }
  async function signOut(){
    if(!supabase||busy)return
    setBusy(true);setError('')
    const {error}=await supabase.auth.signOut()
    setBusy(false)
    if(error){warn(`No se pudo cerrar la sesión: ${error.message}`);return}
    resetToExperienceSelector()
  }

  const refresh = useCallback(async ()=>{
    if(!supabase) return
    const {data:{user}}=await supabase.auth.getUser()
    const [p,j,i,r,pt,v]=await Promise.all([
      supabase.from('profiles').select('*'),supabase.from('jobs').select('*'),
      user ? supabase.from('interests').select('*') : Promise.resolve({data:[],error:null}),
      supabase.from('reviews').select('*'),supabase.from('portfolio').select('*'),
      supabase.from('verifications').select('*')
    ])
    const failure=[p,j,i,r,pt,v].find(x=>x.error)?.error
    if(failure) throw failure
    const {data:{user:latestUser}}=await supabase.auth.getUser()
    if(latestUser?.id!==user?.id)return
    setStore({profiles:p.data as Profile[] ?? [],jobs:j.data as Job[] ?? [],interests:i.data as Interest[] ?? [],reviews:r.data as Review[] ?? [],portfolio:pt.data as Portfolio[] ?? [],verifications:v.data as Verification[] ?? []})
  },[])
  useEffect(()=>{
    if(!supabase) return
    const client=supabase
    let active=true
    client.auth.getUser().then(({data})=>{if(active)setUserId(data.user?.id ?? null)})
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      setUserId(session?.user?.id??null)
      if(event==='SIGNED_OUT')resetToExperienceSelector()
    })
    return ()=>{active=false;subscription.unsubscribe()}
  },[])
  useEffect(()=>{if(!configured)return;setLoading(true);refresh().catch(e=>setError(`No se pudieron cargar los datos: ${e.message}`)).finally(()=>setLoading(false))},[refresh,userId])
  useEffect(()=>{
    if(!supabase||!userId){setNotifications([]);return}
    const client=supabase
    let alive=true
    const load=async()=>{const {data,error}=await client.from('notifications').select('*').order('created_at',{ascending:false}).limit(40);if(alive&&!error)setNotifications(data as NotificationItem[]??[])}
    void load()
    const interval=setInterval(()=>void load(),30000)
    const onFocus=()=>void load()
    window.addEventListener('focus',onFocus)
    return ()=>{alive=false;clearInterval(interval);window.removeEventListener('focus',onFocus)}
  },[userId])
  async function readNotification(n:NotificationItem){
    if(supabase&&!n.read_at){const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);if(error){warn(error.message);return}setNotifications(prev=>prev.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x))}
    if(n.job_id){goRoute('detalle',notificationExperience(n)??mode,n.job_id,null)}
  }
  useEffect(()=>{
    if(!supabase||!userId){setEmailEnabled(false);return}
    const client=supabase
    client.from('notification_preferences').select('email_enabled').eq('user_id',userId).maybeSingle().then(({data})=>setEmailEnabled(data?.email_enabled??false))
  },[userId])
  async function updateEmailPreference(enabled:boolean){
    if(!supabase||!userId)return
    const {error}=await supabase.from('notification_preferences').upsert({user_id:userId,email_enabled:enabled,updated_at:new Date().toISOString()})
    if(error)warn(error.message);else{setEmailEnabled(enabled);notify(enabled?'Avisos por correo habilitados.':'Avisos por correo desactivados.')}
  }
  useEffect(()=>{setProfileForm({display_name:currentProfile?.display_name??'',company_name:currentProfile?.company_name??'',bio:currentProfile?.bio??'',categories:currentProfile?.categories??[],service_localities:currentProfile?.service_localities??[]})},[currentProfile?.id, currentProfile?.display_name, currentProfile?.bio, currentProfile?.company_name, JSON.stringify(currentProfile?.categories), JSON.stringify(currentProfile?.service_localities)])
  useEffect(()=>{
    if(configured&&!loading&&userId&&currentProfile&&mode==='maestro'&&!currentProfile.is_professional&&screen!=='trabajos'){
      goRoute('trabajos','maestro',null,null)
    }
  },[loading,userId,currentProfile?.id,currentProfile?.is_professional,mode,screen])
  useEffect(()=>{
    if(!supabase || !userId)return
    supabase.from('private_contacts').select('phone').eq('user_id',userId).maybeSingle().then(({data})=>setMyPhone(data?.phone??''))
  },[userId])

  async function write(demoMutation:(s:Store)=>Store, remoteAction:()=>Promise<void>, success:string, after?:()=>void){
    if(busy)return
    setBusy(true);setError('')
    try{
      if(supabase){await remoteAction();await refresh()}
      else setDemo(prev=>{const next=demoMutation(prev);localStorage.setItem('arauka-v04-demo',JSON.stringify(next));return next})
      after?.();notify(success)
    }catch(e){warn(`No se pudo completar la acción: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
  }
  async function authenticate(e:FormEvent){
    e.preventDefault();if(!supabase)return
    setBusy(true);setError('')
    try{
      if(authKind==='registro'){
        const {data,error}=await supabase.auth.signUp({email:authFields.email.trim(),password:authFields.password,options:{data:{display_name:authFields.name.trim()||'Usuario ARAUKA'}}})
        if(error)throw error
        setAuthOpen(false)
        if(!data.session)notify('Revisa tu correo para confirmar el registro. Después podrás ingresar a ARAUKA.')
        else {goRoute('inicio',mode,null,null);notify(`Cuenta creada. Entraste al Panel ${mode==='cliente'?'Cliente':'Maestro'}.`);await refresh()}
      } else {
        const {error}=await supabase.auth.signInWithPassword({email:authFields.email.trim(),password:authFields.password})
        if(error)throw error
        setAuthOpen(false);goRoute('inicio',mode,null,null);notify(`Sesión iniciada en el Panel ${mode==='cliente'?'Cliente':'Maestro'}.`)
      }
    }catch(e){setError(`No se pudo ingresar: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
  }
  async function postJob(e:FormEvent){
    e.preventDefault();
    if(!jobForm.category){setJobError('Selecciona el oficio o categoría.');return}
    if(!jobForm.locality){setJobError('Selecciona una localidad.');return}
    if(jobForm.title.trim().length<6){setJobError('Escribe un título de al menos 6 caracteres.');return}
    if(jobForm.description.trim().length<20){setJobError('Describe el trabajo con al menos 20 caracteres.');return}
    if(!requireUser())return
    setJobError('');const id=demoId()
    const draft:Job={id,client_id:currentId!,title:jobForm.title.trim(),description:jobForm.description.trim(),category:jobForm.category,locality:jobForm.locality,status:'open',selected_pro_id:null,client_contact_consent:false,created_at:new Date().toISOString()}
    await write(s=>({...s,jobs:[draft,...s.jobs]}),async()=>{
      const {error}=await supabase!.from('jobs').insert({client_id:currentId,title:draft.title,description:draft.description,category:draft.category,locality:draft.locality})
      if(error)throw error
    },'¡Tu solicitud fue publicada!',()=>{setJobForm(emptyForm());navigate('trabajos')})
  }
  function startEditingJob(j:Job){
    if(j.client_id!==currentId || j.status!=='open' || j.selected_pro_id){warn('Esta solicitud ya no se puede editar.');return}
    setEditJobForm({title:j.title,description:j.description,category:j.category,locality:j.locality})
    setEditingJobId(j.id);setJobError('')
  }
  function cancelEditingJob(){setEditingJobId(null);setEditJobForm(emptyForm());setJobError('')}
  async function saveJob(e:FormEvent,j:Job){
    e.preventDefault()
    if(j.client_id!==currentId || j.status!=='open' || j.selected_pro_id){setJobError('Esta solicitud ya no se puede editar.');return}
    if(!editJobForm.category){setJobError('Selecciona el oficio o categoría.');return}
    if(!editJobForm.locality){setJobError('Selecciona una localidad.');return}
    if(editJobForm.title.trim().length<6){setJobError('Escribe un título de al menos 6 caracteres.');return}
    if(editJobForm.description.trim().length<20){setJobError('Describe el trabajo con al menos 20 caracteres.');return}
    const changes={title:editJobForm.title.trim(),description:editJobForm.description.trim(),category:editJobForm.category,locality:editJobForm.locality}
    setJobError('')
    await write(
      s=>({...s,jobs:s.jobs.map(x=>x.id===j.id?{...x,...changes}:x)}),
      async()=>{const {data,error}=await supabase!.from('jobs').update(changes).eq('id',j.id).eq('client_id',currentId!).eq('status','open').is('selected_pro_id',null).select('id').single();if(error)throw error;if(!data)throw new Error('La solicitud ya no está disponible para edición.')},
      'Solicitud actualizada.',cancelEditingJob
    )
  }
  function openJob(id:string){goRoute('detalle',mode,id,null)}
  async function interestInJob(j:Job){
    if(!requireUser())return
    if(!isPro){warn('Activa tu perfil profesional desde Mi cuenta antes de responder a un trabajo.');navigate('cuenta');return}
    const note=interestNote.trim();if(note.length<10){warn('Tu presentación debe tener al menos 10 caracteres.');return}
    const item:Interest={id:demoId(),job_id:j.id,pro_id:currentId!,note,pro_contact_consent:false,created_at:new Date().toISOString()}
    await write(s=>({...s,interests:[item,...s.interests]}),async()=>{const {error}=await supabase!.from('interests').insert({job_id:j.id,pro_id:currentId,note});if(error)throw error},'Tu interés fue enviado al cliente.')
  }
  async function selectProfessional(j:Job,i:Interest){
    if(!requireUser())return
    if(j.client_id!==currentId||j.status!=='open'||j.selected_pro_id){warn('No tienes autorización para seleccionar en esta solicitud.');return}
    await write(s=>({...s,jobs:s.jobs.map(x=>x.id===j.id?{...x,status:'matched',selected_pro_id:i.pro_id,client_contact_consent:false}:x)}),async()=>{
      const {error}=await supabase!.from('jobs').update({status:'matched',selected_pro_id:i.pro_id,client_contact_consent:false}).eq('id',j.id).eq('client_id',currentId!)
      if(error)throw error
    },'Profesional seleccionado. Ahora ambas partes podrán autorizar el contacto.')
  }
  async function clientConsent(j:Job){
    if(!requireUser()||j.client_id!==currentId||!j.selected_pro_id){warn('No tienes autorización para cambiar este consentimiento.');return}
    await write(s=>({...s,jobs:s.jobs.map(x=>x.id===j.id?{...x,client_contact_consent:!x.client_contact_consent}:x)}),async()=>{const {error}=await supabase!.from('jobs').update({client_contact_consent:!j.client_contact_consent}).eq('id',j.id);if(error)throw error},j.client_contact_consent?'Permiso de contacto retirado.':'Autorizaste compartir tus datos con el profesional seleccionado.')
  }
  async function proConsent(i:Interest){
    if(!requireUser()||!isPro||i.pro_id!==currentId){warn('Necesitas un perfil profesional activo para autorizar este contacto.');return}
    await write(s=>({...s,interests:s.interests.map(x=>x.id===i.id?{...x,pro_contact_consent:!x.pro_contact_consent}:x)}),async()=>{const {error}=await supabase!.from('interests').update({pro_contact_consent:!i.pro_contact_consent}).eq('id',i.id);if(error)throw error},i.pro_contact_consent?'Permiso de contacto retirado.':'Autorizaste compartir tus datos con este cliente.')
  }
  async function showContact(j:Job){
    if(!supabase){setContactResult({name:'Contacto de demostración',phone:'No se comparten teléfonos reales en la demo.'});return}
    setBusy(true)
    try{
      const {data,error}=await supabase.rpc('get_shared_contact',{p_job_id:j.id})
      if(error)throw error
      const target=data?.[0] as {display_name:string;phone:string}|undefined
      if(!target?.phone){warn('El contacto aún no tiene un teléfono registrado.');return}
      setContactResult({name:target.display_name,phone:target.phone})
    }catch(e){warn(`No se pudo mostrar el contacto: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
  }
  async function finishJob(j:Job){
    if(!requireUser()||j.client_id!==currentId||j.status!=='matched'){warn('No tienes autorización para finalizar este trabajo.');return}
    await write(s=>({...s,jobs:s.jobs.map(x=>x.id===j.id?{...x,status:'completed'}:x)}),async()=>{const {error}=await supabase!.from('jobs').update({status:'completed'}).eq('id',j.id);if(error)throw error},'Trabajo marcado como finalizado. Ahora puedes dejar una evaluación.')
  }
  async function reviewJob(j:Job){
    if(!requireUser()||j.client_id!==currentId||j.status!=='completed'||!j.selected_pro_id){warn('No tienes autorización para evaluar este trabajo.');return}
    if(reviewComment.trim().length<10){warn('Escribe una evaluación de al menos 10 caracteres.');return}
    const item:Review={id:demoId(),job_id:j.id,client_id:currentId!,pro_id:j.selected_pro_id!,rating:reviewRating,comment:reviewComment.trim(),created_at:new Date().toISOString()}
    await write(s=>({...s,reviews:[item,...s.reviews]}),async()=>{const {error}=await supabase!.from('reviews').insert({job_id:j.id,client_id:currentId,pro_id:j.selected_pro_id,rating:item.rating,comment:item.comment});if(error)throw error},'Gracias. Tu evaluación quedó registrada.',()=>setReviewComment(''))
  }
  async function saveProfile(e:FormEvent){
    e.preventDefault();if(!requireUser())return
    const patch={display_name:profileForm.display_name.trim()||'Usuario ARAUKA',company_name:profileForm.company_name.trim()||null,bio:profileForm.bio.trim(),categories:profileForm.categories,service_localities:profileForm.service_localities,is_professional:isPro}
    await write(s=>({...s,profiles:s.profiles.map(x=>x.id===currentId?{...x,...patch}:x)}),async()=>{
      const {error}=await supabase!.from('profiles').update(patch).eq('id',currentId!);if(error)throw error
    },'Tu perfil fue actualizado.')
  }
  async function activatePro(){
    if(!requireUser())return
    const patch={is_professional:true}
    await write(s=>({...s,profiles:s.profiles.map(x=>x.id===currentId?{...x,...patch}:x)}),async()=>{const {error}=await supabase!.from('profiles').update(patch).eq('id',currentId!);if(error)throw error},'Tu perfil profesional está activado.')
  }
  async function savePhone(e:FormEvent){
    e.preventDefault();if(!supabase||!userId)return
    if(!/^\+?[0-9\s()-]{8,20}$/.test(myPhone.trim())){warn('Ingresa un teléfono válido, idealmente con código +56.');return}
    setBusy(true)
    const {error}=await supabase.from('private_contacts').upsert({user_id:userId,phone:myPhone.trim()})
    setBusy(false);if(error)warn(error.message);else notify('Tu teléfono quedó guardado de forma privada. Solo podrá compartirse con consentimiento mutuo.')
  }
  async function uploadPortfolio(file:File){
    if(!supabase||!userId){warn('Para subir fotografías necesitas una cuenta real conectada a Supabase.');return}
    if(!isPro){warn('Activa tu perfil profesional antes de subir trabajos.');return}
    if(!file.type.startsWith('image/') || file.size>5*1024*1024){warn('Selecciona una imagen JPG, PNG o WEBP de hasta 5 MB.');return}
    setBusy(true)
    try{
      const ext=file.name.toLowerCase().split('.').pop()?.replace(/[^a-z0-9]/g,'')||'jpg'
      const path=`${userId}/${crypto.randomUUID()}.${ext}`
      const {error:upError}=await supabase.storage.from('portfolio').upload(path,file,{contentType:file.type,upsert:false})
      if(upError)throw upError
      const {error:dbError}=await supabase.from('portfolio').insert({pro_id:userId,image_path:path,caption:'Trabajo realizado'})
      if(dbError)throw dbError
      await refresh();notify('Fotografía agregada a tu portafolio.')
    }catch(e){warn(`No se pudo subir la fotografía: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
  }
  const visiblePros=useMemo(()=>data.profiles.filter(p=>p.is_professional && (!filterCategory||p.categories.includes(filterCategory))&&(!filterLocality||p.service_localities.includes(filterLocality))&&(!filterQuery||(getPublicProfessionalName(p)+' '+p.categories.join(' ')+' '+p.bio).toLowerCase().includes(filterQuery.toLowerCase()))),[data.profiles,filterCategory,filterLocality,filterQuery])
  const verified=(id:string)=>data.verifications.find(v=>v.pro_id===id)
  const stars=(id:string)=>{const results=data.reviews.filter(r=>r.pro_id===id);if(!results.length)return null;return (results.reduce((n,r)=>n+r.rating,0)/results.length).toFixed(1).replace('.',',')}
  const imageUrl=(path:string)=>supabase?.storage.from('portfolio').getPublicUrl(path).data.publicUrl || ''
  const toggleList=(key:'categories'|'service_localities',value:string)=>setProfileForm(prev=>({...prev,[key]:prev[key].includes(value)?prev[key].filter(x=>x!==value):[...prev[key],value]}))
  const banner=<div className="trial-banner"><Sparkles size={16}/><span><strong>ARAUKA en lanzamiento.</strong> Clientes y profesionales participan gratis. No hay pagos ni comisiones.</span></div>
  function proCard(p:Profile){const score=stars(p.id);return <article className="pro-card" key={p.id}>
    <div className="pro-top"><div className="pro-icon"><CategoryIcon category={p.categories[0]||''} size={26}/></div><div className="pro-overview"><div className="name-row"><h3>{getPublicProfessionalName(p)}</h3>{verified(p.id)?.identity_verified&&<span className="verified"><ShieldCheck size={13}/> Identidad verificada</span>}</div><p>{p.categories.slice(0,3).join(' · ')}</p><div className="muted tiny"><MapPin size={13}/>{p.service_localities.join(', ')||'Zonas por definir'}</div></div></div>
    <p className="pro-blurb">{p.bio||'Profesional en ARAUKA. Consulta sus especialidades y trabajos.'}</p>
    <div className="card-foot"><span className="muted tiny">{score?<><Star size={13} fill="currentColor"/> {score} · {data.reviews.filter(r=>r.pro_id===p.id).length} evaluaciones</>:<><CircleHelp size={13}/> Sin evaluaciones todavía</>}</span><button className="btn btn-soft btn-sm" onClick={()=>{goRoute('profesional',mode,null,p.id)}}>Ver perfil <ArrowRight size={15}/></button></div>
  </article>}
  function jobCard(j:Job,asPro=false){const responded=myInterests.some(i=>i.job_id===j.id);return <article className="job-card" key={j.id}>
    <div className="job-header"><span className="tag">{j.category}</span><span className={`status status-${j.status}`}>{statusName(j.status)}</span></div>
    <h3>{j.title}</h3><p className="clamp">{j.description}</p>
    <div className="job-foot"><span><MapPin size={14}/>{j.locality}</span><span><Clock3 size={14}/>{formatDate(j.created_at)}</span></div>
    <div className="card-foot"><span className="muted tiny">{asPro?(responded?'Ya manifestaste interés':'Oportunidad local'):`${data.interests.filter(i=>i.job_id===j.id).length} profesionales interesados`}</span><button className="btn btn-soft btn-sm" onClick={()=>openJob(j.id)}>Ver detalle <ChevronRight size={15}/></button></div>
  </article>}
  function bottomNav(){const entries: {key:Page;icon:typeof Compass;label:string}[]=mode==='cliente'?[{key:'inicio',icon:Compass,label:'Inicio'},{key:'buscar',icon:Search,label:'Buscar'},{key:'trabajos',icon:BriefcaseBusiness,label:'Mis trabajos'},{key:'cuenta',icon:UserCircle2,label:'Mi cuenta'}]:[{key:'inicio',icon:Compass,label:'Inicio'},{key:'trabajos',icon:BriefcaseBusiness,label:'Oportunidades'},{key:'buscar',icon:Users,label:'Profesionales'},{key:'cuenta',icon:UserCircle2,label:'Mi perfil'}]
    return <nav className="bottom-nav" aria-label="Navegación principal">{entries.map(({key,icon:Icon,label})=><button key={key} className={screen===key?'active':''} onClick={()=>navigate(key)}><Icon size={20}/><span>{label}</span></button>)}</nav>
  }
  function navButton(key:Page,label:string){return <button className={`toplink ${screen===key?'active':''}`} onClick={()=>navigate(key)}>{label}</button>}
  function renderHome(){return <>
    <section className="hero"><div className="hero-copy"><span className="hero-kicker"><span className="pulse-dot"/> Villarrica y alrededores</span><h1>{mode==='cliente'?<>La solución que buscas, <em>más cerca.</em></>:<>Tu próximo trabajo puede estar <em>aquí cerca.</em></>}</h1><p>{mode==='cliente'?'Encuentra maestros y servicios de tu zona, revisa sus perfiles y publica lo que necesitas sin pagar por usar ARAUKA.':'Descubre solicitudes de clientes de tu zona, presenta tu experiencia y conecta con nuevas oportunidades. Gratis durante el lanzamiento.'}</p>
    <div className="hero-actions">{mode==='cliente'?<><button className="btn btn-accent" onClick={()=>navigate('publicar')}><Plus size={19}/> Publicar un trabajo</button><button className="btn btn-outline-light" onClick={()=>navigate('buscar')}>Buscar profesionales <ArrowRight size={17}/></button></>:<><button className="btn btn-accent" onClick={()=>navigate('trabajos')}>Ver oportunidades <ArrowRight size={17}/></button><button className="btn btn-outline-light" onClick={()=>navigate('cuenta')}>Editar mi perfil</button></>}</div></div><div className="hero-decoration" aria-hidden="true"><div className="halo halo-one"/><div className="halo halo-two"/><div className="hero-badge hero-badge-one"><Hammer size={20}/> Oficios locales</div><div className="hero-badge hero-badge-two"><HeartHandshake size={19}/> Conexiones reales</div></div></section>
    {banner}
    <section className="section"><div className="section-heading"><div><span className="eyebrow">ENCUENTRA LO QUE NECESITAS</span><h2>Servicios para tu día a día</h2></div><button className="text-link" onClick={()=>navigate('buscar')}>Ver todos <ArrowRight size={16}/></button></div><div className="category-grid">{CATEGORIES.slice(0,8).map(c=><button className="category-tile" key={c} onClick={()=>{setFilterCategory(c);navigate('buscar')}}><span className="category-icon"><CategoryIcon category={c}/></span><span>{c}</span><ChevronRight size={15} className="cat-arrow"/></button>)}</div></section>
    <section className="section"><div className="section-heading"><div><span className="eyebrow">PERSONAS Y OFICIOS</span><h2>Profesionales en ARAUKA</h2></div><button className="text-link" onClick={()=>navigate('buscar')}>Explorar <ArrowRight size={16}/></button></div><div className="cards-grid">{data.profiles.filter(p=>p.is_professional).slice(0,3).map(proCard)}</div><p className="hint">{configured?'Los perfiles provienen de la base de datos.':'Perfiles de ejemplo: aún no representan verificaciones ni recomendaciones reales.'}</p></section>
    <section className="steps-section"><div className="section-heading"><div><span className="eyebrow">ASÍ FUNCIONA</span><h2>Simple desde el primer contacto</h2></div></div><div className="steps-grid">{[['01','Cuenta qué necesitas','Publica un trabajo o busca directamente por oficio y localidad.'],['02','Conoce opciones','Los profesionales interesados responden y tú eliges a quién contactar.'],['03','Coordinen con confianza','El contacto se comparte solo con autorización mutua.']].map(([n,title,desc])=><div className="step-card" key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></section>
  </>}
  function renderSearch(){return <section className="page"><div className="page-heading"><span className="eyebrow">DIRECTORIO LOCAL</span><h1>Encuentra profesionales</h1><p>Explora perfiles, especialidades y zonas de atención.</p></div><div className="filter-panel"><div className="search-box"><Search size={19}/><input aria-label="Buscar profesionales" placeholder="Nombre, oficio o especialidad" value={filterQuery} onChange={e=>setFilterQuery(e.target.value)}/></div><label>Oficio<select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="">Todos los servicios</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Localidad<select value={filterLocality} onChange={e=>setFilterLocality(e.target.value)}><option value="">Todas las localidades</option>{LOCALITIES.map(c=><option key={c}>{c}</option>)}</select></label></div><div className="section-heading compact"><h2>{visiblePros.length} {visiblePros.length===1?'profesional':'profesionales'}</h2><span className="muted tiny">{configured?'Resultados actuales':'Resultados de demostración'}</span></div><div className="cards-grid">{visiblePros.map(proCard)}</div>{!visiblePros.length&&<div className="empty"><Search size={34}/><h3>No encontramos perfiles con estos filtros</h3><p>Prueba otro oficio o localidad. También puedes publicar una solicitud abierta.</p><button className="btn btn-primary" onClick={()=>navigate('publicar')}>Publicar trabajo</button></div>}</section>}
  function renderPro(){if(!pro)return <div className="empty">Profesional no encontrado.</div>;const myReviews=data.reviews.filter(r=>r.pro_id===pro.id);const images=data.portfolio.filter(x=>x.pro_id===pro.id);return <section className="page narrow"><button className="back" onClick={()=>navigate('buscar')}><ArrowLeft size={17}/> Volver a profesionales</button><article className="detail-card"><div className="pro-hero"><div className="pro-icon pro-icon-large"><CategoryIcon category={pro.categories[0]||''} size={34}/></div><div><span className="eyebrow">PERFIL PROFESIONAL</span><h1>{getName(pro)}</h1><p>{pro.categories.join(' · ')||'Oficios por definir'}</p></div></div><div className="pills">{pro.service_localities.map(z=><span className="pill" key={z}><MapPin size={13}/>{z}</span>)}</div><p className="detail-desc">{pro.bio||'Este profesional aún no ha agregado su presentación.'}</p><div className="notice"><ShieldCheck size={20}/><span>{verified(pro.id)?.identity_verified?'Identidad verificada por ARAUKA.':'ARAUKA todavía no ha verificado la identidad de este perfil.'} {verified(pro.id)?.credentials_verified?'Credenciales profesionales verificadas.':'Las credenciales profesionales no han sido comprobadas.'}</span></div><div className="divider"/><h2>Trabajos y fotografías</h2>{images.length?<div className="portfolio-grid">{images.map(im=><figure key={im.id}><img alt={im.caption} src={imageUrl(im.image_path)}/><figcaption>{im.caption}</figcaption></figure>)}</div>:<div className="subtle-box"><ImagePlus size={20}/> Este profesional aún no ha publicado fotografías de trabajos.</div>}<h2>Evaluaciones de clientes</h2>{myReviews.length?myReviews.map(r=><div className="review" key={r.id}><span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span><p>{r.comment}</p><small>{formatDate(r.created_at)} · Trabajo registrado</small></div>):<p className="muted">Todavía no hay evaluaciones registradas.</p>}<div className="notice friendly"><MessageCircle size={20}/><span>Para contactar a este profesional, publica una solicitud, recibe su interés y autoriza el contacto. No mostramos teléfonos públicamente.</span></div><button className="btn btn-primary" onClick={()=>{setJobForm(p=>({...p,category:pro.categories[0]||''}));navigate('publicar')}}>Solicitar servicio <ArrowRight size={18}/></button></article></section>}
  function renderPublish(){return <section className="page narrow"><div className="page-heading"><span className="eyebrow">SOLICITUD DE SERVICIO</span><h1>Publica un trabajo</h1><p>Cuéntanos qué necesitas. Los maestros de tu zona podrán manifestar interés.</p></div><form className="form-card" noValidate onSubmit={postJob}><div className="form-grid"><label className="field">Tipo de servicio<select value={jobForm.category} onChange={e=>setJobForm({...jobForm,category:e.target.value})}><option value="">Seleccionar oficio</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="field">Localidad<select value={jobForm.locality} onChange={e=>setJobForm({...jobForm,locality:e.target.value})}>{LOCALITIES.map(c=><option key={c}>{c}</option>)}</select></label></div><label className="field">¿Qué necesitas hacer?<input value={jobForm.title} onChange={e=>setJobForm({...jobForm,title:e.target.value})} placeholder="Ej.: Reparar un portón de corredera"/></label><label className="field">Describe tu trabajo<textarea rows={5} value={jobForm.description} onChange={e=>setJobForm({...jobForm,description:e.target.value})} placeholder="Explica el trabajo, medidas aproximadas y detalles importantes..."/></label><div className="notice"><LockKeyhole size={18}/><span>No incluyas tu teléfono, correo ni dirección exacta. El contacto se habilita únicamente con aceptación de ambas partes.</span></div>{jobError&&<p role="alert" className="form-error">{jobError}</p>}<button className="btn btn-primary btn-full" type="submit" disabled={busy}><Plus size={18}/>{busy?'Publicando...':configured?'Publicar trabajo gratis':'Publicar solicitud de prueba'}</button><p className="form-small">{configured?'Tu publicación se guarda en Supabase.':'Demostración: tu solicitud se guarda solo en este navegador.'}</p></form></section>}
  function renderJobs(){if(mode==='cliente')return <section className="page"><div className="page-heading split"><div><span className="eyebrow">TU ACTIVIDAD</span><h1>Mis trabajos</h1><p>Revisa solicitudes, interesados y estados de tus trabajos.</p></div><button className="btn btn-primary" onClick={()=>navigate('publicar')}><Plus size={18}/> Publicar trabajo</button></div>{!signedIn?<div className="empty"><LockKeyhole size={32}/><h3>Ingresa para ver tus solicitudes</h3><button className="btn btn-primary" onClick={()=>requestAuth()}>Crear cuenta gratuita</button></div>:<div className="cards-grid">{myJobs.map(j=>jobCard(j))}</div>}{signedIn&&!myJobs.length&&<div className="empty"><BriefcaseBusiness size={34}/><h3>Todavía no publicas trabajos</h3><p>Tu primera publicación es gratis.</p><button className="btn btn-primary" onClick={()=>navigate('publicar')}>Crear solicitud</button></div>}</section>
    return <section className="page"><div className="page-heading"><span className="eyebrow">PANEL DEL MAESTRO</span><h1>Oportunidades cerca de ti</h1><p>Explora solicitudes que coinciden con tus oficios y zonas de cobertura.</p></div>{!signedIn?<div className="empty"><LockKeyhole size={32}/><h3>Crea tu cuenta para responder a solicitudes</h3><button className="btn btn-primary" onClick={()=>requestAuth()}>Registrarme gratis</button></div>:!isPro?<div className="empty"><Hammer size={34}/><h3>Activa tu perfil profesional</h3><p>Es gratuito. Después selecciona tus oficios y localidades.</p><button className="btn btn-primary" onClick={activatePro}>Activar perfil de maestro</button></div>:<><div className="mini-metrics"><div><strong>{openOpportunities.length}</strong><span>Oportunidades</span></div><div><strong>{myInterests.length}</strong><span>Respuestas enviadas</span></div><div><strong>{myInterests.filter(i=>data.jobs.some(j=>j.id===i.job_id&&j.selected_pro_id===currentId)).length}</strong><span>Seleccionado</span></div></div><div className="section-heading compact"><h2>Solicitudes para ti</h2><span className="muted tiny">Según tus oficios y zonas</span></div><div className="cards-grid">{openOpportunities.map(j=>jobCard(j,true))}</div>{!openOpportunities.length&&<div className="empty"><Bell size={32}/><h3>No hay solicitudes nuevas por ahora</h3><p>Revisa tus oficios y zonas de cobertura en Mi perfil.</p><button className="btn btn-soft" onClick={()=>navigate('cuenta')}>Editar perfil</button></div>}<div className="section-heading compact"><h2>Mis postulaciones</h2></div><div className="cards-grid">{myInterests.map(i=>data.jobs.find(j=>j.id===i.job_id)).filter((j):j is Job=>Boolean(j)).map(j=>jobCard(j,true))}</div>{!myInterests.length&&<p className="muted">Aún no has manifestado interés en trabajos.</p>}</>}</section>}
  function renderJobDetail(){if(!job)return <div className="empty">Solicitud no encontrada.</div>;const mine=job.client_id===currentId;const editable=mine&&job.status==='open'&&!job.selected_pro_id;const editing=editable&&editingJobId===job.id;const myInterest=data.interests.find(i=>i.job_id===job.id&&i.pro_id===currentId);const interested=data.interests.filter(i=>i.job_id===job.id);const selectedInterest=interested.find(i=>i.pro_id===job.selected_pro_id);const selectedPerson=data.profiles.find(p=>p.id===job.selected_pro_id);const contactAuthorized=Boolean(job.selected_pro_id&&job.client_contact_consent&&selectedInterest?.pro_contact_consent);const participant=mine || job.selected_pro_id===currentId;const reviewed=data.reviews.some(r=>r.job_id===job.id);return <section className="page narrow"><button className="back" onClick={()=>navigate('trabajos')}><ArrowLeft size={17}/> Volver a trabajos</button><div className="detail-card">{editing?<form noValidate onSubmit={e=>saveJob(e,job)}><div className="job-header"><h2>Editar solicitud</h2><span className={`status status-${job.status}`}>{statusName(job.status)}</span></div><div className="form-grid"><label className="field">Tipo de servicio<select value={editJobForm.category} onChange={e=>setEditJobForm({...editJobForm,category:e.target.value})}><option value="">Seleccionar oficio</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="field">Localidad<select value={editJobForm.locality} onChange={e=>setEditJobForm({...editJobForm,locality:e.target.value})}>{LOCALITIES.map(c=><option key={c}>{c}</option>)}</select></label></div><label className="field">Título<input value={editJobForm.title} onChange={e=>setEditJobForm({...editJobForm,title:e.target.value})}/></label><label className="field">Descripción<textarea rows={5} value={editJobForm.description} onChange={e=>setEditJobForm({...editJobForm,description:e.target.value})}/></label>{jobError&&<p role="alert" className="form-error">{jobError}</p>}<div className="edit-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Guardando...':'Guardar'}</button><button className="btn btn-soft" type="button" onClick={cancelEditingJob} disabled={busy}>Cancelar</button></div></form>:<><div className="job-header"><span className="tag">{job.category}</span><span className={`status status-${job.status}`}>{statusName(job.status)}</span></div><h1>{job.title}</h1><div className="job-foot top-meta"><span><MapPin size={15}/>{job.locality}</span><span><Clock3 size={15}/>{formatDate(job.created_at)}</span></div><p className="detail-desc">{job.description}</p>{editable&&<button className="btn btn-soft btn-sm" onClick={()=>startEditingJob(job)}>Editar solicitud</button>}</>}<div className="divider"/>
    {mine?<><h2>Profesionales interesados ({interested.length})</h2>{!interested.length&&<div className="subtle-box">Todavía no hay respuestas. Cuando un maestro manifieste interés, aparecerá aquí.</div>}{interested.map(i=>{const p=data.profiles.find(x=>x.id===i.pro_id);return <div className="interest" key={i.id}><div><strong>{getName(p)}</strong><p>{i.note}</p><small>{p?.categories.join(' · ')}</small></div><div className="interest-actions"><button className="btn btn-soft btn-sm" onClick={()=>{goRoute('profesional',mode,null,i.pro_id)}}>Ver perfil</button>{job.status==='open'&&<button className="btn btn-primary btn-sm" disabled={busy} onClick={()=>selectProfessional(job,i)}>Elegir profesional</button>}{job.selected_pro_id===i.pro_id&&<span className="tag selected"><Check size={14}/> Seleccionado</span>}</div></div>})}</>:<><h2>Responder a esta oportunidad</h2>{myInterest?<div className="notice friendly"><CheckCircle2 size={21}/> Ya enviaste tu interés. {job.selected_pro_id===currentId?'¡El cliente te seleccionó!':'Espera la decisión del cliente.'}</div>:job.status==='open'?<><label className="field">Tu mensaje al cliente<textarea rows={3} value={interestNote} onChange={e=>setInterestNote(e.target.value)}/></label><button className="btn btn-primary" onClick={()=>interestInJob(job)} disabled={busy}>Me interesa este trabajo <ArrowRight size={16}/></button></>:<p className="muted">Este trabajo ya no acepta nuevos interesados.</p>}</>}
    {participant&&selectedInterest&&<><div className="divider"/><h2><HeartHandshake size={23}/> Contacto con consentimiento mutuo</h2><p className="muted">Ambas personas deben aceptar compartir sus teléfonos. Nunca se muestran públicamente.</p>{mine?<label className="consent-row"><input type="checkbox" checked={job.client_contact_consent} onChange={()=>clientConsent(job)}/> Autorizo compartir mi teléfono con {getName(selectedPerson)}</label>:<label className="consent-row"><input type="checkbox" checked={selectedInterest.pro_contact_consent} onChange={()=>proConsent(selectedInterest)}/> Autorizo compartir mi teléfono con este cliente</label>}<div className="consent-status"><span className={job.client_contact_consent?'ok':''}>{job.client_contact_consent?'✓':'○'} Cliente</span><span className={selectedInterest.pro_contact_consent?'ok':''}>{selectedInterest.pro_contact_consent?'✓':'○'} Profesional</span></div>{contactAuthorized?<><button className="btn btn-primary" disabled={busy} onClick={()=>showContact(job)}><MessageCircle size={18}/> Ver contacto autorizado</button>{contactResult&&<div className="contact-panel"><strong>{contactResult.name}</strong><p>{contactResult.phone}</p>{supabase&&/^\+?[0-9\s()-]{8,20}$/.test(contactResult.phone)&&<a className="btn btn-soft" target="_blank" rel="noreferrer" href={`https://wa.me/${contactResult.phone.replace(/\D/g,'')}`}>Abrir WhatsApp <ArrowRight size={16}/></a>}</div>}</>:<p className="notice">El contacto se habilitará cuando ambos acepten. En cuentas reales, ambos necesitan registrar su teléfono privado.</p>}</>}
    {mine&&job.status==='matched'&&<><div className="divider"/><h2>¿Ya se realizó el trabajo?</h2><button className="btn btn-soft" onClick={()=>finishJob(job)} disabled={busy}><CheckCircle2 size={18}/> Marcar como finalizado</button></>}
    {mine&&job.status==='completed'&&!reviewed&&job.selected_pro_id&&<><div className="divider"/><h2>Evalúa el servicio realizado</h2><p className="muted">Solo puedes evaluar al profesional seleccionado después de finalizar el trabajo.</p><label className="field">Calificación<select value={reviewRating} onChange={e=>setReviewRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} {n===1?'estrella':'estrellas'}</option>)}</select></label><label className="field">Tu experiencia<textarea rows={3} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="¿Cómo fue la atención y el resultado?"/></label><button className="btn btn-primary" disabled={busy} onClick={()=>reviewJob(job)}>Publicar evaluación</button></>}{mine&&reviewed&&<div className="notice friendly"><CheckCircle2 size={19}/> Este trabajo ya tiene una evaluación publicada.</div>}
    </div></section>}
  function renderAccount(){return <section className="page narrow"><div className="page-heading"><span className="eyebrow">TU ESPACIO</span><h1>{mode==='maestro'?'Mi perfil profesional':'Mi cuenta'}</h1><p>Personaliza tu presentación y administra tu información.</p></div>{!signedIn?<div className="empty"><UserCircle2 size={32}/><h3>Bienvenido a ARAUKA</h3><p>Regístrate gratis para publicar trabajos o convertirte en profesional.</p><button className="btn btn-primary" onClick={()=>requestAuth()}>Crear cuenta</button><button className="btn btn-soft" onClick={()=>requestAuth('login')}>Ya tengo cuenta</button></div>:<><div className="account-heading"><div className="account-avatar"><UserCircle2 size={29}/></div><div><strong>{getName(currentProfile)}</strong><p className="muted">{configured?'Cuenta conectada a Supabase':'Cuenta de demostración'}</p></div>{supabase&&<button className="btn btn-soft btn-sm" onClick={async()=>{await supabase?.auth.signOut();notify('Sesión cerrada.')}}><LogOut size={15}/> Salir</button>}</div>{configured&&<section className="form-card" id="avisos"><h2><Bell size={19}/> Mis notificaciones {notifications.filter(n=>!n.read_at).length>0&&<span className="notice-count">{notifications.filter(n=>!n.read_at).length} nuevas</span>}</h2><p className="muted">Avisos dentro de ARAUKA. El correo se activa por separado desde Supabase.</p><label className="consent-row"><input type="checkbox" checked={emailEnabled} onChange={e=>void updateEmailPreference(e.target.checked)}/> Quiero recibir notificaciones por correo cuando esté activado el servicio de envío.</label>{notifications.length?notifications.map(n=><button key={n.id} className={`notification-item ${n.read_at?'':'unread'}`} onClick={()=>void readNotification(n)}><strong>{n.title}</strong><span>{n.body}</span><small>{formatDate(n.created_at)} · {n.read_at?'Leída':'Nueva'} {n.job_id?'· Ver trabajo':''}</small></button>):<p className="muted">Todavía no tienes avisos.</p>}</section>}<form className="form-card" onSubmit={saveProfile}><h2>Información del perfil</h2><label className="field">Nombre para mostrar<input value={profileForm.display_name} onChange={e=>setProfileForm({...profileForm,display_name:e.target.value})}/></label><label className="field">Nombre de la empresa (opcional)<input placeholder="Ej.: NOBRO" value={profileForm.company_name} onChange={e=>setProfileForm({...profileForm,company_name:e.target.value})}/></label><label className="field">Presentación<textarea rows={4} value={profileForm.bio} onChange={e=>setProfileForm({...profileForm,bio:e.target.value})} placeholder="Cuéntales a los clientes qué haces y qué experiencia tienes."/></label>{(mode==='maestro'||isPro)&&<><h3>Mis oficios</h3><div className="check-grid">{CATEGORIES.map(c=><label key={c}><input type="checkbox" checked={profileForm.categories.includes(c)} onChange={()=>toggleList('categories',c)}/>{c}</label>)}</div><h3>Localidades donde trabajo</h3><div className="check-grid">{LOCALITIES.map(c=><label key={c}><input type="checkbox" checked={profileForm.service_localities.includes(c)} onChange={()=>toggleList('service_localities',c)}/>{c}</label>)}</div></>}<button className="btn btn-primary btn-full" type="submit" disabled={busy}>{busy?'Guardando...':'Guardar cambios'}</button></form>
    <div className="form-card"><h2>Experiencia de navegación</h2><p className="muted">Modo actual: <strong>{mode==='cliente'?'Cliente':'Maestro'}</strong>. Este modo es independiente de tu nombre personal o nombre de empresa y queda guardado en la dirección de la página.</p>{mode==='cliente'?<button className="btn btn-soft" onClick={()=>changeRole('maestro')}><Hammer size={17}/> Cambiar a Maestro</button>:<button className="btn btn-soft" onClick={()=>changeRole('cliente')}><Users size={17}/> Cambiar a Cliente</button>}</div>
    {isPro&&<div className="form-card"><h2>Fotografías de mis trabajos</h2><p className="muted">Muestra ejemplos de trabajos realizados. En modo real se guardan en Supabase Storage.</p><label className={`upload-btn ${!configured?'disabled':''}`}><ImagePlus size={20}/> Agregar foto (hasta 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!configured||busy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadPortfolio(f);e.target.value=''}}/></label>{!configured&&<p className="form-small">Disponible al conectar un proyecto Supabase.</p>}{data.portfolio.filter(x=>x.pro_id===currentId).length>0&&<div className="portfolio-grid">{data.portfolio.filter(x=>x.pro_id===currentId).map(x=><figure key={x.id}><img src={imageUrl(x.image_path)} alt={x.caption}/></figure>)}</div>}</div>}
    {configured&&<form className="form-card" onSubmit={savePhone}><h2>Teléfono privado</h2><p className="muted">Solo se entregará a la otra parte después de ser seleccionado y cuando ambos autoricen compartir el contacto.</p><label className="field">Teléfono con código de país<input type="tel" placeholder="+56 9 1234 5678" value={myPhone} onChange={e=>setMyPhone(e.target.value)}/></label><button className="btn btn-soft" type="submit" disabled={busy}><Phone size={17}/> Guardar teléfono</button></form>}
    {supabase&&<div className="mobile-only"><button className="btn btn-soft btn-full" onClick={()=>void supabase?.auth.signOut()}><LogOut size={16}/> Cerrar sesión</button></div>}
    </> }</section>}
  if(configured&&!loading&&!userId&&!experienceChosen)return <div className="experience-entry"><div className="experience-entry-inner"><button className="logo entry-logo" aria-label="ARAUKA"><span className="brand-mark">A</span><span>arauka<span className="brand-period">.</span><small>conecta tu zona</small></span></button><div className="experience-copy"><span className="eyebrow">ELIGE CÓMO QUIERES USAR ARAUKA</span><h1>¿Qué necesitas hacer hoy?</h1><p>Usarás una sola cuenta. Podrás cambiar de experiencia más adelante desde Mi cuenta.</p></div><div className="experience-options"><button className="experience-option client-option" onClick={()=>chooseExperience('cliente')}><span className="experience-icon"><Users size={30}/></span><span><strong>Necesito un servicio</strong><b>Cliente</b><small>Publica solicitudes, recibe propuestas y elige un profesional.</small></span><ChevronRight size={24}/></button><button className="experience-option pro-option" onClick={()=>chooseExperience('maestro')}><span className="experience-icon"><Hammer size={30}/></span><span><strong>Ofrezco mis servicios</strong><b>Maestro</b><small>Activa tu perfil profesional y encuentra oportunidades locales.</small></span><ChevronRight size={24}/></button></div><p className="entry-note"><LockKeyhole size={15}/> Después podrás registrarte o ingresar con la misma cuenta en ambas experiencias.</p></div></div>
  return <div className="site"><header className="topbar"><div className="topbar-inner"><button className="logo" onClick={()=>navigate('inicio')} aria-label="ARAUKA, ir al inicio"><span className="brand-mark">A</span><span>arauka<span className="brand-period">.</span><small>conecta tu zona</small></span></button><nav className="top-nav" aria-label="Menú">{navButton('inicio','Inicio')}{navButton('buscar','Profesionales')}{navButton('trabajos',mode==='cliente'?'Mis trabajos':'Oportunidades')}{navButton('cuenta','Mi cuenta')}</nav><div className="top-actions">{configured&&userId&&<button className="notification-trigger" onClick={()=>navigate('cuenta')} aria-label={`Mis avisos: ${notifications.filter(n=>!n.read_at).length} pendientes`}><Bell size={18}/>{notifications.some(n=>!n.read_at)&&<span className="notification-dot"/>}</button>}<button className="current-role" onClick={()=>navigate('cuenta')} title="Cambiar experiencia desde Mi cuenta"><span>{mode==='cliente'?'Cliente':'Maestro'}</span><span className="muted">· Mi cuenta</span></button>{configured&&!userId&&<button className="btn btn-primary btn-sm login-btn" onClick={()=>requestAuth('login')}><LogIn size={15}/> Ingresar</button>}{configured&&userId&&<button className="account-pill" onClick={()=>navigate('cuenta')}><UserCircle2 size={19}/></button>}</div></div></header><main className="main-content"><div className="top-caption">{!configured&&<span className="demo-flag">MODO DEMOSTRACIÓN</span>}<span>{modeDescription}</span></div>{message&&<div role="status" className="global-message"><CheckCircle2 size={19}/>{message}<button onClick={()=>setMessage('')} aria-label="Cerrar mensaje"><X size={15}/></button></div>}{error&&<div role="alert" className="global-error"><CircleHelp size={19}/>{error}<button onClick={()=>setError('')} aria-label="Cerrar error"><X size={15}/></button></div>}{loading?<div className="empty"><span className="spinner"/> Cargando datos de ARAUKA...</div>:screen==='inicio'?renderHome():screen==='buscar'?renderSearch():screen==='publicar'?renderPublish():screen==='trabajos'?renderJobs():screen==='profesional'?renderPro():screen==='detalle'?renderJobDetail():renderAccount()}</main><footer className="site-footer"><div><strong>arauka.</strong><p>Conectando personas y oficios en La Araucanía y Los Ríos.</p></div><div><span>Villarrica · Pucón · Lican Ray · Panguipulli · Coñaripe</span><small>© {new Date().getFullYear()} ARAUKA · Nombre provisional · Etapa de desarrollo</small></div></footer>{bottomNav()}{authOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthOpen(false)}}><div className="auth-modal" role="dialog" aria-modal="true" aria-label="Acceso a ARAUKA"><button className="modal-close" onClick={()=>setAuthOpen(false)} aria-label="Cerrar"><X size={20}/></button><div className="auth-icon"><UserCircle2 size={28}/></div><h2>{authKind==='registro'?'Únete a ARAUKA':'Ingresa a ARAUKA'}</h2><p>Es gratis durante el lanzamiento.</p><div className="auth-tabs"><button className={authKind==='registro'?'active':''} onClick={()=>setAuthKind('registro')}>Crear cuenta</button><button className={authKind==='login'?'active':''} onClick={()=>setAuthKind('login')}>Ingresar</button></div><form onSubmit={authenticate}>{authKind==='registro'&&<label className="field">Tu nombre<input required value={authFields.name} onChange={e=>setAuthFields({...authFields,name:e.target.value})}/></label>}<label className="field">Correo electrónico<input required type="email" value={authFields.email} onChange={e=>setAuthFields({...authFields,email:e.target.value})}/></label><label className="field">Contraseña<input required minLength={8} type="password" value={authFields.password} onChange={e=>setAuthFields({...authFields,password:e.target.value})}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="btn btn-primary btn-full" type="submit" disabled={busy}>{busy?'Procesando...':authKind==='registro'?'Registrarme gratis':'Ingresar'}<ArrowRight size={16}/></button></form><p className="form-small">Tus datos se protegen mediante las reglas de acceso de la base de datos.</p></div></div>}</div>
}
