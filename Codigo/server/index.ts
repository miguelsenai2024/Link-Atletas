import { buildApp } from './app.js'
import { production } from './config.js'
import { createPool } from './db/pool.js'
import { startServer } from './runtime.js'

const pool = createPool()
await startServer(await buildApp({ pool, logger: true, serveFrontend: production }), pool)
