import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ChevronUp,
  Download,
  FileCheck2,
  FileUp,
  Paperclip,
  Plus,
  UploadCloud,
  MinusCircle,
  PlusCircle,
  Trash2,
} from 'lucide-react'
import { api, ApiError, json } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Empty, Notice, PageTitle, State, message, useRemote } from './common'

export interface MediaItem {
  id: string
  name: string
  mimeType: string
  size: number
  purpose: string
  resourceId: string
  ownerId: string
  createdAt: string
  feedback: {
    id: string
    text: string
    authorName?: string
    createdAt: string
  }[]
}
export async function uploadFile(
  file: File,
  purpose: string,
  resourceId: string,
) {
  if (file.size > 3 * 1024 * 1024) {
    const { upload } = await api<{
      upload: { id: string; partSize: number; parts: number }
    }>(
      '/media/uploads',
      json('POST', {
        purpose,
        resourceId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      }),
    )
    try {
      for (let part = 0; part < upload.parts; part++) {
        await api(`/media/uploads/${upload.id}/parts/${part}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file.slice(
            part * upload.partSize,
            (part + 1) * upload.partSize,
          ),
        })
      }
      return await api<{ media: MediaItem }>(
        `/media/uploads/${upload.id}/complete`,
        json('POST', {}),
      )
    } catch (error) {
      await api(`/media/uploads/${upload.id}`, { method: 'DELETE' }).catch(
        () => undefined,
      )
      throw error
    }
  }
  const body = new FormData()
  body.append('file', file)
  return api<{ media: MediaItem }>(
    `/media?purpose=${purpose}&resourceId=${encodeURIComponent(resourceId)}`,
    { method: 'POST', body },
  )
}
export function MediaPanel({
  resourceId,
  purpose,
  allowUpload = true,
  collapsible = false,
}: {
  resourceId: string
  purpose: 'instruction' | 'performance' | 'message' | 'verification'
  allowUpload?: boolean
  collapsible?: boolean
}) {
  const { user } = useAuth()
  const remote = useRemote<{ media: MediaItem[] }>(
    '/media?resourceId=' + resourceId,
  )
  const [expanded, setExpanded] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [performanceConsent, setPerformanceConsent] = useState<boolean | null>(null)
  const [grantPerformanceConsent, setGrantPerformanceConsent] = useState(false)
  useEffect(() => {
    setExpanded(false)
  }, [resourceId])
  useEffect(() => {
    if (purpose !== 'performance' || !allowUpload) return
    const controller = new AbortController()
    void api<{ consents: Consent[] }>('/privacy/consents', { signal: controller.signal })
      .then(({ consents }) => {
        if (!controller.signal.aborted)
          setPerformanceConsent(consents.some((c) => c.purpose === 'performance' && c.granted))
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setPerformanceConsent(false)
          setError(message(e))
        }
      })
    return () => controller.abort()
  }, [purpose, allowUpload])
  async function perform(action: () => Promise<unknown>, successText: string) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await action()
      await remote.reload()
      setSuccess(successText)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONSENT_REQUIRED') {
        setPerformanceConsent(false)
        setGrantPerformanceConsent(false)
      }
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return
    const form = e.currentTarget
    await perform(async () => {
      if (purpose === 'performance' && !performanceConsent) {
        if (!grantPerformanceConsent)
          throw new Error('Autorize o uso dos dados de performance abaixo para enviar seu arquivo.')
        await api('/privacy/consents', json('PUT', { purpose: 'performance', granted: true }))
        setPerformanceConsent(true)
        setGrantPerformanceConsent(false)
      }
      await uploadFile(file, purpose, resourceId)
      setFile(null)
      form.reset()
    }, 'Arquivo enviado com sucesso.')
  }
  const hasMedia = (remote.data?.media.length ?? 0) > 0
  const isOpen =
    !collapsible ||
    expanded ||
    hasMedia ||
    !!file ||
    !!error ||
    !!success ||
    !!remote.error

  if (!isOpen) {
    return (
      <section className="exp-media exp-media--collapsed" aria-label="Vídeos e correções">
        <div className="exp-media-bar">
          <span className="exp-media-bar__label">
            <Paperclip size={15} aria-hidden="true" />
            <strong>Vídeos e correções</strong>
            <small>{remote.loading ? '(carregando…)' : '(nenhum anexo)'}</small>
          </span>
          {allowUpload && (
            <button
              type="button"
              className="exp-media-toggle"
              aria-expanded={false}
              onClick={() => setExpanded(true)}
            >
              <Plus size={14} aria-hidden="true" />
              Enviar vídeo/arquivo
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className={'exp-media' + (collapsible ? ' exp-media--drawer' : '')}>
      <div className="exp-media__head">
        <h4>
          {collapsible ? (
            <>
              <Paperclip size={16} aria-hidden="true" /> Vídeos e correções
            </>
          ) : (
            <>
              <FileUp size={18} /> Arquivos e correções
            </>
          )}
        </h4>
        {collapsible && !hasMedia && allowUpload && (
          <button
            type="button"
            className="exp-media-toggle exp-media-toggle--close"
            aria-expanded={true}
            disabled={busy}
            onClick={() => {
              setExpanded(false)
              setFile(null)
              setError('')
              setSuccess('')
            }}
          >
            <ChevronUp size={14} aria-hidden="true" />
            Recolher
          </button>
        )}
      </div>
      <p className="live-muted">
        Arquivos privados compartilhados com as pessoas deste vínculo. Imagens e
        PDF até 10 MiB; vídeos até 50 MiB.
      </p>
      <State {...remote} retry={remote.reload} />
      <Notice error={error} success={success} />
      {remote.data?.media.map((m) => (
        <article className="exp-media-item" key={m.id}>
          <div className="live-panel-heading">
            <a
              className="live-link"
              href={'/api/media/' + m.id + '/content'}
              target="_blank"
              rel="noreferrer"
            >
              {m.name}
            </a>
            <small>{(m.size / 1024 / 1024).toFixed(2)} MiB</small>
          </div>
          {m.mimeType.startsWith('video/') && (
            <video
              controls
              preload="none"
              src={'/api/media/' + m.id + '/content'}
              aria-label={'Vídeo ' + m.name}
            />
          )}
          {m.feedback?.map((f) => (
            <div className="exp-feedback" key={f.id}>
              <strong>{f.authorName || 'Feedback'}</strong>
              <p>{f.text}</p>
            </div>
          ))}
          {user?.role === 'coach' && m.purpose === 'performance' && (
            <form
              className="live-form"
              onSubmit={(e) => {
                e.preventDefault()
                void perform(async () => {
                  await api(
                    '/media/' + m.id + '/feedback',
                    json('POST', { text: text[m.id] }),
                  )
                  setText((v) => ({ ...v, [m.id]: '' }))
                }, 'Correção registrada.')
              }}
            >
              <label>
                Comentário sobre {m.name}
                <textarea
                  required
                  minLength={2}
                  maxLength={2000}
                  rows={2}
                  value={text[m.id] || ''}
                  onChange={(e) =>
                    setText((v) => ({ ...v, [m.id]: e.target.value }))
                  }
                />
              </label>
              <div className="live-actions">
                <button className="button button--outline" disabled={busy}>
                  Enviar correção técnica
                </button>
              </div>
            </form>
          )}
          {m.ownerId === user?.id && (
            <button
              type="button"
              className="button button--outline"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Excluir este arquivo privado?'))
                  void perform(
                    () => api('/media/' + m.id, { method: 'DELETE' }),
                    'Arquivo excluído.',
                  )
              }}
            >
              <Trash2 size={16} /> Excluir arquivo
            </button>
          )}
        </article>
      ))}
      {!collapsible && remote.data && !remote.data.media.length && (
        <p className="live-muted">Nenhum arquivo enviado para este recurso.</p>
      )}
      {allowUpload && (
        <form onSubmit={upload} className="live-form exp-upload">
          <label
            className={
              'exp-dropzone' +
              (dragging ? ' is-dragging' : '') +
              (file ? ' has-file' : '') +
              (busy ? ' is-busy' : '')
            }
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
          >
            <span className="exp-dropzone__title">Arquivo privado</span>
            <span className="exp-dropzone__body">
              <span className="exp-dropzone__icon" aria-hidden="true">
                {file ? <FileCheck2 size={22} /> : <UploadCloud size={22} />}
              </span>
              <span className="exp-dropzone__text">
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MiB · clique para trocar
                    </small>
                  </>
                ) : (
                  <>
                    <strong>
                      Arraste um arquivo ou <u>clique para escolher</u>
                    </strong>
                    <small>JPG, PNG, WEBP, PDF, MP4 ou WEBM</small>
                  </>
                )}
              </span>
              <span className="exp-dropzone__cta" aria-hidden="true">
                {file ? 'Trocar' : 'Escolher'}
              </span>
            </span>
            <input
              type="file"
              aria-label="Arquivo privado"
              required
              disabled={busy}
              accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {purpose === 'performance' && performanceConsent === false && (
            <label className="exp-consent checkbox-wrapper-46">
              <input
                className="inp-cbx"
                type="checkbox"
                required
                disabled={busy}
                checked={grantPerformanceConsent}
                onChange={(e) => setGrantPerformanceConsent(e.target.checked)}
              />
              <span className="cbx">
                <span aria-hidden="true">
                  <svg viewBox="0 0 12 10" height="10" width="12">
                    <polyline points="1.5 6 4.5 9 10.5 1" />
                  </svg>
                </span>
                <span>
                  <strong>Autorizo o uso dos meus vídeos e dados de performance para acompanhamento pelo meu treinador.</strong>
                  <small>Você pode revogar esta autorização em <Link className="live-link" to="/atleta/privacidade">Privacidade</Link>. A autorização será salva ao enviar o arquivo.</small>
                </span>
              </span>
            </label>
          )}
          <button className="button button--outline" disabled={busy || !file || (purpose === 'performance' && performanceConsent === null)}>
            <FileUp size={16} /> {busy ? 'Enviando…' : 'Enviar arquivo'}
          </button>
        </form>
      )}
    </section>
  )
}

interface Consent {
  purpose: string
  granted: boolean
  version: string
  updatedAt: string
}
const consentNames: Record<string, string> = {
  performance: 'Vídeos e dados de performance',
  health: 'Informações de saúde',
  communications: 'Comunicações por e-mail',
  location: 'Localização aproximada no mapa',
}
type PrivacyCategory = 'autorizacoes' | 'politica' | 'copia' | 'encerrar'

interface PrivacyAccordionRow {
  id: string
  title: string
  body: ReactNode
}

const PRIVACY_CATEGORIES: { id: PrivacyCategory; label: string; defaultOpen: string }[] = [
  { id: 'autorizacoes', label: 'Autorizações', defaultOpen: 'consents' },
  { id: 'politica', label: 'Política e LGPD', defaultOpen: 'policy-main' },
  { id: 'copia', label: 'Cópia dos dados', defaultOpen: 'export-main' },
  { id: 'encerrar', label: 'Encerrar conta', defaultOpen: 'delete-main' },
]

export function PrivacyPage() {
  const [category, setCategory] = useState<PrivacyCategory>('autorizacoes')
  const [openIds, setOpenIds] = useState<string[]>(['consents', 'health'])
  const [consentDraft, setConsentDraft] = useState<Record<string, boolean>>({})
  const policy = useRemote<{
    policy: { version: string; text: string; retention: string }
  }>('/privacy/policy')
  const consent = useRemote<{ consents: Consent[] }>('/privacy/consents')
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const healthGranted = Boolean(
    consent.data?.consents.some((c) => c.purpose === 'health' && c.granted),
  )

  useEffect(() => {
    if (healthGranted) {
      setOpenIds((prev) => (prev.includes('health') ? prev : [...prev, 'health']))
    }
  }, [healthGranted])

  function selectCategory(next: PrivacyCategory) {
    setCategory(next)
    const spec = PRIVACY_CATEGORIES.find((c) => c.id === next)
    if (spec) {
      setOpenIds(
        next === 'autorizacoes' && healthGranted
          ? [spec.defaultOpen, 'health']
          : [spec.defaultOpen],
      )
    }
  }

  function toggleItem(id: string) {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await action()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function exportData() {
    const data = await api('/privacy/export')
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'linkatletas-meus-dados.json'
    a.click()
    URL.revokeObjectURL(url)
    setSuccess('Exportação dos seus dados preparada.')
  }

  const root = user?.role === 'coach' ? '/treinador' : '/atleta'
  const policyVersion = policy.data?.policy.version || 'atual'

  const consentsContent = consent.data ? (
    <div className="prv-consents">
      <p className="prv-lead">
        Você pode conceder ou revogar cada finalidade a qualquer momento. A
        revogação impede novas coletas e aplica a política de retenção.
      </p>
      <div className="prv-consent-list">
        {Object.entries(consentNames).map(([purpose, label]) => {
          const current = consent.data?.consents.find((c) => c.purpose === purpose)
          const checked = consentDraft[purpose] ?? current?.granted ?? false
          return (
            <label className={'exp-consent prv-consent' + (checked ? ' is-granted' : '')} key={purpose}>
              <input
                type="checkbox"
                disabled={busy}
                checked={checked}
                onChange={(e) => {
                  const granted = e.target.checked
                  setConsentDraft((previous) => ({
                    ...previous,
                    [purpose]: granted,
                  }))
                  void perform(async () => {
                    await api(
                      '/privacy/consents',
                      json('PUT', { purpose, granted }),
                    )
                    await consent.reload()
                    setSuccess('Preferência de privacidade atualizada.')
                  }).finally(() =>
                    setConsentDraft((previous) => {
                      const next = { ...previous }
                      delete next[purpose]
                      return next
                    }),
                  )
                }}
              />
              <span>
                <strong>{label}</strong>
                <small>
                  {current?.updatedAt
                    ? 'Atualizada em ' +
                      new Date(current.updatedAt).toLocaleString('pt-BR')
                    : 'Ainda não concedida'}
                </small>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  ) : null

  const deleteForm = (
    <form
      className="live-form prv-delete-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!confirmed) return
        void perform(async () => {
          await api('/privacy/delete', json('POST', { password }))
          await refresh()
          navigate('/login', { replace: true })
        })
      }}
    >
      <p className="prv-lead">
        Sua sessão será encerrada imediatamente. Os dados serão eliminados ou
        anonimizados conforme a política; registros que precisarem ser retidos
        serão minimizados.
      </p>
      <label>
        Confirme sua senha
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="exp-consent prv-consent">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
        />
        <span>Entendo que esta ação encerra minha conta.</span>
      </label>
      <div className="live-actions">
        <button
          className="button button--outline prv-danger-btn"
          disabled={busy || !confirmed}
        >
          <Trash2 size={16} /> Encerrar minha conta
        </button>
      </div>
    </form>
  )

  const rowsByCategory: Record<PrivacyCategory, PrivacyAccordionRow[]> = {
    autorizacoes: [
      {
        id: 'consents',
        title: 'Suas autorizações de uso de dados',
        body: consentsContent || <p className="prv-lead">Carregando suas autorizações…</p>,
      },
      ...(healthGranted
        ? [
            {
              id: 'health',
              title: 'Informações privadas de saúde',
              body: <HealthPanel embedded />,
            },
          ]
        : []),
      {
        id: 'revoke-effect',
        title: 'O que acontece quando eu revogo uma autorização?',
        body: (
          <p className="prv-copy">
            A revogação impede imediatamente novas coletas para aquela
            finalidade. No caso de <strong>Informações de saúde</strong>, revogar
            o consentimento elimina o registro privado salvo na sua conta. Revogar a{' '}
            <strong>Localização</strong> apaga sua posição e tira você do mapa.
          </p>
        ),
      },
      {
        id: 'who-sees',
        title: 'Quem pode acessar meus treinos, vídeos e dados de saúde?',
        body: (
          <p className="prv-copy">
            Treinos, mensagens e arquivos de performance são acessíveis apenas às
            partes autorizadas do vínculo ativo. Documentos profissionais são
            restritos ao titular e ao administrador responsável pela verificação.
          </p>
        ),
      },
      {
        id: 'encryption',
        title: 'Como a LinkAtletas protege minhas informações sensíveis?',
        body: (
          <p className="prv-copy">
            Registros de saúde são armazenados criptografados em repouso
            (AES-GCM), e o acesso a arquivos privados, exportação e encerramento
            exige sessão autenticada com verificação de titularidade.
          </p>
        ),
      },
      {
        id: 'policy-inline',
        title: `Resumo da Política de Privacidade (Versão ${policyVersion})`,
        body: policy.data ? (
          <div className="prv-policy-copy">
            <p className="prv-copy">{policy.data.policy.text}</p>
            <p className="prv-copy">{policy.data.policy.retention}</p>
          </div>
        ) : (
          <p className="prv-lead">Carregando política…</p>
        ),
      },
    ],
    politica: [
      {
        id: 'policy-main',
        title: `Política de privacidade · Versão ${policyVersion}`,
        body: policy.data ? (
          <p className="prv-copy">{policy.data.policy.text}</p>
        ) : (
          <p className="prv-lead">Carregando política…</p>
        ),
      },
      {
        id: 'policy-retention',
        title: 'Política de retenção, anonimização e backups',
        body: policy.data ? (
          <p className="prv-copy">{policy.data.policy.retention}</p>
        ) : (
          <p className="prv-lead">Carregando política de retenção…</p>
        ),
      },
      {
        id: 'policy-purposes',
        title: 'Quais finalidades exigem consentimento separado?',
        body: (
          <p className="prv-copy">
            Dados básicos de conta e perfil são usados para autenticação e
            acompanhamento esportivo. Vídeos de performance, informações de saúde,
            comunicações opcionais por e-mail e localização aproximada no mapa
            dependem de consentimento
            explícito e independente na aba <strong>Autorizações</strong>.
          </p>
        ),
      },
      {
        id: 'policy-integrations',
        title: 'Como funcionam integrações externas (e-mail, agenda e pagamentos)?',
        body: (
          <p className="prv-copy">
            As integrações externas só operam quando explicitamente configuradas
            pelo responsável do ambiente, respeitando minimização de dados e
            separação por finalidade.
          </p>
        ),
      },
    ],
    copia: [
      {
        id: 'export-main',
        title: 'Uma cópia para você · Exportação em JSON',
        body: (
          <div className="prv-export-box">
            <p className="prv-copy">
              Baixe um arquivo JSON estruturado contendo as informações
              vinculadas à sua conta na LinkAtletas para conferência ou
              portabilidade.
            </p>
            <div>
              <button
                type="button"
                className="button button--dark"
                disabled={busy}
                onClick={() => void perform(exportData)}
              >
                <Download size={16} aria-hidden="true" /> Exportar meus dados
              </button>
            </div>
          </div>
        ),
      },
      {
        id: 'export-contents',
        title: 'Quais dados estão incluídos no arquivo exportado?',
        body: (
          <p className="prv-copy">
            O pacote inclui dados de perfil, histórico de consentimentos,
            informações de saúde (quando autorizadas), vínculos, treinos,
            mensagens e registros associados exclusivamente à sua titularidade.
          </p>
        ),
      },
      {
        id: 'export-frequency',
        title: 'Existe limite ou prazo de espera para gerar a cópia?',
        body: (
          <p className="prv-copy">
            Não. A geração é imediata e sob demanda sempre que você estiver
            autenticado, respeitando os limites de proteção contra abuso da API.
          </p>
        ),
      },
    ],
    encerrar: [
      {
        id: 'delete-main',
        title: 'Encerrar e solicitar exclusão da conta',
        body: deleteForm,
      },
      {
        id: 'delete-retention',
        title: 'O que é excluído e o que permanece minimizado após o encerramento?',
        body: (
          <p className="prv-copy">
            O encerramento remove informações de saúde, conteúdo de mensagens,
            execuções e arquivos próprios, anonimiza a conta e preserva apenas
            referências mínimas de ciclos, auditoria e registros financeiros
            necessários para conciliação.
          </p>
        ),
      },
    ],
  }

  const rows = rowsByCategory[category]

  return (
    <div className="prv-hub">
      <div className="prv-header">
        <div>
          <h2>Privacidade</h2>
          <p className="prv-subtitle">
            Você decide sobre seus dados — controle autorizações, consulte a
            política ou baixe uma cópia.
          </p>
        </div>
        <button
          type="button"
          className="prv-cta"
          disabled={busy}
          onClick={() => void perform(exportData)}
        >
          <Download size={16} aria-hidden="true" />
          Exportar meus dados
        </button>
      </div>

      <Notice error={error} success={success} />
      <State {...policy} retry={policy.reload} />
      <State {...consent} retry={consent.reload} />

      <div className="prv-cats" role="tablist" aria-label="Categorias de privacidade">
        {PRIVACY_CATEGORIES.map((cat) => {
          const active = category === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={'prv-cat' + (active ? ' is-active' : '')}
              onClick={() => selectCategory(cat.id)}
            >
              <span>{cat.label}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <div className="prv-list">
        {rows.map((row) => {
          const open = openIds.includes(row.id)
          const panelId = `prv-panel-${row.id}`
          return (
            <article className={'prv-item' + (open ? ' is-open' : '')} key={row.id}>
              <h3 className="prv-item__heading">
                <button
                  type="button"
                  className="prv-item__trigger"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggleItem(row.id)}
                >
                  <span>{row.title}</span>
                  {open ? (
                    <MinusCircle size={19} aria-hidden="true" />
                  ) : (
                    <PlusCircle size={19} aria-hidden="true" />
                  )}
                </button>
              </h3>
              {open && (
                <div id={panelId} className="prv-item__body">
                  {row.body}
                </div>
              )}
            </article>
          )
        })}
      </div>

      <footer className="prv-footer">
        <h3>Precisa de outro controle?</h3>
        <div className="prv-footer__links">
          <button type="button" onClick={() => selectCategory('autorizacoes')}>
            Autorizações
          </button>
          <span aria-hidden="true">,</span>
          <button type="button" onClick={() => selectCategory('politica')}>
            Política completa
          </button>
          <span aria-hidden="true">,</span>
          <button type="button" onClick={() => selectCategory('copia')}>
            Portabilidade JSON
          </button>
          <span aria-hidden="true">,</span>
          <button type="button" onClick={() => selectCategory('encerrar')}>
            Encerramento de conta
          </button>
          <span aria-hidden="true">,</span>
          <Link to={root + '/notificacoes'}>Notificações</Link>
        </div>
      </footer>
    </div>
  )
}
export function PasswordRecoveryPage() {
  const [params] = useSearchParams()
  const [token] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).get('token') ||
      params.get('token') ||
      '',
  )
  const reset = token.length > 0
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (reset && password !== confirmation) {
      setError('As senhas precisam ser iguais.')
      return
    }
    setBusy(true)
    try {
      await api(
        reset ? '/auth/reset-password' : '/auth/forgot-password',
        json('POST', reset ? { token, password } : { email }),
      )
      setSuccess(
        reset
          ? 'Senha alterada. Entre novamente com a nova senha.'
          : 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.',
      )
      setPassword('')
      setConfirmation('')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="exp-recovery">
      <form className="live-panel live-form" onSubmit={submit}>
        <Link to="/login">← Voltar para o login</Link>
        <span className="eyebrow">LinkAtletas · Sua conta</span>
        <h1>{reset ? 'Escolha sua nova senha' : 'Recupere seu acesso'}</h1>
        <p>
          {reset
            ? 'O link pode ser usado uma única vez e expira em 30 minutos.'
            : 'Informe o e-mail que você usou no cadastro.'}
        </p>
        {reset ? (
          <>
            <label>
              Nova senha
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Repita a nova senha
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <Notice error={error} success={success} />
        <button className="button button--dark" disabled={busy}>
          {busy ? 'Aguarde…' : reset ? 'Alterar senha' : 'Enviar instruções'}
        </button>
      </form>
    </main>
  )
}
export function AdminPrivacyPage() {
  const remote = useRemote<{
    requests: {
      id: string
      user_id: string
      status: string
      requested_at: string
      completed_at?: string | null
    }[]
  }>('/admin/privacy/requests')
  const requests = remote.data?.requests || []
  const completedCount = requests.filter((r) => r.status === 'completed').length
  const openCount = requests.length - completedCount
  return (
    <div className="exp-admin-page">
      <PageTitle
        title="Pedidos de privacidade"
        description="Acompanhe a execução dos pedidos de encerramento e eliminação."
      />
      <State {...remote} retry={remote.reload} />
      <div className="exp-admin-layout">
        <div className="exp-admin-main">
          {requests.length > 0 && (
            <section className="live-panel">
              {requests.map((r) => (
                <article className="live-row" key={r.id}>
                  <div>
                    <strong>Pedido {r.id.slice(0, 8)}</strong>
                    <p>{new Date(r.requested_at).toLocaleString('pt-BR')}</p>
                    <small>Conta {r.user_id}</small>
                  </div>
                  <span className="live-badge">
                    {r.status === 'completed' ? 'Concluído' : r.status}
                  </span>
                </article>
              ))}
            </section>
          )}
          {remote.data && !requests.length && (
            <Empty>Nenhum pedido registrado.</Empty>
          )}
        </div>

        <aside className="live-panel exp-admin-aside" aria-label="Resumo de pedidos LGPD">
          <div>
            <span className="exp-workout-hero__eyebrow">Conformidade LGPD</span>
            <h3>Pedidos de titulares</h3>
          </div>
          <dl className="exp-coach-overview__stats">
            <div>
              <dt>Em aberto</dt>
              <dd className={openCount > 0 ? 'is-accent' : undefined}>{openCount}</dd>
            </div>
            <div>
              <dt>Concluídos</dt>
              <dd>{completedCount}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{requests.length}</dd>
            </div>
          </dl>
          <p className="exp-coach-reputation__note">
            Encerramentos eliminam dados sensíveis, anonimizam a conta e preservam apenas registros mínimos exigidos para conciliação.
          </p>
        </aside>
      </div>
    </div>
  )
}
function HealthPanel({ embedded = false }: { embedded?: boolean }) {
  const remote = useRemote<{
    health: { notes: string; heightCm?: number; weightKg?: number } | null
  }>('/privacy/health')
  const [form, setForm] = useState({ notes: '', height: '', weight: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    if (remote.data?.health)
      setForm({
        notes: remote.data.health.notes,
        height: String(remote.data.health.heightCm || ''),
        weight: String(remote.data.health.weightKg || ''),
      })
  }, [remote.data])
  return (
    <form
      className={embedded ? 'live-form prv-health-form' : 'live-panel live-form'}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        setSuccess('')
        try {
          await api(
            '/privacy/health',
            json('PUT', {
              notes: form.notes,
              ...(form.height ? { heightCm: Number(form.height) } : {}),
              ...(form.weight ? { weightKg: Number(form.weight) } : {}),
            }),
          )
          await remote.reload()
          setSuccess('Informações privadas salvas.')
        } catch (e) {
          setError(message(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      {!embedded && <h3>Informações privadas de saúde</h3>}
      <p className="prv-lead">
        Dados opcionais da sua conta, protegidos em repouso. Revogar o
        consentimento de saúde elimina este registro.
      </p>
      <State {...remote} retry={remote.reload} />
      <div className="live-grid-2">
        <label>
          Altura (cm)
          <input
            type="number"
            min={30}
            max={300}
            step="any"
            value={form.height}
            onChange={(e) => setForm((v) => ({ ...v, height: e.target.value }))}
          />
        </label>
        <label>
          Peso (kg)
          <input
            type="number"
            min={1}
            max={700}
            step="any"
            value={form.weight}
            onChange={(e) => setForm((v) => ({ ...v, weight: e.target.value }))}
          />
        </label>
      </div>
      <label>
        Observações privadas
        <textarea
          rows={3}
          maxLength={4000}
          value={form.notes}
          onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
        />
      </label>
      <Notice error={error} success={success} />
      <button
        className="button button--outline"
        disabled={busy || remote.loading}
      >
        Salvar informações privadas
      </button>
    </form>
  )
}
