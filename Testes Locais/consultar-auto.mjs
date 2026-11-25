import './navegador.mjs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { lerRegistro } from './verificacao.mjs';
import { consultarConfef, fonteNacional } from './confef.mjs';

let prompt;
let relatorio;
try {
  if (!existsSync(chromium.executablePath())) throw new Error('Execute primeiro: npm.cmd run instalar-navegador');
  let [nome, cref] = process.argv.slice(2);
  if (!nome || !cref) {
    prompt = createInterface({ input: process.stdin, output: process.stdout });
    nome = await prompt.question('Nome completo do professor: ');
    cref = await prompt.question('CREF com UF (ex.: 123456-G/RJ): ');
    prompt.close();
  }
  nome = nome.trim();
  if (nome.length < 3 || nome.length > 200) throw new Error('Informe o nome completo (3 a 200 caracteres).');
  cref = lerRegistro(cref);
  relatorio = { entrada: { nome, cref }, fonte: fonteNacional, iniciadoEm: new Date().toISOString(), aprovacaoAutomatica: false, situacaoProfissional: 'nao_informada_pela_fonte' };
  console.log('Consultando o CONFEF em segundo plano...');
  Object.assign(relatorio, await consultarConfef({ nome, cref }));
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  if (relatorio) Object.assign(relatorio, { resultado: 'inconclusivo', motivo: 'Consulta não concluída. Não é possível confirmar o registro.', erro: erro.message });
  process.exitCode = 1;
} finally {
  prompt?.close();
  if (relatorio) {
    relatorio.concluidoEm = new Date().toISOString();
    const pasta = new URL('./relatorios/', import.meta.url);
    await mkdir(pasta, { recursive: true });
    const arquivo = new URL(`${Date.now()}-${randomUUID()}.json`, pasta);
    await writeFile(arquivo, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`\nResultado: ${relatorio.resultado}\n${relatorio.motivo}`);
    if (relatorio.encontrado) console.log(JSON.stringify(relatorio.encontrado, null, 2));
    console.log(`Relatório: ${fileURLToPath(arquivo)}`);
  }
}
