import pg from 'pg'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { createPgConfig } from '@electric-sql/pglite/node-postgres'
import { resolve } from 'node:path'
import { databaseUrl, production } from '../config.js'

export class EmbeddedPool extends pg.Pool {
  private readonly db: PGlite

  constructor(directory: string) {
    const db = new PGlite(resolve(directory), { extensions: { pgcrypto } })
    super({ ...createPgConfig(db), max: 1, idleTimeoutMillis: 0 })
    this.db = db
  }

  override end(): Promise<void>
  override end(callback: () => void): void
  override end(callback?: (error?: Error) => void): Promise<void> | void {
    const closing = super.end().finally(() => this.db.close())
    if (!callback) return closing
    void closing.then(() => callback(), (error) => callback(error))
  }
}

export const createPool = (url = databaseUrl): pg.Pool => {
  if (url.startsWith('pglite:')) {
    const directory = url.slice('pglite:'.length)
    if (production || !directory)
      throw new Error('PGlite exige um diretório local em ambiente de desenvolvimento.')
    return new EmbeddedPool(directory)
  }
  return new pg.Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5000,
  })
}

export async function transaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
