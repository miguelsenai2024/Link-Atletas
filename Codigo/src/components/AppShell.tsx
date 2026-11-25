import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  Award,
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Dumbbell,
  Flame,
  HeartHandshake,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { BillingStatusCard } from './BillingStatusCard'
import { CoachMap } from './CoachMap'
import { NextConsultationCard } from './NextConsultationCard'
import { Logo } from './Logo'
import { ProfilePreview } from './ProfilePreview'
import { ProfileCompletionNotice } from './ProfileCompletionNotice'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../../shared/contracts'

interface NavGroup {
  id: string
  label: string
  icon: typeof LayoutGrid
  items: { to: string; label: string; icon: typeof LayoutGrid }[]
}

function getGroups(role: Role): NavGroup[] {
  if (role === 'admin') {
    return [
      {
        id: 'principal',
        label: 'Principal',
        icon: LayoutGrid,
        items: [
          { to: '/admin', label: 'Verificações profissionais', icon: ShieldCheck },
          { to: '/admin/avaliacoes', label: 'Moderação de avaliações', icon: Star },
          { to: '/admin/financeiro', label: 'Regras financeiras', icon: CreditCard },
        ],
      },
      {
        id: 'consultas',
        label: 'Consultas',
        icon: Shield,
        items: [
          { to: '/admin/privacidade', label: 'Pedidos de privacidade', icon: Shield },
          { to: '/admin/notificacoes', label: 'Notificações', icon: Bell },
        ],
      },
    ]
  }
  const root = role === 'coach' ? '/treinador' : '/atleta'
  return [
    {
      id: 'principal',
      label: 'Principal',
      icon: LayoutGrid,
      items: [
        { to: root, label: 'Início', icon: LayoutGrid },
        {
          to: role === 'coach' ? '/treinador/alunos' : '/atleta/descobrir',
          label: 'Descobrir',
          icon: Search,
        },
        {
          to: role === 'coach' ? '/treinador/treinos' : '/atleta/treino',
          label: 'Meu treino',
          icon: Dumbbell,
        },
      ],
    },
    {
      id: 'social',
      label: 'Social',
      icon: Users,
      items: [
        { to: root + '/perfil', label: 'Perfil', icon: UserRound },
        {
          to: role === 'coach' ? '/treinador/conexoes' : '/atleta/conexoes',
          label: 'Minhas conexões',
          icon: HeartHandshake,
        },
        { to: root + '/mensagens', label: 'Mensagens', icon: MessageSquare },
      ],
    },
    {
      id: 'consultas',
      label: 'Consultas',
      icon: CalendarDays,
      items: [
        {
          to: role === 'coach' ? '/treinador/consultorias' : '/atleta/agenda',
          label: 'Agendas e consultorias',
          icon: CalendarDays,
        },
        { to: root + '/avaliacoes', label: 'Avaliações', icon: Star },
        { to: root + '/financeiro', label: 'Financeiro', icon: Wallet },
      ],
    },
  ]
}

interface VisualSpec {
  tag: string
  title: string
  subtitle: string
  PrimaryIcon: typeof Dumbbell
  SecondaryIcon: typeof Trophy
  metrics: { label: string; value: string }[]
}

