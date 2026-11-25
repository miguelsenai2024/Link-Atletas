import pg from 'pg'
import { expect, it } from 'vitest'
import { buildApp } from '../../server/app.js'
import { createPool } from '../../server/db/pool.js'

it('reports an unavailable PostgreSQL URL without switching to the local database', async () => {
  const pool = createPool('postgresql://test:test@127.0.0.1:1/linkatletas_test')
  expect(pool.constructor).toBe(pg.Pool)
  try {
    const app = await buildApp({ pool })
    try {
      const response = await app.inject('/api/health')
      expect(response.statusCode).toBe(503)
      expect(response.json().code).toBe('DATABASE_UNAVAILABLE')
    } finally {
      await app.close()
    }
  } finally {
    await pool.end()
  }
})
