# CCM — Centro de Controle de Manutenção (MAJ Soluções)

App web de gestão de manutenção de sistemas de detecção e combate a incêndio (PCI). Objetivo central: dar visibilidade aos clientes sobre o resultado dos serviços, reduzindo reunião/acompanhamento manual do Alexandre.

## Stack e ambiente

- Vite + React, rodando no Windows (editor usa CRLF)
- Tailwind via `@tailwindcss/vite`
- Backend: Supabase (Postgres + RLS)
- Deploy: Vercel (plano Hobby) — https://meu-app-maj4.vercel.app, domínio ccm.majsolucoes.com (CNAME via Cloudflare)
- Repo: GitHub `alemonteirof/meu-app`
- Arquivos principais: `App.jsx`, `AtendimentosNovo.jsx`, `supabaseAdapter.js`
- Identidade visual: paleta escura, destaque vinho `#8B2F2F`
- Orçamento apertado — sempre priorizar reaproveitar componentes/lógica já existentes em vez de criar do zero

## Arquitetura de dados (Supabase)

Tabelas: `clientes`, `paineis`, `lacos`, `dispositivos`, `saida_subitens`, `atendimentos`, `inspecoes`, `rvts`, `rvt_itens`, `baterias_painel`, `fontes_auxiliares`, `combate_conjuntos`, `combate_subitens`, `combate_componentes`, `combate_baterias_cilindros`, `combate_cilindros`, `combate_historico`.

- `dispositivos` tem: `categoria_funcional`, `papel_sinal`, `funcao_saida`, `sub_endereco`, `etiqueta_complementar`, `data_calibracao`, `proxima_calibracao`
- IDs são strings curtas geradas por `uid()` (não UUID) — exceção: `combate_historico` usa `bigint identity`
- RLS via `has_client_access()` + `is_admin()`
- **Padrão de salvamento seguro (crítico, não regredir)**: upsert + remoção só do que saiu da lista local. Nunca apagar tudo primeiro e reinserir — já causou 2 incidentes reais de perda de dado.
- Entidades com `painel_id` opcional (`rvts`, `combate_conjuntos`, `combate_baterias_cilindros`): ao remover o painel, o `painel_id` vira `null` em vez de travar por FK.
- Fluxo antigo via `kv_store` está aposentado como fonte de criação nova. Único ponto de criação SDAI é "Atendimentos → Visitas (SDAI)".

## Modelo SDAI (detecção) — padrão estabelecido, reaproveitado no SPCI

- Categoria funcional é definida 1x no cadastro do endereço do módulo de entrada — funciona como TAG que trava o método de teste automaticamente (sem escolha manual na hora da inspeção).
- Tipo "Módulo de Entrada Duplo" (DIMM/FDM-1) tem 2 sub-endereços; import detecta automaticamente.
- Métodos de teste fechados por categoria: fumaça=spray, calor/termovelocimétrico=soprador térmico, chama=fonte de chama/UV-IR, linear=obscurecimento, gás=Bump Test, acionador=5x seguidas, saída=comando pela central, relé=multímetro+jump, sirene=injeção 24V.
- Inspeção é separada de manutenção (não depende de falha). Campos: Funcionamento / Aparência / Comunicação Local / Rede / Método (travado) / Observações / Falha (opcional, gera corretiva automática) / Próxima inspeção. Fotos opcionais.

## Menu (nomenclatura SDAI/SPCI padronizada em toda a aplicação)

`Atendimentos` (sub-abas Visitas SDAI / Visitas Sistemas de Combate) · `Dashboard` (sub-abas SDAI/SPCI) · `Sistemas de Detecção e Alarme` (SDAI — unifica Painéis + Dispositivos Complementares em sub-abas) · `Sistemas de Combate` (SPCI — sub-abas Água/Agentes Gasosos/Componentes) · `Relatório` (Inspeções) · `Indicador` (sub-abas SDAI/SPCI) · `Configurações`.

- Roles: Admin vê tudo (7 itens); Operador/técnico sem Configurações; Visualizador/cliente sem Atendimentos. Barra inferior mobile (4 primários + "Mais") respeita as mesmas regras.
- Dispositivos Complementares: Tipo 1 = atalho via categoria funcional (Beam/Chama/Gás/Termovelocimétrico); Tipo 2 = Bateria de Painel (auto-gera 1 card por painel, 2 baterias fixas, anual, troca a cada 2 anos) e Fonte Auxiliar (cadastro livre).

## Sistemas de Combate (SPCI)

