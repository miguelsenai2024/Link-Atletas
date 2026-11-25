import './navegador.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { comparar, lerRegistro, extrairCartoes, ufs } from './verificacao.mjs';

const entrada = { nome: 'João da Silva', cref: '123-G/SP' };
const registro = { nome: 'JOAO DA SILVA', registro: '000123-G', situacao: 'Ativo', categoria: 'Graduado' };

test('normaliza formato, exige UF e rejeita categorias e UFs inválidas', () => {
  assert.equal(lerRegistro('123 g/sp'), '000123-G/SP');
  assert.equal(lerRegistro('CREF 123-p/rj-s'), '000123-P/RJ-S');
  for (const valor of ['123-G/XX', '123-G', '', 'abc', '123-X/SP', '123-PJ/SP', '123-G/SP-S-S']) assert.throws(() => lerRegistro(valor));
});

test('aceita ambas as categorias e registros secundários em todas as 27 UFs', () => {
  assert.equal(ufs.length, 27);
  for (const uf of ufs) for (const categoria of ['G', 'P']) for (const sufixo of ['', '-S']) {
    assert.equal(lerRegistro(`123-${categoria}/${uf}${sufixo}`), `000123-${categoria}/${uf}${sufixo}`);
  }
});

test('compara registro, nome e situação sem aprovar professor', () => {
  assert.equal(comparar(entrada, [registro]).resultado, 'cadastro_compativel');
  for (const registros of [[], [registro, registro], [{ ...registro, nome: 'Outra Pessoa' }], [{ ...registro, registro: '124-G' }], [{ ...registro, situacao: 'Inativo' }], [{ ...registro, situacao: '' }]]) {
    assert.equal(comparar(entrada, registros).resultado, 'revisao_manual');
  }
});

test('extrai campos de cartões visíveis sem interpretar template vazio', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div class="cardPessoas_" style="display:none"></div><div class="cardPessoas_"><div class="dados-Nome"><p class="info">JOAO DA SILVA</p></div><div class="dados-NumeroInscricao"><p class="info">000123-G</p></div><div class="dados-Categoria"><p class="info">Graduado</p></div><div class="dados-SituacaoDetalhe"><p class="info">Ativo</p></div></div>`);
    const dados = await page.evaluate(extrairCartoes);
    assert.deepEqual(dados, [registro]);
    assert.equal(comparar(entrada, dados).resultado, 'cadastro_compativel');
  } finally { await browser.close(); }
});
