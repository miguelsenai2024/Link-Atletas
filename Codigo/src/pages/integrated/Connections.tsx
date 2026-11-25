import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Dumbbell, MessageCircle, Search, ShieldCheck, Star, Users } from 'lucide-react'
import type { CoachCard, Contract, Dashboard, Workout } from '../../../shared/contracts'
import type { Consultation } from '../../../shared/interaction-contracts'
import { SPORTS } from '../../../shared/contracts'
import { SmoothSelect } from '../../components/SmoothSelect'
import { useAuth } from '../../context/AuthContext'
import { api, json } from '../../services/api'
import {
  Badge,
  day,
  Empty,
  message,
  money,
  Notice,
  PageTitle,
  State,
  useRemote,
} from './common'
type Presence = 'online' | 'away' | 'offline'
const PRESENCE_LABEL: Record<Presence, string> = { online: 'Online', away: 'Ausente', offline: 'Offline' }
// The API has no presence field yet: use it when it arrives, otherwise a stable demo value per coach.
function presenceOf(coach: CoachCard): Presence {
  const real = (coach as { presence?: Presence }).presence
  if (real) return real
  let hash = 0
  for (const char of coach.userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (['online', 'away', 'offline'] as const)[hash % 3]
}

export function DiscoverPage() {
  const [filters, setFilters] = useState({
    query: '',
    sport: '',
    maxPrice: '',
    mode: '',
  })
  const [search, setSearch] = useState('')
  const remote = useRemote<{ coaches: CoachCard[] }>('/coaches' + search)
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const coaches = remote.data?.coaches.filter(
    (coach) => filters.maxPrice === '' || coach.price <= Number(filters.maxPrice),
  ) || []
  async function request(coachId: string) {
    setBusy(coachId)
    setError('')
    setSuccess('')
    try {
      await api('/contracts', json('POST', { coachId }))
      setSuccess('Solicitação enviada. Aguarde a resposta do treinador.')
      await contracts.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy('')
    }
  }
  function filter(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    setSearch('?' + params.toString())
  }
  // the page itself never scrolls here: only the coach list does
  useEffect(() => {
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous
    }
  }, [])
  return (
    <div className="live-discover">
      <PageTitle
        title="Encontre sua próxima conexão"
        description="Profissionais verificados, ordenados pela compatibilidade com seu perfil."
        action={
          <Link to="/atleta/perfil" className="button button--outline">
            Ajustar meu perfil
            <ArrowRight size={16} />
          </Link>
        }
      />
      <form className="live-panel live-form live-filter" onSubmit={filter}>
        <label>
          Nome ou cidade
          <input
            placeholder="Quem você procura?"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </label>
        <label>
          Modalidade
          <SmoothSelect
            value={filters.sport}
            onChange={(sport) => setFilters({ ...filters, sport })}
            options={[
              { value: '', label: 'Todas' },
              ...SPORTS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </label>
        <label>
          Preço máximo (R$)
          <input
            type="number"
            min={0}
            max={100000}
            step="0.01"
            value={filters.maxPrice}
            onChange={(e) => {
              const maxPrice = e.target.value
              setFilters({ ...filters, maxPrice })
              if (!e.target.validity.valid) return
              setSearch((current) => {
                const params = new URLSearchParams(current)
                if (maxPrice !== '') params.set('maxPrice', maxPrice)
                else params.delete('maxPrice')
                return '?' + params.toString()
              })
            }}
          />
        </label>
        <label>
          Formato
          <SmoothSelect
            value={filters.mode}
            onChange={(mode) => setFilters({ ...filters, mode })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'online', label: 'Online' },
              { value: 'presencial', label: 'Presencial' },
              { value: 'hibrido', label: 'Híbrido' },
            ]}
          />
        </label>
        <button className="button button--dark">
          <Search size={17} />
          Buscar
        </button>
      </form>
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      <State {...contracts} retry={contracts.reload} />
      {remote.data && !remote.loading && !coaches.length && (
        <Empty>
          Nenhum treinador encontrado com esses filtros. Experimente outra
          modalidade ou faixa de preço.
        </Empty>
      )}
      <div className="live-card-grid">
        {coaches.map((coach) => {
          const contract = contracts.data?.contracts.find(
            (c) =>
              c.coachId === coach.userId &&
              ['pending', 'active', 'suspended'].includes(c.status),
          )
          return (
            <article className="live-panel live-coach" key={coach.userId}>
              <div className="live-coach-top">
                <span className="live-avatar-wrap">
                  <span className="live-avatar live-avatar--large">
                    {coach.name
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <span
                    className={'live-presence live-presence--' + presenceOf(coach)}
                    role="img"
                    aria-label={PRESENCE_LABEL[presenceOf(coach)]}
                    title={PRESENCE_LABEL[presenceOf(coach)]}
                  />
                </span>
                <span className="live-match">{coach.cref}</span>
              </div>
              <h3>{coach.name}</h3>
              <p>{coach.city || 'Cidade não informada'}</p>
              <p>
                {coach.bio || 'Conheça este profissional e comece sua jornada.'}
              </p>
              <div className="live-tags">
                {coach.sports.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <ul className="live-reasons">
                {coach.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="live-coach-bottom">
                <strong>
                  {money(coach.price)}
                  <small>/mês</small>
                </strong>
                {contract ? (
                  contract.status === 'active' ? null : <Badge status={contract.status} />
                ) : (
                  <button
                    className="button button--dark"
                    disabled={!!busy || contracts.loading || !!contracts.error}
                    onClick={() => request(coach.userId)}
                  >
                    {busy === coach.userId
                      ? 'Enviando…'
                      : 'Solicitar contratação'}
                  </button>
                )}
              </div>
              <Link
                className="live-link"
                to={'/atleta/avaliacoes?treinador=' + coach.userId}
              >
                Ver avaliações deste treinador
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}
export function ContractsPage() {
  const { user } = useAuth()
  const coach = user?.role === 'coach'
  const remote = useRemote<{ contracts: Contract[] }>('/contracts')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const contracts = remote.data?.contracts || []
  const selected =
    contracts.find((c) => c.id === selectedId) ||
    contracts.find((c) => c.status === 'active') ||
    contracts.find((c) => c.status === 'pending') ||
    contracts[0]
  async function decide(id: string, status: 'active' | 'rejected') {
    setBusy(id)
    setError('')
    setSuccess('')
    try {
      await api('/contracts/' + id, json('PATCH', { status }))
      setSuccess(
        status === 'active'
          ? 'Solicitação aceita. Você já pode prescrever treinos para este atleta.'
          : 'Solicitação recusada.',
      )
      await remote.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <PageTitle
        title="Evolução se constrói em conjunto"
        description="Gerencie solicitações, vínculos ativos e o histórico do acompanhamento."
      />
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      <div className="hub-layout">
      <div className="live-stack">
        {remote.data && !remote.data.contracts.length && (
          <Empty>
            {coach
              ? 'Você ainda não recebeu solicitações. Complete seu perfil e envie seu CREF para aparecer na busca.'
              : 'Você ainda não tem conexões. Descubra um treinador para começar.'}
          </Empty>
        )}
        {remote.data?.contracts.map((c) => (
          <article
            className={'live-panel live-contract' + (selected?.id === c.id ? ' is-selected' : '')}
            key={c.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, a, form')) return
              setSelectedId(c.id)
            }}
          >
            <div>
              <h3>{coach ? c.athleteName : c.coachName}</h3>
              <p>Solicitação de {day(c.createdAt)}</p>
              {c.status !== 'active' && <Badge status={c.status} />}
            </div>
            {c.status === 'pending' && coach ? (
              <div className="live-actions">
                <button
                  className="button button--dark"
                  disabled={!!busy}
                  onClick={() => decide(c.id, 'active')}
                >
                  Aceitar solicitação
                </button>
                <button
                  className="button button--outline"
                  disabled={!!busy}
                  onClick={() => decide(c.id, 'rejected')}
                >
                  Recusar solicitação
                </button>
              </div>
            ) : (
              c.status === 'active' &&
              coach && (
                <Link
                  className="button button--outline"
                  to={'/treinador/treinos?atleta=' + c.id}
                >
                  Prescrever treino
                  <ArrowRight size={16} />
                </Link>
              )
            )}
            {['pending', 'active', 'suspended'].includes(c.status) && (
              <ContractEndAction contract={c} onChange={remote.reload} />
            )}
          </article>
        ))}
      </div>
      {remote.data && (
        <ConnectionHubCard
          contract={selected}
          contracts={contracts}
          coach={coach}
          busy={!!busy}
          onDecide={decide}
        />
      )}
      </div>
    </>
  )
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  suspended: 'Suspenso',
  rejected: 'Recusado',
  cancelled: 'Encerrado',
  ended: 'Encerrado',
}
function ConnectionHubCard({
  contract,
  contracts,
  coach,
  busy,
  onDecide,
}: {
  contract: Contract | undefined
  contracts: Contract[]
  coach: boolean
  busy: boolean
  onDecide: (id: string, status: 'active' | 'rejected') => void
}) {
  const workouts = useRemote<{ workouts: Workout[] }>('/workouts')
  const consults = useRemote<{ consultations: Consultation[] }>('/consultations')
  const activeCount = contracts.filter((c) => c.status === 'active').length
  const pendingCount = contracts.filter((c) => c.status === 'pending').length
  const summary = coach && (
    <p className="hub-summary">
      <strong>{activeCount}</strong> {activeCount === 1 ? 'aluno ativo' : 'alunos ativos'}
      <span>·</span>
      <strong>{pendingCount}</strong> {pendingCount === 1 ? 'solicitação pendente' : 'solicitações pendentes'}
    </p>
  )
  if (!contract)
    return (
      <aside className="live-panel hub-card">
        {summary}
        <span className="hub-tag">Sem vínculos</span>
        <h3 className="hub-name">{coach ? 'Seja encontrado' : 'Comece sua parceria'}</h3>
        <p className="live-muted">
          {coach
            ? 'Mantenha seu perfil completo e o CREF verificado para receber novas solicitações.'
            : 'Encontre um treinador verificado que combine com sua modalidade e objetivo.'}
        </p>
        <Link className="button button--accent" to={coach ? '/treinador/perfil' : '/atleta/descobrir'}>
          {coach ? 'Revisar meu perfil' : 'Descobrir treinadores'}
          <ArrowRight size={16} />
        </Link>
      </aside>
    )
  const own = workouts.data?.workouts.filter(
    (w) => w.athleteId === contract.athleteId && w.coachId === contract.coachId,
  )
  const published = own?.filter((w) => w.status === 'published') || []
  const executed = published.filter((w) => w.execution).length
  const now = Date.now()
  const next = consults.data?.consultations
    .filter((x) => x.contractId === contract.id && x.status === 'scheduled' && new Date(x.startsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  const shortcuts = coach
    ? [
        { to: '/treinador/treinos?atleta=' + contract.id, label: 'Prescrever treino', icon: Dumbbell },
        { to: '/treinador/mensagens', label: 'Abrir chat', icon: MessageCircle },
        { to: '/treinador/consultorias', label: 'Ver consultorias', icon: CalendarDays },
      ]
    : [
        { to: '/atleta/mensagens', label: 'Enviar mensagem', icon: MessageCircle },
        { to: '/atleta/treino', label: 'Ver meus treinos', icon: Dumbbell },
        { to: '/atleta/agenda', label: 'Agendar consultoria', icon: CalendarDays },
        { to: '/atleta/avaliacoes', label: 'Avaliar treinador', icon: Star },
      ]
  return (
    <aside className="live-panel hub-card" aria-label="Hub do vínculo">
      {summary}
      <div className="hub-head">
        <span className="hub-tag">Vínculo selecionado</span>
        <span className={'hub-status hub-status--' + contract.status}>
          {STATUS_LABEL[contract.status] || contract.status}
        </span>
      </div>
      <h3 className="hub-name">{coach ? contract.athleteName : contract.coachName}</h3>
      <p className="live-muted">
        {contract.decidedAt && contract.status !== 'pending'
          ? `Desde ${day(contract.decidedAt)} · solicitado em ${day(contract.createdAt)}`
          : `Solicitado em ${day(contract.createdAt)}`}
      </p>
      {contract.status === 'pending' ? (
        <div className="hub-pending">
          <p>
            Treinos, chat e agenda são liberados assim que a solicitação for aceita.
          </p>
          {coach && (
            <div className="live-actions">
              <button className="button button--dark" disabled={busy} onClick={() => onDecide(contract.id, 'active')}>
                Aceitar
              </button>
              <button className="button button--outline" disabled={busy} onClick={() => onDecide(contract.id, 'rejected')}>
                Recusar
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <dl className="hub-facts">
            <div>
              <dt>Treinos publicados</dt>
              <dd>
                {workouts.loading ? '…' : published.length}
                {published.length > 0 && <small> · {executed} com execução</small>}
              </dd>
            </div>
            <div>
              <dt>Próxima consultoria</dt>
              <dd>
                {consults.loading
                  ? '…'
                  : next
                    ? new Date(next.startsAt).toLocaleString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Nenhuma agendada'}
              </dd>
            </div>
          </dl>
          {contract.status === 'active' ? (
            <nav className="hub-shortcuts">
              {shortcuts.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to}>
                  <Icon size={17} />
                  {label}
                  <ArrowRight size={15} className="hub-shortcuts__arrow" />
                </Link>
              ))}
            </nav>
          ) : (
            <p className="live-muted">
              Vínculo sem atividade no momento. O histórico continua salvo.
            </p>
          )}
        </>
      )}
    </aside>
  )
}
export function ContractEndAction({
  contract,
  onChange,
}: {
  contract: Contract
  onChange: () => unknown
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open)
    return (
      <button className="button button--outline" onClick={() => setOpen(true)}>
        {contract.status === 'pending'
          ? 'Retirar solicitação'
          : 'Encerrar vínculo'}
      </button>
    )
  return (
    <form
      className="live-form exp-contract-end"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await api(
            '/contracts/' + contract.id + '/cancel',
            json('POST', { reason }),
          )
          await onChange()
          setOpen(false)
        } catch (e) {
          setError(message(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Motivo do encerramento
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p className="live-muted">
        O histórico será preservado. Se houver assinatura, a renovação e o
        período pago seguem a confirmação do provedor.
      </p>
      <Notice error={error} />
      <div className="live-actions">
        <button className="button button--outline" disabled={busy}>
          Confirmar encerramento
        </button>
        <button
          type="button"
          className="button button--outline"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Voltar
        </button>
      </div>
    </form>
  )
}
export function DashboardPage() {
  const { user } = useAuth()
  const coach = user?.role === 'coach'
  const remote = useRemote<Dashboard>('/dashboard')
  const data = remote.data
  const active = data?.contracts.filter((c) => c.status === 'active') || []
  const pending = data?.contracts.filter((c) => c.status === 'pending') || []
  const workouts = data?.workouts || []
  const published = workouts.filter((w) => w.status === 'published')
  const executed = published.filter((w) => w.execution)
  return (
    <>
      <div className="live-hero">
        {coach && <span className="eyebrow">Orientação que transforma</span>}
        <h2>Olá, {user?.name.split(' ')[0]}.</h2>
        <p>
          {coach
            ? 'Acompanhe seus atletas, transforme objetivos em treinos e ajude cada pessoa a ir mais longe.'
            : 'Encontre seu treinador, siga seu plano e registre como foi cada treino.'}
        </p>
        <Link
          className="button button--accent"
          to={coach ? '/treinador/treinos' : '/atleta/descobrir'}
        >
          {coach ? 'Planejar um treino' : 'Encontrar treinador'}
          <ArrowRight size={18} />
        </Link>
        <Dumbbell className="live-hero-icon" aria-hidden="true" />
      </div>
      <State {...remote} retry={remote.reload} />
      {data && (
        <>
          <div className="live-stat-grid">
            <article className="live-panel">
              <Users />
              <strong>{active.length}</strong>
              <span>{coach ? 'Atletas ativos' : 'Treinadores ativos'}</span>
            </article>
            <article className="live-panel">
              <Dumbbell />
              <strong>{published.length}</strong>
              <span>Treinos publicados</span>
            </article>
            <article className="live-panel">
              <ShieldCheck />
              <strong>{executed.length}</strong>
              <span>Execuções registradas</span>
            </article>
          </div>
          <div className="live-grid-2">
            <section className="live-panel">
              <div className="live-panel-heading">
                <h3>{coach ? 'Sua equipe' : 'Suas conexões'}</h3>
                <Link to={coach ? '/treinador/alunos' : '/atleta/conexoes'}>
                  Ver conexões →
                </Link>
              </div>
              {!data.contracts.length && (
                <Empty>
                  {coach
                    ? 'Nenhum atleta vinculado ainda.'
                    : 'Nenhuma conexão ainda. Descubra os profissionais disponíveis.'}
                </Empty>
              )}
              {data.contracts.slice(0, 6).map((c) => (
                <div className="live-row" key={c.id}>
                  <strong>{coach ? c.athleteName : c.coachName}</strong>
                  <Badge status={c.status} />
                </div>
              ))}
              {pending.length > 0 && (
                <p className="live-muted">
                  {pending.length} solicitação(ões) aguardando resposta.
                </p>
              )}
            </section>
            <section className="live-panel">
              <div className="live-panel-heading">
                <h3>{coach ? 'Treinos e feedbacks' : 'Seu plano'}</h3>
                <Link to={coach ? '/treinador/treinos' : '/atleta/treino'}>
                  Ver treinos →
                </Link>
              </div>
              {!workouts.length && (
                <Empty>
                  {coach
                    ? 'Prescreva o primeiro treino para um atleta ativo.'
                    : 'Seus treinos aparecem aqui quando seu treinador publicar.'}
                </Empty>
              )}
              {workouts.slice(0, 5).map((w) => (
                <div className="live-row" key={w.id}>
                  <div>
                    <strong>{w.title}</strong>
                    <p>
                      {day(w.scheduledDate)} ·{' '}
                      {coach ? w.athleteName : w.coachName}
                    </p>
                  </div>
                  {w.execution ? (
                    <span className="live-badge live-badge--approved">
                      Feedback registrado
                    </span>
                  ) : (
                    <Badge status={w.status} />
                  )}
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  )
}
