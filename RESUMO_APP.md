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

### `rvts` (Visita/RVT)
`id, cliente_id, painel_id, tecnico, data_visita, assinatura_cliente, assinatura_cliente_tipo,
assinatura_cliente_data, assinatura_cliente_login, assinatura_cliente_user_id,
assinatura_cliente_origem`. `assinatura_cliente_login/user_id` são gravados por **trigger Postgres**
(`log_assinatura_rvt` → tabela `assinatura_auditoria`, append-only, sem UPDATE/DELETE policy) usando
`auth.uid()`/`auth.jwt()->>'email'` do servidor — o app nunca manda esses campos.
`assinatura_cliente_origem`: `desenho | texto | salva`. Criado por `createVisita`
([supabaseAdapter.js:279](src/supabaseAdapter.js:279)).

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
  atendimento original (só status "cache").
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
- `backfill_falha_categoria.sql` — backfill de `falha_categoria` a partir de `falhasPorMarca.js`.
  **Rodada** (regenerar com `scratchpad/gen_backfill.mjs` se as listas de falha mudarem).
- `migracao_sirene_visual_sonoro.sql` — colunas `visual`/`sonoro` + CHECK em `inspecoes` e
  `dispositivos`. **Pendente de rodar em produção.**

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

## 21. Convenções de trabalho do Alexandre

- Reaproveitar componente/padrão existente antes de criar novo; orçamento apertado.
- Agrupar mudanças por sessão; menos validação manual quando o padrão já é conhecido/estável.
- Toda entrega vem com os comandos PowerShell prontos (instalação, cópia de arquivo, rodar local).
- Nunca `git restore`/`reset` sem confirmar que o trabalho atual já foi commitado.
- Padrão de salvamento no Supabase: upsert + delete seletivo do que saiu da lista — **nunca**
  apagar tudo e reinserir (2 incidentes reais de perda de dado no passado).
