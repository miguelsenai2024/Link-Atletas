import { fileURLToPath } from 'node:url';

// Mantém o navegador junto ao experimento, independente do cache do usuário.
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL('./.browsers/', import.meta.url));
