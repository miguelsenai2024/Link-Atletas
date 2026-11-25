# Teste local de consulta CREF

Experimento separado do LinkAtletas, sem acesso ao banco do projeto.

## Consulta automática (padrão)

Requer Node.js 24 e internet. No PowerShell:

```powershell
Set-Location 'Y:\Faculdade\integrador\Testes Locais'
npm.cmd install
npm.cmd run instalar-navegador
npm.cmd run consultar -- "JEAN AUGUSTO COELHO GUIMARÃES" "141875-G/SP"
```

Sem argumentos, `npm.cmd run consultar` pede nome completo e CREF no terminal. A consulta é automática após receber os dados: não abre janela e não pede confirmação humana. O Chromium executa em segundo plano e usa o formulário normal da consulta nacional do CONFEF. O próprio portal executa suas verificações reCAPTCHA; não há solução de desafios, reutilização de tokens ou acesso direto ao endpoint protegido. Bloqueio ou indisponibilidade resulta em `inconclusivo`, sem tentativa de contornar a proteção.

A consulta automática aceita as 27 UFs brasileiras, categorias G/P e registro secundário com sufixo `-S`. Exemplos de formato: `123456-G/RJ`, `123456-P/MG`, `123456-G/DF-S`, com prefixo `CREF` opcional. UF é obrigatória: nunca presume SP. Não aceita registro de pessoa jurídica (`PJ`), pois o cadastro do projeto é de professor pessoa física. Nome completo, número, categoria, UF e indicação de secundário devem corresponder. Nome ignora apenas acentos, maiúsculas e espaços repetidos; abreviações não são aceitas como comprovação. A categoria ou formação retornada é informativa e não vira permissão automática para modalidades do projeto.

A busca usa o registro completo para evitar misturar números iguais de estados ou categorias diferentes. Ausência na listagem nacional não comprova inexistência de registro no regional.

Resultados:

- `registro_encontrado`: nome e CREF correspondem a um único registro da listagem.
- `dados_divergentes`: CREF localizado com nome diferente.
- `inconclusivo`: ausência de correspondência única, resposta incompleta, bloqueio ou falha. Não significa registro inexistente.

**A listagem do CONFEF é informativa.** Ela retorna UF, registro, nome, conselho, categoria e natureza do título, mas não informa situação profissional atual. O relatório marca `situacaoProfissional: nao_informada_pela_fonte` e `aprovacaoAutomatica: false`. Registro localizado não comprova identidade de quem se cadastra, regularidade atual ou autorização para uma atividade específica. Não é uma API pública contratada e o fluxo pode parar se o portal mudar ou bloquear automação. Para produção, confirmar condições de integração com o conselho e obter fonte de situação atual.

## Relatórios e navegador

Relatórios JSON em `relatorios/` incluem fonte, datas UTC e os campos necessários à comparação. Contêm dados pessoais; não os publique. O navegador fica em `.browsers/`. Dependências, navegador e relatórios não devem ser versionados.

O módulo `confef.mjs` exporta `consultarConfef({ nome, cref })`, que pode ser chamado programaticamente neste experimento. Não foi integrado ao projeto.

## Fluxo antigo de SP (assistido)

```powershell
npm.cmd run consultar:assistido
```

Abre o portal regional, preenche os dados e exige resolver CAPTCHA, clicar em Consultar, aguardar os resultados e confirmar no terminal. Esse fluxo mantém os resultados `cadastro_compativel` e `revisao_manual`. Não aprova professor. A confirmação de término é humana. O comando padrão não usa esse fluxo.

## Verificação

```powershell
npm.cmd test
```

Testes offline com dados fictícios cobrem formato, comparação, divergências, paginação, duplicidade e extração dos cartões do fluxo antigo. Consulta nacional real também executada com o registro informado pelo usuário: retorno `registro_encontrado`, sem janela e sem intervenção humana. Isso comprova o funcionamento naquele teste, não disponibilidade permanente.

## Fontes

- Consulta nacional: https://www.confef.org.br/registrados/
- Consulta regional SP: https://cref-sp.implanta.net.br/ServicosOnline/Publico/ConsultaInscritos/
- Orientação oficial: https://faq.confef.org.br/faq/pdf.php?artlang=pt-br&cat=12&id=8

`consulta-sp.html` e `consulta-confef.html` são capturas técnicas das páginas públicas, não bases de profissionais e não são usadas para confirmar registros.
