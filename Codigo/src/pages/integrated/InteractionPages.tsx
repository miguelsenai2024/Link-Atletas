import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  FileText,
  MessageSquare,
  ImageIcon,
  Paperclip,
  Pin,
  Search,
  Send,
  Star,
  X,
} from 'lucide-react'
import type { Contract } from '../../../shared/contracts'
import type {
  Consultation,
  InteractionEvent,
  Message,
  Notification,
  Review,
} from '../../../shared/interaction-contracts'
import { useAuth } from '../../context/AuthContext'
import PeekRating from '../../components/PeekRating'
import { api, ApiError, json } from '../../services/api'
import {
  Badge,
  Empty,
  Notice,
  PageTitle,
  State,
  message,
  useRemote,
} from './common'
import { uploadFile } from './Expansion'
import './chat.css'
import {
  createGoogleMeetEvent,
  googleCalendarConfigured,
} from '../../services/googleCalendar'

export function useEvents(onEvent: (event: InteractionEvent) => void) {
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    let stopped = false
    let socket: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    function connect() {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/events`,
      )
      socket.onopen = () => {
        if (!stopped) setConnected(true)
      }
      socket.onmessage = (e) => {
        if (stopped) return
        try {
          handler.current(JSON.parse(e.data) as InteractionEvent)
        } catch {
          /* Ignore invalid events; persisted data remains authoritative. */
        }
      }
      socket.onerror = () => {
        if (!stopped) socket?.close()
      }
      socket.onclose = () => {
        if (stopped) return
        setConnected(false)
        timer = setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      socket?.close()
    }
  }, [])
  return connected
}
const dateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
function usePersistedRefresh(reload: () => Promise<void>) {
  useEffect(() => {
    let running = false
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || running) return
      running = true
      try {
        await reload()
      } finally {
        running = false
      }
    }
    const timer = setInterval(() => void refresh(), 10000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [reload])
}
function localDateTime(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
const maxLocalDateTime = '9999-12-31T23:59'
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return (
    (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
}
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const timeOnly = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
function dayLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(date, today)) return 'Hoje'
  if (sameDay(date, yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}
const shortDay = (value: string) =>
  sameDay(new Date(value), new Date())
    ? timeOnly(value)
    : new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
function Avatar({
  name,
  online,
  size = 'md',
}: {
  name: string
  online?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span className={`lk-chat-avatar lk-chat-avatar--${size}`} aria-hidden="true">
      {initials(name)}
      {online && <span className="lk-chat-avatar-dot" />}
    </span>
  )
}
export function MessagesPage() {
  const { user } = useAuth()
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [params] = useSearchParams()
  const [selected, setSelected] = useState(params.get('vinculo') || '')
  const [query, setQuery] = useState('')
  const current =
    contracts.data?.contracts.find((c) => c.id === selected) ||
    contracts.data?.contracts[0]
  const peer = (c: Contract) =>
    user?.role === 'coach' ? c.athleteName : c.coachName
  // the page itself never scrolls here: only the message history does
  useEffect(() => {
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous
    }
  }, [])
  const needle = normalize(query.trim())
  const pinKey = 'linkatletas:pinned-chats:' + (user?.id || '')
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pinKey) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })
  const togglePin = (id: string) => {
    setPinned((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [id, ...previous]
      try {
        localStorage.setItem(pinKey, JSON.stringify(next))
      } catch {
        /* storage unavailable: pin lasts for this session only */
      }
      return next
    })
  }
  const visible = (
    contracts.data?.contracts.filter((c) =>
      normalize(peer(c)).includes(needle),
    ) || []
  )
    .map((c, index) => ({ c, index }))
    .sort(
      (a, b) =>
        Number(pinned.includes(b.c.id)) - Number(pinned.includes(a.c.id)) ||
        a.index - b.index,
    )
    .map(({ c }) => c)
  return (
    <>
      <State {...contracts} retry={contracts.reload} />
      {contracts.data && !contracts.data.contracts.length && (
        <Empty>
          Suas conversas ficam disponíveis depois que você se conecta a um
          treinador.
        </Empty>
      )}
      {current && (
        <div className="lk-chat-layout">
          <aside className="lk-chat-sidebar" aria-label="Conversas">
            <label className="lk-chat-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversa"
                aria-label="Buscar conversa"
              />
            </label>
            <div className="lk-chat-list">
              <h3>Mensagens</h3>
              <div className="lk-chat-list-items">
                {visible.map((c) => (
                  <button
                    key={c.id}
                    className={
                      c.id === current.id ? 'lk-chat-contact active' : 'lk-chat-contact'
                    }
                    aria-current={c.id === current.id ? 'true' : undefined}
                    onClick={() => setSelected(c.id)}
                  >
                    <Avatar
                      name={peer(c)}
                      online={c.status === 'active'}
                    />
                    <span className="lk-chat-contact-text">
                      <strong>{peer(c)}</strong>
                      {c.status !== 'active' && <Badge status={c.status} />}
                    </span>
                    {pinned.includes(c.id) && (
                      <Pin size={12} className="lk-chat-pinned" aria-label="Fixada" />
                    )}
                    <time dateTime={c.createdAt}>{shortDay(c.createdAt)}</time>
                  </button>
                ))}
                {!visible.length && (
                  <p className="lk-chat-list-empty">
                    Nenhuma conversa encontrada.
                  </p>
                )}
              </div>
            </div>
          </aside>
          <Conversation
            key={current.id}
            contract={current}
            pinned={pinned.includes(current.id)}
            onTogglePin={() => togglePin(current.id)}
          />
        </div>
      )}
    </>
  )
}
function Conversation({
  contract,
  pinned,
  onTogglePin,
}: {
  contract: Contract
  pinned: boolean
  onTogglePin: () => void
}) {
  const { user } = useAuth()
  const [showMedia, setShowMedia] = useState(false)
  const remote = useRemote<{ messages: Message[]; nextCursor: string | null }>(
    `/contracts/${contract.id}/messages?limit=50`,
  )
  usePersistedRefresh(remote.reload)
  const [older, setOlder] = useState<Message[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [attachment, setAttachment] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const connected = useEvents((event) => {
    if (
      event.type === 'ready' ||
      (event.type === 'message' && event.message.contractId === contract.id) ||
      (event.type === 'read' && event.contractId === contract.id)
    )
      void remote.reload()
  })
  const messages = [
    ...new Map(
      [...older, ...(remote.data?.messages || [])].map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  useEffect(() => {
    const unread = remote.data?.messages.filter(
      (m) => m.senderId !== user?.id && !m.readAt,
    )
    if (unread?.length)
      void api(
        `/contracts/${contract.id}/messages/read`,
        json('PUT', { throughId: unread[unread.length - 1].id }),
      ).catch((e) => setError(message(e)))
    const history = end.current?.parentElement
    if (history) history.scrollTop = history.scrollHeight
  }, [remote.data, contract.id, user?.id])
  const fileInput = useRef<HTMLInputElement>(null)
  const peerName =
    user?.role === 'coach' ? contract.athleteName : contract.coachName
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.currentTarget
    try {
      let mediaId = attachment
      if (file && !mediaId) {
        mediaId = (await uploadFile(file, 'message', contract.id)).media.id
        setAttachment(mediaId)
      }
      await api(
        `/contracts/${contract.id}/messages`,
        json('POST', { text, ...(mediaId ? { mediaId } : {}) }),
      )
      setText('')
      setFile(null)
      setAttachment(null)
      form.reset()
      await remote.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function loadOlder() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{
        messages: Message[]
        nextCursor: string | null
      }>(
        `/contracts/${contract.id}/messages?limit=50&before=${cursor || remote.data?.nextCursor}`,
      )
      setOlder((previous) => [...result.messages, ...previous])
      setCursor(result.nextCursor || 'end')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="lk-chat-panel" aria-label={`Conversa com ${peerName}`}>
      <header className="lk-chat-header">
        <Avatar name={peerName} size="lg" />
        <div>
          <h3>{peerName}</h3>
          <span
            className={connected ? 'lk-chat-status online' : 'lk-chat-status'}
            role="status"
          >
            {connected ? 'Online' : 'Reconectando…'}
          </span>
        </div>
        {contract.status !== 'active' && <Badge status={contract.status} />}
        <div className="lk-chat-actions">
          <button
            type="button"
            className={'lk-chat-icon-btn' + (pinned ? ' is-on' : '')}
            aria-pressed={pinned}
            aria-label={pinned ? 'Desafixar conversa' : 'Fixar conversa no topo da lista'}
            title={pinned ? 'Desafixar conversa' : 'Fixar conversa'}
            onClick={onTogglePin}
          >
            <Pin size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={'lk-chat-icon-btn' + (showMedia ? ' is-on' : '')}
            aria-pressed={showMedia}
            aria-label="Ver mídias da conversa"
            title="Mídias da conversa"
            onClick={() => setShowMedia((v) => !v)}
          >
            <ImageIcon size={18} />
          </button>
        </div>
      </header>
      {showMedia && (
        <div className="lk-chat-media" role="region" aria-label="Mídias da conversa">
          <div className="lk-chat-media-head">
            <strong>Mídias</strong>
            <button type="button" className="lk-chat-icon-btn" aria-label="Fechar mídias" onClick={() => setShowMedia(false)}>
              <X size={16} />
            </button>
          </div>
          {messages.some((m) => m.mediaId) ? (
            <div className="lk-chat-media-grid">
              {messages
                .filter((m) => m.mediaId)
                .map((m) => (
                  <a
                    key={m.id}
                    href={`/api/media/${m.mediaId}/content`}
                    target="_blank"
                    rel="noreferrer"
                    title={dateTime(m.createdAt)}
                  >
                    <img
                      src={`/api/media/${m.mediaId}/content`}
                      alt={`Mídia enviada por ${m.senderName}`}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.removeAttribute('hidden')
                      }}
                    />
                    <span hidden aria-hidden="true">
                      <FileText size={22} />
                    </span>
                  </a>
                ))}
            </div>
          ) : (
            <p className="lk-chat-media-empty">Nenhuma mídia enviada nesta conversa.</p>
          )}
        </div>
      )}
      <State {...remote} retry={remote.reload} />
      <Notice error={error} />
      <div
        className="lk-chat-history"
        aria-label="Histórico de mensagens"
        aria-live="polite"
      >
        {cursor !== 'end' && (cursor || remote.data?.nextCursor) && (
          <button
            className="lk-chat-older"
            disabled={busy}
            onClick={() => void loadOlder()}
          >
            Carregar mensagens anteriores
          </button>
        )}
        {remote.data && !messages.length && (
          <div className="lk-chat-empty">
            <MessageSquare size={26} aria-hidden="true" />
            <p>
              Comece a conversa. Compartilhe dúvidas e orientações para o
              próximo treino.
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          const own = m.senderId === user?.id
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const newDay =
            !prev || !sameDay(new Date(prev.createdAt), new Date(m.createdAt))
          const lastOfGroup =
            !next ||
            next.senderId !== m.senderId ||
            !sameDay(new Date(next.createdAt), new Date(m.createdAt))
          return (
            <div key={m.id} className="lk-chat-row-wrap">
              {newDay && (
                <div className="lk-chat-day" role="separator">
                  <span>{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <article
                className={`lk-chat-row ${own ? 'lk-chat-row--own' : ''} ${lastOfGroup ? 'lk-chat-row--last' : ''}`}
              >
                {!own &&
                  (lastOfGroup ? (
                    <Avatar name={m.senderName} size="sm" />
                  ) : (
                    <span className="lk-chat-avatar-gap" aria-hidden="true" />
                  ))}
                <div className="lk-chat-bubble-col">
                  <div className="lk-chat-bubble">
                    <span className="lk-chat-sr">{m.senderName}: </span>
                    {m.text && <p>{m.text}</p>}
                    {m.mediaId && (
                      <a
                        className="lk-chat-attachment"
                        target="_blank"
                        rel="noreferrer"
                        href={`/api/media/${m.mediaId}/content`}
                      >
                        <FileText size={18} aria-hidden="true" />
                        Abrir anexo privado
                      </a>
                    )}
                  </div>
                  <small title={dateTime(m.createdAt)}>
                    <time dateTime={m.createdAt}>{timeOnly(m.createdAt)}</time>
                    {own &&
                      (m.readAt ? (
                        <CheckCheck
                          size={14}
                          className="lk-chat-read"
                          aria-label="Lida"
                        />
                      ) : (
                        <Check size={14} aria-label="Enviada" />
                      ))}
                  </small>
                </div>
              </article>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {contract.status === 'active' ? (
        <form className="lk-chat-composer" onSubmit={submit}>
          {file && (
            <div className="lk-chat-file-chip">
              <FileText size={15} aria-hidden="true" />
              <span>{file.name}</span>
              <button
                type="button"
                aria-label="Remover anexo"
                onClick={() => {
                  setFile(null)
                  setAttachment(null)
                  if (fileInput.current) fileInput.current.value = ''
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="lk-chat-composer-bar">
            <label className="lk-chat-attach" title="Anexar arquivo">
              <Paperclip size={19} aria-hidden="true" />
              <input
                ref={fileInput}
                type="file"
                aria-label="Anexo opcional"
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null)
                  setAttachment(null)
                }}
              />
            </label>
            <textarea
              aria-label="Sua mensagem"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  if (!busy && (text.trim() || file || attachment))
                    e.currentTarget.form?.requestSubmit()
                }
              }}
              required={!file && !attachment}
              maxLength={4000}
              rows={1}
              placeholder="Escreva uma mensagem…"
            />
            <button
              className="lk-chat-send"
              aria-label="Enviar mensagem"
              title={busy ? 'Enviando…' : 'Enviar mensagem'}
              disabled={busy || (!text.trim() && !file && !attachment)}
            >
              <Send size={19} />
            </button>
          </div>
        </form>
      ) : (
        <p className="lk-chat-closed">
          O histórico permanece disponível. Novas mensagens exigem vínculo
          ativo.
        </p>
      )}
    </section>
  )
}
export function NotificationsPage() {
  const { user } = useAuth()
  const remote = useRemote<{ notifications: Notification[]; unread: number }>(
    '/notifications',
  )
  usePersistedRefresh(remote.reload)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEvents((event) => {
    if (event.type === 'notification' || event.type === 'ready')
      void remote.reload()
  })
  async function read(ids?: string[]) {
    setBusy(true)
    setError('')
    try {
      await api('/notifications', json('PUT', ids ? { ids } : { all: true }))
      await remote.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const list = remote.data?.notifications || []
  const unread = remote.data?.unread || 0
  const readCount = Math.max(0, list.length - unread)
  const isAdmin = user?.role === 'admin'
  const feed = list.length > 0 ? (
    <section className="live-panel">
      {list.map((n) => (
        <article
          className={`live-row exp-notification ${n.readAt ? '' : 'unread'}`}
          key={n.id}
        >
          <Bell size={20} />
          <div>
            <strong>{n.title}</strong>
            <p>{dateTime(n.createdAt)}</p>
          </div>
          {!n.readAt && (
            <button
              className="button button--outline"
              disabled={busy}
              onClick={() => void read([n.id])}
            >
              Marcar como lida
            </button>
          )}
        </article>
      ))}
    </section>
  ) : remote.data ? (
    <Empty>
      {isAdmin
        ? 'Os alertas administrativos e eventos de auditoria aparecem aqui.'
        : 'As novidades dos seus treinos e vínculos aparecem aqui.'}
    </Empty>
  ) : null
  return (
    <div className={isAdmin ? 'exp-admin-page' : undefined}>
      <PageTitle
        title={isAdmin ? 'Central de notificações' : 'Novidades da sua jornada'}
        description={`${unread} notificação(ões) ainda não lida(s).`}
        action={
          <button
            className="button button--outline"
            disabled={busy || !unread}
            onClick={() => void read()}
          >
            Marcar todas como lidas
          </button>
        }
      />
      <Notice error={error} />
      <State {...remote} retry={remote.reload} />
      {isAdmin ? (
        <div className="exp-admin-layout">
          <div className="exp-admin-main">{feed}</div>
          <aside className="live-panel exp-admin-aside" aria-label="Resumo de alertas">
            <div>
              <span className="exp-workout-hero__eyebrow">Monitoramento</span>
              <h3>Resumo de alertas</h3>
            </div>
            <dl className="exp-coach-overview__stats">
              <div>
                <dt>Não lidas</dt>
                <dd className={unread > 0 ? 'is-accent' : undefined}>{unread}</dd>
              </div>
              <div>
                <dt>Lidas</dt>
                <dd>{readCount}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{list.length}</dd>
              </div>
            </dl>
            <p className="exp-coach-reputation__note">
              Eventos de verificação profissional, denúncias e solicitações LGPD são atualizados em tempo real.
            </p>
          </aside>
        </div>
      ) : (
        feed
      )}
    </div>
  )
}
export function AgendaPage() {
  const { user } = useAuth()
  const remote = useRemote<{ consultations: Consultation[] }>('/consultations')
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [form, setForm] = useState({
    contractId: '',
    title: '',
    description: '',
    startsAt: '',
    durationMinutes: 30 as number | '',
    meetingUrl: '',
  })
  const [editing, setEditing] = useState<Consultation | null>(null)
  const [reschedule, setReschedule] = useState('')
  const [reason, setReason] = useState('')
  const [completedId, setCompletedId] = useState<string | null>(null)
  const [googlePending, setGooglePending] = useState<
    Record<string, { eventId: string; meetingUrl: string }>
  >({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEvents((event) => {
    if (event.type === 'consultation') void remote.reload()
  })
  usePersistedRefresh(remote.reload)
  const active =
    contracts.data?.contracts.filter((c) => c.status === 'active') || []
  const consultations = remote.data?.consultations || []
  const scheduledCount = consultations.filter(
    (c) => c.status === 'scheduled',
  ).length
  const selectedContract =
    active.find((c) => c.id === form.contractId) || active[0]
  const selectedPeerName = selectedContract
    ? user?.role === 'coach'
      ? selectedContract.athleteName
      : selectedContract.coachName
    : 'Nenhum vínculo ativo'
  async function perform(action: () => Promise<unknown>, result: string) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await action()
      await remote.reload()
      setSuccess(result)
      setEditing(null)
      setCompletedId(null)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function createGoogle(c: Consultation) {
    if (
      !googlePending[c.id] &&
      !window.confirm(
        'Criar um evento e uma reunião Meet na sua própria agenda Google? A conexão solicitará sua autorização. Nenhum convite por e-mail será enviado pela plataforma.',
      )
    )
      return
    await perform(async () => {
      let reference = googlePending[c.id]
      if (!reference) {
        const date = localDateTime(c.startsAt)
        const event = await createGoogleMeetEvent({
          athleteId: 0,
          athleteName: c.athleteName,
          athleteEmail: '',
          purpose: c.title,
          description: c.description,
          date: date.slice(0, 10),
          startTime: date.slice(11, 16),
          duration: c.durationMinutes,
        })
        if (!event.meetLink)
          throw new Error(
            'Evento criado no Google, mas o link Meet ainda não foi disponibilizado. Confira sua agenda antes de tentar outra criação.',
          )
        reference = { eventId: event.googleEventId, meetingUrl: event.meetLink }
        setGooglePending((previous) => ({ ...previous, [c.id]: reference }))
      }
      await api(
        '/consultations/' + c.id + '/google-event',
        json('POST', reference),
      )
      setGooglePending((previous) => {
        const next = { ...previous }
        delete next[c.id]
        return next
      })
    }, 'Referência do Google Agenda e Meet vinculada à consultoria.')
  }
  return (
    <>
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      <State {...contracts} retry={contracts.reload} />
      <div className="exp-agenda-layout">
        <section
          className="live-panel exp-agenda-board"
          aria-labelledby="scheduled-meetings-title"
        >
          <header className="exp-agenda-board__header">
            <div>
              <h3 id="scheduled-meetings-title">Encontros agendados</h3>
              <p className="exp-agenda-board__sub">
                Visão compacta de todas as suas consultorias e atendimentos.
              </p>
            </div>
            <span className="exp-agenda-count">
              {scheduledCount} agendada(s)
            </span>
          </header>
          {consultations.length ? (
            <div className="exp-agenda-grid">
              {consultations.map((c) => {
                const peerName =
                  user?.role === 'coach' ? c.athleteName : c.coachName
                const isExpanded =
                  editing?.id === c.id || completedId === c.id
                return (
                  <article
                    className={`exp-agenda-card exp-agenda-card--${c.status}${isExpanded ? ' exp-agenda-card--expanded' : ''}`}
                    key={c.id}
                  >
                    <div className="exp-agenda-card__top">
                      <h3>
                        <CalendarDays size={16} aria-hidden="true" /> {c.title}
                      </h3>
                      <Badge status={c.status} />
                    </div>
                    <p className="exp-agenda-card__meta">
                      <strong>{dateTime(c.startsAt)}</strong> ·{' '}
                      {c.durationMinutes} minutos
                    </p>
                    <p className="exp-agenda-card__desc" title={c.description}>
                      {c.description || 'Sem observações adicionais.'}
                    </p>
                    <div className="exp-agenda-card__bar" aria-hidden="true">
                      <span
                        className={`exp-agenda-card__bar-fill exp-agenda-card__bar-fill--${c.status}`}
                      />
                    </div>
                    <div className="exp-agenda-card__footer">
                      <div className="exp-agenda-card__peer">
                        <Avatar name={peerName} size="sm" />
                        <span>{peerName}</span>
                      </div>
                      {c.meetingUrl ? (
                        <a
                          className="exp-agenda-card__meet"
                          target="_blank"
                          rel="noreferrer"
                          href={c.meetingUrl}
                        >
                          Abrir encontro online
                        </a>
                      ) : (
                        <span className="exp-agenda-card__no-meet">
                          Sem link externo
                        </span>
                      )}
                    </div>
                    {c.status === 'scheduled' && (
                      <div className="live-actions">
                        <button
                          className="button button--outline"
                          disabled={busy}
                          onClick={() => {
                            setEditing(c)
                            setReschedule(localDateTime(c.startsAt))
                            setReason('')
                          }}
                        >
                          Reagendar ou cancelar
                        </button>
                        {user?.role === 'coach' && (
                          <button
                            className="button button--outline"
                            disabled={
                              busy || new Date(c.startsAt).getTime() > Date.now()
                            }
                            onClick={() => {
                              setCompletedId(c.id)
                              setReason('')
                            }}
                          >
                            Marcar concluída
                          </button>
                        )}
                        {!c.externalEventId &&
                          googleCalendarConfigured &&
                          user?.role === 'coach' && (
                            <button
                              className="button button--outline"
                              disabled={busy}
                              onClick={() => void createGoogle(c)}
                            >
                              {googlePending[c.id]
                                ? 'Vincular evento já criado'
                                : 'Criar evento Google e Meet'}
                            </button>
                          )}
                      </div>
                    )}
                    {c.externalEventId && (
                      <p className="live-muted exp-agenda-card__note">
                        Evento vinculado ao Google. Reagendamentos e
                        cancelamentos locais precisam ser atualizados também na
                        sua agenda externa.
                      </p>
                    )}
                    {completedId === c.id && (
                      <form
                        className="live-form exp-inline-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void perform(
                            () =>
                              api(
                                '/consultations/' + c.id,
                                json('PATCH', { status: 'completed', reason }),
                              ),
                            'Consultoria concluída.',
                          )
                        }}
                      >
                        <label>
                          Registro da conclusão
                          <textarea
                            required
                            minLength={5}
                            maxLength={1000}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <div className="live-actions">
                          <button
                            className="button button--outline"
                            disabled={busy}
                          >
                            Confirmar conclusão
                          </button>
                          <button
                            type="button"
                            className="button button--outline"
                            onClick={() => setCompletedId(null)}
                          >
                            Voltar
                          </button>
                        </div>
                      </form>
                    )}
                    {editing?.id === c.id && (
                      <form
                        className="live-form exp-inline-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void perform(
                            () =>
                              api(
                                '/consultations/' + c.id,
                                json('PATCH', {
                                  startsAt: new Date(reschedule).toISOString(),
                                  reason,
                                }),
                              ),
                            'Consultoria reagendada.',
                          )
                        }}
                      >
                        <label>
                          Novo início
                          <input
                            required
                            type="datetime-local"
                            max={maxLocalDateTime}
                            value={reschedule}
                            onChange={(e) => setReschedule(e.target.value)}
                          />
                        </label>
                        <label>
                          Motivo da mudança
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            minLength={5}
                            maxLength={1000}
                            required
                          />
                        </label>
                        <div className="live-actions">
                          <button
                            className="button button--dark"
                            disabled={busy}
                          >
                            Salvar novo horário
                          </button>
                          <button
                            type="button"
                            className="button button--outline"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => {
                              if (window.confirm('Cancelar esta consultoria?'))
                                void perform(
                                  () =>
                                    api(
                                      '/consultations/' + c.id,
                                      json('PATCH', {
                                        status: 'cancelled',
                                        reason,
                                      }),
                                    ),
                                  'Consultoria cancelada.',
                                )
                            }}
                          >
                            Cancelar consultoria
                          </button>
                          <button
                            type="button"
                            className="button button--outline"
                            onClick={() => setEditing(null)}
                          >
                            Fechar
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            remote.data && (
              <Empty>
                Nenhuma consultoria agendada. Planeje seu primeiro encontro.
              </Empty>
            )
          )}
        </section>

        <div className="exp-agenda-sidebar">
          <div className="live-panel exp-agenda-selected">
            <div className="exp-agenda-selected__copy">
              <span>Vínculo selecionado</span>
              <strong>{selectedPeerName}</strong>
            </div>
            <span className="exp-agenda-selected__icon" aria-hidden="true">
              <CalendarDays size={20} />
            </span>
          </div>

          <form
            className="live-panel live-form exp-agenda-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (form.durationMinutes === '') return
              void perform(async () => {
                await api(
                  '/consultations',
                  json('POST', {
                    ...form,
                    durationMinutes: form.durationMinutes,
                    contractId: form.contractId || active[0]?.id,
                    startsAt: new Date(form.startsAt).toISOString(),
                    ...(form.meetingUrl
                      ? { meetingUrl: form.meetingUrl }
                      : { meetingUrl: undefined }),
                  }),
                )
                setForm({
                  contractId: '',
                  title: '',
                  description: '',
                  startsAt: '',
                  durationMinutes: 30,
                  meetingUrl: '',
                })
              }, 'Consultoria agendada.')
            }}
          >
            <h3>Agendar consultoria</h3>
            <label>
              Vínculo
              <select
                required
                value={form.contractId || active[0]?.id || ''}
                onChange={(e) =>
                  setForm((v) => ({ ...v, contractId: e.target.value }))
                }
              >
                {!active.length && (
                  <option value="">Nenhum vínculo ativo</option>
                )}
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {user?.role === 'coach' ? c.athleteName : c.coachName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título
              <input
                required
                minLength={3}
                maxLength={120}
                value={form.title}
                onChange={(e) =>
                  setForm((v) => ({ ...v, title: e.target.value }))
                }
              />
            </label>
            <label>
              Objetivo do encontro
              <textarea
                required
                maxLength={3000}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((v) => ({ ...v, description: e.target.value }))
                }
              />
            </label>
            <div className="exp-agenda-form__row">
              <label>
                Data e horário
                <input
                  required
                  type="datetime-local"
                  max={maxLocalDateTime}
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, startsAt: e.target.value }))
                  }
                />
              </label>
              <label>
                Duração (minutos)
                <input
                  required
                  type="number"
                  min={15}
                  max={180}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      durationMinutes:
                        e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Link HTTPS do encontro (opcional)
              <input
                type="url"
                value={form.meetingUrl}
                onChange={(e) =>
                  setForm((v) => ({ ...v, meetingUrl: e.target.value }))
                }
              />
            </label>
            <button
              className="button button--dark"
              disabled={busy || !active.length}
            >
              <CalendarDays size={17} /> Agendar consultoria
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
export function ReviewsPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const coachId = params.get('treinador')
  const remote = useRemote<{
    reviews: Review[]
    average: number
    count: number
  }>('/reviews' + (coachId ? '?coachId=' + coachId : ''))
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [form, setForm] = useState({ contractId: '', rating: 0, text: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [reply, setReply] = useState<Record<string, string>>({})
  const [report, setReport] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [earlyWarning, setEarlyWarning] = useState('')
  const confirmationDialog = useRef<HTMLDialogElement>(null)
  const ratingField = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    if (earlyWarning) confirmationDialog.current?.showModal()
    else confirmationDialog.current?.close()
  }, [earlyWarning])
  const eligible =
    contracts.data?.contracts.filter(
      (c) => c.status === 'active' && (!coachId || c.coachId === coachId),
    ) || []
  async function saveReview(confirmEarly = false) {
    if (form.rating < 1) {
      setError('Escolha uma nota de 1 a 5 estrelas para enviar sua avaliação.')
      ratingField.current?.querySelector<HTMLButtonElement>('[role="radio"][tabindex="0"]')?.focus()
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api(
        editing ? '/reviews/' + editing : '/reviews',
        json(
          editing ? 'PUT' : 'POST',
          editing
            ? { rating: form.rating, text: form.text }
            : {
                ...form,
                contractId: form.contractId || eligible[0]?.id,
                confirmEarly,
              },
        ),
      )
      setEarlyWarning('')
      setEditing(null)
      setForm({ contractId: '', rating: 0, text: '' })
      await remote.reload()
      setSuccess('Avaliação salva.')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REVIEW_TOO_EARLY') {
        setEarlyWarning(e.message)
      } else {
        setEarlyWarning('')
        setError(message(e))
      }
    } finally {
      setBusy(false)
    }
  }
  async function perform(action: () => Promise<unknown>, text: string) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await action()
      await remote.reload()
      setSuccess(text)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const isCoach = user?.role === 'coach'
  const reviewsList = remote.data?.reviews || []
  const repliedCount = reviewsList.filter((r) => !!r.reply).length
  const pendingReplyCount = reviewsList.length - repliedCount
  const activeContractsCount =
    contracts.data?.contracts.filter((c) => c.status === 'active').length || 0
  const avg = Number(remote.data?.average || 0)

  return (
    <div className={'exp-reviews-layout' + (isCoach ? ' exp-reviews-layout--coach' : '')}>
      <div>
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      {remote.data && !isCoach && (
        <div className="exp-review-summary live-panel">
          <Star size={28} />
          <strong>{avg.toFixed(1)}</strong>
          <span>{remote.data.count} avaliação(ões) publicada(s)</span>
        </div>
      )}
      {remote.data && isCoach && (
        <section className="live-panel exp-coach-reputation" aria-label="Resumo da reputação">
          <span className="exp-workout-hero__eyebrow">Reputação do treinador</span>
          <div className="exp-coach-reputation__score">
            <strong>{avg.toFixed(1)}</strong>
            <div>
              <span
                className="exp-coach-reputation__stars"
                aria-label={`Média ${avg.toFixed(1)} de 5 estrelas`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= Math.round(avg) ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <small>
                {remote.data.count}{' '}
                {remote.data.count === 1 ? 'avaliação publicada' : 'avaliações publicadas'}
              </small>
            </div>
          </div>

          <ul className="exp-coach-reputation__bars" aria-label="Distribuição por nota">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = reviewsList.filter((r) => r.rating === stars).length
              const pct = reviewsList.length ? Math.round((count / reviewsList.length) * 100) : 0
              return (
                <li key={stars}>
                  <span>{stars}★</span>
                  <div className="exp-coach-reputation__track" aria-hidden="true">
                    <span style={{ width: pct + '%' }} />
                  </div>
                  <em>{count}</em>
                </li>
              )
            })}
          </ul>

          <dl className="exp-coach-overview__stats">
            <div>
              <dt>Respondidas</dt>
              <dd>{repliedCount}</dd>
            </div>
            <div>
              <dt>Sem resposta</dt>
              <dd className={pendingReplyCount > 0 ? 'is-accent' : undefined}>
                {pendingReplyCount}
              </dd>
            </div>
            <div>
              <dt>Alunos ativos</dt>
              <dd>{activeContractsCount}</dd>
            </div>
          </dl>

          <p className="exp-coach-reputation__note">
            Avaliações vêm exclusivamente de vínculos ativos e você pode responder publicamente a cada retorno.
          </p>
        </section>
      )}
      {user?.role === 'athlete' && (
        <form
          className="live-panel live-form"
          onSubmit={(e) => {
            e.preventDefault()
            void saveReview()
          }}
        >
          <h3>
            {editing ? 'Editar sua avaliação' : 'Compartilhe sua experiência'}
          </h3>
          <p>
            Cada vínculo ativo permite uma avaliação. Antes de sete dias de
            acompanhamento, pediremos sua confirmação para publicar.
          </p>
          <label>
            Treinador
            <select
              required
              disabled={!!editing}
              value={form.contractId || eligible[0]?.id || ''}
              onChange={(e) =>
                setForm((v) => ({ ...v, contractId: e.target.value }))
              }
            >
              {!eligible.length && (
                <option value="">Nenhum vínculo ativo</option>
              )}
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.coachName}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="live-choices" ref={ratingField}>
            <legend>Nota</legend>
            <PeekRating
              className="review-rating"
              value={form.rating}
              onChange={(rating) =>
                setForm((v) => ({ ...v, rating }))
              }
              count={5}
              shape="star"
              labels={['Muito ruim', 'Ruim', 'Bom', 'Muito bom', 'Excelente']}
              activeColor="#f5b400"
              idleColor="#52525b"
              tipColor="#27272a"
              tipTextColor="#f5f5f5"
              size={40}
              lift={8}
              magnify={1.15}
              riseDuration={320}
              popScale={1.3}
              showTip
              allowClear={false}
              disabled={busy}
              ariaLabel="Nota"
            />
          </fieldset>
          <label>
            Sua experiência
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              value={form.text}
              onChange={(e) => setForm((v) => ({ ...v, text: e.target.value }))}
            />
          </label>
          <div className="live-actions">
            <button
              className="button button--dark"
              disabled={busy || !eligible.length}
            >
              <Star size={16} />{' '}
              {editing ? 'Salvar edição' : 'Publicar avaliação'}
            </button>
            {editing && (
              <button
                type="button"
                className="button button--outline"
                onClick={() => {
                  setEditing(null)
                  setForm({ contractId: '', rating: 0, text: '' })
                }}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      )}
      <dialog
        ref={confirmationDialog}
        className="exp-review-confirmation"
        aria-labelledby="early-review-title"
        aria-describedby="early-review-warning"
        onCancel={(e) => {
          if (busy) e.preventDefault()
          else setEarlyWarning('')
        }}
      >
        <h3 id="early-review-title">Enviar avaliação antes do prazo?</h3>
        <p id="early-review-warning">{earlyWarning}</p>
        <div className="live-actions">
          <button type="button" className="button button--outline" disabled={busy} onClick={() => setEarlyWarning('')} autoFocus>Voltar</button>
          <button type="button" className="button button--dark" disabled={busy} onClick={() => void saveReview(true)}>{busy ? 'Enviando…' : 'Enviar mesmo assim'}</button>
        </div>
      </dialog>
      </div>
      <div className="live-stack" role="region" aria-label="Avaliações publicadas">
        {remote.data?.reviews.map((r) => (
          <article className="live-panel exp-review" key={r.id}>
            <div className="live-panel-heading">
              <div>
                <h3>{r.coachName}</h3>
                <p>
                  {r.athleteName} · {dateTime(r.createdAt)}
                </p>
              </div>
              <span
                aria-label={`${r.rating} de 5 estrelas`}
                className="exp-stars"
              >
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </span>
            </div>
            <p className="exp-policy">{r.text}</p>
            {r.reply && (
              <div className="exp-feedback">
                <strong>Resposta do treinador</strong>
                <p>{r.reply}</p>
              </div>
            )}
            <div className="live-actions">
              {r.athleteId === user?.id && (
                <button
                  className="button button--outline"
                  onClick={() => {
                    setEditing(r.id)
                    setForm({
                      contractId: r.contractId,
                      rating: r.rating,
                      text: r.text,
                    })
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Editar avaliação
                </button>
              )}
              <button
                className="button button--outline"
                onClick={() => {
                  setReport(report === r.id ? null : r.id)
                  setReason('')
                }}
              >
                Denunciar conteúdo
              </button>
            </div>
            {user?.id === r.coachId && (
              <form
                className="live-form exp-inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void perform(
                    () =>
                      api(
                        '/reviews/' + r.id + '/reply',
                        json('POST', { text: reply[r.id] || '' }),
                      ),
                    'Resposta publicada.',
                  )
                }}
              >
                <label>
                  Sua resposta
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={reply[r.id] || ''}
                    onChange={(e) =>
                      setReply((v) => ({ ...v, [r.id]: e.target.value }))
                    }
                  />
                </label>
                <button className="button button--outline" disabled={busy}>
                  Responder avaliação
                </button>
              </form>
            )}
            {report === r.id && (
              <form
                className="live-form exp-inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void perform(async () => {
                    await api(
                      '/reviews/' + r.id + '/report',
                      json('POST', { reason }),
                    )
                    setReport(null)
                  }, 'Denúncia enviada para análise.')
                }}
              >
                <label>
                  Motivo da denúncia
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="button button--outline" disabled={busy}>
                  Enviar denúncia
                </button>
              </form>
            )}
          </article>
        ))}
        {remote.data && !remote.data.reviews.length && (
          isCoach ? (
            <div className="live-panel exp-coach-reviews-empty">
              <span className="exp-coach-reviews-empty__icon" aria-hidden="true">
                <Star size={22} />
              </span>
              <h3>Ainda não há avaliações publicadas.</h3>
              <p>
                Quando seus atletas ativos avaliarem o acompanhamento, os depoimentos e o campo de resposta direta aparecerão aqui.
              </p>
              <Link className="button button--outline" to="/treinador/alunos">
                Ver meus alunos
              </Link>
            </div>
          ) : (
            <Empty>Ainda não há avaliações publicadas.</Empty>
          )
        )}
      </div>
    </div>
  )
}
export function AdminReviewsPage() {
  const remote = useRemote<{
    reviews: Review[]
    reports: {
      id: string
      reviewId: string
      reason: string
      createdAt: string
    }[]
  }>('/admin/reviews')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<'all' | 'reported' | 'hidden' | 'published'>('all')
  const allReviews = remote.data?.reviews || []
  const allReports = remote.data?.reports || []
  const reportedIds = new Set(allReports.map((p) => p.reviewId))
  const hiddenCount = allReviews.filter((r) => r.hidden).length
  const publishedCount = allReviews.length - hiddenCount
  const visibleReviews = allReviews.filter((r) => {
    if (filter === 'reported') return reportedIds.has(r.id)
    if (filter === 'hidden') return r.hidden
    if (filter === 'published') return !r.hidden
    return true
  })
  async function moderate(r: Review) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api(
        '/admin/reviews/' + r.id,
        json('PATCH', { hidden: !r.hidden, reason: reasons[r.id] }),
      )
      await remote.reload()
      setSuccess('Decisão de moderação registrada.')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="exp-admin-page">
      <PageTitle
        title="Avaliações com responsabilidade"
        description="Revise denúncias e registre a justificativa de cada decisão de publicação."
      />
      <Notice error={error} success={success} />
      <State {...remote} retry={remote.reload} />
      <div className="exp-admin-layout">
        <div className="exp-admin-main">
          {allReviews.length > 1 && (
            <div className="exp-coach-filters" role="group" aria-label="Filtrar avaliações">
              {(
                [
                  ['all', `Todas (${allReviews.length})`],
                  ['reported', `Com denúncia (${reportedIds.size})`],
                  ['hidden', `Ocultas (${hiddenCount})`],
                  ['published', `Publicadas (${publishedCount})`],
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
            {visibleReviews.map((r) => (
              <article className="live-panel live-form" key={r.id}>
                <div className="live-panel-heading">
                  <h3>
                    {r.coachName} · {r.rating}/5
                  </h3>
                  <Badge status={r.hidden ? 'hidden' : 'published'} />
                </div>
                <p>
                  {r.athleteName}: {r.text}
                </p>
                {allReports
                  .filter((p) => p.reviewId === r.id)
                  .map((p) => (
                    <div className="exp-feedback" key={p.id}>
                      <strong>Denúncia</strong>
                      <p>{p.reason}</p>
                    </div>
                  ))}
                <label>
                  Justificativa de moderação
                  <textarea
                    value={reasons[r.id] || ''}
                    onChange={(e) =>
                      setReasons((v) => ({ ...v, [r.id]: e.target.value }))
                    }
                    minLength={5}
                    maxLength={1000}
                  />
                </label>
                <button
                  className="button button--outline"
                  disabled={busy || (reasons[r.id] || '').trim().length < 5}
                  onClick={() => void moderate(r)}
                >
                  {r.hidden ? 'Restaurar publicação' : 'Ocultar avaliação'}
                </button>
              </article>
            ))}
            {remote.data && !allReviews.length && (
              <Empty>Nenhuma avaliação para moderar.</Empty>
            )}
            {remote.data && allReviews.length > 0 && !visibleReviews.length && (
              <Empty>Nenhuma avaliação encontrada com esse filtro.</Empty>
            )}
          </div>
        </div>

        <aside className="live-panel exp-admin-aside" aria-label="Panorama de moderação">
          <div>
            <span className="exp-workout-hero__eyebrow">Moderação auditada</span>
            <h3>Saúde das avaliações</h3>
          </div>
          <dl className="exp-coach-overview__stats">
            <div>
              <dt>Denúncias</dt>
              <dd className={allReports.length > 0 ? 'is-accent' : undefined}>
                {allReports.length}
              </dd>
            </div>
            <div>
              <dt>Ocultas</dt>
              <dd>{hiddenCount}</dd>
            </div>
            <div>
              <dt>Publicadas</dt>
              <dd>{publishedCount}</dd>
            </div>
          </dl>
          <p className="exp-coach-reputation__note">
            Ocultar uma avaliação remove seu impacto na média pública preservando a justificativa no histórico de auditoria.
          </p>
        </aside>
      </div>
    </div>
  )
}
