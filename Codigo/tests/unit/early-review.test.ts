import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { interactionsRoutes } from '../../server/modules/interactions.js'
import { installErrors } from '../../server/shared/errors.js'

const athleteId = '11111111-1111-4111-8111-111111111111'
const contractId = '22222222-2222-4222-8222-222222222222'
const coachId = '33333333-3333-4333-8333-333333333333'
const reviewId = '44444444-4444-4444-8444-444444444444'

async function reviewRequest(confirmEarly?: unknown, options: { status?: string; member?: boolean; mature?: boolean } = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT athlete_id')) return { rows: options.member === false ? [] : [{ athlete_id: athleteId, coach_id: coachId, status: options.status || 'active', decided_at: new Date(Date.now() - (options.mature ? 10 : 0) * 86400_000) }] }
    if (sql.includes('LEFT JOIN billing_subscriptions')) return { rows: [{ status: 'active', verification_status: 'approved' }] }
    if (sql.startsWith('INSERT INTO reviews')) return { rowCount: 1, rows: [{ id: reviewId }] }
    if (sql.includes('FROM reviews r JOIN')) return { rows: [{ id: reviewId, coachId, athleteId, rating: 5, text: 'Primeiras impressões.' }] }
    if (sql.startsWith('INSERT INTO notifications')) return { rows: [{ id: 'notification-1' }] }
    return { rows: [], rowCount: 0 }
  })
  const pool = { query, connect: async () => ({ query, release() {} }) } as unknown as Pool
  const app = Fastify({ ajv: { customOptions: { coerceTypes: false } } })
  installErrors(app)
  app.decorateRequest('user', null)
  app.addHook('preHandler', async (req) => {
    req.user = { id: athleteId, name: 'Marina', email: 'marina@example.com', role: 'athlete' }
  })
  await app.register(websocket)
  await interactionsRoutes(app, pool)
  try {
    const response = await app.inject({ method: 'POST', url: '/reviews', payload: { contractId, rating: 5, text: 'Primeiras impressões.', ...(confirmEarly === undefined ? {} : { confirmEarly }) } })
    return { status: response.statusCode, body: response.json(), inserted: query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO reviews')) }
  } finally {
    await app.close()
  }
}

describe('confirmação de avaliação antecipada', () => {
  it.each([undefined, false])('recusa sem confirmação explícita: %s', async (confirmation) => {
    const response = await reviewRequest(confirmation)
    expect(response).toMatchObject({ status: 403, body: { code: 'REVIEW_TOO_EARLY' }, inserted: false })
    expect(response.body.message).toContain('dias de acompanhamento')
  })
  it('publica com confirmação explícita', async () => {
    expect(await reviewRequest(true)).toMatchObject({ status: 201, inserted: true })
  })
  it('mantém publicação sem confirmação após o período recomendado', async () => {
    expect(await reviewRequest(undefined, { mature: true })).toMatchObject({ status: 201, inserted: true })
  })
  it('recusa confirmação enviada como texto', async () => {
    expect(await reviewRequest('true')).toMatchObject({ status: 400, inserted: false })
  })
  it('confirmação não permite avaliar vínculo de outra pessoa ou encerrado', async () => {
    expect(await reviewRequest(true, { member: false })).toMatchObject({ status: 404, inserted: false })
    expect(await reviewRequest(true, { status: 'cancelled' })).toMatchObject({ status: 403, body: { code: 'INACTIVE_CONTRACT' }, inserted: false })
  })
})
