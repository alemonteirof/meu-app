// Campo "Falha" travado por marca (Hochiki / Notifier) — fonte de verdade das listas.
//
// Duas camadas (decisão de produto, doc instrucoes-campo-falha-por-marca.md):
//   1. Entrada: lista travada e ESPECÍFICA por marca, combobox com busca bilíngue (PT — EN).
//   2. Relatório: cada item carrega uma categoria unificada (10 abaixo); os gráficos
//      agrupam por categoria, nunca pelo texto exato.
//
// Ordem das listas = mais comum em campo primeiro (estimativa técnica, não estatística real).
// Mesma ideia dos checklists de Combate, que também vivem em constantes JS no supabaseAdapter.js.

export const CATEGORIAS_FALHA = {
  alimentacao: 'Alimentação / Bateria',
  fiacao: 'Fiação / Circuito',
  dispositivo_desconectado: 'Dispositivo Desconectado / Não Responde',
  dispositivo_cadastro: 'Dispositivo — Erro de Cadastro/Endereçamento',
  detector_sujo: 'Detector Sujo / Deriva de Sensibilidade',
  saida_nac: 'Saída / NAC / Sirene',
  rede_paineis: 'Rede entre Painéis',
  sistema: 'Sistema / Processador / Software',
  anunciador: 'Anunciador / Periférico Remoto',
  // não é falha real — fica fora do gráfico "falhas mais comuns", mas continua selecionável
  // porque aparece no display do painel.
  diagnostico: 'Diagnóstico / Desabilitação / Teste',
};

export const CATEGORIA_DIAGNOSTICO = 'diagnostico';
export const ROTULO_NAO_CLASSIFICADO = 'Não classificado';

