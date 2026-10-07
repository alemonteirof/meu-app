# CCM — Centro de Controle de Manutenção (MAJ Soluções) — resumo técnico

> Gerado em 2026-09-13, mantido atualizado a cada mudança relevante no app (ver seção 0).
> Nível de detalhe: nomes de coluna/tabela reais, assinaturas de função, ids de componente,
> file:line de referência. Para brainstorm/arquitetura em outro chat — não é doc de usuário final.

## 0. Convenção de manutenção deste arquivo

Este arquivo (`RESUMO_APP.md`, raiz do repo) é atualizado **sempre que uma sessão de trabalho
mexe em schema, fluxo de tela ou decisão de arquitetura** — não é preciso pedir de novo. Regra:
editar a seção afetada (não reescrever tudo), manter os file:line, e mover qualquer decisão
nova de "em aberto" para a seção correta quando implementada. Migrações `.sql` pendentes vão na
seção 15 até serem rodadas em produção.

## 1. Objetivo e stack

App de gestão de manutenção de sistemas de detecção (SDAI) e combate a incêndio (SPCI/PCI) para
clientes da MAJ Soluções (Hochiki/VES e Notifier). Objetivo: portal para o cliente ver o resultado
dos serviços sem depender de reunião manual.

- **Frontend**: Vite + React (JS, sem TS), Windows/CRLF. Tailwind v4 via `@tailwindcss/vite`
  (tokens `--radius-*`, `--surface`, `--surface-raised` sobrescritos no tema "Novo").
- **Backend**: Supabase (Postgres + RLS + Auth + Storage p/ fotos). Toda a camada de dados fica em
  `src/supabaseAdapter.js` — não há API própria.
- **Deploy**: Vercel Hobby, `https://meu-app-maj4.vercel.app` + domínio `ccm.majsolucoes.com`
  (CNAME Cloudflare). Repo GitHub `alemonteirof/meu-app`.
- **Observabilidade**: `@sentry/react` (`main.jsx`, `enabled: import.meta.env.PROD`, DSN em
  `VITE_SENTRY_DSN`) + tabela `security_events` via `src/lib/securityLog.js` (`logSecurityEvent`).
- Arquivos-chave: `App.jsx` (cadastro: Painéis/Dispositivos/Combate/Dashboard/Configurações),
  `AtendimentosNovo.jsx` (Visitas/RVT/Relatório de Inspeções), `supabaseAdapter.js` (dados),
  `src/lib/falhasPorMarca.js` (catálogo de códigos de falha Hochiki/Notifier + `escopoDaFalha`),
  `src/lib/securityLog.js`, `src/supabaseClient.js`.

## 2. Schema Postgres (tabelas e colunas relevantes)

IDs: string curta via `uid()` (não UUID), exceto `combate_historico` (`bigint identity`).
RLS: `has_client_access(cliente_id)` / `is_admin()` / `is_maj_staff()`, todas `SECURITY DEFINER`
com `search_path` fixo; nenhuma policy usa `true` puro.

### `clientes`
`id, nome, endereco, contato, logo_data, cover_color, cover_image_data, bg_color, created_at`.
Migrado do blob `kv_store['pci-clientes-v1']` (só usado hoje em modo local sem Supabase). Mapper:
`rowToCliente`/`clienteToRow` ([supabaseAdapter.js:10](src/supabaseAdapter.js:10)).

### `paineis`
`id, cliente_id, nome, localizacao, modelo, marca, data_instalacao, observacoes`. CHECK
`paineis_marca_check`: `marca is null or marca in ('hochiki','notifier')` (minúsculo).

### `lacos`
`id, painel_id, nome, numero`.

### `dispositivos` (tabela central — endereçáveis, NAC, complementares, sirenes, rede, gás)
`id, cliente_id, laco_id, painel_id, modulo_pai_id, endereco, etiqueta, descricao, tipo_modulo,
modelo, categoria_funcional, papel_sinal, sub_endereco, etiqueta_complementar, data_calibracao,
proxima_calibracao, proxima_inspecao, ultima_manutencao, ultima_inspecao, resultado_teste,
aparencia, comunicacao_local, comunicacao_rede, visual, sonoro`.

- `visual`/`sonoro` (migração `migracao_sirene_visual_sonoro.sql`): só usados por sirene
  (`tipo_modulo='sirene'`); mesmo vocabulário/CHECK de `resultado_teste`
  (`Aprovado/Reprovado/Não avaliado`), espelhados a partir de `inspecoes` pela mesma lógica de
  `aparencia`/`comunicacao_*` em `createInspecao`.

- `tipo_modulo` (CHECK, lista em `TIPOS_MODULO_VALIDOS`
  [supabaseAdapter.js:827](src/supabaseAdapter.js:827)): `fumaca, calor, acionador, saida, rele,
  entrada, entrada_duplo, zona, modulo_saida, detector_gas, rede_conversor, rede_placa, sirene,
  outro`.
- Discriminação de "categoria" pela combinação de FKs (feita em `loadClientData`,
  [supabaseAdapter.js:631-668](src/supabaseAdapter.js:631)):
  - `laco_id OR modulo_pai_id` preenchido → **`devices`** (endereçáveis do laço + filhos
    Tipo1/sirene, mesmo sem laço próprio).
  - `!laco_id && painel_id && !REDE_TIPOS[tipo_modulo]` → **`nacs`** (`tipo_modulo` sempre
    `modulo_saida`).
  - `!laco_id && painel_id && REDE_TIPOS[tipo_modulo]` → **`redeDispositivos`**.
  - `!laco_id && !painel_id && !modulo_pai_id` → **`gasDetectors`**.
- `modulo_pai_id` (FK opcional, `on delete set null`, migração `migracao_dispositivo_complementar_pai.sql`):
  liga um dispositivo filho a um módulo de entrada (Tipo 1) ou a um módulo de saída/NAC (sirene).
- `categoria_funcional` values por família — ver seção 3.
- CHECKs: `dispositivos.tipo_modulo` tem CHECK; `categoria_funcional` **não** tem CHECK de propósito
  (caminho legado grava `'Detector de Gás'` string livre).

### `atendimentos` (Manutenção/Corretiva)
`id, cliente_id, dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id, falha, status,
falha_codigo, falha_marca, falha_categoria, falha_escopo, tecnico, descritivo, origem_inspecao_id,
fotos (jsonb[]), data_agendamento, data_registro, data_resolucao, resolvido_rvt_id, tipo`.
CHECK `*_alvo_unico_check`: exatamente 1 de `dispositivo_id/bateria_painel_id/fonte_auxiliar_id/
painel_id` não-nulo. `status`: `aguardando|andamento|resolvido` (lowercase no banco, capitalizado
só na UI via `statusCapitalizado` [supabaseAdapter.js:272](src/supabaseAdapter.js:272)).
Criado por `createAtendimento` ([supabaseAdapter.js:332](src/supabaseAdapter.js:332)).

### `inspecoes`
`id, cliente_id, dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id, tecnico,
resultado_teste, aparencia, comunicacao_local, comunicacao_rede, visual, sonoro, observacoes,
falha, falha_codigo, falha_marca, falha_categoria, falha_escopo, metodo, data_inspecao,
proxima_inspecao, fotos`.
CHECKs em `resultado_teste/aparencia/comunicacao_local/comunicacao_rede/visual/sonoro` (`IS NULL OR`
+ enum). Vocabulário fixo: `Aprovado/Reprovado/Não avaliado`, `Ótimo/Bom/Regular/Precisa Trocar`,
`Conforme/Não conforme` — **nunca** reintroduzir `operante/nao_operante/em_manutencao`.
`visual`/`sonoro` só se aplicam a sirene, mesmo vocabulário de `resultado_teste`.
Criado por `createInspecao` ([supabaseAdapter.js:409](src/supabaseAdapter.js:409)): grava a
inspeção, opcionalmente cria 1 `atendimento` (corretiva automática) se `falha` vier preenchida, e
faz `update` no alvo (`dispositivos.ultima_inspecao/proxima_inspecao/resultado_teste/aparencia/
comunicacao_local/comunicacao_rede/visual/sonoro`, ou `data_inspecao/proxima_inspecao` em
`baterias_painel`/`fontes_auxiliares`).

### `atendimento_intervencoes` (append-only)
`id, atendimento_id, cliente_id, rvt_id, data, tecnico, status_resultante, descricao, fotos`.
Nunca sobrescreve o atendimento original — só atualiza `atendimentos.status` (e `resolvido_rvt_id`/
`data_resolucao` se `status_resultante='resolvido'`) como "cache" de leitura. Criado por
`registrarIntervencaoAtendimento` ([supabaseAdapter.js:493](src/supabaseAdapter.js:493)). Excluir o
RVT que contém a intervenção que resolveu a pendência reverte `atendimentos.status` (lógica em
`deleteVisita`, em torno de [supabaseAdapter.js:1295](src/supabaseAdapter.js:1295)).

