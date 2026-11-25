import './navegador.mjs';
import { chromium } from 'playwright';
import { lerRegistro, normalizarNome } from './verificacao.mjs';

export const fonteNacional = 'https://www.confef.org.br/registrados/';

export function interpretarConsulta(entrada, resposta) {
  const cref = lerRegistro(entrada.cref);
  const uf = cref.split('/')[1].slice(0, 2);
  if (!resposta || !Array.isArray(resposta.data) || !Number.isInteger(resposta.recordsFiltered) || resposta.recordsFiltered < resposta.data.length) {
    throw new Error('Formato inesperado na resposta do CONFEF.');
  }
  if (resposta.recordsFiltered > resposta.data.length) return { resultado: 'inconclusivo', motivo: 'Busca com mais resultados que a página recebida.' };
  const encontrados = resposta.data.filter(item => {
    try { return item.UF === uf && lerRegistro(item.Registro) === cref; }
    catch { return false; }
  });
  if (encontrados.length !== 1) return { resultado: 'inconclusivo', motivo: 'Não foi encontrado um único CREF exato. Isso não comprova inexistência.' };
  const item = encontrados[0];
  const encontrado = { nome: item.Nome, registro: item.Registro, uf: item.UF, conselho: item.Conselho, categoria: item.Categoria, naturezaTitulo: item.NaturezaTitulo };
  if (typeof item.Nome !== 'string' || normalizarNome(item.Nome) !== normalizarNome(entrada.nome)) {
    return { resultado: 'dados_divergentes', motivo: 'O nome completo informado não corresponde ao nome registrado.', encontrado };
  }
  return { resultado: 'registro_encontrado', motivo: 'Nome e CREF coincidem na listagem informativa. A fonte não informa situação atual; não comprova regularidade, titularidade ou habilitação para uma atividade específica.', encontrado };
}

export async function consultarConfef(entrada) {
  const cref = lerRegistro(entrada.cref);
  const termo = cref;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(fonteNacional, { waitUntil: 'networkidle', timeout: 45000 });
    await page.locator('#input-busca-registrados').fill(termo);
    // Usa o formulário normal, deixando as verificações do portal executarem normalmente.
    // Não reutiliza tokens, não resolve desafios e não consulta endpoint protegido fora da página.
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().startsWith('https://www.confef.org.br/api/consulta/registrados/datatable') && r.request().method() === 'POST', { timeout: 45000 }),
      page.locator('#form-busca button').click(),
    ]);
    if (!response.ok()) throw new Error(`Consulta recusada ou indisponível (HTTP ${response.status()}).`);
    const dados = await response.json();
    if (dados._search !== termo) throw new Error('A resposta não corresponde ao filtro enviado.');
    return interpretarConsulta({ ...entrada, cref }, dados);
  } finally { await browser.close(); }
}
