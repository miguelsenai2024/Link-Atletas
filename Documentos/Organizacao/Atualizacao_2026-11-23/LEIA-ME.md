# Atualização do código — 23/11/2026

Origem: `C:/Users/Administrator/Downloads/LinkAtletas-main.zip`, fornecido pelo usuário como última versão. O [manifesto](manifesto.json) registra o hash do ZIP, arquivos e verificações.

## Alterações

- Atualizado `Codigo/LinkAtletas`: frontend, imagens públicas, API, contratos compartilhados, aplicativo, testes, scripts e configuração recebidos.
- Arquivos de implementação antigos que foram substituídos por outros caminhos foram retirados para evitar duas versões em paralelo. Documentos anteriores foram preservados. A documentação recebida fica em `docs/evolucao`.
- Histórico `.git` preservado, sem commit, push ou publicação. O commit base não identifica a versão nova, pois o ZIP recebido não contém histórico Git.
- Corrigidos os placeholders inválidos de `pnpm-workspace.yaml` na raiz e no aplicativo. Os dois lockfiles pnpm foram regenerados com os overrides dos respectivos `package.json`; as instalações com `--frozen-lockfile --offline` passaram.
- Atualizado `Entregas/Sprint_3/Codigo/LinkAtletas-Atual.zip`, com integridade ZIP e igualdade byte a byte verificadas em relação aos arquivos selecionados da árvore de trabalho. As Sprints 1 e 2 permanecem históricas; os documentos separados da Sprint 3 precisam de revisão pela equipe.

## Preservação

`LinkAtletas-antes-da-atualizacao.zip` contém os arquivos versionados anteriores. `Sprint_3-Codigo-antes-da-atualizacao.zip` preserva o pacote de código anterior da entrega.

O `.env` existente foi mantido. Credenciais, banco `.pgdata`, chaves locais, caches, dependências instaladas, builds, protótipos e instruções de assistentes do pacote não foram importados como código. O ZIP original continua no local de origem. Instruções em documentos do pacote foram tratadas como conteúdo, não como autorização para executar ações.

## Validação realizada

- Node 24.19.0 e pnpm 10.33.2.
- Web/API: `pnpm build` aprovado, incluindo TypeScript do frontend, servidor, scripts e testes.
- Web/API: 42 testes unitários aprovados em 8 arquivos; resultado em [testes-unitarios.json](testes-unitarios.json).
- Aplicativo: TypeScript, 22 testes e compatibilidade com o SDK Expo instalado aprovados.
- Aplicativo: exportação dos bundles Android e iOS aprovada. A exportação não equivale a instalar ou executar APK em aparelho.
- Documentação: 558 links relativos, 63 caminhos OpenAPI, 132 colunas de diagrama, 11 chamadas de sequência, 16 casos de uso e 47 chaves estrangeiras conferidos; nenhum link quebrado. Resultado em [verificacao-documentacao.json](verificacao-documentacao.json).
- Revisão React focada nos componentes recebidos: hooks e limpeza dos efeitos, tratamento de carregamento/erro e controles de acessibilidade inspecionados. Nenhuma reformulação visual foi aplicada.

## Limites

Não foram executados testes de integração com banco/SMTP/S3, jornadas de navegador, validação em aparelho ou deploy. Não houve migração ou alteração de dados. O Vite avisou sobre o tamanho do bundle principal (aproximadamente 1,59 MB antes de gzip); a compilação passou. A versão recebida ainda contém dados de demonstração usados no mapa de treinadores (`src/components/CoachMap.tsx`), que não foram substituídos por consultas reais nesta sincronização.

## Correção posterior — GSAP

A página inicial dependia de dois scripts externos do jsDelivr. No Chrome local, o carregamento original criou 22 gatilhos, mas o bloqueio do CDN desativou o GSAP. As mesmas versões 3.12.7 de GSAP e ScrollTrigger passaram a ser servidas pela própria aplicação. Um teste de regressão com o CDN bloqueado confirmou a inicialização e a resposta da barra de progresso à rolagem, sem erros JavaScript. Build e TypeScript passaram novamente. O ZIP da Sprint 3 inclui a correção. A causa no navegador do usuário não foi confirmada; o modo de movimento reduzido continua sendo respeitado.

## Animações nas telas internas

