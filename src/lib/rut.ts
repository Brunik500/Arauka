export function normalizeRut(value: string): string {
  const clean=value.replace(/[^0-9kK]/g,'').toUpperCase()
  if(clean.length<2)return clean
  return `${clean.slice(0,-1)}-${clean.slice(-1)}`
}

export function rutCheckDigit(body: string): string {
  let sum=0
  let multiplier=2
  for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*multiplier;multiplier=multiplier===7?2:multiplier+1}
  const result=11-(sum%11)
  return result===11?'0':result===10?'K':String(result)
}

export function isValidRut(value: string): boolean {
  const normalized=normalizeRut(value)
  const [body,digit]=normalized.split('-')
  return Boolean(body && digit && /^\d{7,8}$/.test(body) && rutCheckDigit(body)===digit)
}