**Solução provisória** (2026-10-04, `migracao_provisoria_e_nao_conformidades.sql`):
`atendimento_intervencoes.provisoria` + `falta_definitiva`. Na intervenção, 3ª opção "Solução provisória
(paliativo)" → grava `status_resultante='andamento'`, `provisoria=true` e exige "o que falta para a
definitiva". Item "em provisório" = última intervenção (por `criado_em`) provisória e item não resolvido —
derivado por `anexarProvisoria` (vira `atendimento._provisoria = {desde, falta, descricao}` em
`fetchVisitasEnriquecidas`/`listAtendimentosAbertos`). Selo `SeloProvisoria` no card (Visitas e
pendências anteriores), bloco tracejado "SOLUÇÃO PROVISÓRIA" no RVT impresso (só se o paliativo já
existia no dia da visita) e card/lista "Em solução provisória" no Indicador → Pendências
(`listItensProvisorios`). Remanejamento de peça: decidido NÃO tratar (fica no texto da intervenção).
Itens avulsos (sem intervenção) ficam fora.
Também na abertura (2026-10-06): "+ Manutenção" tem Status "Solução provisória (paliativo)" com
"Paliativo aplicado" + "O que falta para a definitiva" (obrigatórios) + "Fotos do paliativo"
(`palFotos`, vão na intervenção; as fotos normais viram "Fotos do problema" e ficam na corretiva) → `submitAtendimento` cria a
corretiva em `andamento` e, na mesma visita, chama `registrarIntervencaoAtendimento({provisoria:true})`
(o RVT mostra a corretiva e a intervenção paliativa).
"Itens adicionados agora" (workspace da visita) mostra `PendenciasItem` em cada corretiva aberta
criada na hora (manutenção ou gerada por inspeção) — classifica pendências sem finalizar a visita
nem passar pela tela temporária; sugere pendência compartilhada p/ itens com mesma falha+descritivo.
**Bug antigo corrigido no mesmo dia**: CHECK `rvt_itens.um_dos_tres` recusava item de intervenção (o
"Registrar intervenção" nunca tinha gravado nada — 0 intervenções no banco) e "Outro" só com atividade
(Diagnóstico sem texto). Agora aceita exatamente 1 de atendimento/inspeção/intervenção/outro.

### `nao_conformidades` (NC — 2026-10-04, mesma migração)
"Fora da regra mesmo funcionando" (ex.: fontes Nissan sem certificação/subdimensionadas) — separado de
corretiva ("quebrou"), não entra no Dashboard de falhas. Colunas: `cliente_id, rvt_id` (visita opcional →
sai no RVT dela), `classificacao` (`normativa|regras_internas|seguradora`), `norma`, `norma_item`, `titulo`,
`descricao` (constatação), `local_texto`, `painel_id`, `dispositivo_id`, `risco` (`alto|medio|baixo`),
`recomendacao`, `fotos` (Storage), `data_constatacao`, `status` (`aberta|em_tratamento|encerrada`),
encerramento `encerrada_em, solucao, fotos_solucao` + `encerrada_por_*` (trigger `nao_conformidade_carimbo`),
`origem_conversao` jsonb (snapshot das corretivas convertidas). RLS: SELECT `has_client_access`; escrita
`is_maj_staff()`. Pendências: `pendencia_alvos.nao_conformidade_id` (alvo NC não entra na regra de status).
- Adapter: `listNaoConformidades`, `salvarNaoConformidade` (encerrar = status encerrada + solução),
  `excluirNaoConformidade`, `listVisitasResumo`, constantes `NC_CLASSIFICACOES/NC_RISCOS/NC_STATUS/
  NC_NORMAS_SUGERIDAS` (só nomes de norma; o ITEM é digitado pela MAJ do texto oficial — nunca sugerido).
- UI: menu "Não conformidades" (`components/NaoConformidades.jsx`, todos os papéis; edição só `canEdit`):
  4 cards, filtros status/classificação/risco, form, fotos, pendências da NC (`PendenciasItem` com
  `{naoConformidadeId}`), encerrar (solução + fotos), reabrir, excluir (confirmação inline), impressão
  (`NcPrintView`) e Excel. RVT: seção "NÃO CONFORMIDADES IDENTIFICADAS" (`NcPrintBlock`) com as NCs
  cuja `rvt_id` está nas visitas impressas.

### `rvts` (Visita/RVT)
`id, cliente_id, painel_id, tecnico, data_visita, assinatura_cliente, assinatura_cliente_tipo,
assinatura_cliente_data, assinatura_cliente_login, assinatura_cliente_user_id,
assinatura_cliente_origem`. `assinatura_cliente_login/user_id` são gravados por **trigger Postgres**
(`log_assinatura_rvt` → tabela `assinatura_auditoria`, append-only, sem UPDATE/DELETE policy) usando
`auth.uid()`/`auth.jwt()->>'email'` do servidor — o app nunca manda esses campos.
`assinatura_cliente_origem`: `desenho | texto | salva`. Criado por `createVisita`
([supabaseAdapter.js:279](src/supabaseAdapter.js:279)).
Assinatura do **técnico** (`migracao_assinatura_tecnico_rvt.sql`): `assinatura_tecnico`,
`_tipo`, `_origem`, `_data`, `_login`, `_user_id`, `_nome`. Trigger `log_assinatura_tecnico_rvt`
exige `is_maj_staff()`, carimba uid/email/nome(profiles)/data do servidor, trava o carimbo quando a
assinatura não muda e grava evento `tecnico_assinada | tecnico_refeita` na mesma `assinatura_auditoria`.
Em INSERT as colunas são zeradas (`bloqueia_assinatura_tecnico_insert`). App grava via
`salvarAssinaturaTecnicoVisita`.

### `pendencias` / `pendencia_alvos` (Pendências para conclusão — `migracao_pendencias.sql`)
O que um item em Aguardando/Andamento está aguardando. Pertence ao **item**, não ao RVT (o
`desde` nunca zera quando o item reaparece em outra visita).
- `pendencias`: `id uuid, cliente_id, tipo` (`material|liberacao|parada_maquina|condicao_seguranca|
  decisao_cliente|outro` + `tipo_outro`; rótulos em `PENDENCIA_TIPOS` — `parada_maquina` aparece
  como "Dia não produtivo/Parada de máquina" desde 2026-10-04), `responsavel` (`cliente|maj`), `detalhe` (texto livre),
  `materiais` jsonb `[{item, qtd, unidade, especificacao, marca, obs}]` (só tipo material), `desde`,
  `previsao`, `origem_rvt_id`, baixa: `baixa_em, baixa_obs, baixa_rvt_id, baixa_por_uid/email/nome`
  (carimbo pelo trigger `pendencia_carimbo`, servidor). "Sem detalhe" é derivado (sem materiais /
  sem texto), não é coluna. Nunca apagada na baixa; `excluirPendencia` só p/ cadastro por engano.
- `pendencia_alvos`: `pendencia_id, cliente_id, atendimento_id | rvt_item_id` (exatamente 1).
  **Pendência compartilhada** = N alvos (ex.: 5 sirenes do mesmo diagnóstico → soma de material
  não multiplica). Alvo apagado → cascade; pendência sem alvo é apagada pelo trigger
  `pendencia_limpa_orfa` (ex.: visita cancelada).
- Alvos válidos: corretivas (`atendimentos`) + avulso `manutencao_nao_cadastrada` corretiva
  (`rvt_itens`). Indicador legado (kv_store) fica de fora. Combate (SPCI): depois.
- RLS: SELECT `has_client_access`; INSERT/UPDATE/DELETE `is_maj_staff() and has_client_access`.
- Adapter: `listPendencias`, `listNomesMateriais` (autocomplete), `salvarPendencia` (upsert +
  insere só alvos novos + remove só os que saíram), `darBaixaPendencias`, `reabrirPendencia`,
  `excluirPendencia`, `pendenciasQueFechariam({atendimentoId|rvtItemId})` (abertas cujos outros
  alvos já estão resolvidos). `deleteVisita` reabre pendências com `baixa_rvt_id` = visita apagada.