// ---- Hochiki (protocolo FireNET/ESP — tabela de eventos 0–73) ----
export const FALHAS_HOCHIKI = [
  // Tier 1 — mais comuns
  { codigo: 'HOC-19', en: 'AC Power Failure', pt: 'Falta de energia CA', categoria: 'alimentacao' },
  { codigo: 'HOC-20', en: 'Low battery voltage', pt: 'Tensão de bateria baixa', categoria: 'alimentacao' },
  { codigo: 'HOC-21', en: 'Battery disconnected', pt: 'Bateria desconectada', categoria: 'alimentacao' },
  { codigo: 'HOC-24', en: 'Charger Trouble', pt: 'Falha no carregador', categoria: 'alimentacao' },
  { codigo: 'HOC-23', en: 'Aux 24V fuse trouble', pt: 'Falha no fusível de 24V auxiliar', categoria: 'alimentacao' },
  { codigo: 'HOC-05', en: 'Disconnected trouble', pt: 'Dispositivo desconectado', categoria: 'dispositivo_desconectado' },
  { codigo: 'HOC-15', en: 'Ground trouble', pt: 'Falha de terra', categoria: 'fiacao' },
  { codigo: 'HOC-18', en: 'Loop open circuit', pt: 'Circuito aberto no laço', categoria: 'fiacao' },
  { codigo: 'HOC-17', en: 'Loop short circuit', pt: 'Curto-circuito no laço', categoria: 'fiacao' },
  { codigo: 'HOC-16', en: 'Loop wiring trouble', pt: 'Falha na fiação do laço', categoria: 'fiacao' },
  { codigo: 'HOC-02', en: 'Detector removed', pt: 'Detector removido', categoria: 'dispositivo_desconectado' },
  { codigo: 'HOC-10', en: 'Wrong device type', pt: 'Tipo de dispositivo errado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-06', en: 'Double address', pt: 'Endereço duplicado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-07', en: 'Monitored output trouble', pt: 'Falha na saída monitorada', categoria: 'saida_nac' },

  // Tier 2 — comuns
  { codigo: 'HOC-03', en: 'Slave line open circuit', pt: 'Circuito aberto na linha escrava', categoria: 'fiacao' },
  { codigo: 'HOC-04', en: 'Slave line short circuit', pt: 'Curto-circuito na linha escrava', categoria: 'fiacao' },
  { codigo: 'HOC-08', en: 'Unknown device', pt: 'Dispositivo desconhecido', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-09', en: 'Unexpected device', pt: 'Dispositivo inesperado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-29', en: 'Calibration failed trouble', pt: 'Falha na calibração', categoria: 'detector_sujo' },
  { codigo: 'HOC-22', en: 'Battery voltage too high', pt: 'Tensão de bateria muito alta', categoria: 'alimentacao' },
  { codigo: 'HOC-44', en: 'Network open or short circuit', pt: 'Circuito aberto ou curto na rede', categoria: 'rede_paineis' },
  { codigo: 'HOC-40', en: 'Network node missing', pt: 'Nó de rede ausente', categoria: 'rede_paineis' },
  { codigo: 'HOC-45', en: 'Network comms trouble', pt: 'Falha de comunicação na rede', categoria: 'rede_paineis' },
  { codigo: 'HOC-46', en: 'Network comms timeout', pt: 'Timeout de comunicação na rede', categoria: 'rede_paineis' },
  { codigo: 'HOC-50', en: 'Communicator Missing', pt: 'Comunicador ausente', categoria: 'rede_paineis' },
  { codigo: 'HOC-51', en: 'Comms Fail', pt: 'Falha de comunicação', categoria: 'rede_paineis' },
  { codigo: 'HOC-70', en: 'Enunciator missing', pt: 'Anunciador ausente', categoria: 'anunciador' },
  { codigo: 'HOC-69', en: 'IO Board Missing', pt: 'Placa de E/S ausente', categoria: 'dispositivo_desconectado' },
  { codigo: 'HOC-36', en: 'I/O Module not installed', pt: 'Módulo de E/S não instalado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-37', en: 'Unexpected I/O Module', pt: 'Módulo de E/S inesperado', categoria: 'dispositivo_cadastro' },

  // Tier 3 — menos comuns
  { codigo: 'HOC-25', en: 'Processor Watch Dog operated', pt: 'Watchdog do processador atuou', categoria: 'sistema' },
  { codigo: 'HOC-26', en: 'Bad data trouble', pt: 'Falha de dados corrompidos', categoria: 'sistema' },
  { codigo: 'HOC-00', en: 'Internal trouble', pt: 'Problema interno', categoria: 'sistema' },
  { codigo: 'HOC-27', en: 'Unknown event trouble', pt: 'Evento de falha desconhecido', categoria: 'sistema' },
  { codigo: 'HOC-35', en: 'Sub address limit reached', pt: 'Limite de subendereços atingido', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-34', en: 'Unexpected Loop', pt: 'Laço inesperado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-33', en: 'Loop Not Installed', pt: 'Laço não instalado', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-38', en: 'Unexpected network node', pt: 'Nó de rede inesperado', categoria: 'rede_paineis' },
  { codigo: 'HOC-39', en: 'Unknown network type', pt: 'Tipo de rede desconhecido', categoria: 'rede_paineis' },
  { codigo: 'HOC-41', en: 'Unexpected network card', pt: 'Placa de rede inesperada', categoria: 'rede_paineis' },
  { codigo: 'HOC-42', en: 'Network card not installed', pt: 'Placa de rede não instalada', categoria: 'rede_paineis' },
  { codigo: 'HOC-43', en: 'Network card address incorrect', pt: 'Endereço da placa de rede incorreto', categoria: 'rede_paineis' },
  { codigo: 'HOC-47', en: 'Network address invalid', pt: 'Endereço de rede inválido', categoria: 'rede_paineis' },
  { codigo: 'HOC-52', en: 'Comms Phone Line 1 Trouble', pt: 'Falha na linha telefônica 1', categoria: 'rede_paineis' },
  { codigo: 'HOC-54', en: 'Comms Phone Line 2 Trouble', pt: 'Falha na linha telefônica 2', categoria: 'rede_paineis' },
  { codigo: 'HOC-68', en: 'Unexpected IO Board', pt: 'Placa de E/S inesperada', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-71', en: 'Unexpected IO Board', pt: 'Placa de E/S inesperada', categoria: 'dispositivo_cadastro' },
  { codigo: 'HOC-49', en: 'Unknown', pt: 'Desconhecido', categoria: 'sistema' },
  { codigo: 'HOC-01', en: 'Maintenance trouble', pt: 'Problema de manutenção', categoria: 'diagnostico' },

  // Tier 4 — raras / estados operacionais (não são defeito real)
  { codigo: 'HOC-11', en: 'Initializing Device', pt: 'Inicializando dispositivo', categoria: 'diagnostico' },
  { codigo: 'HOC-12', en: 'System initializing', pt: 'Sistema inicializando', categoria: 'diagnostico' },
  { codigo: 'HOC-13', en: 'Autolearn', pt: 'Autoaprendizagem (autolearn)', categoria: 'diagnostico' },
  { codigo: 'HOC-14', en: 'New config downloaded from PC', pt: 'Nova configuração baixada do PC', categoria: 'diagnostico' },
  { codigo: 'HOC-30', en: 'Device initializing', pt: 'Dispositivo inicializando', categoria: 'diagnostico' },
  { codigo: 'HOC-28', en: 'Pre alarm', pt: 'Pré-alarme', categoria: 'diagnostico' },
  { codigo: 'HOC-31', en: 'Input Activated', pt: 'Entrada ativada', categoria: 'diagnostico' },
  { codigo: 'HOC-32', en: 'Cause & Effect Active', pt: 'Causa e efeito ativo', categoria: 'diagnostico' },
  { codigo: 'HOC-48', en: 'Fire Drill Active', pt: 'Simulado de incêndio ativo', categoria: 'diagnostico' },
  { codigo: 'HOC-53', en: 'Comms Phone Line 1 Restored', pt: 'Linha telefônica 1 restaurada', categoria: 'diagnostico' },
  { codigo: 'HOC-55', en: 'Comms Phone Line 2 Restored', pt: 'Linha telefônica 2 restaurada', categoria: 'diagnostico' },
  { codigo: 'HOC-56', en: 'Disabled device', pt: 'Dispositivo desabilitado', categoria: 'diagnostico' },
  { codigo: 'HOC-57', en: 'Disabled zone', pt: 'Zona desabilitada', categoria: 'diagnostico' },
  { codigo: 'HOC-58', en: 'Disabled loop', pt: 'Laço desabilitado', categoria: 'diagnostico' },
  { codigo: 'HOC-59', en: 'All sounders disabled', pt: 'Todas as sirenes desabilitadas', categoria: 'diagnostico' },
  { codigo: 'HOC-60', en: 'Disabled panel input', pt: 'Entrada do painel desabilitada', categoria: 'diagnostico' },
  { codigo: 'HOC-61', en: 'Disabled panel output', pt: 'Saída do painel desabilitada', categoria: 'diagnostico' },
  { codigo: 'HOC-62', en: 'CE disablement', pt: 'Desabilitação de causa e efeito (C&E)', categoria: 'diagnostico' },
  { codigo: 'HOC-63', en: 'Buzzer Disabled', pt: 'Besouro (buzzer) desabilitado', categoria: 'diagnostico' },
  { codigo: 'HOC-64', en: 'Printer Disabled', pt: 'Impressora desabilitada', categoria: 'diagnostico' },
  { codigo: 'HOC-65', en: 'Ground trouble Disabled', pt: 'Detecção de falha de terra desabilitada', categoria: 'diagnostico' },
  { codigo: 'HOC-66', en: 'Disablement', pt: 'Desabilitação (genérica)', categoria: 'diagnostico' },
  { codigo: 'HOC-67', en: 'Test mode', pt: 'Modo de teste', categoria: 'diagnostico' },
  { codigo: 'HOC-72', en: 'Sensor Fire test pass', pt: 'Teste de incêndio do sensor aprovado', categoria: 'diagnostico' },
  { codigo: 'HOC-73', en: 'Sensor Fire test fail', pt: 'Teste de incêndio do sensor reprovado', categoria: 'diagnostico' },
];

// ---- Notifier (protocolo NFS-640/NFS2-640/NFS-320 — System/Point Trouble Messages) ----
// Notifier não tem código numérico universal; NOT-XX é só referência interna do app.
export const FALHAS_NOTIFIER = [
  // Tier 1 — mais comuns
  { codigo: 'NOT-01', en: 'AC FAIL', pt: 'Falta de energia CA', categoria: 'alimentacao' },
  { codigo: 'NOT-02', en: 'BATTERY', pt: 'Falha de bateria', categoria: 'alimentacao' },
  { codigo: 'NOT-03', en: 'CHARGER FAIL', pt: 'Falha no carregador', categoria: 'alimentacao' },
  { codigo: 'NOT-04', en: 'AUXILIARY TROUBLE', pt: 'Falha na alimentação auxiliar', categoria: 'alimentacao' },
  { codigo: 'NOT-05', en: 'GROUND FAULT', pt: 'Falha de terra', categoria: 'fiacao' },
  { codigo: 'NOT-06', en: 'GROUND FAULT LOOP 1', pt: 'Falha de terra — Laço 1', categoria: 'fiacao' },
  { codigo: 'NOT-07', en: 'GROUND FAULT LOOP 2', pt: 'Falha de terra — Laço 2', categoria: 'fiacao' },
  { codigo: 'NOT-08', en: 'DEVICE NOT RESPONDING', pt: 'Dispositivo não responde', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-09', en: 'DIRTY DETECTOR / CLEAN ME', pt: 'Detector sujo', categoria: 'detector_sujo' },
  { codigo: 'NOT-10', en: 'OPEN CIRCUIT (module/speaker)', pt: 'Circuito aberto no módulo/alto-falante', categoria: 'fiacao' },
  { codigo: 'NOT-11', en: 'SHORT CIRCUIT', pt: 'Curto-circuito', categoria: 'fiacao' },
  { codigo: 'NOT-12', en: 'POWER SUPPLY TROUBLE', pt: 'Falha na fonte de alimentação', categoria: 'alimentacao' },
  { codigo: 'NOT-13', en: 'MONITORED OUTPUT TROUBLE', pt: 'Falha na saída monitorada', categoria: 'saida_nac' },
  { codigo: 'NOT-14', en: 'NO DEV. INST ON L1', pt: 'Nenhum dispositivo instalado no Laço 1', categoria: 'dispositivo_desconectado' },

  // Tier 2 — comuns
  { codigo: 'NOT-15', en: 'STYLE 6 POS. LOOP 1', pt: 'Falha polaridade positiva Estilo 6 — Laço 1', categoria: 'fiacao' },
  { codigo: 'NOT-16', en: 'STYLE 6 POS. LOOP 2', pt: 'Falha polaridade positiva Estilo 6 — Laço 2', categoria: 'fiacao' },
  { codigo: 'NOT-17', en: 'STYLE 6 NEG. LOOP 1', pt: 'Falha polaridade negativa Estilo 6 — Laço 1', categoria: 'fiacao' },
  { codigo: 'NOT-18', en: 'STYLE 6 NEG. LOOP 2', pt: 'Falha polaridade negativa Estilo 6 — Laço 2', categoria: 'fiacao' },
  { codigo: 'NOT-19', en: 'NETWORK FAIL PORT A', pt: 'Falha de rede — Porta A', categoria: 'rede_paineis' },
  { codigo: 'NOT-20', en: 'NETWORK FAIL PORT B', pt: 'Falha de rede — Porta B', categoria: 'rede_paineis' },
  { codigo: 'NOT-21', en: 'NCM COMM FAILURE', pt: 'Falha de comunicação do módulo de rede (NCM)', categoria: 'rede_paineis' },
  { codigo: 'NOT-22', en: 'UDACT TROUBLE', pt: 'Falha no discador digital (UDACT)', categoria: 'rede_paineis' },
  { codigo: 'NOT-23', en: 'UDACT NO ANSWER', pt: 'Discador digital (UDACT) não responde', categoria: 'rede_paineis' },
  { codigo: 'NOT-24', en: 'SUPERVISORY', pt: 'Condição supervisória ativa', categoria: 'diagnostico' },
  { codigo: 'NOT-25', en: 'TROUBL CONTROL', pt: 'Falha em módulo de controle/relé', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-26', en: 'CHARGER HIGH / AUX POWER OVER', pt: 'Carga da fonte auxiliar acima do normal', categoria: 'alimentacao' },
  { codigo: 'NOT-27', en: 'CHARGER LOW / AUX POWER LOW', pt: 'Carga da fonte auxiliar abaixo do normal', categoria: 'alimentacao' },
  { codigo: 'NOT-28', en: 'PANEL DOOR OPEN', pt: 'Porta do painel aberta', categoria: 'diagnostico' },
  { codigo: 'NOT-29', en: 'ANNUN. TROUBLE', pt: 'Falha no anunciador', categoria: 'anunciador' },
  { codigo: 'NOT-30', en: 'ANNUN. NO ANSWER', pt: 'Anunciador não responde', categoria: 'anunciador' },
  { codigo: 'NOT-31', en: 'LOW TEMP (Heat/Acclimate detector)', pt: 'Temperatura abaixo do esperado no detector térmico', categoria: 'detector_sujo' },

  // Tier 3 — menos comuns
  { codigo: 'NOT-32', en: 'EPROM ERROR', pt: 'Erro na EPROM', categoria: 'sistema' },
  { codigo: 'NOT-33', en: 'INTERNAL RAM ERROR', pt: 'Erro na memória RAM interna', categoria: 'sistema' },
  { codigo: 'NOT-34', en: 'EXTERNAL RAM ERROR', pt: 'Erro na memória RAM externa', categoria: 'sistema' },
  { codigo: 'NOT-35', en: 'PROGRAM CORRUPTED', pt: 'Programação corrompida', categoria: 'sistema' },
  { codigo: 'NOT-36', en: 'CORRUPT LOGIC EQUAT', pt: 'Equação lógica corrompida', categoria: 'sistema' },
  { codigo: 'NOT-37', en: 'BAT. BACKUP RAM', pt: 'Falha na bateria de backup da RAM', categoria: 'alimentacao' },
  { codigo: 'NOT-38', en: 'LCD80 SUPERVISORY', pt: 'Supervisório no display LCD80', categoria: 'diagnostico' },
  { codigo: 'NOT-39', en: 'TERM. SUPERVISORY', pt: 'Supervisório no terminal', categoria: 'diagnostico' },
  { codigo: 'NOT-40', en: 'Master Box trouble', pt: 'Falha na caixa mestra (master box)', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-41', en: 'Pwr.Supply Comm Fail', pt: 'Falha de comunicação da fonte de alimentação', categoria: 'alimentacao' },
  { codigo: 'NOT-42', en: 'Network Incompatible', pt: 'Rede incompatível', categoria: 'rede_paineis' },
  { codigo: 'NOT-43', en: 'Exceeded Conn. Limit', pt: 'Limite de conexões excedido', categoria: 'rede_paineis' },
  { codigo: 'NOT-44', en: 'Release Dev. Disable', pt: 'Dispositivo de liberação (supressão) desabilitado', categoria: 'diagnostico' },
  { codigo: 'NOT-45', en: 'POINT DISABLED / DISABLED', pt: 'Ponto desabilitado manualmente', categoria: 'diagnostico' },

  // Tier 4 — raras / módulo de voz (DVC) — só relevante com evacuação por voz
  { codigo: 'NOT-46', en: 'DVC Self Test Fail', pt: 'Autoteste do módulo de voz falhou', categoria: 'sistema' },
  { codigo: 'NOT-47', en: 'DVC Soft. Mismatch', pt: 'Incompatibilidade de software no módulo de voz', categoria: 'sistema' },
  { codigo: 'NOT-48', en: 'DVC Program Corrupt', pt: 'Programação do módulo de voz corrompida', categoria: 'sistema' },
  { codigo: 'NOT-49', en: 'DVC Database Corrupt', pt: 'Banco de dados do módulo de voz corrompido', categoria: 'sistema' },
  { codigo: 'NOT-50', en: 'DVC Audio Lib.Corrup', pt: 'Biblioteca de áudio do módulo de voz corrompida', categoria: 'sistema' },
  { codigo: 'NOT-51', en: 'DVC Dbase Incompat', pt: 'Banco de dados do módulo de voz incompatível', categoria: 'sistema' },
  { codigo: 'NOT-52', en: 'DVC Audio Lib Incomp', pt: 'Biblioteca de áudio do módulo de voz incompatível', categoria: 'sistema' },
  { codigo: 'NOT-53', en: 'DVC Ext Ram Error', pt: 'Erro na RAM externa do módulo de voz', categoria: 'sistema' },
  { codigo: 'NOT-54', en: 'DVC NVRam Batt Tbl', pt: 'Falha na bateria da NVRAM do módulo de voz', categoria: 'alimentacao' },
  { codigo: 'NOT-55', en: 'DVC Buzzer Off-Line', pt: 'Besouro do módulo de voz fora de linha', categoria: 'diagnostico' },
  { codigo: 'NOT-56', en: 'DVC Aux.Trouble', pt: 'Falha auxiliar no módulo de voz', categoria: 'alimentacao' },
  { codigo: 'NOT-57', en: 'DVC FFT Trouble', pt: 'Falha FFT no módulo de voz', categoria: 'sistema' },
  { codigo: 'NOT-58', en: 'DVC Rem. Mic. Tbl.', pt: 'Falha no microfone remoto do módulo de voz', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-59', en: 'DVC Local Mic. Tbl.', pt: 'Falha no microfone local do módulo de voz', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-60', en: 'DVC Local Phone Tbl', pt: 'Falha no telefone local do módulo de voz', categoria: 'dispositivo_desconectado' },
  { codigo: 'NOT-61', en: 'DVC Analog Out.X Tbl', pt: 'Falha na saída analógica X do módulo de voz', categoria: 'saida_nac' },
  { codigo: 'NOT-62', en: 'DVC Flash Image Err', pt: 'Erro na imagem flash do módulo de voz', categoria: 'sistema' },
  { codigo: 'NOT-63', en: 'DVC Loading No Serv', pt: 'Módulo de voz carregando — fora de serviço', categoria: 'diagnostico' },
  { codigo: 'NOT-64', en: 'DVC DAA Downloading', pt: 'Download DAA do módulo de voz em andamento', categoria: 'diagnostico' },
  { codigo: 'NOT-65', en: 'HS_NCM Sniffer Activ', pt: 'Modo "sniffer" do HS-NCM ativo', categoria: 'diagnostico' },

  // Tier 5 — estados operacionais (não são defeito real)
  { codigo: 'NOT-66', en: 'PROG MODE ACTIVATED', pt: 'Modo de programação ativado', categoria: 'diagnostico' },
  { codigo: 'NOT-67', en: 'LOADING..NO SERVICE', pt: 'Carregando... fora de serviço', categoria: 'diagnostico' },
  { codigo: 'NOT-68', en: 'BASIC WALK TEST', pt: 'Teste de caminhada básico em andamento', categoria: 'diagnostico' },
  { codigo: 'NOT-69', en: 'ADV WALK TEST', pt: 'Teste de caminhada avançado em andamento', categoria: 'diagnostico' },
  { codigo: 'NOT-70', en: 'NFPA 24Hr. REMINDER', pt: 'Lembrete de 24h da NFPA', categoria: 'diagnostico' },
  { codigo: 'NOT-71', en: 'Detector Initialize', pt: 'Detector inicializando', categoria: 'diagnostico' },
  { codigo: 'NOT-72', en: 'Drill activated', pt: 'Simulado (drill) ativado', categoria: 'diagnostico' },
];

/** Normaliza o valor gravado em paineis.marca. Aceita variações do texto antigo
    "Marca / Modelo" (ex.: "Hochiki FireNET", "Notifier Onyx"). Retorna
    'hochiki' | 'notifier' | '' (desconhecida). */
export function normalizarMarca(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'hochiki' || v === 'notifier') return v;
  if (/hochiki|firenet|ves|l@titude|latitude/.test(v)) return 'hochiki';
  if (/notifier|onyx|nfs|honeywell/.test(v)) return 'notifier';
  return '';
}

/** Lista de falhas para a marca dada (já normalizada ou texto livre). */
export function falhasParaMarca(marca) {
  const m = normalizarMarca(marca);
  if (m === 'hochiki') return FALHAS_HOCHIKI;
  if (m === 'notifier') return FALHAS_NOTIFIER;
  return [];
}

/** Busca um item de falha pelo código, nas duas listas. */
export function getFalhaPorCodigo(codigo) {
  if (!codigo) return null;
  return FALHAS_HOCHIKI.find((f) => f.codigo === codigo)
    || FALHAS_NOTIFIER.find((f) => f.codigo === codigo)
    || null;
}

/** Rótulo PT de uma categoria; cai em "Não classificado" para chave vazia/desconhecida. */
export function rotuloCategoria(chave) {
  return CATEGORIAS_FALHA[chave] || ROTULO_NAO_CLASSIFICADO;
}