- **Água** (Casa de Bombas/Hidrante/VGA/LGE): "Conjuntos" (pai com checklist fixo auto-gerado — Casa de Bombas 6 itens, Hidrante 7, VGA 6, LGE 8+retest laboratorial) e "Componentes" (Fluxostato/Pressostato/Solenoide/Chave Supervisora/Chave de Abandono — cadastro livre, linkável opcional a Conjunto e a Módulo do painel via `DeviceLinkPicker` em cascata painel→busca→lista).
- **Agentes Gasosos** (CO2/NOVEC/Pó Químico): "Sistema" (mesmo padrão de Conjunto, 6 itens) + "Bateria de Cilindros" (1 bateria pai + N cilindros filhos, 4 itens de checklist por cilindro — Válvula/Manômetro/Corpo/Etiqueta). Retest laboratorial tem só 1 campo de data — o app calcula a próxima sozinho (+5 anos/60 meses).
- Tudo laboratorial/terceirizado (ex: relatório Fireless do NOVEC1230) vira só controle de prazo (Data + próxima calculada), **nunca** formulário técnico.
- Listas de checklist/componentes vivem em constantes JS no `supabaseAdapter.js` (`COMBATE_CONJUNTO_TIPOS`, `COMBATE_COMPONENTE_TIPOS`, `COMBATE_CILINDRO_ITENS`) — ajustar ali, não no schema.
- **Decisão de arquitetura**: Combate NÃO integra no pipeline de Atendimentos/dispositivos SDAI (evita reescrever o que está amarrado a `dispositivo_id`). Tem pipeline próprio e paralelo.
- "Visitas (Sistemas de Combate)" dentro de Atendimentos: busca+seleção múltipla agrupando por tipo, 1 registro só de "vistoria" aplicado a todos os selecionados, grava via `updateCombateSubitem/Componente/Cilindro` + insere 1 linha em `combate_historico` (log append-only, base do Indicador SPCI).

## Relatório de Inspeções (concluído)

- Menu renomeado de "Relatório" para "Inspeções" ("Relatório de Inspeções").
- `createInspecao` grava `resultado_teste/aparencia/comunicacao_local/comunicacao_rede` de volta no dispositivo (não só a data) — `loadClientData` expõe esses campos (`operationalStatus`, `appearance`, `localComm`, `networkComm`, `lastInspection`, `nextInspection`) pra devices/nacs/gasDetectors.
- Vocabulário padronizado (não reintroduzir o antigo `operante/nao_operante/em_manutencao`): `Aprovado/Reprovado/Não avaliado`, `Ótimo/Bom/Regular/Precisa Trocar`, `Conforme/Não conforme`.
- Tela: sub-abas SDAI/SPCI. SDAI com 3 seções (Dispositivos Endereçáveis/Circuitos NAC/Dispositivos Complementares). SPCI com 3 seções (Água/Agentes Gasosos/Componentes). 4 cards de resumo cada.
- Agrupamento colapsável por seção (fechado por padrão, exceto se sobrar só 1 grupo) — componente genérico `ReportGroup`/`ReportSection` com prop `groupBy`, usa campo `groupLabel` do item.
- Grupos colapsados aparecem inteiros na impressão via CSS `.report-group-body.collapsed` (`display:none` na tela, `display:block !important` em `@media print`) — não trocar por lógica que pare de renderizar.
- Mobile: item vira card expansível. Desktop: tabela normal.

## Importadores de dispositivos (multi-marca)

- Hochiki/VES CSV (Loop Explorer 2), Hochiki/VES PDF (Loop Explorer 1, via `pdfjs-dist` com extração por coordenadas), Notifier XLS/XLSX (VeriFire Tools via SheetJS)
- Parser de PDF do Loop Explorer 1: `pdfjs-dist` mescla múltiplas colunas em itens de texto único — abordagem final é extração por conteúdo, juntando itens não-endereço dentro de cada banda de Y ordenados esquerda→direita, cortando o nome do dispositivo na primeira keyword de Tipo encontrada.
- Import tem undo e export CSV do banco de dispositivos.

## Indicador (histórico de diagnóstico — legado, ainda ativo)

- Importado originalmente da planilha INDICADOR_SDAI, com filtro por status/área/falha, vínculo de dispositivo via mapeamento de endereço de rede do painel, suporte a fotos, exclusão múltipla/por status/tudo.
- Mapeamento hardcoded de endereço de rede de painel → área, específico do cliente Nissan: `{1: SECURITY OFFICE, 2: PAINT, 3: TRIM, 4: PLASTIC, 5: BODY, 6: POWER TRAIN, 8: CENTRAL COP}` — painel 7 (AUTOLEARN/PWT) e painéis Notifier ficam fora do vínculo automático.
- Normalizações de área já aplicadas: variantes de BODY → BODY, CBU → PLASTIC, SECURITY/SECUTIRY → SECURITY OFFICE, POWERTRAIN → POWER TRAIN, COP → CENTRAL COP.