- UI: `components/Pendencias.jsx` — `PendenciasItem` (bloco no card do item em Visitas anteriores
  e na aba "Pendências de visitas anteriores"; cadastro/editar/completar/baixa/reabrir/excluir;
  ao criar oferece "vale também para" as outras corretivas abertas da mesma visita com mesma
  falha+descritivo) e `usePerguntaBaixa` (diálogo Voltar / Resolver sem baixa / Resolver e dar
  baixa) chamado em `salvarIntervencao` e `saveEditItem` quando o item passa a Resolvido. Edição
  pelo Indicador (App.jsx `submitIndicador`) usa `window.confirm` simples (sem "Voltar").
- RVT impresso (`VisitaPrintView`, prop `pendencias`): `PendenciasPrintBlock` no fim do card de item
  não resolvido, **separado por responsável (decisão 2026-10-07, "puxar sardinha pra MAJ")**:
  cliente = bloco "AGUARDANDO O CLIENTE" com moldura vinho (borda esq. 4px), cabeçalho tingido,
  selo CLIENTE e "N dias aguardando" em vinho; MAJ/sem responsável = bloco discreto cinza, sem
  contagem de dias. `PendenciasResumoPrint` no topo (abaixo dos 4 cards): "N pendências aguardando
  o cliente" em destaque + "+ N em andamento com a MAJ" em cinza. Cores via `--pend-bg/-borda/-txt`
  na classe `.rvt-pend-cliente` (versão tela escura e versão papel no `@media print`, App.jsx).
  Campos: Tipo, Desde, Previsão, detalhe ou tabela de materiais; classe
  `.rvt-pendencias` com `break-inside: avoid` no `@media print`. Mostra as pendências **vigentes no
  dia da visita** (`pendenciasVigentesNoDia`: `desde <= dia` e sem baixa até o dia) — reimprimir RVT
  antigo mostra a situação daquele dia. `agruparItensParaImpressao` inclui os ids das pendências na
  chave: corretivas só juntam no mesmo card se compartilham as mesmas pendências (efeito: o card
  "Itens registrados" pode subir quando um item do grupo ganha pendência própria).
- Indicador → aba **Pendências** (`components/PendenciasIndicador.jsx`, 3ª aba ao lado de SDAI/SPCI,
  todos os papéis veem; "Dar baixa" só `canEdit`). Dados: `listPendenciasDetalhadas(clienteId)`
  (embed de alvos → painel/laço/etiqueta/END, falha+descritivo, `origem:rvts!pendencias_origem_rvt_id_fkey`).
  Só abertas. 4 cards (total/cliente/MAJ/mais antiga), filtros responsável+tipo, grupos Cliente→MAJ
  e por tipo (ordem de `PENDENCIA_TIPOS`, recolhíveis), mais antigas primeiro. `consolidarMateriais`
  soma por item+especificação+unidade (ignora maiúsc./espaços; nome exibido = grafia com mais qtd),
  separado por responsável. Imprimir = `PendenciasPrintView` (`.print-area` + `rvt-brand-band`, A4
  deitado global, tabelas por tipo + materiais). Excel = `montarPlanilhaPendencias` (wrapper no
  componente formata as linhas; gerador puro em `lib/pendenciasXlsx.js`, carregado dinâmico com
  exceljs+jszip). 3 abas: **Dashboard** (faixa vinho, lista suspensa Todos/Cliente/MAJ em D5 que
  recalcula tudo via COUNTIFS/MAXIFS — auxiliares na coluna O oculta; 6 cards; tabelas por
  responsável/situação da previsão/tipo/faixa de dias; top 10 mais antigas fixo; impressão 1 página),
  **Pendências** (base com Faixa + Situação da previsão, filtro, zebra, destaque 31–90/+90 dias e
  Vencida) e **Materiais**. Gráficos nativos (rosca + 2 barras empilhadas Cliente/MAJ): o ExcelJS
  não faz gráfico, então o DrawingML é injetado no .zip depois (`injetarGraficos`) apontando para as
  tabelas do Dashboard — mudar linhas/colunas das tabelas exige ajustar as âncoras e refs dos
  gráficos. Tipo "Outro" sai como "Outro — <texto>" e é contado com curinga `Outro*`. Pendências
  da MAJ ficam **visualmente discretas** de propósito (cinza claro `MAJ_COR`/`MAJ_TXT` nos gráficos,
  card e linhas; destaque de atraso/Vencida só nas do Cliente) — os números continuam completos. Tudo respeita
  os filtros da tela.
