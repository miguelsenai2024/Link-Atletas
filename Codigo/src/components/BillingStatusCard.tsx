import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Percent,
  Wallet,
} from 'lucide-react'
import type { Role } from '../../shared/contracts'
import type {
  BillingConfig,
  BillingPlan,
  BillingState,
  BillingSubscription,
  BillingSummary,
  BillingWallet,
} from '../../shared/billing-contracts'
import { money, useRemote } from '../pages/integrated/common'

export const BILLING_UPDATED_EVENT = 'linkatletas:billing-updated'

export function notifyBillingUpdated() {
  window.dispatchEvent(new Event(BILLING_UPDATED_EVENT))
}

const STATE_LABELS: Record<BillingState, string> = {
  regular: 'Em dia',
  grace: 'Em carência',
  awaiting_payment: 'Aguardando pagamento',
  suspended: 'Suspensa',
  cancellation_requested: 'Cancelamento solicitado',
  ended: 'Encerrada',
  uncertain: 'Em conferência',
}

function formatDayShort(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(iso))
    .replace('.', '')
    .replace(' de ', ' ')
}

function formatFullDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function pickPrimarySubscription(list: BillingSubscription[]): BillingSubscription | null {
  const active = list.filter((s) => s.state !== 'ended')
  if (!active.length) return null
  const urgent = active.find((s) => s.state === 'grace' || s.state === 'suspended')
  if (urgent) return urgent
  const awaiting = active.find((s) => s.state === 'awaiting_payment')
  if (awaiting) return awaiting
  return [...active].sort((a, b) => {
    const da = a.paidUntil ? new Date(a.paidUntil).getTime() : Number.MAX_SAFE_INTEGER
    const db = b.paidUntil ? new Date(b.paidUntil).getTime() : Number.MAX_SAFE_INTEGER
    return da - db
  })[0]
}

/** Card lateral da tela Financeiro: resumo dinâmico do ciclo (atleta) ou repasse (treinador). */
export function BillingStatusCard({ role }: { role: Role }) {
  return role === 'coach' ? <CoachBillingCard /> : <AthleteBillingCard />
}

