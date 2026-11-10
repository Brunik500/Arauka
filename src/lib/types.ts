export const LOCALITIES = ['Villarrica', 'Pucón', 'Lican Ray', 'Panguipulli', 'Coñaripe'] as const
export const CATEGORIES = ['Electricidad', 'Gasfitería', 'Limpieza', 'Carpintería', 'Jardinería', 'Construcción', 'Portones', 'Pintura', 'Mascotas', 'Muebles', 'Cerrajería', 'Otros'] as const
export type Locality = typeof LOCALITIES[number]
export type Category = typeof CATEGORIES[number]
export type Mode = 'cliente' | 'maestro'
export type Page = 'inicio' | 'buscar' | 'publicar' | 'trabajos' | 'cuenta'
export type JobStatus = 'open' | 'matched' | 'completed' | 'cancelled'

export type Profile = {
  id: string
  display_name: string
  bio: string
  company_name: string | null
  is_professional: boolean
  categories: string[]
  service_localities: string[]
  created_at?: string
}
export type Job = {
  id: string
  client_id: string
  title: string
  description: string
  category: string
  locality: string
  status: JobStatus
  selected_pro_id: string | null
  client_contact_consent: boolean
  created_at: string
}
export type Interest = {
  id: string
  job_id: string
  pro_id: string
  note: string
  pro_contact_consent: boolean
  created_at: string
}
export type Portfolio = { id: string; pro_id: string; image_path: string; caption: string; created_at: string }
export type Review = { id: string; job_id: string; client_id: string; pro_id: string; rating: number; comment: string; created_at: string }
export type Verification = { pro_id: string; identity_verified: boolean; credentials_verified: boolean }
