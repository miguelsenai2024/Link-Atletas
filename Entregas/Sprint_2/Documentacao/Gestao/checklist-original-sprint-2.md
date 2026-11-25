# Checklist da Sprint 2 — versão ampliada

Atualização da nuvem em 26/10/2026: [aplicação pública](https://link-atletas.vercel.app) com API, PostgreSQL Neon, Tigris privado e Brevo integrados. [Verificações de Preview e produção, arquivos de 50 MiB, recuperação de senha, APK e limites](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/implantacao-2026-10-26.md). O [PR #3](https://github.com/DaviSouza78/LinkAtletas/pull/3) integrou a versão na `main` do grupo, sincronizada com o fork. A revisão coletiva foi concluída conforme confirmação da equipe. O envio individual é realizado por cada integrante no ambiente acadêmico.

Atualizado em 26/10/2026. Use este documento para revisar os nove entregáveis obrigatórios. A [entrega inicial](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/sprint-2/checklist-sprint-2.md) permanece histórica. `[x]` indica implementação, artefato ou revisão concluída com referência. Este checklist reúne os entregáveis da Sprint 2; evoluções e homologações não executadas permanecem no backlog e no registro de implantação, sem indicação de conclusão. A [ERS final revisada pela equipe](../Requisitos/ERS-v2.6.pdf) define o alcance e o [relatório](../Testes/relatorio-testes.md) registra resultados sem presumir aprovação. As [pendências humanas](pendencias-originais.md) distinguem a entrega acadêmica da ativação externa.

## 1. Código-fonte atualizado e versionado

Conferência de 26/10: [implantação pública verificada](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/implantacao-2026-10-26.md), com 99 testes de unidade/API, 15 de navegador e verificações reais de Preview e produção. A [conferência anterior](Historico/conferencia-entrega-2026-10-26.md) preserva o contexto da demonstração local e da publicação posterior.

- [x] Clone local separado e branch de ampliação; código de [API](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server), [web](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src) e [app](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/mobile); base anterior preservada em `sprint-2`.
- [x] Autor Git definido como Lucca com e-mail fornecido; [decisões](decisoes.md) explicam autoria e limites.
- [x] Implementação versionada no commit inicial da ampliação [fca8a18](https://github.com/DaviSouza78/LinkAtletas/commit/fca8a18), com autoria Lucca; documentação/evidências versionadas na mesma branch. O código pode ser obtido pelo clone ou pelo ZIP da branch main no GitHub; veja o [índice](entrega-original.md).
- [x] Branch publicada no [GitHub do grupo — main atual](https://github.com/DaviSouza78/LinkAtletas/tree/main), com commits de Lucca; [pull request #1](https://github.com/DaviSouza78/LinkAtletas/pull/1) integrado após autorização de publicação e aprovação dos checks.
- [x] Merge inicial na `main`, commit `f6a5a56` (histórico): [registro do PR](../Evidencias/github-pr-1.json) e [CI aprovada na main](../Evidencias/github-ci-main.json).

## 2. Fluxo principal funcional de ponta a ponta

- [x] Cadastro → perfil → CREF manual → descoberta → solicitação → aceite → prescrição → execução/feedback: [API original](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/api.test.ts), [web](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/App.tsx), [roteiro](../Manuais/manual.md) e [jornada real em Preview HTTPS](../Evidencias/vercel-fluxo-2026-10-26.json).
- [x] Funcionalidades antes abertas agora possuem código e telas: [mensagens/agenda/reviews/notificações](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/pages/integrated/InteractionPages.tsx), [financeiro](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/pages/integrated/BillingPages.tsx), [privacidade/mídia/reset](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/pages/integrated/Expansion.tsx).
- [x] Cancelamento, novos ciclos, carência e conciliação: [billing](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/billing.ts), [contratos](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/contracts.ts), [testes de financeiro](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/billing.test.ts).
- [x] Fluxo ampliado em Chromium, Firefox e WebKit: [15/15 E2E da verificação final](../Evidencias/verificacao-nuvem-entrega-2026-10-26/playwright-results.json) e [relatório](../Testes/relatorio-testes.md).

## 3. Banco de dados criado e integrado

- [x] PostgreSQL Neon criado e integrado em produção e Preview, com seis migrations aplicadas: [fontes](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/db/migrations) e [evidência](../Evidencias/neon-migrations-2026-10-26.json).
- [x] Relações/chaves/índices para conta, ciclos, treino, arquivos, chat, agenda, review, financeiro e privacidade: [DER visual](../Diagramas/der.svg) e [fonte editável](../Diagramas/der.mmd).
- [x] Isolamento de testes com banco `_test` e dados fictícios: [testes](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration), [configuração](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/vitest.config.ts).
- [x] Snapshot cifrado do Neon de produção restaurado em banco local isolado, com contagens das 37 tabelas conferidas: [registro](../Evidencias/backup-nuvem-2026-10-26.json). Esse teste não inclui cópia dos objetos Tigris.
- [x] Ensaio local anterior de backup/restauração isolados: [36 tabelas e objetos com checksums iguais](../Evidencias/backup-restore.json), campo/mídia decifrados e [worker de rede privada](../Evidencias/private-network-backup.json).

## 4. Interface responsiva integrada ao back-end

- [x] Web real para atleta, treinador e administrador; [rotas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/App.tsx), [navegação](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/components/AppShell.tsx), [cliente HTTP](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/services/api.ts).
- [x] Formulários novos com rótulos/erro/espera/sucesso e layout responsivo: [CSS](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/src/styles.css) e páginas integradas.
- [x] Fonte do app Expo com a mesma API e SecureStore: [app](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/mobile/App.tsx), [cliente](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/mobile/src/api.ts).
- [x] Evidências Chromium 390/1440 e seis telas sem violações axe: [E2E](../Evidencias/playwright-results.json), [axe](../Evidencias/chromium-axe.json), [chat desktop](../Evidencias/chromium-chat.png) e [privacidade mobile](../Evidencias/chromium-privacidade-mobile.png).
- [x] App: tipos/dependências/Doctor, [22/22 testes de transporte/configuração](../Evidencias/mobile-tests.json) e [bundles Hermes Android/iOS](../Evidencias/mobile-bundles.json); ver [limites](../Evidencias/mobile-verificacao.md).
- [x] Firefox e WebKit executados: [resultados](../Evidencias/playwright-results.json), [axe Firefox](../Evidencias/firefox-axe.json) e [axe WebKit](../Evidencias/webkit-axe.json).
- [x] APK Android de verificação compilado no GitHub, com assinatura de desenvolvimento: [execução e hash](../Manuais/publicacao.md). O perfil local permite backend por USB: [manual](../Manuais/manual-apk-local.md); o APK documental antigo permanece histórico.
- [x] APK com URL HTTPS de produção compilado, instalado e iniciado no emulador Android API 35: [resultado atual](../Evidencias/android-nuvem-2026-10-26.json) e [captura](../Evidencias/android-nuvem-inicializacao-2026-10-26.png). Esse ensaio valida a inicialização, não a jornada completa em aparelho físico.
- [x] Ensaio anterior de inicialização do APK no emulador Android API 35: [resultado](../Evidencias/android-emulator-result.json), [captura](../Evidencias/android-emulator-startup.png) e [run aprovado](https://github.com/DaviSouza78/LinkAtletas/actions/runs/38675093814). O ensaio integrado do APK local é registrado separadamente na [verificação móvel](../Evidencias/mobile-verificacao.md); aparelho físico continua pendente.

## 5. Validações e tratamento básico de erros

- [x] Papel/propriedade/estado, Zod, CSRF/Origin, sessão, limites e mensagens públicas sanitizadas: [segurança](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/shared/security.ts), [erros](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/shared/errors.ts).
- [x] Arquivo por assinatura/MIME/extensão/limite, S3 privado e cifra: [media](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/media.ts), [crypto](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/shared/crypto.ts).
- [x] Consentimento/saúde/recuperação/encerramento com senha e sessão revogada: [platform](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/platform.ts).
- [x] Webhook autenticado/idempotente, resultado incerto e cancelamento sem falso sucesso: [Asaas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/services/asaas.ts), billing e testes.
- [x] Review elegível, moderação, horário/conflito e WS: [interactions](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/interactions.ts).

## 6. Testes iniciais com evidências

- [x] Evidência inicial preservada: [33 Vitest e 2 E2E históricos](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/sprint-2/relatorio-testes.md).
- [x] Novos testes de [plataforma](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/platform.test.ts), [interações](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/interactions.test.ts), [financeiro](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/billing.test.ts), [cifra](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/unit/crypto.test.ts).
- [x] [99/99 testes de API/unidade](../Evidencias/nuvem-2026-10-26-vitest.json), [15/15 E2E nos três motores na verificação final](../Evidencias/verificacao-nuvem-entrega-2026-10-26/playwright-results.json), testes/bundles do app e operação TLS/backup/carga: [relatório](../Testes/relatorio-testes.md).
- [x] Corridas de privacidade verificadas com bloqueios reais: [três testes](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/privacy-races.test.ts) de perfil, senha/sessão e feedback eliminado.
- [x] [TLS 1.3 local](../Evidencias/production-tls.json) com CA explícita, sem alteração do trust global; [carga](../Evidencias/carga-matchmaking.json) 200 chamadas/500 perfis sintéticos e p95 97,78 ms.
- [x] [CI versionada](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/.github/workflows/ci.yml) e executada com sucesso após a integração da nuvem na main: [run 40417254496](https://github.com/DaviSouza78/LinkAtletas/actions/runs/40417254496). O [registro da CI anterior](../Evidencias/github-ci-main.json) permanece histórico.
- [x] Correção do indicador de chat após evento tardio de socket descartado e regressão no navegador: [CI final aprovada](../Evidencias/github-ci-finalizacao.json), [cenário de chat](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/e2e/expansion.spec.ts).
- [x] [Tipos e build aprovados na execução registrada](../Evidencias/verificacao-build.txt); engines adicionais incluídos no relatório.

## 7. Documentação de API

- [x] [Guia ampliado](../API/api.md), [contratos compartilhados](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/shared/contracts.ts), [Swagger interativo](https://link-atletas.vercel.app/api/docs/) e [OpenAPI da aplicação](https://link-atletas.vercel.app/api/openapi.json).
- [x] Documentados autenticação web/nativa, multipart, WS, erro, papel, finalidade e limites externos no [guia da API](../API/api.md). O CREF é conferido manualmente pela administração; não há API externa de validação oficial ativada.
- [x] [Snapshot OpenAPI](../API/openapi.json) gerado da aplicação e [conferência](../Evidencias/documentation-check.json) das rotas e links relativos.

## 8. ERS, diagramas e backlog atualizados

- [x] [ERS final de entrega](../Requisitos/ERS-v2.6.pdf) e [síntese técnica auxiliar](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/ERS-v2.md): RF-01–24, RNF-01–16, RN-01–16 preservados, RF-A explícitos e fluxos/exceções.
- [x] [Backlog](../Requisitos/backlog.md), [matriz de UCs/rastreabilidade](../Requisitos/rastreabilidade.md) e [diagramas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/diagramas.md) com fontes editáveis.
- [x] Casos de uso UML: atores, elipses e limite de sistema, [PlantUML](../Diagramas/casos-de-uso.puml) e [SVG](../Diagramas/casos-de-uso.svg).
- [x] [ERS final v2.6 em PDF](../Requisitos/ERS-v2.6.pdf), ajustada e fornecida pela equipe em 26/10/2026, preservada sem conversão. O DOCX anterior foi retirado para evitar divergência com a versão entregue. Relatório de testes em [Word](../Testes/relatorio-testes.docx) e [PDF](../Testes/relatorio-testes.pdf).
- [x] Revisão coletiva concluída, conforme confirmação da equipe; a ERS ajustada é a versão final de entrega.
- [x] Relacionar a contribuição da Eletiva I e suas evidências na [matriz](../Requisitos/rastreabilidade.md).

## 9. Registro de dificuldades, decisões e mudanças de escopo

- [x] [Decisões](decisoes.md): arquitetura/provedores, ciclos, cifra, dependências externas, mudanças em relação à ERS original e limites de autoria.
- [x] [Manual](../Manuais/manual.md): instalação, serviços locais, conta, privacidade, financeiro, app e roteiro de demonstração.
- [x] Limitações preservadas: IA treinada, autoescala, autosave contínuo, sincronização Google bidirecional e novos esportes administrativos estão no [backlog](../Requisitos/backlog.md).
- [x] Ativar os serviços da implantação acadêmica com autorização do responsável e registrar testes reais: Vercel, Neon, Tigris, Brevo e cron-job.org. [Evidências por ambiente e limites](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/implantacao-2026-10-26.md). Asaas, Google e lojas conservam seus próprios critérios de evolução/homologação.

## Estado de conclusão

Os nove entregáveis obrigatórios possuem implementação ou artefato referenciado neste checklist. A ERS oficial de entrega é o [PDF final ajustado pela equipe](../Requisitos/ERS-v2.6.pdf), que substitui o PDF anterior; o DOCX correspondente à versão anterior foi removido.

A revisão coletiva foi concluída conforme informado pela equipe. Cada integrante deve realizar sua submissão no ambiente acadêmico. Este documento não afirma que a submissão já ocorreu.

Evoluções e homologações não realizadas, como cobrança real, Google OAuth e testes em aparelhos físicos, permanecem no [backlog](../Requisitos/backlog.md) e nos [limites da implantação](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/implantacao-2026-10-26.md), fora dos checks desta entrega.

## Registros históricos da revisão de 15–21/10/2026

As contagens, versões e execuções abaixo pertencem às datas desses registros. As evidências atuais de entrega estão nos nove itens acima.

- [x] Todos os materiais originais inventariados e comparados: [revisão](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/revisao-materiais.md) e [hashes](../Evidencias/materiais-originais.json).
- [x] Checklist dos fornecedores, obrigação por Sprint, alternativas locais e homologações: [serviços externos](../Manuais/servicos-externos-sprint-2.md).
- [x] DER e sequências conferidos automaticamente contra 36 tabelas/257 colunas/45 FKs e OpenAPI: [dicionário](../Banco_de_Dados/dicionario-dados.md), [verificador](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/scripts/check-docs.ts).
- [x] Docker reiniciado com dados preservados, migrations e saúde: [ambiente](../Evidencias/ambiente-local-revisado.json).
- [x] Correções de limpeza de arquivos privados, backup com variável vazia e bibliotecas: [decisões](decisoes.md), [auditoria](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/seguranca-dependencias.md).
- [x] Página pública com informações coerentes, menu móvel e layout sem overflow em 320/390/1440: [Chrome](../Evidencias/chrome-landing-revisada.json); contraste corrigido e [axe sem violações nas regras verificadas](../Evidencias/chrome-landing-axe.json).
- [x] APK corrigido conectado à API/PostgreSQL/SMTP/S3: [18/18 etapas aprovadas](../Evidencias/android-integrated-result.json), [execução remota](../Evidencias/github-android-integrated.json), [upload e correção](../Evidencias/android-integrated-midia-feedback.png), [encerramento](../Evidencias/android-integrated-conta-encerrada.png).

- [x] CI completa da revisão, com tipos/build, 82 testes, backup, 15 E2E, nativo e TLS: [run 39645457806](https://github.com/DaviSouza78/LinkAtletas/actions/runs/39645457806), [registro](../Evidencias/github-ci-pr-2.json).

## Conferência das referências

[A auditoria dos links](../Evidencias/checklist-links-2026-10-26.json) registra destinos locais versionados, integridade dos formatos examinados e respostas HTTP dos links externos. Essa conferência documental não representa uma nova execução dos testes funcionais.
