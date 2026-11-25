# Matriz de rastreabilidade — ampliação

Data: 14/10/2026. Mantém os IDs da ERS original. Referência de implementação/cenário não significa aprovação presumida: resultados estão no [relatório](../Testes/relatorio-testes.md).

| Requisitos | Implementação | Cenário/evidência |
|---|---|---|
| RF-01,02,05,A01 | [auth](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/auth.ts), [profiles](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/profiles.ts), [platform](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/platform.ts); login/perfil/reset/privacy | [API original](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/api.test.ts), [plataforma](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/platform.test.ts); conta, sessão, Bearer, reset SMTP e invalidação |
| RF-03,04,A05; RN-01–03 | [verification](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/verification.ts), [media](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/media.ts), jobs | Conferência manual de CREF conforme ERS atual; plataforma: documento/propriedade, aprovação, suspensão, expiração e auditoria; API original: papéis/descoberta |
| RF-06,07,08; RN-08–10 | [matching](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/matching.ts), descoberta e reviews | [Matching](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/unit/matching.test.ts), API/filtros e interação/reviews; IA treinada e dataset representativo futuros |
| RF-09,10,22,23 | [contracts](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/contracts.ts), [billing](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/billing.ts), conexões | [Financeiro](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/billing.test.ts): ciclos, encerramento, terceiros e vigência; API: aceite/conflito |
| RF-11–13,24; RN-04–07,16 | [asaas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/services/asaas.ts), billing, migrações 004/005 | Financeiro: contrato HTTP, timeout, webhook, duplicata, ordem, conciliação e bloqueio; sandbox real pendente |
| RF-14–18; RN-11,12 | [workouts](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/workouts.ts), media, treino/execução | API/plataforma: propriedade, rascunho, catálogo, criptografia, consentimento, S3/download e correção |
| RF-19,A02 | [interactions](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/modules/interactions.ts), mensagens/notificações | [Interações](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/tests/integration/interactions.test.ts): WS duas sessões, leitura/cursor, persistência, terceiros, sessão/origem |
| RF-20,21,A08; RN-13 | Interactions; reviews/moderação | Elegibilidade temporal, única por ciclo, edição, resposta, denúncia/ocultação e média |
| RF-A03 | Interactions; agenda e Google opcional | Conflito entre vínculos, histórico, reagendamento/cancelamento, cifragem; OAuth real não executado |
| RF-A04; RN-14,15; RNF-01,02 | Platform, media, [crypto](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/server/shared/crypto.ts) | Plataforma/crypto: consentimentos, cifra SQL/S3, exportação e exclusão; política jurídica e domínio real pendentes |
| RF-A06; RNF-09,12 | [mobile/App.tsx](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/mobile/App.tsx), SecureStore e mesma API | Tipos/dependências/bundles separados de instalação/dispositivos; conferir relatório |
| RF-A07; RNF-06,08,13,14,16 | Compose/config/API e ferramentas de verificação | Logs/build/TLS/backup/carga/CI conforme relatório; escala pública e browsers/aparelhos reais não inferidos |

## Integração das unidades curriculares

UCs do roteiro original. Esta matriz relaciona conteúdo técnico, sem atribuir avaliação ou participação não registradas.

| UC | Aplicação concreta | Artefato/limite |
|---|---|---|
| Desenvolvimento Back-end | REST, sessão, papel/propriedade, criptografia, transações, SMTP/S3, webhook e jobs | `server/`, migrations e testes PostgreSQL/serviços locais |
| Frameworks Front-end | React/TypeScript, rotas, formulários, estados assíncronos, WS; cliente React Native | `src/`, `mobile/`, contratos e E2E; nativo exige homologação própria |
| Ciência de Dados | Atributos/nota explicável, catálogo de métricas, agregação de reviews e medição de latência | `matching.ts`, `metric_types`, testes e relatório de carga; não há IA treinada |
| Computação em Nuvem | Serviços isolados, objetos S3 privados, configuração, container, TLS e recuperação | Compose/infra/scripts; nuvem/autoescala pública dependem implantação real |
| Automação Industrial | Aquisição manual e validação de métricas, tarefas periódicas e fluxo de eventos | Execuções/catálogos/jobs; sem sensores, PLC ou IoT físico conectado |
| Relações Humanas e Cidadania | Consentimento, privacidade, transparência profissional, acessibilidade e moderação | Política, revisão de dados, papéis, denúncias e limitações; sem certificação jurídica presumida |
| Eletiva I | Integrar conhecimentos das UCs, organizar o desenvolvimento por Sprints, especificar requisitos, implementar e verificar a solução e comunicar resultados | [ERS](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/ERS-v2.md), [backlog](backlog.md), [diagramas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/diagramas.md), [testes](../Testes/relatorio-testes.md), [decisões](../Gestao/decisoes.md) e [checklist](../Gestao/checklist-original-sprint-2.md) |
| Conhecimentos anteriores | Requisitos, modelagem relacional/UML, qualidade e versionamento | ERS, modelos, SQL, testes e histórico Git |

## Participação e submissão

Equipe informada: João Gabriel Floriano Olimpio; Miguel Oliveira de Almeida; Lucas Souza Silva; Davi Marcondes Paes de Souza; João Pedro Fonseca Alves de Carvalho; Lucca Castilho Costa. Planejamento original não comprova execução individual desta Sprint. Cada integrante deve associar commit/revisão/ensaio/apresentação real com data e descrição e realizar sua própria entrega. A identidade Git configurada para o incremento é Lucca; não se distribui essa autoria automaticamente aos colegas.

## Conferência com os materiais originais — 15/10/2026

A [revisão documental](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/revisao-materiais.md) compara ERS, proposta, roteiro, portaria, convivência e templates. O [dicionário](../Banco_de_Dados/dicionario-dados.md) e os [diagramas](https://github.com/DaviSouza78/LinkAtletas/blob/f48d6f0ba682c72a5120daf16cc330ad63147aa7/docs/evolucao/diagramas.md) demonstram 36 tabelas e 45 chaves estrangeiras reais. O diagrama de classes inclui os módulos de integração financeira existentes; não representa um ORM inexistente.

A conferência manual de CREF substitui a automação no RF-04 atual, conforme decisão da equipe registrada na ERS. Evolução de IA, nuvem e suporte Android/iOS seguem os recortes de escopo e estados de implementação do backlog. O match atual é por regras e o APK local não comprova operação pública ou iOS. Os commits de Lucca não comprovam participação dos demais integrantes.
