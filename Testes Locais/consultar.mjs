import './navegador.mjs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fonte, lerRegistro, comparar, extrairCartoes } from './verificacao.mjs';

const prompt = createInterface({ input: stdin, output: stdout });
let browser;
let relatorio;
try {
  if (!existsSync(chromium.executablePath())) {
    throw new Error('Navegador não instalado. Execute: npm.cmd run instalar-navegador. Depois execute: npm.cmd run consultar');
  }
  const nome = (await prompt.question('Nome completo do professor: ')).trim();
  if (nome.length < 3 || nome.length > 200) throw new Error('Informe o nome completo (3 a 200 caracteres).');
  const cref = lerRegistro(await prompt.question('CREF de São Paulo (ex.: 123456-G/SP): '));
  if (!cref.endsWith('/SP')) throw new Error('O fluxo assistido usa somente o portal de SP. Para outras UFs, use npm.cmd run consultar.');
  relatorio = { entrada: { nome, cref }, fonte, iniciadoEm: new Date().toISOString(), aprovacaoAutomatica: false };
  browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(fonte, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#NumeroRegistro').fill(cref.replace('/SP', ''));
  await page.locator('#NomeRazaoSocial').fill(nome);
  console.log('\nNo navegador: resolva o CAPTCHA, clique em Consultar e aguarde o resultado.');
  console.log('Se houver bloqueio ou erro, volte e digite cancelar. Não tente contornar o CAPTCHA.');
  const resposta = (await prompt.question('Quando o resultado terminar de carregar, pressione Enter (ou digite cancelar): ')).trim();
  if (resposta) {
    Object.assign(relatorio, { resultado: 'revisao_manual', motivo: 'Consulta cancelada ou bloqueada.' });
  } else {
    // Confere os filtros usados antes de interpretar os cartões, evitando consulta alterada.
    const filtroRegistro = await page.locator('#NumeroRegistro').inputValue();
    const filtroNome = await page.locator('#NomeRazaoSocial').inputValue();
    if (lerRegistro(filtroRegistro, 'SP') !== cref || filtroNome.trim() !== nome) throw new Error('Os filtros foram alterados. Execute novamente.');
    const registros = await page.evaluate(extrairCartoes);
    Object.assign(relatorio, comparar({ nome, cref }, registros));
  }
} catch (erro) {
  console.error(`\nErro: ${erro.message}`);
  if (relatorio) Object.assign(relatorio, { resultado: 'revisao_manual', motivo: 'Não foi possível concluir a consulta.', erro: erro.message });
  process.exitCode = 1;
} finally {
  await browser?.close();
  prompt.close();
  if (relatorio) {
    relatorio.concluidoEm = new Date().toISOString();
    const pasta = new URL('./relatorios/', import.meta.url);
    await mkdir(pasta, { recursive: true });
    const arquivo = new URL(`${Date.now()}-${randomUUID()}.json`, pasta);
    await writeFile(arquivo, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`\nResultado: ${relatorio.resultado}\n${relatorio.motivo}\nRelatório: ${fileURLToPath(arquivo)}`);
  }
}
