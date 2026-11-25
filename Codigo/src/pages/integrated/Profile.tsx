import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { Camera, ShieldCheck, Save } from 'lucide-react'
import * as Flags from 'country-flag-icons/react/3x2'
import exampleCutout from '../../assets/profile/athlete-cutout.png'
import type {
  Contract,
  Profile,
  ProfileInput,
  Verification,
} from '../../../shared/contracts'
import { SPORTS, GOALS, LEVELS, SLOTS } from '../../../shared/contracts'
import { useAuth } from '../../context/AuthContext'
import { ProfileCompletionNotice } from '../../components/ProfileCompletionNotice'
import { api, json } from '../../services/api'
import { uploadFile } from './Expansion'
import {
  Badge,
  Empty,
  message,
  Notice,
  PageTitle,
  State,
  useRemote,
} from './common'
function Choices({
  legend,
  values,
  selected,
  onChange,
  searchable = false,
  className = '',
}: {
  legend: string
  values: readonly string[]
  selected: string[]
  onChange: (v: string[]) => void
  searchable?: boolean
  className?: string
}) {
  const [query, setQuery] = useState('')
  const plain = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const shown = values.filter(
    (v) => selected.includes(v) || plain(v).includes(plain(query.trim())),
  )
  return (
    <fieldset className={`live-choices ${className}`}>
      <legend>{legend}</legend>
      {searchable && (
        <input
          type="search"
          className="live-choices-search"
          placeholder="Buscar modalidade…"
          aria-label={`Buscar em ${legend}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div>
        {shown.length === 0 && <p className="live-choices-empty">Nenhuma modalidade encontrada.</p>}
        {shown.map((value) => (
          <label
            key={value}
            className={`checkbox-wrapper-46${selected.includes(value) ? ' selected' : ''}`}
          >
            <input
              className="inp-cbx"
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() =>
                onChange(
                  selected.includes(value)
                    ? selected.filter((v) => v !== value)
                    : [...selected, value],
                )
              }
            />
            <span className="cbx">
              <span aria-hidden="true">
                <svg viewBox="0 0 12 10" height="10" width="12">
                  <polyline points="1.5 6 4.5 9 10.5 1" />
                </svg>
              </span>
              <span>{value}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
/** URL da foto salva no banco; o parâmetro v invalida o cache após cada troca. */
export const photoUrl = (userId: string, updatedAt: string | null) =>
  updatedAt
    ? `/api/profiles/${userId}/photo?v=${encodeURIComponent(updatedAt)}`
    : null

/** Reduz o PNG recortado para caber no limite de 2 MB do servidor. */
async function shrinkPng(blob: Blob, maxSide = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  // corta as margens transparentes deixadas pela remoção de fundo, para o recorte ocupar o espaço do retrato
  const probe = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
  probe.drawImage(bitmap, 0, 0)
  const { data } = probe.getImageData(0, 0, bitmap.width, bitmap.height)
  let [x0, y0, x1, y1] = [bitmap.width, bitmap.height, -1, -1]
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++)
      if (data[(y * bitmap.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) [x0, y0, x1, y1] = [0, 0, bitmap.width - 1, bitmap.height - 1] // imagem toda transparente
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')?.drawImage(bitmap, x0, y0, w, h, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG.'))),
      'image/png',
    ),
  )
}

const regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' })
const COUNTRIES = Object.keys(Flags)
  .filter((code) => /^[A-Z]{2}$/.test(code))
  .map((code) => {
    let name = code
    try { name = regionNames.of(code) || code } catch { /* código sem nome */ }
    return { code, name }
  })
  .filter((c) => c.name !== c.code)
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

function countryName(code: string) {
  try { return regionNames.of(code) || code } catch { return code }
}

function CountryFlag({ code }: { code: string }) {
  const Flag = (Flags as Record<string, ComponentType<SVGProps<SVGSVGElement>>>)[code]
  if (!Flag) return null
  return (
    <span className="pf-flag" role="img" aria-label={'Bandeira: ' + countryName(code)} title={countryName(code)}>
      <Flag aria-hidden="true" />
    </span>
  )
}

function longDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso.slice(0, 10) + 'T00:00:00Z'))
    .replace(/\./g, '')
    .replace(/ de /g, ' ')
}

type ProfileTab = 'dados' | 'modalidades' | 'objetivos' | 'nivel' | 'disponibilidade' | 'atendimento'

export function ProfilePage() {
  const { user } = useAuth()
  const remote = useRemote<{ profile: Profile }>('/profiles/me')
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<ProfileTab>('dados')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isCoach = user?.role === 'coach'
  useEffect(() => {
    if (remote.data) setProfile(remote.data.profile)
  }, [remote.data])
  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p))
    setSuccess('')
  }
  async function changePhoto(file: File | undefined) {
    if (!file || !user) return
    setPhotoBusy(true)
    setError('')
    try {
      // Remove o fundo no próprio navegador e envia o PNG recortado ao banco
      const { removeBackground } = await import('@imgly/background-removal')
      const cutout = await removeBackground(file, { output: { format: 'image/png' } })
      const body = new FormData()
      body.append('file', await shrinkPng(cutout), 'foto.png')
      const data = await api<{ profile: Profile }>('/profiles/me/photo', {
        method: 'PUT',
        body,
      })
      setProfile((p) => (p ? { ...p, photoUpdatedAt: data.profile.photoUpdatedAt } : p))
      setSuccess('Foto atualizada.')
    } catch (e) {
      setError('Não foi possível salvar a foto. Tente outra imagem. ' + message(e))
    } finally {
      setPhotoBusy(false)
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setError('')
    setSuccess('')
    const {
      name,
      city,
      bio,
      sports,
      goals,
      levels,
      availability,
      mode,
      budget,
      price,
      birthDate,
      nationality,
      heightCm,
      weightKg,
    } = profile
    try {
      const data = await api<{ profile: Profile }>(
        '/profiles/me',
        json('PUT', {
          name,
          city,
          bio,
          sports,
          goals,
          levels,
          availability,
          mode,
          budget,
          price,
          birthDate: birthDate || null,
          nationality: nationality || null,
          heightCm: heightCm || null,
          weightKg: weightKg || null,
        }),
      )
      setProfile(data.profile)
      setSuccess('Perfil salvo com sucesso.')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const nameParts = (profile?.name || user?.name || '').trim().split(/\s+/)
  const firstName = nameParts.length > 1 ? nameParts[0] : ''
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]
  const activeCoach = contracts.data?.contracts.find((c) => c.status === 'active')
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'dados', label: 'Dados pessoais' },
    { id: 'modalidades', label: 'Modalidades' },
    { id: 'objetivos', label: 'Objetivos' },
    { id: 'nivel', label: isCoach ? 'Níveis que atende' : 'Seu nível' },
    { id: 'disponibilidade', label: 'Disponibilidade' },
    { id: 'atendimento', label: 'Atendimento' },
  ]
  return (
    <>
      <State {...remote} retry={remote.reload} />
      {profile && !remote.error && (
        <div className="pf-page">
          <ProfileCompletionNotice profile={profile} />
          {/* Cabeçalho frameless do atleta: bio à esquerda, retrato no fundo, "LA" e bandeira à direita */}
          <section className="pf-hero" aria-label="Resumo do perfil">
            <div className="pf-hero__badge">
              <div className="pf-hero__mark" aria-hidden="true">
                <span>L</span><span>A</span>
              </div>
            </div>
            <div className="pf-hero__portrait">
              {photoUrl(profile.userId, profile.photoUpdatedAt) ? (
                <img
                  className="pf-hero__photo"
                  src={photoUrl(profile.userId, profile.photoUpdatedAt)!}
                  alt={'Foto de ' + profile.name}
                />
              ) : (
                <img
                  className="pf-hero__photo pf-hero__photo--placeholder"
                  src={exampleCutout}
                  alt=""
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="pf-hero__copy">
              {firstName && <span className="pf-hero__first">{firstName}</span>}
              <h2 className="pf-hero__last">{lastName}</h2>
              <dl className="pf-facts">
                {isCoach ? (
                  <div><dt>Registro CREF</dt><dd>{profile.cref || 'Não informado'}</dd></div>
                ) : (
                  <div><dt>Treinador atual</dt><dd>{activeCoach?.coachName || 'Sem treinador'}</dd></div>
                )}
                <div>
                  <dt>Data de nascimento</dt>
                  <dd>{longDate(profile.birthDate)}{profile.birthDate && profile.city ? ', ' + profile.city.split(',')[0] : ''}</dd>
                </div>
                <div><dt>Nacionalidade</dt><dd>{profile.nationality ? countryName(profile.nationality) : '—'}</dd></div>
                <div>
                  <dt>Perfil</dt>
                  <dd>
                    {profile.heightCm ? profile.heightCm + 'cm' : '—'} /{' '}
                    {profile.weightKg ? profile.weightKg.toLocaleString('pt-BR') + 'kg' : '—'}
                  </dd>
                </div>
                <div><dt>Na LinkAtletas desde</dt><dd>{longDate(profile.memberSince)}</dd></div>
              </dl>
            </div>
            <label className={'pf-hero__upload' + (photoBusy ? ' is-busy' : '')}>
              <Camera size={15} aria-hidden="true" />
              {photoBusy ? 'Removendo fundo…' : profile.photoUpdatedAt ? 'Trocar foto' : 'Adicionar foto'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={photoBusy}
                onChange={(e) => {
                  void changePhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </section>

          <form className="live-panel live-form pf-panel" onSubmit={save}>
            <div className="pf-tabs-bar">
              <div className="pf-tabs" role="tablist" aria-label="Seções do perfil">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={'pf-tab-' + t.id}
                    aria-selected={tab === t.id}
                    aria-controls="pf-tabpanel"
                    className={'pf-tab' + (tab === t.id ? ' is-active' : '')}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {isCoach && <Badge status={profile.verificationStatus} />}
            </div>

            <div id="pf-tabpanel" role="tabpanel" aria-labelledby={'pf-tab-' + tab} className="pf-tabpanel">
            {tab === 'dados' && (<>
            <p className="pf-email">{profile.email}</p>
            <div className="live-grid-2">
              <label>
                Nome completo
                <input
                  value={profile.name}
                  minLength={2}
                  maxLength={100}
                  required
                  onChange={(e) => set('name', e.target.value)}
                />
              </label>
              <label>
                Cidade
                <input
                  value={profile.city}
                  maxLength={100}
                  onChange={(e) => set('city', e.target.value)}
                />
              </label>
            </div>
            <label>
              Sobre você
              <textarea
                value={profile.bio}
                maxLength={2000}
                rows={3}
                onChange={(e) => set('bio', e.target.value)}
              />
            </label>
            <div className="pf-grid-4">
              <label>
                Data de nascimento
                <input
                  type="date"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={profile.birthDate ?? ''}
                  onChange={(e) => set('birthDate', e.target.value || null)}
                />
              </label>
              <label>
                Nacionalidade
                <select
                  value={profile.nationality ?? ''}
                  onChange={(e) => set('nationality', e.target.value || null)}
                >
                  <option value="">Selecione</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  min={100}
                  max={250}
                  step={1}
                  value={profile.heightCm ?? ''}
                  onChange={(e) => set('heightCm', e.target.value ? Number(e.target.value) : null)}
                />
              </label>
              <label>
                Peso (kg)
                <input
                  type="number"
                  min={30}
                  max={300}
                  step={0.1}
                  value={profile.weightKg ?? ''}
                  onChange={(e) => set('weightKg', e.target.value ? Number(e.target.value) : null)}
                />
              </label>
            </div>
            </>)}
            {tab === 'modalidades' && (
              <Choices
                legend="Modalidades"
                values={SPORTS}
                searchable
                selected={profile.sports}
                onChange={(v) => set('sports', v)}
              />
            )}
            {tab === 'objetivos' && (
              <Choices
                legend="Objetivos"
                values={GOALS}
                selected={profile.goals}
                onChange={(v) => set('goals', v)}
              />
            )}
            {tab === 'nivel' && (
              <Choices
                legend={isCoach ? 'Níveis que atende' : 'Seu nível'}
                values={LEVELS}
                selected={profile.levels}
                onChange={(v) => set('levels', v)}
              />
            )}
            {tab === 'disponibilidade' && (
              <Choices
                legend="Disponibilidade"
                values={SLOTS}
                className="live-choices--week"
                selected={profile.availability}
                onChange={(v) => set('availability', v)}
              />
            )}
            {tab === 'atendimento' && (
            <div className="live-grid-2">
              <label>
                Formato de atendimento
                <select
                  value={profile.mode}
                  onChange={(e) =>
                    set('mode', e.target.value as Profile['mode'])
                  }
                >
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </label>
              {user?.role === 'coach' ? (
                <label>
                  Preço mensal (R$)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={profile.price}
                    onChange={(e) => set('price', Number(e.target.value))}
                  />
                </label>
              ) : (
                <label>
                  Orçamento mensal (R$)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={profile.budget}
                    onChange={(e) => set('budget', Number(e.target.value))}
                  />
                </label>
              )}
            </div>
            )}
            </div>
            <Notice error={error} success={success} />
            <div className="pf-actions">
              <button className="button button--dark" disabled={busy}>
                <Save size={17} />
                {busy ? 'Salvando…' : 'Salvar perfil'}
              </button>
            </div>
          </form>
          {user?.role === 'coach' && (
            <VerificationForm
              onChange={remote.reload}
              currentStatus={profile.verificationStatus}
            />
          )}
        </div>
      )}
    </>
  )
}
type ExtendedVerification = Verification & {
  documentId?: string | null
  expiresAt?: string | null
  source?: string
}
function VerificationForm({
  onChange,
  currentStatus,
}: {
  onChange: () => unknown
  currentStatus: string
}) {
  const { user } = useAuth()
  const remote = useRemote<{ verifications: ExtendedVerification[] }>(
    '/verifications',
  )
  const [cref, setCref] = useState('')
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      let document = documentId
      if (file && !document && user) {
        document = (await uploadFile(file, 'verification', user.id)).media.id
        setDocumentId(document)
      }
      await api(
        '/verifications',
        json('POST', {
          cref,
          evidence,
          ...(document ? { documentId: document } : {}),
        }),
      )
      setSuccess('Credenciais enviadas. Aguarde a análise do administrador.')
      await remote.reload()
      onChange()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const pending = remote.data?.verifications.some((v) => v.status === 'pending')
  const approved = currentStatus === 'approved'
  return (
    <section className="live-panel">
      <div className="live-panel-heading">
        <div>
          <h3>
            <ShieldCheck size={21} /> Verificação profissional
          </h3>
          <p>Seu perfil aparece na busca após a aprovação manual do CREF.</p>
        </div>
      </div>
      <State {...remote} retry={remote.reload} />
      {remote.data?.verifications.map((v) => (
        <article className="live-row" key={v.id}>
          <div>
            <strong>{v.cref}</strong>
            <p>{v.reason || 'Solicitação enviada para análise.'}</p>
            {v.expiresAt && (
              <small>
                Validade: {new Date(v.expiresAt).toLocaleDateString('pt-BR')}
              </small>
            )}
            {v.documentId && (
              <a
                className="live-link"
                href={'/api/media/' + v.documentId + '/content'}
                target="_blank"
                rel="noreferrer"
              >
                Abrir documento privado
              </a>
            )}
          </div>
          <Badge status={v.status} />
        </article>
      ))}
      {!approved && (
        <form onSubmit={submit} className="live-form">
          <label>
            CREF
            <input
              value={cref}
              placeholder="Ex.: 012345-G/SC"
              required
              minLength={4}
              maxLength={50}
              onChange={(e) => setCref(e.target.value)}
            />
          </label>
          <label>
            Evidência profissional
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              placeholder="Informe o link público de consulta ao registro e informações para verificação."
              rows={3}
            />
          </label>
          <p className="live-muted">
            Complete seu perfil antes de enviar. Use apenas informações
            profissionais. A evidência é revisada pelo administrador.
          </p>
          <label>
            Documento profissional privado (opcional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
                setDocumentId(null)
              }}
            />
          </label>
          <Notice error={error} success={success} />
          <button className="button button--dark" disabled={busy || pending}>
            {pending
              ? 'Análise em andamento'
              : busy
                ? 'Enviando…'
                : 'Enviar para análise'}
          </button>
        </form>
      )}
    </section>
  )
}
export function AdminPage() {
  const remote = useRemote<{ verifications: ExtendedVerification[] }>(
    '/admin/verifications',
  )
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [expirations, setExpirations] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'other'>('all')
  const allVerifications = remote.data?.verifications || []
  const pendingCount = allVerifications.filter((v) => v.status === 'pending').length
  const approvedCount = allVerifications.filter((v) => v.status === 'approved').length
  const reviewedCount = allVerifications.length - pendingCount
  const reviewedPct = allVerifications.length
    ? Math.round((reviewedCount / allVerifications.length) * 100)
    : 0
  const visibleVerifications = allVerifications.filter((v) => {
    if (filter === 'pending') return v.status === 'pending'
    if (filter === 'approved') return v.status === 'approved'
    if (filter === 'other') return v.status !== 'pending' && v.status !== 'approved'
    return true
  })
  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(id)
    setError('')
    setSuccess('')
    if ((reasons[id] || '').trim().length < 5) {
      setError(
        'Informe uma justificativa de pelo menos 5 caracteres para registrar a análise.',
      )
      setBusy('')
      return
    }
    try {
      await api(
        '/admin/verifications/' + id,
        json('PATCH', {
          status,
          reason: reasons[id] || '',
          ...(status === 'approved' && expirations[id]
            ? {
                expiresAt: new Date(
                  expirations[id] + 'T23:59:59',
                ).toISOString(),
              }
            : {}),
        }),
      )
      setSuccess(
        status === 'approved'
          ? 'Profissional aprovado.'
          : 'Solicitação recusada com justificativa.',
      )
      await remote.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy('')
    }
  }
  async function suspend(
    v: ExtendedVerification,
    status: 'suspended' | 'rejected',
  ) {
    if ((reasons[v.id] || '').trim().length < 5) {
      setError('Informe uma justificativa de pelo menos 5 caracteres.')
      return
    }
    if (
      !window.confirm(
        status === 'suspended'
          ? 'Suspender este profissional e remover seu perfil da descoberta?'
          : 'Revogar a aprovação deste profissional?',
      )
    )
      return
    setBusy(v.id)
    setError('')
    setSuccess('')
    try {
      await api(
        '/admin/coaches/' + v.coachId + '/verification',
        json('PATCH', { status, reason: reasons[v.id] }),
      )
      await remote.reload()
      setSuccess('Decisão profissional registrada com auditoria.')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="exp-admin-page">
      <PageTitle
        title="Confiança começa com verificação"
        description="Revise o registro e a evidência profissional antes de aprovar o treinador."
      />
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      <div className="exp-admin-layout">
        <div className="exp-admin-main">
          {allVerifications.length > 1 && (
            <div className="exp-coach-filters" role="group" aria-label="Filtrar verificações">
              {(
                [
                  ['all', `Todos (${allVerifications.length})`],
                  ['pending', `Pendentes (${pendingCount})`],
                  ['approved', `Aprovados (${approvedCount})`],
                  ['other', `Recusados/Suspensos (${allVerifications.length - pendingCount - approvedCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={'exp-coach-filter' + (filter === key ? ' is-active' : '')}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="live-stack">
            {remote.data && !allVerifications.length && (
              <Empty>Nenhum registro para analisar no momento.</Empty>
            )}
            {remote.data && allVerifications.length > 0 && !visibleVerifications.length && (
              <Empty>Nenhum registro encontrado com esse filtro.</Empty>
            )}
            {visibleVerifications.map((v) => (
              <article className="live-panel" key={v.id}>
                <div className="live-panel-heading">
                  <div>
                    <h3>{v.coachName}</h3>
                    <p>CREF {v.cref}</p>
                  </div>
                  <Badge status={v.status} />
                </div>
                <p className="live-evidence">{v.evidence}</p>
                {v.documentId && (
                  <a
                    className="button button--outline"
                    href={'/api/media/' + v.documentId + '/content'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Conferir documento privado
                  </a>
                )}
                {v.expiresAt && (
                  <p className="live-muted">
                    Validade: {new Date(v.expiresAt).toLocaleDateString('pt-BR')} ·
                    Origem{' '}
                    {v.source === 'manual'
                      ? 'conferência manual'
                      : v.source || 'manual'}
                  </p>
                )}
                {v.status === 'pending' ? (
                  <>
                    <label className="live-field">
                      Justificativa da análise
                      <textarea
                        value={reasons[v.id] || ''}
                        onChange={(e) =>
                          setReasons({ ...reasons, [v.id]: e.target.value })
                        }
                        maxLength={1000}
                        placeholder="Obrigatória para aprovar ou recusar (mínimo 5 caracteres)."
                      />
                    </label>
                    <label className="live-field">
                      Validade da aprovação (opcional)
                      <input
                        type="date"
                        value={expirations[v.id] || ''}
                        min={new Date().toLocaleDateString('en-CA')}
                        onChange={(e) =>
                          setExpirations((value) => ({
                            ...value,
                            [v.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="live-actions">
                      <button
                        className="button button--dark"
                        disabled={!!busy}
                        onClick={() => review(v.id, 'approved')}
                      >
                        Aprovar
                      </button>
                      <button
                        className="button button--outline"
                        disabled={!!busy}
                        onClick={() => review(v.id, 'rejected')}
                      >
                        Recusar
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{v.reason || 'Registro aprovado.'}</p>
                )}
                {v.status === 'approved' && (
                  <div className="live-form exp-inline-form">
                    <label>
                      Justificativa da suspensão ou revogação
                      <textarea
                        minLength={5}
                        maxLength={1000}
                        value={reasons[v.id] || ''}
                        onChange={(e) =>
                          setReasons((value) => ({
                            ...value,
                            [v.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="live-actions">
                      <button
                        className="button button--outline"
                        disabled={!!busy}
                        onClick={() => void suspend(v, 'suspended')}
                      >
                        Suspender profissional
                      </button>
                      <button
                        className="button button--outline"
                        disabled={!!busy}
                        onClick={() => void suspend(v, 'rejected')}
                      >
                        Revogar aprovação
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        <aside className="live-panel exp-admin-aside" aria-label="Resumo das verificações">
          <div>
            <span className="exp-workout-hero__eyebrow">Auditoria de CREF</span>
            <h3>Fila de verificação</h3>
          </div>
          <dl className="exp-coach-overview__stats">
            <div>
              <dt>Pendentes</dt>
              <dd className={pendingCount > 0 ? 'is-accent' : undefined}>{pendingCount}</dd>
            </div>
            <div>
              <dt>Aprovados</dt>
              <dd>{approvedCount}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{allVerifications.length}</dd>
            </div>
          </dl>
          {allVerifications.length > 0 && (
            <div className="exp-workout-progress">
              <div className="exp-workout-progress__label">
                <span>Registros analisados</span>
                <strong>{reviewedCount}/{allVerifications.length}</strong>
              </div>
              <div
                className="exp-workout-progress__bar"
                role="progressbar"
                aria-label="Registros analisados"
                aria-valuemin={0}
                aria-valuemax={allVerifications.length}
                aria-valuenow={reviewedCount}
              >
                <span style={{ width: reviewedPct + '%' }} />
              </div>
            </div>
          )}
          <p className="exp-coach-reputation__note">
            Toda aprovação, recusa ou suspensão exige justificativa registrada em trilha de auditoria.
          </p>
        </aside>
      </div>
    </div>
  )
}
