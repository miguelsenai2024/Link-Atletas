import Fastify from 'fastify'
import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { profilesRoutes } from '../../server/modules/profiles.js'
import { installErrors } from '../../server/shared/errors.js'
import { installResponseDocs } from '../../server/shared/openapi.js'

const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Marina Costa', email: 'marina@example.com', role: 'athlete' as const }

async function request(options: { anonymous?: boolean; missing?: boolean } = {}) {
  const query = vi.fn().mockResolvedValue({ rows: options.missing ? [] : [{ name: user.name, bio: 'Corrida e constância.', consultedCoaches: 2, email: user.email }] })
  const app = Fastify()
  installErrors(app)
  installResponseDocs(app)
  app.decorateRequest('user', null)
  app.addHook('preHandler', async req => { req.user = options.anonymous ? null : user })
  await profilesRoutes(app, { query } as unknown as Pool)
  try {
    const response = await app.inject('/profiles/me/preview?userId=outra-pessoa')
    return { status: response.statusCode, body: response.json(), query }
  } finally {
    await app.close()
  }
}

describe('visualização do próprio perfil', () => {
  it('usa a conta autenticada e retorna somente os dados do card', async () => {
    const result = await request()
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ preview: { name: user.name, bio: 'Corrida e constância.', consultedCoaches: 2 } })
    expect(result.query.mock.calls[0][1]).toEqual([user.id])
  })

  it('exige autenticação antes de consultar os dados', async () => {
    const result = await request({ anonymous: true })
    expect(result.status).toBe(401)
    expect(result.query).not.toHaveBeenCalled()
  })

  it('não substitui uma conta ausente por dados fictícios', async () => {
    const result = await request({ missing: true })
    expect(result.status).toBe(404)
    expect(result.body.code).toBe('NOT_FOUND')
  })
})

