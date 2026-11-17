export type AuthErrorLike={message?:string;code?:string;status?:number}

export const SIGNUP_EMAIL_DELIVERY_ERROR='No pudimos completar tu registro. En este momento no fue posible enviar el correo de confirmación. Por favor, inténtalo nuevamente más tarde'
export const RESEND_EMAIL_DELIVERY_ERROR='No fue posible procesar el reenvío del correo de confirmación. Por favor, inténtalo nuevamente más tarde'

export function isEmailConfirmationPending(error:unknown):boolean{
  if(!error||typeof error!=='object')return false
  const value=error as AuthErrorLike
  return value.code==='email_not_confirmed'||/email\s+not\s+confirmed/i.test(value.message??'')
}

export function loginErrorMessage(error:unknown):string{
  if(isEmailConfirmationPending(error))return 'Tu correo electrónico aún no está confirmado. Revisa tu bandeja de entrada y confirma tu cuenta antes de ingresar.'
  return 'No pudimos iniciar sesión. Revisa tu correo y contraseña e inténtalo nuevamente.'
}

export function isEmailDeliveryRateError(error:unknown):boolean{
  if(!error||typeof error!=='object')return false
  const value=error as AuthErrorLike
  if(value.status!==429)return false
  return /email|mail|confirmation|over_email_send_rate_limit/i.test(`${value.code??''} ${value.message??''}`)
}

export function signupErrorMessage(error?:unknown):string{
  if(isEmailDeliveryRateError(error))return SIGNUP_EMAIL_DELIVERY_ERROR
  return 'No pudimos completar el registro. Revisa los datos e inténtalo nuevamente. Si ya comenzaste este proceso, revisa también tu bandeja de entrada.'
}

export function resendErrorMessage():string{
  return RESEND_EMAIL_DELIVERY_ERROR
}

export type SafeAuthDiagnostic={operation:'signup'|'resend';category:'email_delivery_rate_limited'|'auth_request_rejected';status:number|null;code:string|null}

export function safeAuthDiagnostic(operation:SafeAuthDiagnostic['operation'],error:unknown):SafeAuthDiagnostic{
  const value=error&&typeof error==='object'?error as AuthErrorLike:{}
  const rawCode=typeof value.code==='string'?value.code:''
  return {
    operation,
    category:isEmailDeliveryRateError(error)?'email_delivery_rate_limited':'auth_request_rejected',
    status:typeof value.status==='number'&&Number.isFinite(value.status)?value.status:null,
    code:/^[a-z0-9_-]{1,80}$/i.test(rawCode)?rawCode:null
  }
}
