import { buildApp } from '../../server/app.js'
import { createPool } from '../../server/db/pool.js'
import { startServer } from '../../server/runtime.js'

const database = process.env.DATABASE_URL
if (process.env.NODE_ENV === 'production' || !database ||
    !decodeURIComponent(new URL(database).pathname).endsWith('_test'))
  throw new Error('O servidor de testes exige um banco com sufixo _test.')

const pool = createPool(database)
await startServer(await buildApp({
  pool,
  logger: true,
  lookupCref: async (cref) => [`Treinador E2E ${cref.slice(0, 6)}`],
}), pool)
