import { createClient } from '@supabase/supabase-js'
import {validateStagingBrowserConfig} from './environment'

const environment=validateStagingBrowserConfig({
  appEnvironment:import.meta.env.VITE_APP_ENV,
  url:import.meta.env.VITE_SUPABASE_URL,
  publishableKey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  projectRef:import.meta.env.VITE_SUPABASE_PROJECT_REF
})
export const configured=environment.configured
export const isStaging=environment.isStaging
export const configurationError=environment.error
export const stagingProjectRef=environment.projectRef

// La clave publicable se puede exponer; la seguridad depende de las políticas RLS en PostgreSQL.
// Nunca utilizar la service_role/secret key desde un navegador.
export const supabase = configured ? createClient(environment.url!, environment.key!, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
}) : null