function AthleteBillingCard() {
  const summary = useRemote<BillingSummary>('/billing/summary')

  useEffect(() => {
    const onUpdate = () => void summary.reload()
    window.addEventListener(BILLING_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(BILLING_UPDATED_EVENT, onUpdate)
  }, [summary.reload])

  const subscriptions = summary.data?.subscriptions || []
  const activeSubs = subscriptions.filter((s) => s.state !== 'ended')
  const primary = pickPrimarySubscription(subscriptions)
  const pendingCheckout = activeSubs.find(
    (s) => s.state === 'awaiting_payment' && s.checkoutUrl,
  )
  const monthlyCommittedCents = activeSubs.reduce((sum, s) => sum + s.amountCents, 0)
  const isGrace = primary?.state === 'grace'
  const isSuspended = primary?.state === 'suspended'
  const isWarning = isGrace || isSuspended

  return (
    <div className={'neo-visual-card next-consult billing-status' + (isWarning ? ' billing-status--warn' : '')}>
      <div className="neo-visual-card__glow" aria-hidden="true" />
      <div className="neo-visual-card__top">
        <span className="neo-visual-tag">
          {isGrace ? 'Alerta de carência' : 'Resumo do ciclo'}
        </span>
        <span className="neo-visual-compass" aria-hidden="true">
          {isWarning ? <AlertTriangle size={20} /> : <Wallet size={20} />}
        </span>
      </div>

      {summary.loading && !summary.data ? (
        <p className="next-consult__muted">Carregando resumo financeiro…</p>
      ) : summary.error ? (
        <div className="next-consult__empty">
          <p className="next-consult__muted">Não foi possível carregar suas assinaturas.</p>
          <button
            type="button"
            className="button button--outline"
            onClick={() => void summary.reload()}
          >
            Tentar novamente
          </button>
        </div>
      ) : primary ? (
        <div className="next-consult__body">
          <div className="next-consult__date billing-status__date">
            <small className="billing-status__kicker">
              {isGrace && primary.graceUntil
                ? 'Carência até'
                : primary.state === 'regular' && primary.nextChargeAt
                  ? `Próxima cobrança · ${money((primary.nextChargeCents ?? primary.amountCents) / 100)}`
                  : primary.paidUntil
                  ? 'Vigência atual até'
                  : primary.state === 'awaiting_payment'
                    ? 'Cobrança pendente'
                    : 'Ciclo atual'}
            </small>
            <strong>
              {isGrace && primary.graceUntil
                ? formatDayShort(primary.graceUntil)
                : primary.paidUntil
                  ? formatDayShort(primary.paidUntil)
                  : money(primary.amountCents / 100)}
            </strong>
            <span>
              {isGrace && primary.graceUntil
                ? `Regularize até ${formatFullDate(primary.graceUntil)}`
                : primary.paidUntil
                  ? formatFullDate(primary.paidUntil)
                  : STATE_LABELS[primary.state]}
            </span>
          </div>

          <div className="next-consult__info">
            <small>{primary.planName}</small>
            <h3>{primary.coachName}</h3>
            <p>
              {activeSubs.length > 1
                ? `${activeSubs.length} assinaturas ativas no ciclo atual.`
                : 'Acompanhamento mensal vinculado à sua conta.'}
            </p>
          </div>

          <div className="billing-status__metrics">
            <div className="neo-visual-metric">
              <span>Valor mensal</span>
              <strong>{money(monthlyCommittedCents / 100)}</strong>
            </div>
            <div className="neo-visual-metric">
              <span>Status</span>
              <strong>{STATE_LABELS[primary.state]}</strong>
            </div>
          </div>

          <div className="next-consult__actions">
            {pendingCheckout?.checkoutUrl ? (
              <a
                className="button button--dark"
                href={pendingCheckout.checkoutUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir fatura / checkout <ExternalLink size={15} aria-hidden="true" />
              </a>
            ) : primary.checkoutUrl && isWarning ? (
              <a
                className="button button--dark"
                href={primary.checkoutUrl}
                target="_blank"
                rel="noreferrer"
              >
                Regularizar fatura <ExternalLink size={15} aria-hidden="true" />
              </a>
            ) : (
              <a className="button button--outline" href="#iniciar-assinatura">
                Gerenciar assinaturas
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="next-consult__empty">
          <h3>Nenhuma assinatura ativa.</h3>
          <p className="next-consult__muted">
            Quando você contratar um treinador, o próximo vencimento e o valor mensal aparecem aqui.
          </p>
          <div className="next-consult__actions">
            <a className="button button--dark" href="#iniciar-assinatura">
              Iniciar assinatura
            </a>
            <NavLink className="button button--outline" to="/atleta/descobrir">
              Encontrar treinador
            </NavLink>
          </div>
        </div>
      )}
    </div>
  )
}

function CoachBillingCard() {
  const summary = useRemote<BillingSummary>('/billing/summary')
  const config = useRemote<BillingConfig>('/billing/config')
  const plan = useRemote<{ plan: BillingPlan | null }>('/billing/plan')
  const wallet = useRemote<{ wallet: BillingWallet | null }>('/billing/wallet')

  useEffect(() => {
    const onUpdate = () => {
      void summary.reload()
      void plan.reload()
      void wallet.reload()
    }
    window.addEventListener(BILLING_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(BILLING_UPDATED_EVENT, onUpdate)
  }, [summary.reload, plan.reload, wallet.reload])

  const loading =
    (summary.loading && !summary.data) ||
    (config.loading && !config.data) ||
    (plan.loading && !plan.data) ||
    (wallet.loading && !wallet.data)
  const failed = summary.error || config.error

  const commissionBps = config.data?.commissionBps ?? 1500
  const commissionPct = (commissionBps / 100).toFixed(2).replace('.', ',')
  const coachSharePct = ((10000 - commissionBps) / 100).toFixed(2).replace('.', ',')

  const activeSubs = (summary.data?.subscriptions || []).filter((s) => s.state !== 'ended')
  const activeGrossCents = activeSubs.reduce((sum, s) => sum + s.amountCents, 0)
  const activeNetCents = activeSubs.reduce(
    (sum, s) => sum + Math.round((s.amountCents * (10000 - s.commissionBps)) / 10000),
    0,
  )

  const currentPlan = plan.data?.plan || null
  const planNetCents = currentPlan
    ? Math.round((currentPlan.amountCents * (10000 - commissionBps)) / 10000)
    : 0

  const hasWallet = Boolean(wallet.data?.wallet?.walletId)
  const planActive = Boolean(currentPlan?.active)
  const needsSetup = !hasWallet || !currentPlan

  return (
    <div className="neo-visual-card next-consult billing-status">
      <div className="neo-visual-card__glow" aria-hidden="true" />
      <div className="neo-visual-card__top">
        <span className="neo-visual-tag">Resumo de repasse</span>
        <span className="neo-visual-compass" aria-hidden="true">
          <Wallet size={20} />
        </span>
      </div>

      {loading ? (
        <p className="next-consult__muted">Carregando resumo de repasse…</p>
      ) : failed ? (
        <div className="next-consult__empty">
          <p className="next-consult__muted">Não foi possível carregar os dados de repasse.</p>
          <button
            type="button"
            className="button button--outline"
            onClick={() => {
              void summary.reload()
              void config.reload()
              void plan.reload()
              void wallet.reload()
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="next-consult__body">
          <div className="next-consult__date billing-status__date">
            <small className="billing-status__kicker">
              {activeSubs.length > 0
                ? 'Líquido mensal estimado'
                : currentPlan
                  ? 'Líquido estimado por aluno'
                  : 'Repasse líquido estimado'}
            </small>
            <strong>
              {activeSubs.length > 0
                ? money(activeNetCents / 100)
                : money(planNetCents / 100)}
            </strong>
            <span>
              {activeSubs.length > 0
                ? `${money(activeGrossCents / 100)} bruto · ${activeSubs.length} ${activeSubs.length === 1 ? 'aluno ativo' : 'alunos ativos'}`
                : currentPlan
                  ? `Plano de ${money(currentPlan.amountCents / 100)}/mês (${coachSharePct}% seu)`
                  : 'Configure seu plano mensal para calcular o repasse'}
            </span>
          </div>

          <ul className="billing-status__checklist" aria-label="Status do repasse">
            <li>
              <Percent size={15} aria-hidden="true" />
              <span>Taxa da plataforma</span>
              <strong>{commissionPct}%</strong>
            </li>
            <li className={hasWallet ? 'is-ok' : 'is-pending'}>
              {hasWallet ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : (
                <Clock3 size={15} aria-hidden="true" />
              )}
              <span>Carteira Asaas</span>
              <strong>{hasWallet ? 'Conectada' : 'Pendente'}</strong>
            </li>
            <li className={planActive ? 'is-ok' : 'is-pending'}>
              {planActive ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : (
                <Clock3 size={15} aria-hidden="true" />
              )}
              <span>Plano mensal</span>
              <strong>
                {!currentPlan
                  ? 'Não configurado'
                  : planActive
                    ? 'Ativo para novos alunos'
                    : 'Pausado'}
              </strong>
            </li>
          </ul>

          <div className="next-consult__actions">
            <a
              className={needsSetup ? 'button button--dark' : 'button button--outline'}
              href="#configurar-acompanhamento"
            >
              {needsSetup ? 'Configurar recebimento' : 'Editar plano e carteira'}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