function getVisualSpec(pathname: string, role: Role): VisualSpec {
  if (pathname.includes('/treino')) {
    return {
      tag: 'Centro de Performance',
      title: 'Periodização & Execução',
      subtitle: 'Blocos técnicos detalhados, percepção de esforço e vídeos de correção.',
      PrimaryIcon: Dumbbell,
      SecondaryIcon: Flame,
      metrics: [
        { label: 'Zona alvo', value: 'Z4 · Alta' },
        { label: 'Foco do ciclo', value: 'Evolução' },
        { label: 'Registro', value: 'Bloco a bloco' },
      ],
    }
  }
  if (pathname.includes('/perfil')) {
    return {
      tag: 'Identidade Esportiva',
      title: 'Bio & Credenciais',
      subtitle: 'Seus objetivos, modalidades e horários calibrados para conexões ideais.',
      PrimaryIcon: UserRound,
      SecondaryIcon: Award,
      metrics: [
        { label: 'Visibilidade', value: 'Ativa' },
        { label: 'Match Score', value: 'Otimizado' },
        { label: 'Segurança', value: 'Verificada' },
      ],
    }
  }
  if (pathname.includes('/conexoes') || pathname.includes('/alunos')) {
    return {
      tag: 'Rede de Vínculos',
      title: 'Parceria em Movimento',
      subtitle: 'Acompanhamento contínuo, histórico preservado e evolução compartilhada.',
      PrimaryIcon: HeartHandshake,
      SecondaryIcon: Users,
      metrics: [
        { label: 'Ciclo ativo', value: 'Contínuo' },
        { label: 'Canal direto', value: 'Liberado' },
        { label: 'Histórico', value: 'Protegido' },
      ],
    }
  }
  if (pathname.includes('/mensagens')) {
    return {
      tag: 'Comunicação Direta',
      title: 'Canal Atleta & Treinador',
      subtitle: 'Mensagens instantâneas, vídeos de execução e ajustes de carga com criptografia.',
      PrimaryIcon: MessageSquare,
      SecondaryIcon: Sparkles,
      metrics: [
        { label: 'Tempo real', value: 'WebSocket' },
        { label: 'Mídia privada', value: 'Cifrada' },
        { label: 'Status', value: 'Online' },
      ],
    }
  }
  if (pathname.includes('/avaliacoes')) {
    return {
      tag: 'Reputação Verificada',
      title: 'Feedbacks Reais',
      subtitle: 'Avaliações exclusivas de vínculos comprovados com direito de resposta.',
      PrimaryIcon: Star,
      SecondaryIcon: Trophy,
      metrics: [
        { label: 'Autenticidade', value: 'Por vínculo' },
        { label: 'Moderação', value: 'Auditada' },
        { label: 'Transparência', value: 'Total' },
      ],
    }
  }
  if (pathname.includes('/financeiro')) {
    return {
      tag: 'Gestão Financeira',
      title: 'Planos & Assinaturas',
      subtitle: 'Controle transparente de mensalidades, repasses e histórico de operações.',
      PrimaryIcon: Wallet,
      SecondaryIcon: TrendingUp,
      metrics: [
        { label: 'Ambiente', value: 'Protegido' },
        { label: 'Conciliação', value: 'Automática' },
        { label: 'Vigência', value: 'Garantida' },
      ],
    }
  }
  if (pathname.includes('/notificacoes')) {
    return {
      tag: 'Central de Alertas',
      title: 'Rastreamento de Eventos',
      subtitle: 'Avisos imediatos sobre novos treinos, feedbacks, mensagens e agendamentos.',
      PrimaryIcon: Bell,
      SecondaryIcon: Sparkles,
      metrics: [
        { label: 'Entrega', value: 'Instantânea' },
        { label: 'Histórico', value: 'Completo' },
        { label: 'Prioridade', value: 'Alta' },
      ],
    }
  }
  if (pathname.includes('/privacidade')) {
    return {
      tag: 'Proteção de Dados',
      title: 'Governança & LGPD',
      subtitle: 'Controle granular de consentimentos, exportação JSON e proteção AES.',
      PrimaryIcon: Shield,
      SecondaryIcon: ShieldCheck,
      metrics: [
        { label: 'Criptografia', value: 'AES-GCM' },
        { label: 'Portabilidade', value: 'JSON' },
        { label: 'Controle', value: 'Titular' },
      ],
    }
  }
  return {
    tag: role === 'coach' ? 'Comando Técnico' : 'Jornada Esportiva',
    title: role === 'coach' ? 'Gestão de Alta Performance' : 'Evolução Diária Guiada',
    subtitle:
      role === 'coach'
        ? 'Visão integrada da sua carteira de atletas, prescrições e resultados.'
        : 'Seu painel completo de treinos, métricas e contato direto com seu treinador.',
    PrimaryIcon: Dumbbell,
    SecondaryIcon: Trophy,
    metrics: [
      { label: 'Ritmo atual', value: 'Constante' },
      { label: 'Acompanhamento', value: '100% Ativo' },
      { label: 'Próxima meta', value: 'Superação' },
    ],
  }
}

