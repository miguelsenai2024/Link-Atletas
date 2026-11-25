import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarConsulta } from './confef.mjs';
import { ufs } from './verificacao.mjs';

const entrada = { nome: 'João da Silva', cref: '000123-G/SP' };
const item = { UF: 'SP', Registro: 'CREF 000123-G/SP', Nome: 'JOAO DA SILVA', Categoria: 'Graduado', NaturezaTitulo: 'BACHAREL' };
const resposta = { data: [item], recordsFiltered: 1 };

test('consulta nacional confirma somente correspondência, sem inferir situação', () => {
  const resultado = interpretarConsulta(entrada, resposta);
  assert.equal(resultado.resultado, 'registro_encontrado');
  assert.equal(resultado.encontrado.naturezaTitulo, 'BACHAREL');
  assert.equal(resultado.encontrado.situacao, undefined);
});
test('divergências, paginação, duplicidade e ausência não confirmam registro', () => {
  assert.equal(interpretarConsulta(entrada, { ...resposta, data: [{ ...item, Nome: 'Outro Nome' }] }).resultado, 'dados_divergentes');
  for (const dados of [{ data: [], recordsFiltered: 0 }, { ...resposta, recordsFiltered: 20 }, { data: [item, item], recordsFiltered: 2 }, { data: [{ ...item, UF: 'RJ' }], recordsFiltered: 1 }]) {
    assert.equal(interpretarConsulta(entrada, dados).resultado, 'inconclusivo');
  }
  assert.throws(() => interpretarConsulta(entrada, {}));
});

test('consulta nacional compara todas as UFs, categorias e registros secundários', () => {
  for (const uf of ufs) for (const categoria of ['G', 'P']) for (const sufixo of ['', '-S']) {
    const cref = `000123-${categoria}/${uf}${sufixo}`;
    const dados = { data: [{ ...item, UF: uf, Registro: `CREF ${cref}` }], recordsFiltered: 1 };
    assert.equal(interpretarConsulta({ ...entrada, cref }, dados).resultado, 'registro_encontrado');
    const outroTipo = sufixo ? cref.replace('-S', '') : `${cref}-S`;
    assert.equal(interpretarConsulta({ ...entrada, cref: outroTipo }, dados).resultado, 'inconclusivo');
  }
});