## RVT — Relatório de Visita Técnica

- Seletores em cascata painel/laço/dispositivo, captura de foto, auto-população do Indicador ao salvar, layout de impressão profissional.
- Tab "+ Novo RVT" foi removida — hoje é só leitura/impressão/edição de registros históricos (criação nova de visita vai só pelo fluxo relacional via Atendimentos).
- **Layout aprovado (não regredir)**: header full-width vinho (`#8B2F2F`) com wordmark M.A.J, overlay diagonal escuro (clip-path), textura cross-hatch, nome do cliente + logo, título do relatório — inspirado na capa do folder institucional MAJ. Cards de resumo com borda superior vinho 3px; cards de item com borda esquerda vinho 4px.
- Correções de impressão aplicadas: rodapé órfão corrigido com `break-inside: avoid` + `print-color-adjust: exact` + padding reduzido; cabeçalho/rodapé nativos do navegador contornado setando `document.title` dinamicamente (`"RVT - ClienteX - Data"`).
- Campo de busca de dispositivo no formulário de item RVT: aparece só quando o laço tem mais de 8 dispositivos, filtra por endereço/tipo/descrição em tempo real, limpa ao trocar painel/laço, mostra contagem "X de Y" — reaproveita o padrão de busca já usado em Painéis.
- Ideia descartada: dropdown de códigos de falha pré-definidos Hochiki/VES no campo "Falha" — rejeitada por bagunçar workflows existentes.

## Gráficos

Seção com gráficos SVG de barra e pizza pra Indicador e manutenção, com exportação CSV e PDF.

## Tela de login

Fundo escuro com glow radial vinho sutil + marca d'água do emblema real (`Contorno_vermelho_sem_MAJ.png`, salvo como `maj-emblem.png`) grande (620px, 14% opacidade), no canto inferior direito. Rejeitados: fundo preto liso, textura quadriculada, banner diagonal grande, banner fixo no topo, foto da capa do folder como fundo full-bleed.

## Projeto de planta baixa gráfica (Hochiki FireNet) — não implementado, próximo passo em aberto

- Objetivo: tela de planta baixa mostrando dispositivos Hochiki FireNet plotados sobre blueprint do cliente, com indicador de status em tempo real (normal/falha/alarme por cor).
- Arquitetura discutida: editor visual de upload de planta + posicionamento de dispositivo via drag-and-drop (x/y em % salvos no Supabase) + camada de status.
- Status em tempo real exige conexão física: Raspberry Pi ou notebook ligado na porta PC do painel (J5, RS-232 19200 8N1), lê eventos e envia pro Supabase Realtime — o app assina via subscribe. Conexão é estritamente somente-leitura, nunca envia comando de volta ao painel.
- Caminho mais seguro pra capturar o formato de mensagem antes de codar o parser real: o Loop Explorer (software oficial Hochiki, já usado pelo Alexandre) tem Monitor Mode / Virtual Panel que mostra status em tempo real e exporta logs de atividade em `.rtf`.
- Próximo passo combinado: Alexandre manda screenshots e logs exportados do Monitor Mode do Loop Explorer pra avançar a implementação do parser.

## Código morto já removido — não reintroduzir

`PumpDeviceForm`, `GasDetectorForm`, `SimpleListView`, handlers órfãos (`submitPumpDevice`/`deletePumpDevice`/`submitGasDetector`/`deleteGasDetector`/`deleteMaintenanceLogEntry`/`deleteInspectionLogEntry`), constantes `PUMP_TYPE_SUGGESTIONS`/`GAS_TYPE_SUGGESTIONS`, status residuais no Indicador (Falso Positivo, Intermitente — ficou só Resolvido/Andamento/Aguardando).

## Convenções de trabalho

- Reaproveitar componentes/padrões existentes antes de criar novos.
- Agrupar mudanças por sessão (menos idas e vindas); reduzir validação extensiva quando o padrão já está bem estabelecido no código.
- Toda mudança finalizada vem acompanhada dos comandos PowerShell prontos (instalação, cópia de arquivo, rodar o projeto).
- Antes de qualquer `git restore`/`reset`, confirmar que o trabalho atual foi commitado.
