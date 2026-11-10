import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const configured = Boolean(url && key && !url.includes('TU-PROYECTO') && !key.includes('TU_CLAVE'))

// La clave publicable se puede exponer; la seguridad depende de las políticas RLS en PostgreSQL.
// Nunca utilizar la service_role/secret key desde un navegador.
export const supabase = configured ? createClient(url!, key!, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
}) : null
