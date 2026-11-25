import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Logo } from '../components/Logo'
import { homeFor, useAuth, type RegisterConsents } from '../context/AuthContext'
import { api } from '../services/api'

// Finalidades opcionais da política; a conta funciona sem elas, só os recursos ligados ficam bloqueados
const OPTIONAL_CONSENTS: {
  key: keyof RegisterConsents
  title: string
  detail: string
}[] = [
  {
    key: 'performance',
    title: 'Vídeos e dados de performance',
    detail: 'Necessário para enviar vídeos e métricas de execução ao seu treinador.',
  },
  {
    key: 'health',
    title: 'Informações de saúde',
    detail: 'Necessário para registrar dados de saúde privados (guardados criptografados).',
  },
  {
    key: 'location',
    title: 'Localização aproximada no mapa',
    detail: 'Mostra sua região (~1 km) no mapa para atletas e treinadores se encontrarem.',
  },
  {
    key: 'communications',
    title: 'Comunicações por e-mail',
    detail: 'Novidades e lembretes opcionais. E-mails de segurança da conta são sempre enviados.',
  },
]

export function LoginPage() {
  const [params] = useSearchParams()
  const [registering, setRegistering] = useState(params.get('cadastro') === '1')
  const [role, setRole] = useState<'athlete' | 'coach'>(
    params.get('perfil') === 'treinador' ? 'coach' : 'athlete',
  )
  const [name, setName] = useState('')
  const [cref, setCref] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [acceptPolicy, setAcceptPolicy] = useState(false)
  const [consents, setConsents] = useState<RegisterConsents>({})
  const [policy, setPolicy] = useState<{ version: string; text: string; retention: string } | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const auth = useAuth()
  const navigate = useNavigate()

  async function togglePolicy() {
    setPolicyOpen((open) => !open)
    if (!policy)
      api<{ policy: { version: string; text: string; retention: string } }>('/privacy/policy')
        .then((d) => setPolicy(d.policy))
        .catch(() => setError('Não foi possível carregar a política. Tente novamente.'))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (registering && !acceptPolicy) {
      setError('Aceite a política de privacidade para criar a conta.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = registering
        ? await auth.register(name, email, password, role, cref, consents)
        : await auth.login(email, password)
      navigate(homeFor(user.role))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-brand-panel">
          <Link to="/" aria-label="Voltar para o início" className="login-brand-logo">
            <Logo light />
          </Link>
          <h1>
            SUPERE
            <br />
            LIMITES
          </h1>
          <p className="login-brand-lead">
            Onde sua evolução esportiva se torna realidade.
          </p>
          <p className="login-brand-sub">
            Conecte-se a treinadores verificados e acompanhe cada etapa da sua
            jornada de alto rendimento.
          </p>
        </div>
        <main className="login-form-panel">
          <form onSubmit={submit} className="login-form">
            {registering && (
              <>
                <div className="role-switch">
                  <button
                    type="button"
                    className={role === 'athlete' ? 'active' : ''}
                    onClick={() => setRole('athlete')}
                  >
                    Sou atleta
                  </button>
                  <button
                    type="button"
                    className={role === 'coach' ? 'active' : ''}
                    onClick={() => setRole('coach')}
                  >
                    Sou treinador
                  </button>
                </div>
                <label>
                  Nome completo
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </label>
                {role === 'coach' && (
                  <label>
                    CREF com UF
                    <input
                      value={cref}
                      onChange={(event) => setCref(event.target.value)}
                      placeholder="123456-G/SP"
                      maxLength={50}
                      required
                    />
                  </label>
                )}
              </>
            )}
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={registering ? 8 : 1}
                  maxLength={128}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {!registering && (
                <Link className="live-link login-forgot-link" to="/recuperar-senha">
                  Esqueci minha senha
                </Link>
              )}
            </label>
            {registering && (
              <small className="login-register-hint">
                Use pelo menos 8 caracteres.
                {role === 'coach' && ' Informe o nome completo como consta no CONFEF.'}
              </small>
            )}
            {registering && (
              <fieldset className="login-consents">
                <legend>Privacidade e LGPD</legend>
                <label className="login-consent login-consent--required">
                  <input
                    type="checkbox"
                    checked={acceptPolicy}
                    onChange={(e) => setAcceptPolicy(e.target.checked)}
                    required
                  />
                  <span>
                    <strong>
                      Li e aceito a política de privacidade
                      {policy ? ` (versão ${policy.version})` : ''}.
                    </strong>{' '}
                    <button
                      type="button"
                      className="login-policy-toggle"
                      aria-expanded={policyOpen}
                      onClick={() => void togglePolicy()}
                    >
                      {policyOpen ? 'Ocultar política' : 'Ler política'}
                    </button>
                  </span>
                </label>
                {policyOpen && (
                  <div className="login-policy-text">
                    {policy ? (
                      <>
                        <p>{policy.text}</p>
                        <p>{policy.retention}</p>
                      </>
                    ) : (
                      <p>Carregando política…</p>
                    )}
                  </div>
                )}
                <p className="login-consents-lead">
                  Autorizações opcionais (pode mudar depois em Privacidade):
                </p>
                {OPTIONAL_CONSENTS.map((c) => (
                  <label className="login-consent" key={c.key}>
                    <input
                      type="checkbox"
                      checked={consents[c.key] === true}
                      onChange={(e) =>
                        setConsents((prev) => ({ ...prev, [c.key]: e.target.checked }))
                      }
                    />
                    <span>
                      <strong>{c.title}</strong>
                      <small>{c.detail}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <button
              className="button button--large login-submit"
              disabled={loading}
            >
              {loading
                ? 'Aguarde…'
                : registering
                  ? 'Criar minha conta'
                  : 'Entrar na plataforma'}
            </button>
            <div className="login-divider">
              <span>ou</span>
            </div>
            <p className="signup-copy">
              {registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setRegistering(!registering)
                  setError('')
                }}
              >
                {registering ? 'Entrar' : 'Criar cadastro'}
              </button>
            </p>
          </form>
        </main>
      </div>
    </div>
  )
}
