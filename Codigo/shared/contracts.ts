export type Role = 'athlete' | 'coach' | 'admin'
export type Mode = 'online' | 'presencial' | 'hibrido'
export type VerificationStatus =
  'unsubmitted' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'expired'
export type ContractStatus =
  'pending' | 'active' | 'rejected' | 'cancelled' | 'suspended'
export const SPORTS = [
  'Corrida',
  'Musculação',
  'Natação',
  'Ciclismo',
  'Triatlo',
  'Atletismo',
  'Basquete',
  'Beach tennis',
  'Boxe',
  'Canoagem',
  'Caminhada',
  'CrossFit',
  'Dança',
  'Escalada',
  'Futebol',
  'Futsal',
  'Ginástica',
  'Handebol',
  'Jiu-jitsu',
  'Judô',
  'Karatê',
  'MMA',
  'Mountain bike',
  'Muay thai',
  'Padel',
  'Pilates',
  'Remo',
  'Skate',
  'Surfe',
  'Taekwondo',
  'Tênis',
  'Tênis de mesa',
  'Trail running',
  'Treinamento funcional',
  'Vôlei',
  'Vôlei de praia',
  'Yoga',
] as const
export const LEVELS = ['Iniciante', 'Intermediário', 'Avançado'] as const
// ordem dia → período: a grade do perfil depende dela para montar uma coluna por dia
export const SLOTS = [
  'Segunda manhã',
  'Segunda tarde',
  'Segunda noite',
  'Terça manhã',
  'Terça tarde',
  'Terça noite',
  'Quarta manhã',
  'Quarta tarde',
  'Quarta noite',
  'Quinta manhã',
  'Quinta tarde',
  'Quinta noite',
  'Sexta manhã',
  'Sexta tarde',
  'Sexta noite',
  'Sábado manhã',
  'Sábado tarde',
  'Sábado noite',
  'Domingo manhã',
  'Domingo tarde',
  'Domingo noite',
] as const
export const GOALS = [
  'Condicionamento',
  'Performance',
  'Emagrecimento',
  'Força',
  'Competição',
] as const
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
}
export interface ProfilePreview {
  name: string
  bio: string
  consultedCoaches: number
}
export interface ProfileInput {
  name: string
  city: string
  bio: string
  sports: string[]
  goals: string[]
  levels: string[]
  availability: string[]
  mode: Mode
  budget: number
  price: number
  birthDate?: string | null
  nationality?: string | null
  heightCm?: number | null
  weightKg?: number | null
}
export interface Profile extends ProfileInput {
  userId: string
  role: Role
  email: string
  cref: string
  verificationStatus: VerificationStatus
  verificationReason: string
  verificationExpiresAt?: string | null
  memberSince: string
  /** ISO da última troca de foto; null quando não há foto. */
  photoUpdatedAt: string | null
}
/** Altura e peso são opcionais, mas recomendados; a foto é opcional. */
export const profileMissing = (p: Profile) =>
  (
    [
      ['birthDate', 'data de nascimento'],
      ['nationality', 'nacionalidade'],
      ['heightCm', 'altura'],
      ['weightKg', 'peso'],
    ] as const
  )
    .filter(([key]) => p[key] == null || p[key] === '')
    .map(([, label]) => label)
export interface MapPerson {
  userId: string
  role: 'athlete' | 'coach'
  name: string
  city: string
  sports: string[]
  price: number
  lat: number
  lon: number
  photoUpdatedAt: string | null
  verified: boolean
}
export interface CoachCard
  extends Omit<
    Profile,
    'email' | 'budget' | 'role' | 'birthDate' | 'heightCm' | 'weightKg'
  > {
  score: number
  reasons: string[]
}
export interface Verification {
  id: string
  coachId: string
  coachName: string
  cref: string
  evidence: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  submittedAt: string
  reviewedAt: string | null
  reviewerId: string | null
  documentId?: string | null
  expiresAt?: string | null
  source?: string
}
export interface Contract {
  id: string
  athleteId: string
  coachId: string
  athleteName: string
  coachName: string
  status: ContractStatus
  createdAt: string
  decidedAt: string | null
}
export interface ExerciseBlock {
  name: string
  instructions: string
  sets?: number
  repetitions?: number
  loadKg?: number
  durationMinutes?: number
  distanceKm?: number
  videoUrl?: string
}
export interface WorkoutInput {
  contractId: string
  title: string
  sport: string
  scheduledDate: string
  instructions: string
  status: 'draft' | 'published'
  blocks: ExerciseBlock[]
}
export interface ExecutionInput {
  completedBlocks: number[]
  effort: number
  notes: string
  metrics: Record<string, number>
}
export interface Execution extends ExecutionInput {
  id: string
  updatedAt: string
}
export interface Workout extends WorkoutInput {
  id: string
  coachId: string
  athleteId: string
  coachName: string
  athleteName: string
  createdAt: string
  execution: Execution | null
}
export interface MetricType {
  sport: string
  key: string
  label: string
  unit: string
  min: number
  max: number
}
export interface Dashboard {
  contracts: Contract[]
  workouts: Workout[]
}
export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string[]>
}

/** HTTP contract: all endpoints are relative to /api. Cookie credentials are mandatory.
 * POST /auth/register {name,email,password,role:'athlete'|'coach',cref?} (CREF obrigatório para treinador) -> 201 {user}
 * POST /auth/login {email,password} -> {user}; GET /auth/session -> {user: AppUser|null}
 * POST /auth/logout {} -> {ok:true}
 * GET /profiles/me -> {profile}; PUT /profiles/me ProfileInput -> {profile}
 * GET /coaches?sport=&query=&maxPrice=&mode= -> {coaches:CoachCard[]}
 * POST /verifications {cref,evidence} -> 201 {verification}; GET /verifications -> {verifications}
 * GET /admin/verifications -> {verifications}; PATCH /admin/verifications/:id {status:'approved'|'rejected',reason} -> {verification}
 * GET /contracts -> {contracts}; POST /contracts {coachId} -> 201 {contract}
 * PATCH /contracts/:id {status:'active'|'rejected'} -> {contract}
 * GET /workouts -> {workouts}; POST /workouts WorkoutInput -> 201 {workout}
 * GET /workouts/:id -> {workout}; PUT /workouts/:id WorkoutInput -> {workout}
 * PUT /workouts/:id/execution ExecutionInput -> {workout}
 * GET /metrics?sport= -> {metrics:MetricType[]}; GET /dashboard -> Dashboard
 */
