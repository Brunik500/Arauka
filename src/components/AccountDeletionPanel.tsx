import {useState} from 'react'
import {AlertTriangle, LockKeyhole, Trash2, X} from 'lucide-react'

export function AccountDeletionPanel({experienceCount}:{experienceCount:number}){
  const [open,setOpen]=useState(false)
  const [confirmation,setConfirmation]=useState('')
  const [password,setPassword]=useState('')
  const close=()=>{setOpen(false);setConfirmation('');setPassword('')}
  return <section className="form-card privacy-account">
    <span className="eyebrow">PRIVACIDAD</span><h2><LockKeyhole size={19}/> Privacidad y cuenta</h2>
    <p className="muted">Administra tu cuenta completa. Esto es distinto de cambiar o desactivar una experiencia.</p>
    <button type="button" className="btn danger-action" onClick={()=>setOpen(true)}><Trash2 size={17}/> Eliminar mi cuenta</button>
    {open&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><div className="auth-modal deletion-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
      <button className="modal-close" type="button" onClick={close} aria-label="Cancelar y cerrar"><X size={20}/></button>
      <AlertTriangle className="danger-icon" size={34}/><h2 id="delete-account-title">Eliminar toda mi cuenta</h2>
      <p>Al eliminar tu cuenta perderás el acceso a ARAUKA y eliminaremos tus datos personales, salvo aquellos que debamos conservar por motivos legales o justificados. Esto afecta tus {experienceCount===1?'experiencia activa':`${experienceCount} experiencias activadas`}.</p>
      <p className="retention-notice">El historial de trabajos, acuerdos y evaluaciones podrá conservarse de forma anonimizada para proteger la integridad de la plataforma y la reputación de las personas que participaron.</p>
      <label className="field">Escribe ELIMINAR para confirmar<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label>
      <label className="field">Contraseña actual<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>
      <div className="notice"><LockKeyhole size={18}/><span>La eliminación permanece deshabilitada mientras se aprueba la política de conservación y anonimización. No se envió ninguna solicitud.</span></div>
      <div className="deletion-actions"><button type="button" className="btn btn-soft" onClick={close}>Cancelar</button><button type="button" className="btn danger-action" disabled title="Pendiente de aprobación de conservación">Eliminar permanentemente</button></div>
      {confirmation==='ELIMINAR'&&password&&<p className="form-small">La confirmación está completa, pero el servidor todavía no admite eliminaciones.</p>}
    </div></div>}
  </section>
}
