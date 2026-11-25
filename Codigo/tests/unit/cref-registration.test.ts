import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../server/app.js'
import { createPool } from '../../server/db/pool.js'
import { migrate } from '../../server/db/migrate.js'

const origin = 'http://localhost:5173'
let directory: string
let pool: ReturnType<typeof createPool>
const lookup = vi.fn(async (cref: string) => {
  if (cref === '000002-G/SP') throw new Error('Serviço indisponível')
  return cref === '000001-G/SP' ? ['JOÃO DA SILVA'] : []
})
let app: FastifyInstance
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'linkatletas-cref-'))
  pool = createPool('pglite:' + directory)
  await migrate(pool)
  app = await buildApp({ pool, origin, lookupCref: lookup })
})
afterAll(async () => {
  await app?.close()
  await pool?.end()
  if (directory) await rm(directory, { recursive: true, force: true })
})

describe('CREF no cadastro', () => {
  it.each([
    ['/api/auth/register', '', 'João da Silva', 422, 'CREF_INVALID'],
    ['/api/auth/native/register', '1-G/SP', 'Outro Nome', 422, 'CREF_NAME_MISMATCH'],
    ['/api/auth/register', '3-G/SP', 'João da Silva', 422, 'CREF_NOT_CONFIRMED'],
    ['/api/auth/native/register', '2-G/SP', 'João da Silva', 503, 'CREF_UNAVAILABLE'],
  ] as const)('bloqueia %s com CREF %s e nome %s', async (url, cref, name, status, code) => {
    const email = code.toLowerCase() + '@example.com'
    const response = await app.inject({
      method: 'POST', url, headers: { origin },
      payload: { acceptPolicy: true, role: 'coach', email, name, password: 'SenhaTeste123!', ...(cref ? { cref } : {}) },
    })
    expect(response.statusCode, response.body).toBe(status)
    expect(response.json().code).toBe(code)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows).toEqual([])
  })

  it('grava o CREF normalizado sem aprovar o perfil automaticamente', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/auth/native/register', headers: { origin },
      payload: { acceptPolicy: true, role: 'coach', email: 'coach@example.com', name: 'João da Silva', password: 'SenhaTeste123!', cref: 'CREF 1-g/sp' },
    })
    expect(response.statusCode, response.body).toBe(201)
    expect(response.json().token).toEqual(expect.any(String))
    const { rows } = await pool.query('SELECT cref, verification_status FROM profiles WHERE user_id=$1', [response.json().user.id])
    expect(rows[0]).toMatchObject({ cref: '000001-G/SP' })
    expect(rows[0].verification_status).not.toBe('approved')
  })

  it('cadastra atleta sem consultar CREF', async () => {
    const calls = lookup.mock.calls.length
    const response = await app.inject({
      method: 'POST', url: '/api/auth/register', headers: { origin },
      payload: { acceptPolicy: true, role: 'athlete', email: 'athlete@example.com', name: 'Atleta Teste', password: 'SenhaTeste123!' },
    })
    expect(response.statusCode, response.body).toBe(201)
    expect(lookup.mock.calls).toHaveLength(calls)
  })
})
