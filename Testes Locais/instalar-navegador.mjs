import './navegador.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
const instalacao = spawnSync(process.execPath, [cli, 'install', 'chromium'], {
  stdio: 'inherit',
  env: process.env,
});
if (instalacao.error) console.error(instalacao.error.message);
process.exitCode = instalacao.status ?? 1;