export function AppShell({
  children,
  role,
}: {
  children: ReactNode
  role: Role
}) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [openMobile, setOpenMobile] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [openSettings, setOpenSettings] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileTrigger = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')

  const groups = getGroups(role)
  const root = role === 'admin' ? '/admin' : role === 'coach' ? '/treinador' : '/atleta'
  const allItems = [
    ...groups.flatMap((g) => g.items),
    { to: root + '/notificacoes', label: 'Notificações', icon: Bell },
    { to: root + '/privacidade', label: 'Privacidade', icon: Shield },
  ]

  useEffect(() => {
    setOpenSettings(false)
    setProfileOpen(false)
  }, [location.pathname, role])

  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenGroup(null)
        setOpenMobile(false)
        setOpenSettings(false)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  async function exit() {
    setError('')
    try {
      await logout()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao sair.')
    }
  }

  const initial = Array.from(user?.name.trim() || '')[0]?.toLocaleUpperCase('pt-BR') || 'L'

  const currentTitle =
    allItems.find((i) => i.to === location.pathname)?.label || 'LinkAtletas'
  const visual = getVisualSpec(location.pathname, role)
  const reviewsPage = /^\/(?:atleta|treinador)\/avaliacoes\/?$/i.test(location.pathname)
  const agenda = /^\/(?:atleta\/(?:agenda|treino)|treinador\/(?:agenda|consultorias|treinos))\/?$/i.test(location.pathname)
  // Perfil: cabeçalho próprio ocupa a largura toda, sem o card visual lateral
  const profilePage = /^\/(?:atleta|treinador)\/perfil\/?$/i.test(location.pathname)
  const connectionsPage = /^\/(?:atleta\/conexoes|treinador\/(?:conexoes|alunos))\/?$/i.test(location.pathname)
  // Privacidade: central em largura total (cards de categoria + acordeão), sem card lateral genérico
  const privacyPage = /^\/(?:atleta|treinador)\/privacidade\/?$/i.test(location.pathname)
  // Administrador: todas as rotas usam espaço completo com painéis operacionais reais
  const adminPage = role === 'admin'
  const { PrimaryIcon, SecondaryIcon } = visual
  // Tela "Início": card de próxima consulta + layout alinhado
  const isHome = location.pathname.replace(/\/+$/, '') === root && role !== 'admin'
  // Tela "Financeiro": card lateral dinâmico de resumo do ciclo / repasse
  const isFinance = /^\/(?:atleta|treinador)\/financeiro\/?$/i.test(location.pathname)

  return (
    <div
      className={`app-shell neo-shell app-shell--${role === 'athlete' ? 'athlete' : 'coach'}`}
    >
      <aside
        id="application-sidebar"
        className={`sidebar neo-rail ${openMobile ? 'sidebar--open' : ''}`}
      >
        <div className="neo-rail__top">
          <NavLink to={root} className="neo-brand-link" aria-label="LinkAtletas Início">
            <Logo light />
          </NavLink>
          <button
            className="icon-button sidebar__close"
            aria-label="Fechar menu"
            onClick={() => setOpenMobile(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="neo-rail__nav" aria-label="Navegação principal">
          {groups.map((group) => {
            const GroupIcon = group.icon
            const isExpanded = openGroup === group.id
            const hasActiveChild = group.items.some(
              (i) => i.to === location.pathname,
            )
            return (
              <div
                key={group.id}
                className={`neo-group ${isExpanded ? 'is-open' : ''} ${hasActiveChild ? 'has-active' : ''}`}
              >
                <button
                  type="button"
                  className={`neo-nav-toggle ${hasActiveChild && !isExpanded ? 'neo-nav-toggle--active' : ''}`}
                  aria-expanded={isExpanded}
                  aria-label={group.label}
                  aria-controls={`nav-branch-${group.id}`}
                  onClick={() =>
                    setOpenGroup((prev) => (prev === group.id ? null : group.id))
                  }
                >
                  <GroupIcon size={18} aria-hidden="true" />
                  <span>{group.label}</span>
                  <ChevronDown size={15} className="neo-nav-chevron" aria-hidden="true" />
                </button>
                <div id={`nav-branch-${group.id}`} className="neo-branch" aria-hidden={!isExpanded} inert={!isExpanded}>
                  <div className="neo-branch__clip">
                    <div className="neo-branch__card">
                      {group.items.map(({ to, label }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end
                          className={({ isActive }) =>
                            `neo-nav-link ${isActive ? 'neo-nav-link--active' : ''}`
                          }
                        >
                          <span>{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="neo-rail__bottom">
          <button
            onClick={exit}
            className="neo-nav-logout"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {openMobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <div className={'app-main neo-main' + (role === 'athlete' ? ' neo-main--fixed' : '')}>
        <header className="app-header neo-header">
          <div className="neo-header__left">
            <button
              className="icon-button app-header__menu"
              aria-label="Abrir menu"
              aria-expanded={openMobile}
              aria-controls="application-sidebar"
              onClick={() => setOpenMobile(true)}
            >
              <Menu />
            </button>
            <div>
              <span className="app-header__kicker">Conecte. Treine. Evolua.</span>
              <h1>{currentTitle}</h1>
            </div>
          </div>

          <div className="neo-header__right">
            <div className="neo-settings-wrap">
              <button
                type="button"
                className={`neo-settings-btn ${openSettings || location.pathname.includes('/notificacoes') || location.pathname.includes('/privacidade') ? 'is-active' : ''}`}
                aria-label="Configurações"
                aria-expanded={openSettings}
                onClick={() => setOpenSettings((v) => !v)}
              >
                <Settings size={20} />
              </button>
              {openSettings && (
                <div className="neo-settings-menu" role="menu">
                  <span className="neo-settings-menu__title">Configurações</span>
                  <NavLink
                    to={root + '/notificacoes'}
                    className={({ isActive }) =>
                      `neo-settings-menu__item ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setOpenSettings(false)}
                  >
                    <Bell size={16} />
                    <div>
                      <strong>Notificações</strong>
                      <small>Alertas e avisos da conta</small>
                    </div>
                  </NavLink>
                  {role !== 'admin' ? (
                    <NavLink
                      to={root + '/privacidade'}
                      className={({ isActive }) =>
                        `neo-settings-menu__item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setOpenSettings(false)}
                    >
                      <Shield size={16} />
                      <div>
                        <strong>Privacidade</strong>
                        <small>Consentimentos, saúde e dados</small>
                      </div>
                    </NavLink>
                  ) : (
                    <NavLink
                      to="/admin/privacidade"
                      className={({ isActive }) =>
                        `neo-settings-menu__item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setOpenSettings(false)}
                    >
                      <Shield size={16} />
                      <div>
                        <strong>Privacidade</strong>
                        <small>Pedidos de exclusão</small>
                      </div>
                    </NavLink>
                  )}
                </div>
              )}
            </div>

            <div className="neo-profile-wrap">
            <button
              type="button"
              className="neo-user-pill"
              ref={profileTrigger}
              aria-label={`Visualizar perfil de ${user?.name || 'usuário'}`}
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
              aria-controls={profileOpen ? 'profile-preview' : undefined}
              onClick={() => {
                setProfileOpen(value => !value)
                setOpenSettings(false)
              }}
            >
              <span className="neo-user-pill__meta">
                <strong className="live-header-name">{user?.name}</strong>
                <span>
                  {role === 'admin'
                    ? 'Administrador'
                    : role === 'coach'
                      ? 'Especialista · Treinador'
                      : 'Atleta Performance'}
                </span>
              </span>
              <span className="live-avatar" aria-hidden="true">{initial}</span>
            </button>
            <AnimatePresence initial={false}>
              {profileOpen && user && <ProfilePreview user={user} anchorRef={profileTrigger} onClose={(restoreFocus = true) => {
                setProfileOpen(false)
                if (restoreFocus) profileTrigger.current?.focus({ preventScroll: true })
              }} />}
            </AnimatePresence>
            </div>
          </div>
        </header>

        <div className={'neo-workspace' + (location.pathname.includes('/mensagens') ? ' neo-workspace--wide' : '') + (reviewsPage || agenda || profilePage || privacyPage || connectionsPage || adminPage ? ' neo-workspace--content-columns' : '') + (profilePage ? ' neo-workspace--profile' : '') + (privacyPage ? ' neo-workspace--privacy' : '') + (location.pathname.includes('/mensagens') || profilePage || privacyPage ? '' : ' neo-workspace--doodles') + (isHome ? ' neo-workspace--home' : '')}>
          <main className="app-content neo-content">
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            {isHome && <ProfileCompletionNotice profileHref={root + '/perfil'} />}
            {children}
          </main>

          {!location.pathname.includes('/mensagens') && !reviewsPage && !agenda && !profilePage && !privacyPage && !connectionsPage && !adminPage && <aside className="neo-visual-stage" aria-label="Painel visual contextual">
            {location.pathname.endsWith('/descobrir') || location.pathname.endsWith('/descobrir/') ? <CoachMap /> : isHome ? <NextConsultationCard role={role} /> : isFinance ? <BillingStatusCard role={role} /> : (
            <div className="neo-visual-card">
              <div className="neo-visual-card__glow" aria-hidden="true" />
              <div className="neo-visual-card__top">
                <span className="neo-visual-tag">{visual.tag}</span>
                <span className="neo-visual-compass" aria-hidden="true">
                  <PrimaryIcon size={20} />
                </span>
              </div>

              <div className="neo-visual-art" aria-hidden="true">
                <svg
                  className="neo-visual-route"
                  viewBox="0 0 400 260"
                  fill="none"
                >
                  <path
                    d="M30 210 C 110 200, 120 110, 200 125 C 270 138, 280 55, 365 45"
                    stroke="rgba(215, 242, 102, 0.22)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M30 210 C 110 200, 120 110, 200 125 C 270 138, 280 55, 365 45"
                    stroke="#d7f266"
                    strokeWidth="4"
                    strokeDasharray="8 8"
                    strokeLinecap="round"
                  />
                  <circle cx="30" cy="210" r="8" fill="#d7f266" />
                  <circle
                    cx="200"
                    cy="125"
                    r="9"
                    fill="#182b23"
                    stroke="#d7f266"
                    strokeWidth="4"
                  />
                  <circle cx="365" cy="45" r="10" fill="#fff" />
                </svg>
                <PrimaryIcon className="neo-visual-watermark" />
                <SecondaryIcon className="neo-visual-watermark neo-visual-watermark--sec" />
              </div>

              <div className="neo-visual-copy">
                <h3>{visual.title}</h3>
                <p>{visual.subtitle}</p>
              </div>

              <div className="neo-visual-metrics">
                {visual.metrics.map((m) => (
                  <div key={m.label} className="neo-visual-metric">
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            )}
          </aside>}
        </div>
      </div>
    </div>
  )
}