- **Tela TEMPORÁRIA "Classificar pendências"** (`components/ClassificarPendencias.jsx`, view
  `classificar`, item no `NAV_ITEMS` só no papel admin + guard `navRole === 'admin'`): itens abertos
  sem nenhuma pendência de TODOS os clientes visíveis (`listItensSemPendencia`: corretivas +
  avulsos `manutencao_nao_cadastrada` corretiva). Filtros cliente (começa no atual)/painel/período
  da visita, "marcar todos", barra com N linhas Tipo+Responsável ("+ Outro tipo"; um item pode
  aguardar várias coisas) → "Aplicar" cria 1 pendência por linha em cada grupo (tipo repetido é
  recusado, exceto "Outro"). `agruparParaPendencia`: itens
  da mesma visita com mesma falha+descritivo viram 1 pendência compartilhada; o resto, 1 cada.
  `desde` = data da 1ª visita do item (fallback `data_registro`). Pendência nasce sem detalhe;
  contador `contarPendenciasSemDetalhe`. Confirmação do "Aplicar" é inline (não `window.confirm`:
  o navegador embutido do app Claude não mostra a caixa e devolve Cancelar).
  3 abas: **Classificar** · **Completar detalhe** (pendências sem detalhe do cliente aberto, com
  falha+descritivo antigo, `PendenciaForm` inline — grava na própria pendência, que continua no
  item da visita) · **Reenviar RVTs** (visitas cujo RVT agora mostra pendências —
  `visitaTemPendencias` exportado de AtendimentosNovo; "Ver / Imprimir" individual ou "Imprimir
  juntas" via `VisitaPrintView` exportado, import dinâmico; avisa "N sem detalhe").
  4ª aba (2026-10-04) **Converter em NC**: marca corretivas abertas (mesmo cliente) → 1 NC
  (`converterCorretivasEmNC`: cria a NC na visita mais antiga com fotos/texto + snapshot em
  `origem_conversao`, move as pendências pra NC — insere alvo NC antes de apagar o antigo — e apaga as
  corretivas). Confirmação inline lista o que deixa de existir.
  **REMOVER A TELA INTEIRA (as 4 abas) quando tudo estiver classificado** — combinado com o
  Alexandre em 2026-10-02/04: NAV_ITEMS + NAV_KEYS_BY_ROLE.admin + render em App.jsx + o arquivo +
  exports só usados por ela (`visitaTemPendencias`, export de `VisitaPrintView`,
  `listItensSemPendencia`, `contarPendenciasSemDetalhe`, `listCorretivasParaConversao`,
  `converterCorretivasEmNC`). A tabela/menu de NC e `origem_conversao` FICAM.
- **Status do item pelas pendências** (decisão 2026-10-04, `sincronizarStatusPorPendencias` no
  adapter, chamado por `darBaixaPendencias`/`reabrirPendencia`/`excluirPendencia`; também em
  `recalcularStatusAtendimento`): Resolvido nunca é tocado; corretiva com intervenção segue a última
  intervenção; sem intervenção → alguma pendência com baixa = **Andamento**, nenhuma = **Aguardando**
  (reabrir/excluir a única baixa devolve a Aguardando). Avulso (status no jsonb): mesma regra.
  Baixa em TODAS **não resolve** o item (resolver = técnico, via intervenção/editar item).
  **"Sem impedimentos — pronto para executar"**: categoria derivada (não é status no banco) = item
  não resolvido com pendência(s) e todas com baixa. Aparece como selo verde no card do item
  (`PendenciasItem`) e no Indicador → Pendências (card "Prontos p/ executar" + seção própria;
  `listPendenciasDetalhadas` agora devolve `itens[].chave` = `at:<id>`/`ri:<id>`).
- Datas "hoje" das pendências usam data LOCAL (`hojeLocal`/`hojeISO`), não `toISOString` (UTC).

### `rvt_itens` (join Visita ↔ item)
`id, rvt_id, atendimento_id, inspecao_id, intervencao_id, outro_descricao, outro_fotos,
outro_atividade, outro_atividade_dados (jsonb)`. Inserido por `addItemToVisita`
([supabaseAdapter.js:288](src/supabaseAdapter.js:288)) — 1 linha por item de qualquer tipo
(atendimento OU inspeção OU intervenção OU "outro").

### `baterias_painel` / `fontes_auxiliares`
`baterias_painel`: `id, cliente_id, painel_id, tecnico, data_inspecao, bateria1_tensao,
bateria1_data, bateria2_tensao, bateria2_data, proxima_inspecao, fotos`. Auto-gerada 1 por painel,
2 baterias fixas, anual, troca a cada 2 anos.
`fontes_auxiliares`: mesmas colunas de bateria + `nome, tensao_saidas`. Cadastro livre.
Selecionáveis em Atendimentos com id prefixado `bp:<id>` / `fa:<id>` (`decodeAlvo`/`idsPorAlvo`,
[AtendimentosNovo.jsx:323](src/AtendimentosNovo.jsx:323)).

### `assinaturas_salvas` / `assinatura_auditoria`
`assinaturas_salvas`: 1 linha por `user_id` (RLS `user_id = auth.uid()`), `origem` = `desenho|texto`.
`assinatura_auditoria`: log append-only gravado só pelo trigger, nunca pelo app.

### Checklist de ferramentas / assinatura MAJ (`tool_checklists`, `assinaturas_salvas_maj`, `assinatura_auditoria_maj`)
- Só membros MAJ (`is_maj_staff()` = admin/operador) registram e assinam. Banco de assinatura **separado**
  do RVT: `assinaturas_salvas_maj` (quem assina RVT não assina checklist). Vale também p/ DDS (ver abaixo).
- `tool_checklists` + `assinatura_tipo/valor/origem/hash`, `assinado_por_uid/email/nome`, `assinado_em`.
  Trigger `tool_checklist_assinar` (BEFORE INSERT) exige MAJ + assinatura e carimba uid/email/nome/data/
  sha256 e força `tecnico_id = auth.uid()`. Sem policy de UPDATE → registro imutável.
- `assinatura_auditoria_maj`: genérica (`documento_tipo` 'tool_checklist'|'dds', `documento_id` SEM FK),
  eventos `assinada` / `excluida` (este com `snapshot` jsonb do registro apagado) — trilha sobrevive à exclusão.
- UI: `MajSignatureField` (components/) — mesma UX do `SignatureField` do RVT, mas só devolve
  `{tipo, valor, origem}` pro form (grava junto no insert).
- Saída: só PDF (Excel removido em 2026-10-02 a pedido do Alexandre — `exportChecklist*Xlsx.js` apagados).
  `ToolChecklistPdf.jsx`: `ChecklistPdfIndividual` (botão "PDF" no Histórico, A4 em pé) e `ChecklistPdfMes`
  (aba "PDF do mês", grade dias 1-31, A4 deitado, com tabela de assinaturas do mês). Folha comum a DDS e
  checklist: `MajFolhaImpressao.jsx` (cabeçalho `rvt-brand-band`, `@page` por folha, cor fixada na `.print-area`).
- Abas do `ToolChecklistScreen`: Preencher novo · Histórico/PDF do mês/**Equipamentos** (admin) ·
  **Minha assinatura** (todo MAJ — pré-cadastro via `MajSignatureField modoCadastro`). Equipamentos
  (`ToolEquipamentosAdmin`): cadastrar/editar/desativar — sem excluir (FK de `tool_checklists`).
- Tipos: `TOOL_CHECKLISTS` em `lib/toolChecklists.js`; checklist pode limitar opções via `statusOptions`
  e mostrar `avisoNC`. `cinto_talabarte` (SEG-EPI-001) = só C/NC/NA.

### DDS — Diálogo Diário de Segurança (`dds_sessoes`, `dds_assinaturas`)
- Só membros MAJ (RLS `is_maj_staff()`); botão "DDS" ao lado de "Checklist de Ferramentas" (tela sem cliente).
- `dds_sessoes`: `tema_codigo/tema_titulo`, `data_dds`, `local`, `status` 'aberto'|'encerrado',
  `criado_por_*` e `encerrado_por_*` carimbados pelo trigger `dds_sessao_guard`. Qualquer MAJ abre; só quem
  abriu (ou admin) encerra; encerrado não muda mais. Excluir = só admin (cascade nas assinaturas).
- `dds_assinaturas`: 1 por login por DDS (`unique(dds_id, assinado_por_uid)`). Cada participante assina com o
  PRÓPRIO login no próprio aparelho; trigger `dds_assinar` carimba uid/email/nome/data/sha256 e recusa se o DDS
  estiver encerrado. Sem UPDATE/DELETE pelo app.
- Trilha: `assinatura_auditoria_maj` com `documento_tipo='dds'`, `documento_id` = id do DDS; eventos
  `aberto`/`encerrado`/`excluida` (sessão) e `assinada`/`assinatura_excluida` (presença).
- Conteúdo dos 50 temas em `lib/ddsTemas.js` (gerado de `DDS_MAJ_50_Temas.md`); banco guarda só código/título.
  Sugestão = próximo da sequência após o último DDS aberto (01→50, volta ao 01); dá pra trocar.
- Saída: só PDF (sem Excel) — "Gerar PDF" após encerrar → folha A4 em pé via `window.print` (mesmo esquema
  `.print-area`/`rvt-brand-band` do RVT) com tema resumido + tabela de participantes com assinatura e hash.
- UI: `components/DdsScreen.jsx` (lista abertos/encerrados · abrir novo · detalhe com assinar/encerrar ·
  impressão) + aba "Minha assinatura" (mesmo `assinaturas_salvas_maj` do checklist).

### `profiles.nome` / `profiles.empresa`
Pedidos no primeiro login (`PerfilInicialScreen` no `AuthGate`), gravados via RPC `definir_meu_perfil`
(security definer, só altera esses 2 campos — usuário segue sem UPDATE no próprio `role`). Expostos no
`AuthContext` (`nome`, `empresa`); nome preenche "Técnico responsável" do checklist.

### Combate (SPCI) — pipeline paralelo, não usa `dispositivo_id`
- `combate_conjuntos`: `id, cliente_id, painel_id (nullable), tipo, agente, etiqueta`. `tipo` ∈
  `casa_bombas|hidrante|vga|lge|sistema_gas` (chaves de `COMBATE_CONJUNTO_TIPOS`).
- `combate_subitens`: `id, cliente_id, conjunto_id, categoria, tecnico, data_inspecao,
  resultado_teste, valor_medido, observacoes, falha, proxima_inspecao, fotos,
  data_retest_laboratorial, proxima_retest_laboratorial` — 1 linha por item fixo do checklist do
  conjunto (auto-gerado na criação, nunca CRUD livre).
- `combate_componentes`: `id, cliente_id, tipo, etiqueta, conjunto_id (opcional), dispositivo_id
  (opcional, linka a um módulo do painel via `DeviceLinkPicker`), tecnico, data_inspecao,
  resultado_teste, valor_medido, observacoes, falha, proxima_inspecao, fotos`. `tipo` ∈
  `fluxostato|pressostato|solenoide|chave_supervisora|chave_abandono`.
- `combate_baterias_cilindros`: `id, cliente_id, painel_id (nullable), agente, etiqueta`.
- `combate_cilindros`: `id, cliente_id, bateria_id, identificacao, tecnico, data_inspecao,
  resultado_valvula, resultado_manometro, resultado_corpo, resultado_etiqueta, observacoes, falha,
  proxima_inspecao, fotos, data_retest_laboratorial, proxima_retest_laboratorial`. Retest
  laboratorial: só a data é digitada, `proxima_retest_laboratorial` é calculada
  (`+COMBATE_RETEST_LABORATORIAL_MESES` = 60 meses).
- `combate_historico` (`bigint identity`, append-only): log de toda vistoria SPCI, gravado junto com
  o `update` de subitem/componente/cilindro (`registrarHistoricoCombate`,
  [supabaseAdapter.js:1260](src/supabaseAdapter.js:1260)) — base do Indicador SPCI.
- Updates parciais: `updateCombateSubitem/Componente/Cilindro`
  ([supabaseAdapter.js:1215-1242](src/supabaseAdapter.js:1215)).

### `memberships` / `profiles`
`profiles.role` ∈ `admin|operador|visualizador` (usado por `is_admin()`). `memberships` liga
`user_id`↔`cliente_id`. Precisa de 2 policies PERMISSIVAS: `memberships_admin_all` (`is_admin()`,
FOR ALL) + `memberships_self_select` (`user_id = auth.uid()`) — uma `FOR ALL` só com `is_admin()`
sem policy de INSERT explícita **não basta** (RESTRICTIVE por padrão não concede, só filtra).
"Vincular" só grava `memberships`; o papel geral (`profiles.role`, que decide DDS/Checklist via
`is_maj_staff()`) é trocado em Configurações → usuários vinculados ("Equipe MAJ"/"Cliente") via RPC
`definir_papel_global` (só admin, só operador↔visualizador, nunca mexe em perfil admin).

### `security_events` (append-only)
Insert só aceita `evento IN ('login_falhou','acesso_negado')`, teto 100/min. `pg_cron` job
`purga_security_events` apaga >90 dias às 3h UTC. Só `is_admin()` lê.

### `kv_store` (legado, aposentado como fonte de criação nova)
Chave `pci-dados-cliente-<clienteId>` guarda `{ pumpDevices, maintenanceLog, inspectionLog,
modelPhotos, indicador, rvt }` — só os registros com `origemNovo` ausente/false ainda vivem aqui;
tudo com `origemNovo: true` já é linha própria em `atendimentos`/`inspecoes`/`rvts`. Policy
`leitura_kv`: chaves com `client_id IS NULL` só legíveis por `is_maj_staff()` OU quem tem qualquer
membership.

## 3. Categorias funcionais / método de teste travado

Constantes em `supabaseAdapter.js`:

```
FUNCTIONAL_CATEGORIES        // módulo de entrada: detector_linear, acionador_manual,
                              // detector_gas_hc/co2/outro, termovelocimetrico, detector_chama, outro
FUNCTIONAL_CATEGORIES_ZONA   // módulo de zona: zona_calor, zona_fumaca, zona_chama, zona_geral, zona_outro
FUNCTIONAL_CATEGORIES_SAIDA  // módulo de saída/NAC: sirenes, saida_outro
functionalCategoriesForType(type)  // zona → FUNCTIONAL_CATEGORIES_ZONA, senão FUNCTIONAL_CATEGORIES
```

`getMetodoTeste(device)` ([supabaseAdapter.js:165](src/supabaseAdapter.js:165)):
```js
if (type is entrada|entrada_duplo|zona) return METODO_POR_CATEGORIA_FUNCIONAL[categoriaFuncional];
else return METODO_POR_TIPO[type];
```
`METODO_POR_TIPO`: `fumaca→spray, calor→soprador térmico, acionador→5x seguidas, saida→comando pela
central, rele→multímetro+jump, rede_conversor/rede_placa→LEDs+reaperto, sirene→injeção 24V`.
`METODO_POR_CATEGORIA_FUNCIONAL`: `detector_linear→obscurecimento, detector_chama→UV-IR,
detector_gas_*→Bump Test, termovelocimetrico→soprador térmico, acionador_manual→5x seguidas,
zona_calor/fumaca/chama→idem versão zona, zona_geral→spray+soprador, zona_outro→''`.

`CATEGORIAS_COM_PAPEL_SINAL = ['detector_linear','detector_chama','detector_gas_hc','detector_gas_co2','detector_gas_outro']`
— essas categorias também pedem `papel_sinal` (`falha|alarme|pre_alarme`, `PAPEL_SINAL_OPTIONS`).

## 4. Dispositivos Complementares — 4 modelagens diferentes (não confundir)

1. **Tipo 1** (Beam/Chama/Gás/Termovelocimétrico, desde 2026-09-11): dispositivo **filho de
   verdade** (`modulo_pai_id` → módulo de entrada pai), 1-pra-1. Antes de 2026-09-11 reaproveitava a
   MESMA linha do módulo (bug: módulo sumia do seletor normal). Lógica: `syncModuloComplementar` /
   `categoriaFuncionalEfetiva` ([App.jsx:4093-4141](src/App.jsx:4093)), chamada por `submitDevice`.
   Ponto em aberto não resolvido: filho copia o `endereco` do pai só para exibição, sem constraint de
   unicidade `(laco_id, endereco)` — se o Postgres reclamar em produção, resolver com sufixo no
   endereço do filho.
2. **Sirenes** (desde 2026-09-11): módulo de saída/NAC com `categoria_funcional='sirenes'` abre lista
   editável (modelo + localização, N sirenes) → 1 dispositivo `type:'sirene'` por sirene, filho via
   `modulo_pai_id` (1-pra-N). Modelo travado por marca do painel:
   `SIRENE_MODELOS_POR_MARCA = { hochiki: [hec3_24, bullet], notifier: [pr2l, hrl] }`. Lógica central:
   `syncSirenes` ([App.jsx:4240](src/App.jsx:4240)), UI `SirenesFields`/`SireneList`
   (App.jsx ~4266/4489). Migração `migracao_sirene_tipo_dispositivo.sql` libera `'sirene'` no CHECK
   de `tipo_modulo` — precisa rodar antes de usar.
   Inspeção de sirene (desde 2026-09-13, `migracao_sirene_visual_sonoro.sql`) ganha 2 critérios
   extras — **Visual** e **Sonoro** (mesmo vocabulário de `resultado_teste`) — que só renderizam no
   form de Inspeção/edição quando `device.type === 'sirene'` (`saoTodasSirenes()`,
   [AtendimentosNovo.jsx](src/AtendimentosNovo.jsx)). Catálogo de falha próprio (`FALHAS_SIRENE` em
   `falhasPorMarca.js`, 4 itens: Visual/Sonoro com Defeito, Sem funcionamento, Sem resistor) —
   `FalhaSelect` troca pra essa lista (prop `sirene`) em vez do catálogo de código Hochiki/Notifier.
   Sugestão automática (editável) de falha a partir de Visual/Sonoro:
   `sugestaoFalhaSirene()`/`aplicarSugestaoFalhaSirene()` — "Sem resistor" nunca é sugerido, só
   manual.
3. **Bateria de Painel / Fonte Auxiliar**: tabelas próprias, auto-relacionadas por `painel_id`,
   selecionáveis em Atendimentos via id prefixado (`bp:`/`fa:`).
4. **Rede** (Conversor de Mídia / Placa): dispositivo de verdade (`painel_id` setado, sem laço,
   `tipo_modulo ∈ REDE_TIPOS = {rede_conversor, rede_placa}`), pipeline nativo (UI: `RedeList`/
   `RedeForm` em App.jsx).

## 5. `buildDeviceOptions` — seletor unificado de Atendimentos

Função em [AtendimentosNovo.jsx:220](src/AtendimentosNovo.jsx:220), gera a lista usada em todo
seletor de dispositivo (Manutenção/Inspeção/Diagnóstico). Cada opção:
`{ id, label, type, categoriaFuncional?, papelSinal?, nextInspection, panelId, panelName, loopId,
loopName, kind?, painelSintetico?, complementarSemCodigo? }`.

- Painel sintético: `id = PAINEL_OPT_PREFIX + painelId` (ex.: `pn:<id>`), `kind:'painel'`,
  `painelSintetico:true` — só entra em Manutenção/Corretiva/Diagnóstico
  (`deviceOptionsSemPainel = deviceOptions.filter(o => o.kind !== 'painel')` usado em Inspeção).
- `decodeAlvo(optionId)` / `idsPorAlvo(optionId)` ([AtendimentosNovo.jsx:323](src/AtendimentosNovo.jsx:323)):
  decodifica `bp:`/`fa:`/`pn:`/dispositivo puro → `{dispositivoId, bateriaPainelId,
  fonteAuxiliarId, painelId}` passado direto pros `create*`.
- `escopoDaSelecao(ids)` ([AtendimentosNovo.jsx:344](src/AtendimentosNovo.jsx:344)): `'painel'` se
  todos ids são `pn:`, `'dispositivo'` se nenhum é, `''` se misto — usado pra travar a lista do
  `FalhaSelect`.

## 6. Falha classificada — código, categoria e escopo

`src/lib/falhasPorMarca.js`: `FALHAS_HOCHIKI`/`FALHAS_NOTIFIER`, cada item
`{ codigo, texto, categoria, marca, escopo: 'painel'|'dispositivo' }`. `escopoDaFalha(codigo)`
resolve o escopo; texto livre ("Outro") não tem escopo. `CATEGORIAS_FALHA` = 14 categorias
unificadas usadas no Dashboard (10 de código de painel + 4 próprias de sirene).

- `FALHAS_SIRENE` (mesmo arquivo): catálogo próprio pra avaliação manual de sirene (Visual/Sonoro
  na inspeção) — **não** é código reportado pelo painel, então fica fora de `FALHAS_HOCHIKI`/
  `FALHAS_NOTIFIER`. 4 itens, `escopo:'dispositivo'` sempre (sirene é sempre item endereçável):
  `visual_defeito, sonoro_defeito, sem_funcionamento, sem_resistor`. `getFalhaPorCodigo` busca nas
  3 listas. `FalhaSelect` (`AtendimentosNovo.jsx`) recebe prop `sirene` — quando true (todos os
  dispositivos selecionados são `type==='sirene'`, via `saoTodasSirenes()`), troca a lista pra esse
  catálogo em vez do de código de painel, em todo callsite (Manutenção, Inspeção, Diagnóstico,
  edição de item).

- `falha_escopo` em `atendimentos`/`inspecoes` é **sempre derivado do código no backend**
  (`escopoDaFalha(falhaCodigo)` dentro de `createAtendimento`/`createInspecao`), nunca escolhido à
  mão na UI.
- ~14 códigos Hochiki / ~10 Notifier são `escopo:'dispositivo'` (endereço específico); resto é
  `painel` por padrão. Exceção tratada manualmente: **HOC-00 "Internal Trouble"** →
  `categoria:'dispositivo_desconectado'`, `escopo:'dispositivo'` (FireNET reporta por endereço).
  HOC-25/26/27/49 (watchdog/EPROM/RAM/dados corrompidos) seguem `sistema`/painel.
- `falhaClassificada(falhaSel)` ([AtendimentosNovo.jsx](src/AtendimentosNovo.jsx)): exige
  `codigo` OU `categoria` antes de salvar qualquer corretiva (Manutenção, Inspeção com falha,
  Diagnóstico Outro, edição de item) — trava contra itens "Não classificado" no Dashboard.
- `FalhaSelect` recebe prop `escopo`: filtra a lista de códigos **só quando `escopoDaSelecao(ids)
  === 'painel'`**; em `'dispositivo'` ou misto mostra a lista completa (correção pós-bug: o filtro
  cortava até no alvo dispositivo).
- Card "Falhas mais comuns" (Dashboard, App.jsx ~L3608) agrupa por `falha_categoria`. Corretivas
  `origem: manutencao_nao_cadastrada` → rótulo próprio "Item não cadastrado" (não cai em "Não
  classificado"). Backfill de categoria: `backfill_falha_categoria.sql` (regenerar com
  `scratchpad/gen_backfill.mjs` se `falhasPorMarca.js` mudar).
- **Decisão deliberada, não mexer**: sem toggle Painel/Dispositivo nem balde único "Falha de Painel"
  no card — destruiria o detalhe já útil (6 das 9 categorias já são intrinsecamente de painel).

## 7. Fluxo de Visita (Atendimentos → `AtendimentosNovo.jsx`)

Estado local: `visita` (row de `rvts` ativa), `itensVisita` (lista de resumo pra exibição imediata,
não é fonte de verdade — a fonte é `rvt_itens` via `listVisitas`).

- **Manutenção/Corretiva** — `submitAtendimento` ([AtendimentosNovo.jsx:2061](src/AtendimentosNovo.jsx:2061)):
  itera `atForm.dispositivoIds`, chama `createAtendimento` 1x por id selecionado.
- **Inspeção** — `submitInspecao` ([AtendimentosNovo.jsx:2103](src/AtendimentosNovo.jsx:2103)):
  itera `inspForm.dispositivoIds`, `metodo: getMetodoTeste(device)` calculado por item, chama
  `createInspecao`; se resultar em `atendimento` não-nulo, conta como corretiva automática gerada.
- **Pendências de visitas anteriores** — `listAtendimentosAbertos(clienteId)` traz tudo
  `status != 'resolvido'` de qualquer visita; `registrarIntervencaoAtendimento` grava sem tocar no
  atendimento original (só status "cache"). Ao iniciar/reabrir a visita (2026-10-06), se houver
  item em Aguardando/Andamento, a tela já abre nessa aba com aviso "N item(ns)… use Registrar
  intervenção para classificar" — só na carga inicial (recargas não trocam a aba).
- **Reabrir visita** — `reabrirVisita(v)`: seta `visita=v`, novos itens entram nela normalmente
  (mesmo `rvtId` usado por qualquer `submit*`).
- **Cancelar visita** — `cancelarVisita()`: `deleteVisita(visita.id)` — apaga em cascata
  `atendimentos`/`inspecoes` ligados via `rvt_itens`, mas preserva/reverte status de itens
  resolvidos por intervenção que só existiam por causa desse RVT.

## 8. `reportMode` (menu "Relatórios", só visualizador)

`view === 'relatorios'` renderiza `<AtendimentosNovo reportMode />` — mesma tela, sem router de URL
(guard é só a visibilidade no menu). `reportMode=true` força `canEdit=false`, esconde sub-abas
SDAI/Combate, fluxo de iniciar visita e todo botão de editar/excluir. Sobra: filtros + "Imprimir
período" + lista + `VisitaPrintView`. Filtro de cliente: `listVisitas(clientId)` + RLS
`has_client_access` na tabela `rvts` (mesmo padrão de qualquer outra tela — nunca vaza dado de
outro cliente).

## 9. Relatório de Inspeções (menu "Relatório")

Builders em App.jsx: `buildSDAIReportItems`/`buildSPCIReportItems`. SDAI monta 3 grupos:
`enderecaveis`, `nacs`, `complementares` (união de Tipo1 + sirenes + baterias + fontes + rede —
ver [App.jsx:6566-6631](src/App.jsx:6566)). Cada item carrega `extra: [{label, value, color}]` com
Status/Aparência/Com. local/Com. rede/Última/Próxima inspeção (item de sirene soma Visual/Sonoro
no mesmo array, mesma cor via `operStatusColor`), e `groupLabel` (painel pai) usado
pelo componente genérico `ReportGroup`/`ReportSection` (prop `groupBy`). Grupos colapsados na tela
(`display:none`) viram `display:block !important` em `@media print` — não trocar por lógica que
deixe de renderizar o conteúdo colapsado.

## 10. Indicador (legado, ainda ativo)

Alimentado por 2 fontes concatenadas em `loadClientData`
([supabaseAdapter.js:719-757](src/supabaseAdapter.js:719)): `indicadorNovos` (derivado ao vivo de
`atendimentos`/`inspecoes` via `alvoLabelInfo`, id `novo-at-<id>`/`novo-insp-<id>`) + `legacy.indicador`
(registros antigos do `kv_store`, sem `origemNovo`). `categoriaFor(dispositivoId)`
([supabaseAdapter.js:670](src/supabaseAdapter.js:670)) resolve a categoria de exibição
(`devices|nacs|gasDetectors|redeDispositivos`) checando em qual array o id aparece — sirenes caem em
`devices` por terem `modulo_pai_id`.

Mapeamento hardcoded específico do cliente Nissan (endereço de rede do painel → área):
`{1: SECURITY OFFICE, 2: PAINT, 3: TRIM, 4: PLASTIC, 5: BODY, 6: POWER TRAIN, 8: CENTRAL COP}`
(painel 7/AUTOLEARN e painéis Notifier ficam fora). Normalizações já aplicadas: variantes de
BODY→BODY, CBU→PLASTIC, SECURITY/SECUTIRY→SECURITY OFFICE, POWERTRAIN→POWER TRAIN, COP→CENTRAL COP.

## 11. RVT — impressão e assinatura

`VisitaPrintView`: header full-width vinho `#8B2F2F`, wordmark M.A.J, overlay diagonal (clip-path),
textura cross-hatch. `document.title` setado dinamicamente (`"RVT - ClienteX - Data"`) pra contornar
cabeçalho/rodapé nativo do navegador na impressão. `break-inside: avoid` + `print-color-adjust: exact`
corrige rodapé órfão.

`SignatureField`: 2 capacidades — (1) auditoria via trigger Postgres (seção 2, `rvts`), hash SHA-256
do valor assinado gravado por `pgcrypto`; (2) assinatura salva reutilizável
(`assinaturas_salvas`, `listAssinaturaSalva`/`upsertAssinaturaSalva`/`deleteAssinaturaSalva` ~
[supabaseAdapter.js:1179-1201](src/supabaseAdapter.js:1179)).

`RvtSignatureBlock` (impressão do RVT, individual e por período): bloco fixo **Contratante + Técnico
responsável**, sempre impresso. Contratante mostra a assinatura confirmada no `SignatureField` (que
agora exibe só o registro/auditoria, sem repetir a imagem); sem assinatura → linha em branco p/
assinar no papel. Técnico: assinatura digital via `TecnicoSignatureField` (reaproveita
`MajSignatureField` → mesma assinatura pré-cadastrada do checklist/DDS), visível só p/ `canEdit`
(admin/operador); sem assinatura → linha em branco + nome(s) do técnico. Voltar da impressão
recarrega a lista de visitas (assinaturas novas aparecem ao reabrir).

Campo de busca de dispositivo no item RVT: só aparece se o laço tem >8 dispositivos, filtra por
endereço/tipo/descrição, contador "X de Y".

## 12. Combate (SPCI) — telas e vistoria em massa

`buildCombateOptions` ([AtendimentosNovo.jsx:356](src/AtendimentosNovo.jsx:356)): lista unificada
de subitens/componentes/cilindros pra vistoria em massa, cada item com `{id, kind, grupo, label,
categoriaLabel, contextoLabel}`. "Visitas (Sistemas de Combate)": seleção múltipla agrupada por
`grupo`, 1 registro de vistoria aplicado a todos os selecionados →
`updateCombateSubitem/Componente/Cilindro` + 1 insert em `combate_historico`. Pipeline
**deliberadamente separado** do de dispositivos SDAI (evita reescrever tudo amarrado a
`dispositivo_id`) — única ponte é `combate_componentes.dispositivo_id` (link opcional, não
obrigatório).

## 13. Layout — dois temas

`UI_THEME_KEY='ccm-ui-theme'` no localStorage (`classico|novo`, default `classico`).
`readUiTheme()`/`applyUiTheme()` ligam a classe `ui-v2` no `<body>`. `ThemeToggle` (ícone `Palette`)
no header. CSS do tema Novo: bloco `body.ui-v2 {...}` dentro de `PageStyles` (gradiente dark+glow
vinho, `--radius-*` reduzidos). `@media print` tem tokens próprios, não afetado.
`UiThemeContext`/`useIsV2()` expõe o tema pra componentes com ramo `v2`: `StatCard`,
`SimplePieChart`, `SimpleBarChart`, `ChartCard`. Dashboard SDAI no tema Novo: 2 donuts lado a lado
(corretivas + visitas) + "Falhas mais comuns" full width abaixo. `PanelsList` foi redesenhado e
**revertido** por pedido do Alexandre — card de painel é idêntico nos 2 temas (commit 3143d4a).
Gráfico de tendência (linha) foi descartado, não entra.

## 14. Importadores multi-marca

- **Hochiki/VES CSV** (Loop Explorer 2): parser direto de coluna.
- **Hochiki/VES PDF** (Loop Explorer 1): `pdfjs-dist`, extração por coordenadas — o parser mescla
  itens de texto por banda de Y (ordenados esquerda→direita) e corta o nome do dispositivo na
  primeira keyword de Tipo encontrada (múltiplas colunas do PDF viram texto corrido no pdfjs).
- **Notifier XLS/XLSX** (VeriFire Tools): SheetJS.
- Import tem undo e export CSV do banco de dispositivos.
- Tipo "Módulo de Entrada Duplo" (DIMM/FDM-1): import detecta 2 sub-endereços automaticamente.
- **DIMM = 1 equipamento físico, 2 endereços lógicos.** Corretiva lançada junta nos 2 sub-endereços
  do mesmo módulo (mesma visita, laço, endereço base, falha e descritivo) = troca/dano físico → conta
  como **1** no RVT, card da visita, pendências, Dashboard e Indicador (rótulo "005.01 + 005.02",
  status = o menos avançado dos 2). Banco continua com 2 atendimentos (lógica/inspeção/status por
  endereço não muda). Regra única em `marcarParesDimmFisico` (supabaseAdapter.js): sub 1 ganha
  `_dimmPar`, sub 2 ganha `_dimmPrincipalId`. Editar o item ou registrar intervenção grava nos 2.
  Falha só em 1 sub-endereço, ou falhas diferentes = lógica → segue 2.

## 15. Migrações `.sql` na raiz do repo — status

Rodar sempre no SQL Editor do Supabase **antes** de subir o build que depende delas:

- `migracao_dispositivo_complementar_pai.sql` — coluna `modulo_pai_id` (Tipo 1). **Rodada.**
- `migracao_sirene_tipo_dispositivo.sql` — libera `'sirene'` no CHECK de `tipo_modulo`. **Rodada.**
- `migracao_complementares_manutencao.sql` — `cliente_id`/`bateria_painel_id`/`fonte_auxiliar_id`
  em `atendimentos`/`inspecoes`. Passos 4/5 (RLS + CHECK tipo_modulo) são manuais. **Rodada.**
- `migracao_escopo_falha_e_painel_item.sql` — `falha_escopo` + `painel_id` em
  `atendimentos`/`inspecoes`, backfill incluso. **Rodada.**
- `migracao_assinatura_auditavel.sql` — colunas de assinatura em `rvts` + trigger + `pgcrypto`.
  Substituiu `migracao_assinatura_login.sql` (apagado). **Rodada.**
- `migracao_memberships_rls.sql` — policies PERMISSIVAS de `memberships`. **Rodada.**
- `migracao_checklist_assinatura_maj.sql` — tipo `cinto_talabarte`, `profiles.nome/empresa` + RPC,
  assinatura MAJ em `tool_checklists` + triggers + `assinatura_auditoria_maj` + `assinaturas_salvas_maj`.
  Exige assinatura em checklist novo. **Rodada** (2026-10-01).
- `migracao_assinatura_importada.sql` — libera origem `importada` no CHECK de
  `tool_checklists.assinatura_origem` (RVT não precisa, sem CHECK). **Rodada** (2026-10-01).
  "Importar imagem" (RVT e checklist) usa `assinaturaDeImagem` em `lib/imagens.js`: PNG ≤600x200,
  fundo branco → transparente; grava `tipo='desenho'`, `origem='importada'`.
- `backfill_falha_categoria.sql` — backfill de `falha_categoria` a partir de `falhasPorMarca.js`.
  **Rodada** (regenerar com `scratchpad/gen_backfill.mjs` se as listas de falha mudarem).
- `migracao_sirene_visual_sonoro.sql` — colunas `visual`/`sonoro` + CHECK em `inspecoes` e
  `dispositivos`. **Pendente de rodar em produção.**
- `migracao_dds.sql` — tabelas `dds_sessoes`/`dds_assinaturas` + triggers + RLS (só MAJ) + trilha em
  `assinatura_auditoria_maj`. **Rodada** (2026-10-01).
- `migracao_papel_global.sql` — RPC `definir_papel_global` + corrige matheus.alves para operador.
  **Rodada** (2026-10-02).
- `migracao_assinatura_tecnico_rvt.sql` — colunas `assinatura_tecnico*` em `rvts` + triggers
  `trg_log_assinatura_tecnico_rvt`/`trg_bloqueia_assinatura_tecnico_insert`. **Rodada** (2026-10-02).
- `migracao_pendencias.sql` — tabelas `pendencias`/`pendencia_alvos` + RLS + triggers de carimbo da
  baixa e limpeza de órfã. **Rodada** (2026-10-02).
- `migracao_provisoria_e_nao_conformidades.sql` — intervenção provisória, tabela `nao_conformidades`,
  `pendencia_alvos.nao_conformidade_id` e correção do CHECK `rvt_itens.um_dos_tres`. **Rodada**
  (2026-10-04, aplicada pelo Claude via MCP com autorização do Alexandre).

## 16. Segurança — estado da auditoria de 29/08/2026

Corrigido: RLS de `kv_store` legado, `security_events` (append-only + purga 90d via pg_cron),
Sentry em produção, confirmação de e-mail no Supabase Auth, CHECKs em `dispositivos.tipo_modulo` e
campos de `inspecoes`, bug de `paineis_marca_check` (esperava capitalizado, app manda minúsculo).

**Em aberto, baixa prioridade:**
- Erro 400 de `observacoes` no console — não trava nada, não investigado.
- CHECKs propositalmente ausentes em `dispositivos.categoria_funcional` (legado grava string livre)
  e `atendimentos.status`/`tipo` (valor com inconsistência de caixa).
- Cliente de teste "ZZZZ" + painel "dasasdasd" a apagar pelo próprio app.

## 17. Código morto — não reintroduzir

`PumpDeviceForm`, `GasDetectorForm`, `SimpleListView`, handlers órfãos (`submitPumpDevice`/
`deletePumpDevice`/`submitGasDetector`/`deleteGasDetector`/`deleteMaintenanceLogEntry`/
`deleteInspectionLogEntry`), constantes `PUMP_TYPE_SUGGESTIONS`/`GAS_TYPE_SUGGESTIONS`, status
residuais do Indicador (`Falso Positivo`, `Intermitente` — só resta `Resolvido/Andamento/Aguardando`).
Dropdown de códigos de falha pré-definidos no campo "Falha" do RVT — **rejeitado** (bagunçava
workflow existente).

## 18. Projeto em aberto — planta baixa gráfica Hochiki FireNet (não implementado)

Objetivo: tela com dispositivos plotados sobre blueprint do cliente, status em tempo real por cor.

- Arquitetura discutida (nenhuma linha de código ainda): editor de upload de planta + posicionamento
  drag-and-drop (x/y em % salvos no Supabase) + camada de status.
- Status real-time exigiria hardware físico: Raspberry Pi/notebook na porta PC do painel (J5,
  RS-232 19200 8N1), somente-leitura (nunca envia comando de volta), publicando pro Supabase
  Realtime; o app assinaria via `subscribe`.
- Caminho combinado pra destravar o parser: Alexandre mandar screenshots + logs `.rtf` exportados do
  **Monitor Mode / Virtual Panel** do Loop Explorer (software oficial Hochiki) antes de codar.
- **Este é o item de maior abertura para brainstorm de próximo passo.**

## 19. Outras frentes explicitamente em aberto/adiadas

- **Pendências para conclusão** — Fases 1 a 4 feitas (2026-10-02). Em aberto: remover a tela
  temporária "Classificar pendências" quando os itens antigos forem classificados; Combate (SPCI)
  fica para depois. Histórico da Fase 4 (feita): tela temporária
  só admin de classificação retroativa em massa (`desde` = data da 1ª visita da corretiva).

- **Assinatura com validade jurídica** (ICP-Brasil/Lei 14.063) via provedor externo, preferência
  ZapSign, modo "assinatura eletrônica avançada". Plano desenhado (adiado 2026-08-30): pipeline
  paralelo opcional, tabela `rvt_assinatura_formal`, Edge Functions `rvt-pdf`/`assinatura-criar`/
  `assinatura-webhook` (token do provedor só em Supabase secrets), botão atrás de flag por cliente
  no `VisitaPrintView`, PDF assinado no Storage. Estimativa: ~3-5 dias, custo por documento. Começar
  por `rvt-pdf` reaproveitando o layout de impressão existente.
- **Dashboard**: nenhum toggle Painel/Dispositivo nem balde único de falha — decisão fechada, não
  reabrir sem novo motivo concreto.

## 20. Otimização de bundle (2026-09-21)

- `xlsx`, `exceljs`, `chart.js` e `pdfjs-dist` eram `import` estático no topo de `App.jsx` (e de
  `exportChecklistXlsx.js`/`exportChecklistMonthXlsx.js`) — iam pro bundle inicial que **todo**
  usuário baixa, inclusive Visualizador/cliente que nunca importa/exporta nada. Chunk principal
  caiu de 2.873 kB → 973 kB (gzip 822 kB → 253 kB) convertendo esses 4 imports pra `import()`
  dinâmico nos pontos de uso: `extractPdfWords` (pdfjs-dist, via `getPdfjsLib()` com cache de
  promise), `readFileAsRows`/`parseIndicadorXlsx` (xlsx), `exportIndicadorXlsx` (chart.js + exceljs,
  carregados juntos no início da função), `ToolChecklistHistory`/`ToolChecklistMonthExport`
  (exceljs, no clique do botão de exportar).
- `chart.js` só era usado dentro de `exportIndicadorXlsx` pra renderizar gráfico num canvas
  off-screen e embutir no Excel — os gráficos exibidos em tela (`SimpleBarChart`/`SimplePieChart`)
  já são SVG próprio, não dependem de chart.js.
- Padrão pra manter: qualquer lib pesada nova (parser de arquivo, exportador, lib de gráfico)
  entra via `import()` dinâmico dentro da função/handler que a usa, nunca como `import` estático
  no topo de `App.jsx` — senão volta a engordar o bundle inicial de todo mundo.
- Não mexido de propósito: `App.jsx` continua um arquivo único de ~455 kB sem code-splitting por
  rota/tela (Dashboard, RVT, Configurações etc. todos no mesmo módulo/chunk). Quebrar isso exigiria
  separar `App.jsx` em módulos por tela pra viabilizar `React.lazy` — refactor maior, avaliar só se
  o chunk principal (973 kB / 253 kB gzip) virar gargalo real.

### 20.1 Fotos no Storage + carregamento (2026-09-29)

- **Gargalo real era dado, não bundle**: `atendimentos` tinha 39 MB p/ 113 linhas e `rvt_itens`
  22 MB p/ 223 — fotos base64 (cruas, até 8 MB cada) dentro do jsonb. `loadClientData` baixava tudo
  (~54 MB) a cada abertura de cliente **e** a cada recarga pós-salvamento.
- Agora: bucket privado `fotos`, caminho `<cliente_id>/<uuid>.<ext>`, policies em `storage.objects`
  por `has_client_access(1ª pasta)` (delete só admin). A linha guarda `"storage:<caminho>"`.
  `supabaseAdapter.js`: `resolverFotosEmLinhas` (leitura → URL assinada 24h, 1 chamada por lista,
  cache em memória) e `prepararFotos` (gravação: data URL → upload; URL assinada → volta a ser ref;
  sem cliente conhecido mantém base64). Escopo: `atendimentos.fotos`, `inspecoes.fotos`,
  `rvt_itens.outro_fotos`, `atendimento_intervencoes.fotos`. Baterias/fontes/combate continuam
  base64 (pequenas, 900px) — não mexido de propósito.
- Fotos antigas: conversão pelo app em **Configurações → Dados → Migrar fotos** (RPC
  `fotos_base64_pendentes` + `migrarFotosParaStorage`, idempotente). Backup em
  `backup.fotos_*_20260929` (schema não exposto) — apagar depois de validar.
- Fotos novas de Atendimentos comprimidas pra 2048px/JPEG 0.85 (`lib/imagens.js`, `compressImageFile`
  compartilhado com App.jsx). `baixarImagem` baixa via blob (URL do Storage é outra origem).
- Arquivo removido de um registro fica órfão no bucket (não apagamos) — limpeza futura se pesar.
- Bundle: `AtendimentosNovo` e `ToolChecklistScreen` via `React.lazy` (pré-carrega Atendimentos
  1,5 s depois do cliente abrir); vendors em chunks próprios (`vite.config.js` `codeSplitting`) p/
  cache entre deploys; Google Fonts saiu do `@import` em `PageStyles` pro `index.html` + preconnect
  Supabase. Chunk do app: 375 kB (85 kB gzip).
- Banco: índices nas FKs que faltavam, `has_client_access`/`is_admin` marcadas `STABLE`.
  Tudo em `migracao_fotos_storage_e_performance.sql` (**rodada**).

### 20.2 Tela de erro / 404 + chunk antigo pós-deploy (2026-10-02)
- `components/ErrorScreen.jsx` + `components/FireGame.jsx` (mini-jogo canvas estilo dinossauro do
  Chrome: detector de calor pula chamas; botão de pulo = acionador manual; recorde em
  `localStorage` `ccm-fire-game-hi`). Usada pelo `ErrorBoundary` e pelo 404.
- 404: app não tem rotas — qualquer `pathname` ≠ `/` renderiza `NotFoundScreen` (antes do login).
  `vercel.json` reescreve caminhos desconhecidos pro `index.html`, **exceto `/assets/`** (chunk
  inexistente tem que continuar 404 de verdade pra cair no tratamento abaixo).
- Chunk de deploy antigo (`error loading dynamically imported module`): `vite:preloadError` em
  `main.jsx` + `ErrorBoundary` recarregam a página 1x sozinhos (trava de 10 s em `sessionStorage`
  `ccm-chunk-reload`); se falhar de novo, mostra a tela "Nova versão" com botão Recarregar.

## 21. Convenções de trabalho do Alexandre

- Reaproveitar componente/padrão existente antes de criar novo; orçamento apertado.
- Agrupar mudanças por sessão; menos validação manual quando o padrão já é conhecido/estável.
- Toda entrega vem com os comandos PowerShell prontos (instalação, cópia de arquivo, rodar local).
- Nunca `git restore`/`reset` sem confirmar que o trabalho atual já foi commitado.
- Padrão de salvamento no Supabase: upsert + delete seletivo do que saiu da lista — **nunca**
  apagar tudo e reinserir (2 incidentes reais de perda de dado no passado).
- **Data "de hoje" = data LOCAL** (2026-10-02): usar `hojeLocal()` / `dataLocalISO(date)` de
  `src/lib/datas.js`. **Nunca** `new Date().toISOString().slice(0, 10)` para data do dia — é UTC e,
  no Brasil (UTC-3), depois das 21h dá o dia seguinte (visita/inspeção/intervenção noturna ganhava
  data de amanhã). Já aplicado em `createVisita`, `createAtendimento`, `createInspecao`,
  `registrarIntervencaoAtendimento`, Pendências, forms de Visitas/agendamento/vistoria
  (`AtendimentosNovo.jsx`), `todayISO` (App), DDS e checklist de ferramentas.
  `toISOString()` completo continua certo para timestamp (`updated_at`, `atualizado_em`, assinaturas).
