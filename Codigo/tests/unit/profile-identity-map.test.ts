import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
let app: FastifyInstance
// PNG 1x1 transparente
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function register(email: string, extra: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/native/register',
    headers: { origin },
    payload: { role: 'athlete', email, name: 'Atleta ' + email, password: 'SenhaTeste123!', ...extra },
  })
  return response
}
const call = (token: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: '/api' + url, headers: { origin, authorization: 'Bearer ' + token }, payload: payload as never })
function multipart(bytes: Buffer) {
  const boundary = '----la' + Date.now()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.png"\r\nContent-Type: image/png\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, type: `multipart/form-data; boundary=${boundary}` }
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'linkatletas-identity-'))
  pool = createPool('pglite:' + directory)
  await migrate(pool)
  app = await buildApp({ pool, origin })
})
afterAll(async () => {
  await app?.close()
  await pool?.end()
  if (directory) await rm(directory, { recursive: true, force: true })
})

describe('cadastro com política e consentimentos', () => {
  it('recusa cadastro sem aceitar a política', async () => {
    const response = await register('sem-politica@example.com')
    expect(response.statusCode, response.body).toBe(400)
  })
  it('grava cada consentimento conforme marcado', async () => {
    const response = await register('consente@example.com', {
      acceptPolicy: true,
      consents: { location: true, health: false },
    })
    expect(response.statusCode, response.body).toBe(201)
    const { rows } = await pool.query(
      'SELECT purpose,granted FROM consents WHERE user_id=$1 ORDER BY purpose',
      [response.json().user.id],
    )
    expect(rows).toEqual([
      { purpose: 'communications', granted: false },
      { purpose: 'health', granted: false },
      { purpose: 'location', granted: true },
      { purpose: 'performance', granted: false },
    ])
  })
})

describe('perfil e mapa', () => {
  let a: string
  let b: string
  let bId: string
  beforeAll(async () => {
    a = (await register('perfil-a@example.com', { acceptPolicy: true })).json().token
    const second = (await register('perfil-b@example.com', { acceptPolicy: true, consents: { location: true } })).json()
    b = second.token
    bId = second.user.id
  })

  it('salva nascimento, nacionalidade e medidas; ausentes mantêm o valor', async () => {
    const base = { name: 'Atleta A', city: '', bio: '', sports: [], goals: [], levels: [], availability: [], mode: 'online', budget: 0, price: 0 }
    let res = await call(a, 'PUT', '/profiles/me', { ...base, birthDate: '2000-02-29', nationality: 'BR', heightCm: 180, weightKg: 72.35 })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().profile).toMatchObject({ birthDate: '2000-02-29', nationality: 'BR', heightCm: 180, weightKg: 72.4 })
    res = await call(a, 'PUT', '/profiles/me', base)
    expect(res.json().profile).toMatchObject({ birthDate: '2000-02-29', heightCm: 180 })
    res = await call(a, 'PUT', '/profiles/me', { ...base, heightCm: 90 })
    expect(res.statusCode).toBe(400)
  })

  it('guarda a foto PNG no banco e recusa outros formatos', async () => {
    const ok = multipart(png)
    let res = await app.inject({ method: 'PUT', url: '/api/profiles/me/photo', headers: { origin, authorization: 'Bearer ' + a, 'content-type': ok.type }, payload: ok.body })
    expect(res.statusCode, res.body).toBe(200)
    const profile = res.json().profile
    expect(profile.photoUpdatedAt).toEqual(expect.any(String))
    res = await call(b, 'GET', `/profiles/${profile.userId}/photo`)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
    expect(res.rawPayload.equals(png)).toBe(true)
    const bad = multipart(Buffer.from('GIF89a not a png'))
    res = await app.inject({ method: 'PUT', url: '/api/profiles/me/photo', headers: { origin, authorization: 'Bearer ' + a, 'content-type': bad.type }, payload: bad.body })
    expect(res.statusCode).toBe(415)
  })

  it('mapa exige consentimento, arredonda a posição e some ao revogar', async () => {
    let res = await call(a, 'PUT', '/map/location', { lat: -23.55123, lon: -46.63399 })
    expect(res.statusCode).toBe(403)
    res = await call(b, 'PUT', '/map/location', { lat: -23.55123, lon: -46.63399 })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().location).toMatchObject({ lat: -23.55, lon: -46.63 })
    res = await call(a, 'GET', '/map/people')
    expect(res.json().people.map((p: { userId: string }) => p.userId)).toEqual([bId])
    await call(b, 'PUT', '/privacy/consents', { purpose: 'location', granted: false })
    res = await call(a, 'GET', '/map/people')
    expect(res.json().people).toEqual([])
    expect((await pool.query('SELECT 1 FROM user_locations WHERE user_id=$1', [bId])).rowCount).toBe(0)
  })
})
