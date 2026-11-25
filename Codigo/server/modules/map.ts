import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { MapPerson } from '../../shared/contracts.js'
import { transaction } from '../db/pool.js'
import { fail } from '../shared/errors.js'
import { requireUser } from '../shared/security.js'
import { bodySchema } from '../shared/validation.js'

const schema = { tags: ['Mapa'] }
const point = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
  })
  .strict()
// 2 casas decimais ≈ 1,1 km: o mapa nunca guarda nem expõe a posição exata.
const coarse = (value: number) => Math.round(value * 100) / 100

export async function mapRoutes(app: FastifyInstance, pool: Pool) {
  app.put(
    '/map/location',
    {
      schema: {
        ...schema,
        summary: 'Salvar minha localização aproximada (exige consentimento)',
        body: bodySchema(point),
      },
    },
    async (req) => {
      const user = requireUser(req)
      if (user.role === 'admin')
        fail(403, 'FORBIDDEN', 'Administrador não aparece no mapa.')
      const input = point.parse(req.body)
      const location = await transaction(pool, async (client) => {
        // FOR SHARE: uma revogação concorrente espera este salvamento terminar
        const consent = await client.query(
          "SELECT 1 FROM consents WHERE user_id=$1 AND purpose='location' AND granted=true FOR SHARE",
          [user.id],
        )
        if (!consent.rowCount)
          fail(
            403,
            'CONSENT_REQUIRED',
            'Autorize a localização aproximada em Privacidade para aparecer no mapa.',
          )
        return (
          await client.query(
            `INSERT INTO user_locations(user_id,lat,lon) VALUES($1,$2,$3)
             ON CONFLICT(user_id) DO UPDATE SET lat=EXCLUDED.lat,lon=EXCLUDED.lon,updated_at=now()
             RETURNING lat::float8,lon::float8,updated_at AS "updatedAt"`,
            [user.id, coarse(input.lat), coarse(input.lon)],
          )
        ).rows[0]
      })
      return { location }
    },
  )
  app.get(
    '/map/location',
    { schema: { ...schema, summary: 'Minha localização salva' } },
    async (req) => {
      const user = requireUser(req)
      return {
        location:
          (
            await pool.query(
              'SELECT lat::float8,lon::float8,updated_at AS "updatedAt" FROM user_locations WHERE user_id=$1',
              [user.id],
            )
          ).rows[0] ?? null,
      }
    },
  )
  app.delete(
    '/map/location',
    { schema: { ...schema, summary: 'Sair do mapa (apaga minha localização)' } },
    async (req) => {
      const user = requireUser(req)
      await pool.query('DELETE FROM user_locations WHERE user_id=$1', [user.id])
      return { ok: true }
    },
  )
  app.get(
    '/map/people',
    {
      schema: {
        ...schema,
        summary:
          'Atletas e treinadores que consentiram em aparecer no mapa (posição aproximada)',
      },
    },
    async (req) => {
      const user = requireUser(req)
      // Consentimento é conferido na leitura também: revogação some do mapa na hora.
      const { rows } = await pool.query<MapPerson>(
        `SELECT u.id AS "userId",u.role,u.name,p.city,p.sports,p.price::float8 AS price,
          l.lat::float8 AS lat,l.lon::float8 AS lon,p.photo_updated_at AS "photoUpdatedAt",
          (u.role='coach' AND p.verification_status='approved'
            AND (p.verification_expires_at IS NULL OR p.verification_expires_at>now())) AS verified
         FROM user_locations l
         JOIN users u ON u.id=l.user_id AND u.disabled_at IS NULL AND u.role IN ('athlete','coach')
         JOIN profiles p ON p.user_id=u.id
         JOIN consents c ON c.user_id=u.id AND c.purpose='location' AND c.granted=true
         WHERE u.id<>$1
         ORDER BY u.name
         LIMIT 500`,
        [user.id],
      )
      return { people: rows }
    },
  )
}
