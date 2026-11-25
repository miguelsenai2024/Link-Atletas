export const fonte = 'https://cref-sp.implanta.net.br/ServicosOnline/Publico/ConsultaInscritos/';

export function normalizarNome(valor) {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim().replace(/\s+/g, ' ');
}

export const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function lerRegistro(valor, ufPadrao) {
  const match = /^(?:CREF\s+)?(\d{1,6})\s*-?\s*([GP])(?:\s*\/\s*([A-Z]{2})(\s*-\s*S)?)?$/i.exec(String(valor).trim());
  const uf = (match?.[3] || ufPadrao || '').toUpperCase();
  if (!match || !ufs.includes(uf)) throw new Error('Informe o CREF profissional com UF, por exemplo 123456-G/RJ ou 123456-P/MG-S.');
  return `${match[1].padStart(6, '0')}-${match[2].toUpperCase()}/${uf}${match[4] ? '-S' : ''}`;
}

// Executada dentro do navegador; extrai somente os campos necessários dos cartões.
export function extrairCartoes() {
  return [...document.querySelectorAll('.cardPessoas_')].filter(el => el.getClientRects().length).map(el => {
    const campo = seletor => el.querySelector(seletor)?.textContent.trim() || '';
    return {
      nome: campo('.dados-Nome .info'),
      registro: campo('.dados-NumeroInscricao .info'),
      categoria: campo('.dados-Categoria .info'),
      situacao: campo('.dados-SituacaoDetalhe .info'),
    };
  });
}

export function comparar(entrada, registros) {
  const registro = lerRegistro(entrada.cref);
  const candidatos = registros.filter(item => {
    try { return lerRegistro(item.registro, 'SP') === registro; } catch { return false; }
  });
  if (candidatos.length !== 1) return { resultado: 'revisao_manual', motivo: candidatos.length ? 'Mais de um registro correspondente.' : 'Nenhum registro exato capturado; isso não comprova inexistência.' };
  const encontrado = candidatos[0];
  if (normalizarNome(encontrado.nome) !== normalizarNome(entrada.nome)) {
    return { resultado: 'revisao_manual', motivo: 'O nome retornado diverge do nome informado.', encontrado };
  }
  // shortcut: rótulo cadastral não comprova habilitação; ampliar só após validar as regras oficiais do regional.
  if (normalizarNome(encontrado.situacao) !== 'ATIVO') {
    return { resultado: 'revisao_manual', motivo: 'Situação diferente de ATIVO ou não informada.', encontrado };
  }
  return {
    resultado: 'cadastro_compativel',
    motivo: 'Nome e CREF coincidem e a consulta informa ATIVO. Ainda é necessário conferir titularidade e habilitação para a atividade.',
    encontrado,
  };
}
