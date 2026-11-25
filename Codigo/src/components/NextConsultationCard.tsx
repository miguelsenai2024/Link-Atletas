import { NavLink } from 'react-router-dom'
import { CalendarDays, MessageSquare, Video } from 'lucide-react'
import type { Consultation } from '../../shared/interaction-contracts'
import type { Role } from '../../shared/contracts'
import { useRemote } from '../pages/integrated/common'

/** Card lateral da tela Início: mostra a próxima consulta marcada e o panorama da agenda. */
export function NextConsultationCard({ role }: { role: Role }) {
  const remote = useRemote<{ consultations: Consultation[] }>('/consultations')
  const now = Date.now()
  const upcoming = (remote.data?.consultations || [])
    .filter((c) => c.status === 'scheduled' && new Date(c.startsAt).getTime() + c.durationMinutes * 60_000 >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const next = upcoming[0]
  const following = upcoming.slice(1, 3)

  const isCoach = role === 'coach'
  const agendaPath = isCoach ? '/treinador/consultorias' : '/atleta/agenda'
  const messagesBase = isCoach ? '/treinador/mensagens' : '/atleta/mensagens'
  const partnerName = next ? (isCoach ? next.athleteName : next.coachName) : ''
  const hasDescription = Boolean(next?.description?.trim() && next.description.trim() !== next.title.trim())

  return (
    <div className="neo-visual-card next-consult">
      <div className="neo-visual-card__glow" aria-hidden="true" />
      <div className="neo-visual-card__top">
        <div className="next-consult__kicker">
          <span className="neo-visual-tag">Próxima consulta</span>
          {next && <span className="next-consult__when">{formatRelative(next.startsAt, next.durationMinutes, now)}</span>}
        </div>
        <span className="neo-visual-compass" aria-hidden="true">
          <CalendarDays size={20} />
        </span>
      </div>

      {remote.loading && !remote.data ? (
        <p className="next-consult__muted">Carregando sua agenda…</p>
      ) : remote.error ? (
        <div className="next-consult__empty">
          <p className="next-consult__muted">Não foi possível carregar sua agenda.</p>
          <button type="button" className="button button--outline" onClick={() => void remote.reload()}>
            Tentar novamente
          </button>
        </div>
      ) : next ? (
        <div className="next-consult__body">
          <div className="next-consult__hero">
            <div className="next-consult__date">
              <strong>{formatDay(next.startsAt)}</strong>
              <span>{formatWeekday(next.startsAt)}</span>
            </div>
            <div className="next-consult__time">
              <strong>{formatTime(next.startsAt)}</strong>
              <span>até {formatEndTime(next.startsAt, next.durationMinutes)} · {next.durationMinutes} min</span>
            </div>
          </div>

          <div className="next-consult__person">
            <small>{isCoach ? 'Com o atleta' : 'Com o treinador'}</small>
            <div className="next-consult__partner">
              <span className="next-consult__avatar" aria-hidden="true">{initials(partnerName)}</span>
              <h3>{partnerName}</h3>
            </div>
            <div className="next-consult__topic">
              <strong>{next.title}</strong>
              {hasDescription && <p>{next.description}</p>}
            </div>
          </div>

          <dl className="next-consult__specs">
            <div>
              <dt>Duração</dt>
              <dd>{next.durationMinutes} min</dd>
            </div>
            <div>
              <dt>Sala de vídeo</dt>
              <dd className={next.meetingUrl ? 'is-ready' : undefined}>
                {next.meetingUrl ? 'Link pronto' : 'A definir'}
              </dd>
            </div>
            <div>
              <dt>Na agenda</dt>
              <dd>{upcoming.length} {upcoming.length === 1 ? 'sessão' : 'sessões'}</dd>
            </div>
          </dl>

          {following.length > 0 && (
            <div className="next-consult__queue">
              <small>Na sequência</small>
              <ul>
                {following.map((item) => (
                  <li key={item.id}>
                    <span>{formatDay(item.startsAt)} · {formatTime(item.startsAt)}</span>
                    <strong>{isCoach ? item.athleteName : item.coachName}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="next-consult__actions">
            {next.meetingUrl && (
              <a className="button button--accent" href={next.meetingUrl} target="_blank" rel="noreferrer">
                <Video size={16} aria-hidden="true" /> Entrar na chamada
              </a>
            )}
            <NavLink className="button button--outline" to={agendaPath}>Ver agenda</NavLink>
            <NavLink className="button button--outline" to={`${messagesBase}?vinculo=${next.contractId}`}>
              <MessageSquare size={15} aria-hidden="true" /> Mensagem
            </NavLink>
          </div>
        </div>
      ) : (
        <div className="next-consult__empty">
          <h3>Nenhuma consulta marcada.</h3>
          <p className="next-consult__muted">
            {isCoach
              ? 'Quando você agendar um encontro com um atleta, ele aparece aqui.'
              : 'Quando seu treinador agendar um encontro com você, ele aparece aqui.'}
          </p>
          <NavLink className="button button--outline" to={agendaPath}>Ver agenda</NavLink>
        </div>
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?'
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(iso))
    .replace('.', '')
    .replace(' de ', ' ')
}

function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(iso))
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function formatEndTime(iso: string, durationMinutes: number) {
  const end = new Date(new Date(iso).getTime() + durationMinutes * 60_000)
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(end)
}

function formatRelative(iso: string, durationMinutes: number, nowMs: number) {
  const startMs = new Date(iso).getTime()
  const endMs = startMs + durationMinutes * 60_000
  if (nowMs >= startMs && nowMs <= endMs) return 'Agora'
  const diffMin = Math.round((startMs - nowMs) / 60_000)
  if (diffMin > 0 && diffMin < 60) return `Em ${diffMin} min`
  const startDay = new Date(startMs)
  const today = new Date(nowMs)
  const dayDiff = Math.round(
    (new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  )
  if (dayDiff === 0) return 'Hoje'
  if (dayDiff === 1) return 'Amanhã'
  if (dayDiff > 1) return `Em ${dayDiff} dias`
  return 'Em breve'
}
