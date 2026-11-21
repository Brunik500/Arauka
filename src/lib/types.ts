export const LOCALITIES = ['Villarrica', 'Pucón', 'Lican Ray', 'Panguipulli', 'Coñaripe'] as const
export const CATEGORIES = ['Electricidad', 'Gasfitería', 'Limpieza', 'Carpintería', 'Jardinería', 'Construcción', 'Portones', 'Pintura', 'Mascotas', 'Muebles', 'Cerrajería', 'Otros'] as const
export type Locality = typeof LOCALITIES[number]
export type Category = typeof CATEGORIES[number]
export type Mode = 'cliente' | 'maestro' | 'empresa'
export type ProfileKind = 'personal' | 'professional' | 'business' | 'company'
export type Capability = 'hire' | 'offer'
export type Experience = {
  experience: Mode
  profile_kind: ProfileKind
  is_primary: boolean
  public_name: string | null
  legal_name: string | null
  verification_status: 'not_applicable' | 'pending' | 'verified' | 'rejected'
}
export type Page = 'inicio' | 'buscar' | 'publicar' | 'trabajos' | 'cuenta'
export type JobStatus = 'open' | 'matched' | 'completed' | 'cancelled'

export type Profile = {
  id: string
  auth_user_id?: string | null
  deleted_at?: string | null
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
export type PublicProviderKind = 'professional' | 'business' | 'company'
export type PublicProviderRpcRow = {
  user_id:string
  profile_kind:PublicProviderKind
  public_name:string
  bio:string
  services:string[]
  coverage:string[]
  is_company_verified:boolean
}
export type PublicProviderPortfolioItem = { id:string; imagePath:string; caption:string }
export type PublicProviderReview = { id:string; rating:number; comment:string; createdAt:string }
export type PublicProvider = {
  id:string
  publicName:string
  description:string
  services:string[]
  serviceAreas:string[]
  profileKind:PublicProviderKind
  isCompanyVerified:boolean
  portfolio:PublicProviderPortfolioItem[]
  reviews:PublicProviderReview[]
  reviewCount:number
  averageRating:number|null
}
export type CommercialProfile = {
  user_id:string
  profile_kind:ProfileKind
  public_name:string|null
  legal_name:string|null
  tax_id:string|null
  legal_type:string|null
  economic_activity:string|null
  tax_address:string|null
  municipality:string|null
  region:string|null
  representative_name:string|null
  contact_email:string|null
  business_phone:string|null
  coverage:string[]
  services:string[]
  verification_status:Experience['verification_status']
  verification_reviewed_at:string|null
}
export type CompanyDocument = {id:string;user_id:string;storage_path:string;document_type:string;created_at:string}
