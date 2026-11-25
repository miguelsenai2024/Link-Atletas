import type { FastifyInstance } from 'fastify'
import type { Pool, PoolClient } from 'pg'
import type { Profile, ProfilePreview } from '../../shared/contracts.js'
import { transaction } from '../db/pool.js'
import { fail } from '../shared/errors.js'
import { requireUser } from '../shared/security.js'
import { bodySchema, idSchema, profileSchema } from '../shared/validation.js'

export const profileSelect = `SELECT u.id AS "userId",u.role,u.name,u.email,p.city,p.bio,p.sports,p.goals,p.levels,
 p.availability,p.mode,p.budget::float8,p.price::float8,p.cref,p.verification_status AS "verificationStatus",
 p.verification_reason AS "verificationReason",p.verification_expires_at AS "verificationExpiresAt",
 to_char(p.birth_date,'YYYY-MM-DD') AS "birthDate",p.nationality,p.height_cm AS "heightCm",p.weight_kg::float8 AS "weightKg",
 u.created_at AS "memberSince",p.photo_updated_at AS "photoUpdatedAt" FROM users u JOIN profiles p ON p.user_id=u.id`
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PHOTO_MAX = 2 * 1024 * 1024
export async function profileFor(
  pool: Pool | PoolClient,
  id: string,
): Promise<Profile> {
  const { rows } = await pool.query<Profile>(`${profileSelect} WHERE u.id=$1`, [
    id,
  ])
  if (!rows[0]) fail(404, 'NOT_FOUND', 'Perfil não encontrado.')
  return rows[0]
}
export async function profilesRoutes(app: FastifyInstance, pool: Pool) {
  app.get(
    '/profiles/me/preview',
    {
      schema: {
        tags: ['Perfis'],
        summary: 'Visualizar meu perfil e o total de treinadores consultados',
        response: {
          200: {
            type: 'object',
            required: ['preview'],
            properties: {
              preview: {
                type: 'object',
                required: ['name', 'bio', 'consultedCoaches'],
                properties: {
                  name: { type: 'string' },
                  bio: { type: 'string' },
                  consultedCoaches: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const user = requireUser(req)
      const { rows } = await pool.query<ProfilePreview>(
        `SELECT u.name,COALESCE(p.bio,'') AS bio,
          (SELECT COUNT(DISTINCT c.coach_id)::int
           FROM consultations x JOIN contracts c ON c.id=x.contract_id
           WHERE c.athlete_id=u.id AND x.status='completed') AS "consultedCoaches"
         FROM users u LEFT JOIN profiles p ON p.user_id=u.id
         WHERE u.id=$1 AND u.disabled_at IS NULL`,
        [user.id],
      )
      if (!rows[0]) fail(404, 'NOT_FOUND', 'Perfil não encontrado.')
      return { preview: rows[0] }
    },
  )
  app.get(
    '/profiles/me',
    { schema: { tags: ['Perfis'], summary: 'Consultar meu perfil' } },
    async (req) => ({ profile: await profileFor(pool, requireUser(req).id) }),
  )
  app.put(
    '/profiles/me',
    {
      schema: {
        tags: ['Perfis'],
        summary: 'Atualizar preferências e dados de perfil',
        body: bodySchema(profileSchema),
      },
    },
    async (req) => {
      const user = requireUser(req)
      if (user.role === 'admin')
        fail(403, 'FORBIDDEN', 'Administrador não possui perfil esportivo.')
      const p = profileSchema.parse(req.body)
      for (const values of [p.sports, p.goals, p.levels, p.availability]) {
        if (new Set(values).size !== values.length)
          fail(
            400,
            'VALIDATION',
            'As opções do perfil não podem estar repetidas.',
          )
      }
      await transaction(pool, async (client) => {
        const account = await client.query(
          'UPDATE users SET name=$1 WHERE id=$2 AND disabled_at IS NULL RETURNING id',
          [p.name, user.id],
        )
        if (!account.rowCount)
          fail(401, 'UNAUTHENTICATED', 'Esta conta foi encerrada.')
        // Campo ausente mantém o valor salvo; null apaga.
        const keep = (v: unknown) => v === undefined
        await client.query(
          `UPDATE profiles SET city=$1,bio=$2,sports=$3,goals=$4,levels=$5,availability=$6,
        mode=$7,budget=$8,price=$9,
        birth_date=CASE WHEN $11 THEN birth_date ELSE $12::date END,
        nationality=CASE WHEN $13 THEN nationality ELSE $14 END,
        height_cm=CASE WHEN $15 THEN height_cm ELSE $16::smallint END,
        weight_kg=CASE WHEN $17 THEN weight_kg ELSE $18::numeric END
        WHERE user_id=$10`,
          [
            p.city,
            p.bio,
            p.sports,
            p.goals,
            p.levels,
            p.availability,
            p.mode,
            p.budget,
            p.price,
            user.id,
            keep(p.birthDate),
            p.birthDate ?? null,
            keep(p.nationality),
            p.nationality ?? null,
            keep(p.heightCm),
            p.heightCm ?? null,
            keep(p.weightKg),
            p.weightKg == null ? null : Math.round(p.weightKg * 10) / 10,
          ],
        )
      })
      return { profile: await profileFor(pool, user.id) }
    },
  )
  app.put(
    '/profiles/me/photo',
    {
      schema: {
        tags: ['Perfis'],
        summary: 'Enviar foto de perfil recortada (PNG até 2 MB, multipart)',
      },
    },
    async (req) => {
      const user = requireUser(req)
      if (user.role === 'admin')
        fail(403, 'FORBIDDEN', 'Administrador não possui perfil esportivo.')
      const file = await req.file({ limits: { fileSize: PHOTO_MAX } })
      if (!file) fail(400, 'VALIDATION', 'Envie a imagem da foto.')
      const bytes = await file.toBuffer().catch(() =>
        fail(413, 'TOO_LARGE', 'A foto precisa ter no máximo 2 MB.'),
      )
      if (bytes.length < PNG.length || !bytes.subarray(0, 8).equals(PNG))
        fail(415, 'UNSUPPORTED_MEDIA', 'A foto precisa estar em PNG.')
      await pool.query(
        'UPDATE profiles SET photo_png=$1,photo_updated_at=now() WHERE user_id=$2',
        [bytes, user.id],
      )
      return { profile: await profileFor(pool, user.id) }
    },
  )
  app.delete(
    '/profiles/me/photo',
    { schema: { tags: ['Perfis'], summary: 'Remover foto de perfil' } },
    async (req) => {
      const user = requireUser(req)
      await pool.query(
        'UPDATE profiles SET photo_png=NULL,photo_updated_at=NULL WHERE user_id=$1',
        [user.id],
      )
      return { profile: await profileFor(pool, user.id) }
    },
  )
  app.get<{ Params: { id: string } }>(
    '/profiles/:id/photo',
    {
      schema: {
        tags: ['Perfis'],
        summary: 'Foto de perfil (somente usuários autenticados)',
      },
    },
    async (req, reply) => {
      requireUser(req)
      const id = idSchema.parse(req.params.id)
      const { rows } = await pool.query<{ photo_png: Buffer | null }>(
        'SELECT p.photo_png FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1 AND u.disabled_at IS NULL',
        [id],
      )
      if (!rows[0]?.photo_png) fail(404, 'NOT_FOUND', 'Foto não encontrada.')
      return reply
        .header('content-type', 'image/png')
        .header('cache-control', 'private, max-age=86400')
        .header('x-content-type-options', 'nosniff')
        .send(rows[0].photo_png)
    },
  )
}