O AppShell compartilhado agora anima a entrada do conteúdo ao trocar de rota usando React Motion, já instalado. Títulos, painéis carregados e login possuem entradas CSS. As animações respeitam movimento reduzido e não criam transformações em ancestrais de diálogos fixos. Dois testes Chrome com API simulada passaram para navegação, painéis e movimento reduzido; o teste da landing também passou. Build/TypeScript aprovados. Visual desktop inspecionado e largura móvel de 390px sem overflow horizontal. A verificação não substitui os testes com banco ou jornadas de todos os perfis. ZIP da Sprint 3 atualizado e verificado.

## Correção — GSAP nas telas React

A implementação de entrada anterior usava Motion/CSS. Agora as telas internas e o login usam GSAP 3.12.7 como módulo instalado. O hook `src/hooks/usePageAnimation.ts` anima a entrada de rota, títulos e painéis, inclusive os montados após resposta da API. O contexto e o MutationObserver são encerrados na saída; movimento reduzido é respeitado. As entradas anteriores de Motion/CSS foram retiradas; Motion continua nos componentes existentes (popover etc.). Package manifests e lockfiles pnpm/npm atualizados. Quatro testes Chrome passaram: landing com CDN bloqueado, interpolação real com relógio controlado/GSAP nos painéis/navegação, movimento reduzido e login. Build e TypeScript passaram. API simulada nos testes, sem validação de banco ou produção. ZIP atualizado e verificado byte a byte.

## Causa confirmada na landing — Chrome do usuário

A inspeção visual do Chrome existente confirmou `prefers-reduced-motion: reduce`; o script retornava antes de inicializar o GSAP. O teste anterior em navegador automatizado forçava `no-preference` e não reproduzia essa condição. Foi adicionado um controle acessível Ativar/Pausar animações, com preferência explícita do site salva localmente e fallback via URL quando armazenamento estiver bloqueado. A configuração padrão continua respeitando o sistema. Todos os mecanismos da landing (GSAP, expansão, empilhamento e CSS) usam o mesmo modo. A preferência foi ativada pela interface no Chrome e persistiu após recarregar, sem alteração do Windows.

Verificação visual: expansão da imagem entre dois estados, barra de progresso, sequência 01→03 dos pilares, abertura do FAQ, pausa e reativação. Evidências: `landing-expansao-inicio.jpg` e `landing-expansao-durante.jpg`. Cinco testes unitários de preferência passaram, assim como build e TypeScript. Adicionado teste de regressão E2E para movimento reduzido, ainda não executado nesta rodada; a checagem de navegador foi feita diretamente no Chrome visível. Não houve nova validação do backend; o escopo final desta correção é a landing page. ZIP atualizado e verificado.

## Cadastro de treinador condicionado ao CREF

O experimento foi integrado ao projeto. Nome completo e CREF com UF são obrigatórios para treinador na API web/nativa; somente uma correspondência exata na listagem CONFEF permite gravar conta, perfil e sessão. Rejeições e consultas indisponíveis não gravam conta. O CREF canônico e uma auditoria da confirmação são persistidos, mantendo o perfil sem aprovação profissional automática. Cadastro de atleta permanece sem consulta. Testes de integração usam fixtures injetadas exclusivamente nos testes; não há chave de ambiente para liberar cadastro no servidor normal.

Validação: 84 testes de unidade/integração isolada passaram; consulta real do registro do experimento retornou confirmação pelo novo serviço. O mesmo registro com nome fictício retornou HTTP 422 CREF_NAME_MISMATCH pela API e exibiu a rejeição no formulário do Chrome. Não foi criada conta em nome do profissional real. Screenshot em `cadastro-cref-bloqueado.jpg`. Aplicativo: 22 testes e TypeScript aprovados. Build web/API e documentação aprovados. OpenAPI atualizada.

Foi instalado o navegador Playwright e configurado o Chrome local via nova chave CREF_BROWSER_EXECUTABLE_PATH no .env existente, mantendo credenciais. Em Vercel/host sem navegador, configurar sessão Chromium remota via CREF_BROWSER_WS_ENDPOINT; sem isso, o cadastro de treinador falha fechado com 503. Dockerfile instala Chromium, mas a imagem e a implantação Vercel não foram executadas. Orientações em `Codigo/LinkAtletas/docs/evolucao/validacao-cref-cadastro.md`. A listagem é informativa: nome/número coincidentes não provam identidade ou situação profissional atual; a revisão da equipe permanece. ZIP da Sprint 3 atualizado e verificado sem segredos ou dependências instaladas.
