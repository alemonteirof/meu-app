import { supabase } from './supabaseClient';

function legacyKey(clienteId) {
  return `pci-dados-cliente-${clienteId}`;
}

export const DEVICE_TYPE_LABELS = {
  fumaca: 'Detector de fumaça',
  calor: 'Detector de calor',
  acionador: 'Acionador manual',
  saida: 'Módulo de saída',
  entrada: 'Módulo de entrada',
  entrada_duplo: 'Módulo de Entrada Duplo',
  rele: 'Módulo de relé',
};

// ---- Categoria funcional (módulos de entrada) / método de teste ----

export const FUNCTIONAL_CATEGORIES = [
  { value: 'detector_linear', label: 'Detector Linear' },
  { value: 'acionador_manual', label: 'Acionador Manual' },
  { value: 'detector_gas_hc', label: 'Detector de Gás HC' },
  { value: 'detector_gas_co2', label: 'Detector de Gás CO2' },
  { value: 'detector_gas_outro', label: 'Detector de Gás (outro)' },
  { value: 'termovelocimetrico', label: 'Detector Termovelocimétrico' },
  { value: 'detector_chama', label: 'Detector de Chama' },
  { value: 'outro', label: 'Outro' },
];
export const FUNCTIONAL_CATEGORY_MAP = Object.fromEntries(FUNCTIONAL_CATEGORIES.map((c) => [c.value, c.label]));

export const PAPEL_SINAL_OPTIONS = [
  { value: 'falha', label: 'Falha' },
  { value: 'alarme', label: 'Alarme' },
  { value: 'pre_alarme', label: 'Pré-Alarme' },
];
export const PAPEL_SINAL_MAP = Object.fromEntries(PAPEL_SINAL_OPTIONS.map((p) => [p.value, p.label]));

export const CATEGORIAS_COM_PAPEL_SINAL = ['detector_linear', 'detector_chama', 'detector_gas_hc', 'detector_gas_co2', 'detector_gas_outro'];

const METODO_POR_TIPO = {
  fumaca: 'Spray de teste de detectores',
  calor: 'Soprador térmico digital a bateria (temp. conforme detector)',
  acionador: 'Acionamento 5x seguidas (teste de esforço)',
  saida: 'Comando pela central',
  rele: 'Multímetro + "jump" nos comandos',
};

const METODO_POR_CATEGORIA_FUNCIONAL = {
  detector_linear: 'Teste de obscurecimento com filtro/lente de teste',
  detector_chama: 'Fonte de chama em área controlada ou lanterna UV/IR',
  detector_gas_hc: 'Bump Test (cilindro MultiGas/4 gases)',
  detector_gas_co2: 'Bump Test (cilindro MultiGas/4 gases)',
  detector_gas_outro: 'Bump Test (cilindro MultiGas/4 gases)',
  termovelocimetrico: 'Soprador térmico digital a bateria (temp. conforme detector)',
  acionador_manual: 'Acionamento 5x seguidas (teste de esforço)',
};

/** Dado um dispositivo (type, categoriaFuncional), devolve o método de teste travado. */
export function getMetodoTeste(device) {
  if (!device) return '';
  if (device.type === 'entrada' || device.type === 'entrada_duplo') {
    return METODO_POR_CATEGORIA_FUNCIONAL[device.categoriaFuncional] || '';
  }
  return METODO_POR_TIPO[device.type] || '';
}

// ---- Combate a Incêndio ----
// Duas estruturas:
// 1) CONJUNTO = pai com checklist fixo (mecânico/estrutural) — ao criar, já nascem todos os sub-itens.
//    Tudo isso é UMA LISTA SÓ (fácil de ajustar: adicionar/remover/editar um item aqui, sem mexer no banco).
// 2) COMPONENTE = elétrico/supervisionado (fluxostato, pressostato, solenoide, chaves) — cadastro livre,
//    quantidade variável, linkável opcionalmente a um Conjunto ("pertence a") e a um módulo do painel.

export const COMBATE_CONJUNTO_TIPOS = {
  casa_bombas: {
    label: 'Casa de Bombas',
    subItens: [
      { categoria: 'bomba_eletrica', label: 'Bomba Elétrica (principal)', metodo: 'Teste de vazão/pressão com medidor (curva característica)', periodicidade: 'Anual', unidade: 'L/min ou mca' },
      { categoria: 'bomba_diesel', label: 'Bomba Diesel (reserva)', metodo: 'Acionamento cronometrado + verificação de óleo/combustível', periodicidade: 'Semanal', unidade: 's (tempo de partida)' },
      { categoria: 'bomba_jockey', label: 'Bomba Jockey (pressurização)', metodo: 'Verificação de ciclos de partida/parada', periodicidade: 'Mensal', unidade: 'ciclos/dia' },
      { categoria: 'bateria_partida', label: 'Bateria de Partida (motor diesel)', metodo: 'Tensão + densidade do eletrólito', periodicidade: 'Mensal', unidade: 'V' },
      { categoria: 'quadro_comando', label: 'Quadro de Comando / Alarmes', metodo: 'Teste funcional de sinalização', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'reservatorio', label: 'Reservatório de Água', metodo: 'Inspeção visual de nível', periodicidade: 'Mensal', unidade: '%' },
    ],
  },
  hidrante: {
    label: 'Hidrante / Mangotinho',
    subItens: [
      { categoria: 'abrigo', label: 'Abrigo/Caixa', metodo: 'Inspeção visual (integridade, acesso, fechamento)', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'mangueira', label: 'Mangueira', metodo: 'Visual mensal + teste hidrostático anual (NBR 12779)', periodicidade: 'Mensal / Anual', unidade: 'bar' },
      { categoria: 'esguicho', label: 'Esguicho/Requinte', metodo: 'Inspeção + acionamento do jato', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'registro', label: 'Registro (Globo/Ângulo/Gaveta)', metodo: 'Acionamento manual + lubrificação, estanqueidade', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'uniao_storz', label: 'Adaptador/União Storz', metodo: 'Verificação de rosca/encaixe', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'chave_mangueira', label: 'Chave de Mangueira', metodo: 'Presença e estado', periodicidade: 'Mensal', unidade: '' },
      { categoria: 'sinalizacao', label: 'Sinalização/Iluminação do Abrigo', metodo: 'Visibilidade da placa + luz de emergência', periodicidade: 'Mensal', unidade: '' },
    ],
  },
  vga: {
    label: 'VGA (Sprinklers)',
    subItens: [
      { categoria: 'clapper', label: 'Corpo da VGA (Clapper)', metodo: 'Inspeção visual + acionamento manual', periodicidade: 'Semestral/Anual', unidade: '' },
      { categoria: 'gongo', label: 'Gongo Hidráulico', metodo: 'Teste sonoro durante o acionamento da VGA', periodicidade: 'Semestral/Anual', unidade: '' },
      { categoria: 'camara_retardo', label: 'Câmara de Retardo', metodo: 'Inspeção do dreno, sem obstrução', periodicidade: 'Anual', unidade: '' },
      { categoria: 'manometros', label: 'Manômetros', metodo: 'Leitura/comparação, dentro da faixa', periodicidade: 'Mensal', unidade: 'bar' },
      { categoria: 'dreno_principal', label: 'Válvula de Dreno Principal', metodo: 'Main drain test — queda/recuperação de pressão', periodicidade: 'Anual', unidade: '' },
      { categoria: 'sprinklers_amostragem', label: 'Sprinklers do Setor (Amostragem)', metodo: 'Inspeção visual de amostra representativa (obstrução/corrosão/pintura)', periodicidade: 'Trimestral', unidade: '' },
    ],
  },
  lge: {
    label: 'LGE (Espuma)',
    temRetestLaboratorial: true,
    subItens: [
      { categoria: 'clapper', label: 'Corpo da Válvula (Dilúvio)', metodo: 'Inspeção visual + acionamento manual', periodicidade: 'Semestral/Anual', unidade: '' },
      { categoria: 'gongo', label: 'Gongo Hidráulico', metodo: 'Teste sonoro durante o acionamento', periodicidade: 'Semestral/Anual', unidade: '' },
      { categoria: 'manometros', label: 'Manômetros', metodo: 'Leitura/comparação, dentro da faixa', periodicidade: 'Mensal', unidade: 'bar' },
      { categoria: 'dreno_principal', label: 'Válvula de Dreno Principal', metodo: 'Main drain test', periodicidade: 'Anual', unidade: '' },
      { categoria: 'tanque_lge', label: 'Tanque de LGE', metodo: 'Inspeção visual/medição de nível', periodicidade: 'Mensal', unidade: '%' },
      { categoria: 'proporcionador', label: 'Proporcionador', metodo: 'Teste de proporção água/LGE (refratômetro)', periodicidade: 'Anual', unidade: '%' },
      { categoria: 'camara_espuma', label: 'Câmara de Espuma', metodo: 'Inspeção visual + teste de descarga', periodicidade: 'Anual', unidade: '' },
      { categoria: 'bicos_abertos', label: 'Bicos Abertos (Amostragem)', metodo: 'Inspeção visual de amostra representativa (sem bulbo)', periodicidade: 'Trimestral', unidade: '' },
    ],
  },
  sistema_gas: {
    label: 'Sistema (Agente Gasoso)',
    subItens: [
      { categoria: 'painel_acionamento', label: 'Painel de Acionamento Dedicado', metodo: 'Teste funcional de reconhecimento de sinal', periodicidade: 'Semestral', unidade: '' },
      { categoria: 'valvula_direcional', label: 'Válvula Direcional/Seletora', metodo: 'Teste de abertura/fechamento', periodicidade: 'Semestral', unidade: '' },
      { categoria: 'sirenes', label: 'Sirenes/Estrobos de Pré-Descarga', metodo: 'Teste sonoro/visual', periodicidade: 'Semestral', unidade: '' },
      { categoria: 'temporizador', label: 'Temporizador de Retardo', metodo: 'Cronometragem do tempo de retardo', periodicidade: 'Semestral', unidade: 's' },
      { categoria: 'difusores', label: 'Difusores/Bicos', metodo: 'Inspeção visual de obstrução', periodicidade: 'Semestral', unidade: '' },
      { categoria: 'tubulacao', label: 'Tubulação e Suportes', metodo: 'Inspeção visual', periodicidade: 'Anual', unidade: '' },
    ],
  },
};
export const COMBATE_AGUA_TIPOS = ['casa_bombas', 'hidrante', 'vga', 'lge'];
export const COMBATE_GAS_AGENTES = [
  { value: 'co2', label: 'CO₂' },
  { value: 'novec', label: 'NOVEC 1230' },
  { value: 'po_quimico', label: 'Pó Químico' },
];

export function conjuntoSubitemInfo(tipo, categoria) {
  return COMBATE_CONJUNTO_TIPOS[tipo]?.subItens.find((s) => s.categoria === categoria) || null;
}

export const COMBATE_COMPONENTE_TIPOS = [
  { value: 'fluxostato', label: 'Fluxostato', metodo: 'Acionamento manual/dreno, verificar sinal e retardo', periodicidade: 'Semestral', unidade: '', moduloTipo: 'entrada' },
  { value: 'pressostato', label: 'Pressostato', metodo: 'Verificar setpoint de atuação com manômetro de referência', periodicidade: 'Semestral', unidade: 'bar', moduloTipo: 'entrada' },
  { value: 'solenoide', label: 'Válvula Solenoide', metodo: 'Energiza/desenergiza, verifica abertura, fechamento e posição', periodicidade: 'Semestral', unidade: '', moduloTipo: 'saida' },
  { value: 'chave_supervisora', label: 'Chave Supervisora (Tamper)', metodo: 'Move a válvula, verifica sinal de supervisão', periodicidade: 'Semestral', unidade: '', moduloTipo: 'entrada' },
  { value: 'chave_abandono', label: 'Chave de Abandono/Bloqueio', metodo: 'Teste funcional, verifica bloqueio de descarga', periodicidade: 'Semestral', unidade: '', moduloTipo: 'entrada' },
];
export const COMBATE_COMPONENTE_TIPO_MAP = Object.fromEntries(COMBATE_COMPONENTE_TIPOS.map((c) => [c.value, c]));

// ---- Bateria de Cilindros (CO2/NOVEC/Pó Químico) ----
// Pressão já é visual no manômetro (item de checklist, sem valor numérico); peso e demais medições
// ficam só no retest laboratorial terceirizado (1 data só — o app calcula a próxima sozinho, 5 anos).
export const COMBATE_CILINDRO_ITENS = [
  { key: 'valvula', label: 'Válvula/Cabeça de Comando', metodo: 'Inspeção visual de corrosão, vazamento e integridade do lacre' },
  { key: 'manometro', label: 'Manômetro (leitura visual)', metodo: 'Leitura visual — ponteiro na faixa verde/pressão normal' },
  { key: 'corpo', label: 'Corpo do Cilindro', metodo: 'Inspeção visual de corrosão, amassados e pintura' },
  { key: 'etiqueta', label: 'Etiqueta de Dados', metodo: 'Verificação de legibilidade (peso, data de fabricação/teste, capacidade)' },
];
export const COMBATE_RETEST_LABORATORIAL_MESES = 60; // 5 anos — período padrão de retest/requalificação de cilindro

function statusCapitalizado(s) {
  if (s === 'aguardando') return 'Aguardando';
  if (s === 'andamento') return 'Andamento';
  if (s === 'resolvido') return 'Resolvido';
  return 'Aguardando';
}

export async function createVisita({ clienteId, painelId, tecnico, dataVisita }) {
  const { data, error } = await supabase.from('rvts').insert({
    cliente_id: clienteId, painel_id: painelId || null, tecnico: tecnico || null,
    data_visita: dataVisita || new Date().toISOString().slice(0, 10),
  }).select().single();
  if (error) throw error;
  return data;
}

async function addItemToVisita(rvtId, { atendimentoId, inspecaoId, outroDescricao, outroFotos }) {
  if (!rvtId) return;
  const { error } = await supabase.from('rvt_itens').insert({
    rvt_id: rvtId, atendimento_id: atendimentoId || null,
    inspecao_id: inspecaoId || null, outro_descricao: outroDescricao || null,
    outro_fotos: outroFotos || [],
  });
  if (error) throw error;
}

export async function addOutroToVisita(rvtId, descricao, fotos) {
  return addItemToVisita(rvtId, { outroDescricao: descricao, outroFotos: fotos });
}

export async function createAtendimento({ dispositivoId, falha, status, tecnico, descritivo, origemInspecaoId, rvtId, fotos }) {
  const { data, error } = await supabase.from('atendimentos').insert({
    dispositivo_id: dispositivoId, falha: falha || null, status: status || 'aguardando',
    tecnico: tecnico || null, descritivo: descritivo || null, origem_inspecao_id: origemInspecaoId || null,
    fotos: fotos || [],
  }).select().single();
  if (error) throw error;

  await supabase.from('dispositivos')
    .update({ ultima_manutencao: new Date().toISOString().slice(0, 10) })
    .eq('id', dispositivoId);

  await addItemToVisita(rvtId, { atendimentoId: data.id });
  return data;
}

async function selectAllRows(builderFactory) {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await builderFactory(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
export async function createInspecao({
  dispositivoId, tecnico, resultadoTeste, aparencia, comunicacaoLocal, comunicacaoRede,
  observacoes, falha, metodo, dataInspecao, proximaInspecao, rvtId, fotos,
}) {
  const dataFinal = dataInspecao || new Date().toISOString().slice(0, 10);

  const { data: inspecao, error } = await supabase.from('inspecoes').insert({
    dispositivo_id: dispositivoId, tecnico: tecnico || null, resultado_teste: resultadoTeste || null,
    aparencia: aparencia || null, comunicacao_local: comunicacaoLocal || null,
    comunicacao_rede: comunicacaoRede || null, observacoes: observacoes || null,
    falha: falha || null, metodo: metodo || null, data_inspecao: dataFinal,
    proxima_inspecao: proximaInspecao || null, fotos: fotos || [],
  }).select().single();
  if (error) throw error;

  await addItemToVisita(rvtId, { inspecaoId: inspecao.id });

  let atendimento = null;
  if (falha && falha.trim()) {
    atendimento = await createAtendimento({
      dispositivoId, falha, status: 'aguardando', origemInspecaoId: inspecao.id, rvtId,
      descritivo: 'Corretiva gerada automaticamente por falha na inspeção',
    });
  }

  await supabase.from('dispositivos')
    .update({
      ultima_inspecao: dataFinal, proxima_inspecao: proximaInspecao || null,
      resultado_teste: resultadoTeste || null, aparencia: aparencia || null,
      comunicacao_local: comunicacaoLocal || null, comunicacao_rede: comunicacaoRede || null,
    })
    .eq('id', dispositivoId);

  return { inspecao, atendimento };
}

export async function listAtendimentos(clienteId) {
  const { data, error } = await supabase
    .from('atendimentos')
    .select('*, dispositivos!inner(id, etiqueta, endereco, cliente_id), rvt_itens(rvt_id)')
    .eq('dispositivos.cliente_id', clienteId)
    .order('data_registro', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listInspecoes(clienteId) {
  const { data, error } = await supabase
    .from('inspecoes')
    .select('*, dispositivos!inner(id, etiqueta, endereco, cliente_id), rvt_itens(rvt_id)')
    .eq('dispositivos.cliente_id', clienteId)
    .order('data_inspecao', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listVisitas(clienteId) {
  const { data, error } = await supabase
    .from('rvts')
    .select(`
      id, data_visita, tecnico, painel_id,
      rvt_itens (
                id, outro_descricao, outro_fotos,
        atendimentos ( id, falha, tipo, status, descritivo, dispositivo_id, fotos, dispositivos ( etiqueta, endereco ) ),
        inspecoes ( id, falha, resultado_teste, aparencia, comunicacao_local, comunicacao_rede, observacoes, metodo, data_inspecao, proxima_inspecao, dispositivo_id, fotos, dispositivos ( etiqueta, endereco ) )
      )
    `)
    .eq('cliente_id', clienteId)
    .order('data_visita', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadClientData(clienteId) {
  const { data: legacyRow, error: legacyErr } = await supabase
    .from('kv_store').select('value').eq('key', legacyKey(clienteId)).maybeSingle();
  if (legacyErr) throw legacyErr;
  const legacy = legacyRow ? JSON.parse(legacyRow.value) : {};

  const { data: paineis, error: eP } = await supabase.from('paineis').select('*').eq('cliente_id', clienteId);
  if (eP) throw eP;

  const painelIds = paineis.map((p) => p.id);
  const { data: lacos, error: eL } = painelIds.length
    ? await supabase.from('lacos').select('*').in('painel_id', painelIds)
    : { data: [], error: null };
  if (eL) throw eL;

  const { data: dispositivos, error: eD } = await selectAllRows((from, to) => supabase.from('dispositivos').select('*').eq('cliente_id', clienteId).range(from, to));
  if (eD) throw eD;

  const { data: bateriasPainelRows, error: eBP } = await selectAllRows((from, to) => supabase.from('baterias_painel').select('*').eq('cliente_id', clienteId).range(from, to));
  if (eBP) throw eBP;
  const { data: fontesAuxiliaresRows, error: eFA } = await selectAllRows((from, to) => supabase.from('fontes_auxiliares').select('*').eq('cliente_id', clienteId).range(from, to));
  if (eFA) throw eFA;
  const { data: combateConjuntosRows, error: eCC } = await selectAllRows((from, to) => supabase.from('combate_conjuntos').select('*').eq('cliente_id', clienteId).range(from, to));
  if (eCC) throw eCC;
  const { data: combateSubitensRows, error: eCS } = await selectAllRows((from, to) => supabase.from('combate_subitens').select('*').eq('cliente_id', clienteId).range(from, to));
  if (eCS) throw eCS;
  const { data: combateComponentesRows, error: eCP } = await supabase.from('combate_componentes').select('*').eq('cliente_id', clienteId);
  if (eCP) throw eCP;
  const { data: combateBateriasRows, error: eCB } = await supabase.from('combate_baterias_cilindros').select('*').eq('cliente_id', clienteId);
  if (eCB) throw eCB;
  const { data: combateCilindrosRows, error: eCI } = await supabase.from('combate_cilindros').select('*').eq('cliente_id', clienteId);
  if (eCI) throw eCI;

  const bateriasPainel = (bateriasPainelRows || []).map((b) => ({
    id: b.id, panelId: b.painel_id, tecnico: b.tecnico || '', dataInspecao: b.data_inspecao || '',
    bateria1Tensao: b.bateria1_tensao ?? '', bateria1Data: b.bateria1_data || '',
    bateria2Tensao: b.bateria2_tensao ?? '', bateria2Data: b.bateria2_data || '',
    proximaInspecao: b.proxima_inspecao || '', fotos: b.fotos || [],
  }));

  const fontesAuxiliares = (fontesAuxiliaresRows || []).map((f) => ({
    id: f.id, nome: f.nome || '', tensaoSaidas: f.tensao_saidas ?? '',
    tecnico: f.tecnico || '', dataInspecao: f.data_inspecao || '',
    bateria1Tensao: f.bateria1_tensao ?? '', bateria1Data: f.bateria1_data || '',
    bateria2Tensao: f.bateria2_tensao ?? '', bateria2Data: f.bateria2_data || '',
    proximaInspecao: f.proxima_inspecao || '', fotos: f.fotos || [],
  }));

  const combateConjuntos = (combateConjuntosRows || []).map((c) => ({
    id: c.id, tipo: c.tipo || '', agente: c.agente || '', panelId: c.painel_id || '', etiqueta: c.etiqueta || '',
  }));

  const combateSubitens = (combateSubitensRows || []).map((s) => ({
    id: s.id, conjuntoId: s.conjunto_id, categoria: s.categoria || '',
    tecnico: s.tecnico || '', dataInspecao: s.data_inspecao || '', resultadoTeste: s.resultado_teste || '',
    valorMedido: s.valor_medido ?? '', observacoes: s.observacoes || '', falha: s.falha || '',
    proximaInspecao: s.proxima_inspecao || '', fotos: s.fotos || [],
    dataRetestLaboratorial: s.data_retest_laboratorial || '', proximaRetestLaboratorial: s.proxima_retest_laboratorial || '',
  }));

  const combateComponentes = (combateComponentesRows || []).map((c) => ({
    id: c.id, tipo: c.tipo || '', etiqueta: c.etiqueta || '', conjuntoId: c.conjunto_id || '', dispositivoId: c.dispositivo_id || '',
    tecnico: c.tecnico || '', dataInspecao: c.data_inspecao || '', resultadoTeste: c.resultado_teste || '',
    valorMedido: c.valor_medido ?? '', observacoes: c.observacoes || '', falha: c.falha || '',
    proximaInspecao: c.proxima_inspecao || '', fotos: c.fotos || [],
  }));

  const combateBaterias = (combateBateriasRows || []).map((b) => ({
    id: b.id, agente: b.agente || '', etiqueta: b.etiqueta || '', panelId: b.painel_id || '',
  }));

  const combateCilindros = (combateCilindrosRows || []).map((c) => ({
    id: c.id, bateriaId: c.bateria_id, identificacao: c.identificacao || '',
    tecnico: c.tecnico || '', dataInspecao: c.data_inspecao || '',
    resultadoValvula: c.resultado_valvula || '', resultadoManometro: c.resultado_manometro || '',
    resultadoCorpo: c.resultado_corpo || '', resultadoEtiqueta: c.resultado_etiqueta || '',
    observacoes: c.observacoes || '', falha: c.falha || '', proximaInspecao: c.proxima_inspecao || '', fotos: c.fotos || [],
    dataRetestLaboratorial: c.data_retest_laboratorial || '', proximaRetestLaboratorial: c.proxima_retest_laboratorial || '',
  }));

  const panels = paineis.map((p) => ({
    id: p.id, name: p.nome, location: p.localizacao || '', model: p.modelo || '',
    installDate: p.data_instalacao || '', notes: p.observacoes || '',
  }));

  const loops = lacos.map((l) => ({
    id: l.id, panelId: l.painel_id, name: l.nome || (l.numero ? `Laço ${l.numero}` : ''),
  }));

  const devices = dispositivos.filter((d) => d.laco_id).map((d) => ({
    id: d.id, loopId: d.laco_id, address: d.endereco || '', type: d.tipo_modulo,
    modelo: d.modelo || '', description: d.etiqueta || '',
    categoriaFuncional: d.categoria_funcional || '', papelSinal: d.papel_sinal || '', subEndereco: d.sub_endereco || '',
    etiquetaComplementar: d.etiqueta_complementar || '', dataCalibracao: d.data_calibracao || '', proximaCalibracao: d.proxima_calibracao || '',
    nextMaintenance: d.proxima_inspecao || '', lastMaintenance: d.ultima_manutencao || '',
    operationalStatus: d.resultado_teste || '', appearance: d.aparencia || '',
    localComm: d.comunicacao_local || '', networkComm: d.comunicacao_rede || '',
    lastInspection: d.ultima_inspecao || '', nextInspection: d.proxima_inspecao || '',
  }));

  const nacs = dispositivos.filter((d) => !d.laco_id && d.painel_id).map((d) => ({
    id: d.id, panelId: d.painel_id, name: d.etiqueta || '', description: d.descricao || '',
    nextMaintenance: d.proxima_inspecao || '', lastMaintenance: d.ultima_manutencao || '',
    operationalStatus: d.resultado_teste || '', appearance: d.aparencia || '',
    localComm: d.comunicacao_local || '', networkComm: d.comunicacao_rede || '',
    lastInspection: d.ultima_inspecao || '', nextInspection: d.proxima_inspecao || '',
  }));

  const gasDetectors = dispositivos.filter((d) => !d.laco_id && !d.painel_id).map((d) => ({
    id: d.id, name: d.etiqueta || '', modelo: d.modelo || '', location: d.descricao || '',
    type: d.categoria_funcional || '', nextMaintenance: d.proxima_inspecao || '', lastMaintenance: d.ultima_manutencao || '',
    operationalStatus: d.resultado_teste || '', appearance: d.aparencia || '',
    localComm: d.comunicacao_local || '', networkComm: d.comunicacao_rede || '',
    lastInspection: d.ultima_inspecao || '', nextInspection: d.proxima_inspecao || '',
  }));

  function categoriaFor(dispositivoId) {
    if (devices.some((d) => d.id === dispositivoId)) return 'devices';
    if (nacs.some((n) => n.id === dispositivoId)) return 'nacs';
    if (gasDetectors.some((g) => g.id === dispositivoId)) return 'gasDetectors';
    return 'devices';
  }

  const [atendimentosNovos, inspecoesNovos, visitasNovas] = await Promise.all([
    listAtendimentos(clienteId), listInspecoes(clienteId), listVisitas(clienteId),
  ]);

  const indicadorNovos = [
    ...atendimentosNovos.map((a) => ({
      id: `novo-at-${a.id}`, tipo: 'manutencao', deviceId: a.dispositivo_id,
      categoria: categoriaFor(a.dispositivo_id),
      etiqueta: a.dispositivos?.etiqueta || a.dispositivos?.endereco || '',
      endereco: a.dispositivos?.endereco || '', laco: '', painel: '', equipamento: '', area: '',
      falha: a.falha || '', descritivo: a.descritivo || '', status: statusCapitalizado(a.status),
      explanacao: '', dataDiagnostico: (a.data_registro || '').slice(0, 10),
      dataIntervencao1: (a.data_registro || '').slice(0, 10),
      dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: a.status === 'resolvido' ? (a.data_registro || '').slice(0, 10) : '',
      solucao: '', fotos: a.fotos || [],
      origemRvt: a.rvt_itens?.[0]?.rvt_id ? `novo-rvt-${a.rvt_itens[0].rvt_id}` : '',
      origemNovo: true,
    })),
    ...inspecoesNovos.map((i) => ({
      id: `novo-insp-${i.id}`, tipo: 'inspecao', deviceId: i.dispositivo_id,
      categoria: categoriaFor(i.dispositivo_id),
      etiqueta: i.dispositivos?.etiqueta || i.dispositivos?.endereco || '',
      endereco: i.dispositivos?.endereco || '', laco: '', painel: '', equipamento: '', area: '',
      falha: i.falha || '', descritivo: i.observacoes || i.resultado_teste || '', status: 'Resolvido',
      explanacao: '', dataDiagnostico: i.data_inspecao || '',
      dataIntervencao1: i.data_inspecao || '',
      dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: i.data_inspecao || '',
      solucao: '', fotos: i.fotos || [],
      origemRvt: i.rvt_itens?.[0]?.rvt_id ? `novo-rvt-${i.rvt_itens[0].rvt_id}` : '',
      origemNovo: true,
    })),
  ];

  const rvtNovos = visitasNovas.map((v) => ({
    id: `novo-rvt-${v.id}`, data: v.data_visita, tecnico: v.tecnico || '',
    origemNovo: true,
    itens: (v.rvt_itens || []).map((it) => {
      if (it.outro_descricao) {
        return { id: `novo-item-${it.id}`, deviceId: null, categoria: 'outro',
          etiqueta: 'Outros', endereco: '', laco: '', painel: '', equipamento: '', area: '',
          falha: '', descritivo: it.outro_descricao, status: 'Resolvido',
          explanacao: '', dataIntervencao: v.data_visita, solucao: '', fotos: [] };
      }
      if (it.atendimentos) {
        const a = it.atendimentos;
        return { id: `novo-item-${it.id}`, deviceId: a.dispositivo_id, categoria: categoriaFor(a.dispositivo_id),
          etiqueta: a.dispositivos?.etiqueta || a.dispositivos?.endereco || '',
          endereco: a.dispositivos?.endereco || '', laco: '', painel: '', equipamento: '', area: '',
          falha: a.falha || '', descritivo: a.descritivo || '', status: statusCapitalizado(a.status),
          explanacao: '', dataIntervencao: v.data_visita, solucao: '', fotos: a.fotos || [] };
      }
      if (it.inspecoes) {
        const i = it.inspecoes;
        return { id: `novo-item-${it.id}`, deviceId: i.dispositivo_id, categoria: categoriaFor(i.dispositivo_id),
          etiqueta: i.dispositivos?.etiqueta || i.dispositivos?.endereco || '',
          endereco: i.dispositivos?.endereco || '', laco: '', painel: '', equipamento: '', area: '',
          falha: i.falha || '', descritivo: i.resultado_teste || '', status: 'Resolvido',
          explanacao: '', dataIntervencao: i.data_inspecao, solucao: '', fotos: i.fotos || [] };
      }
      return null;
    }).filter(Boolean),
  }));

  return {
    panels, loops, nacs, devices, gasDetectors,
    bateriasPainel, fontesAuxiliares, combateConjuntos, combateSubitens, combateComponentes, combateBaterias, combateCilindros,
    pumpDevices: legacy.pumpDevices || [],
    maintenanceLog: legacy.maintenanceLog || [],
    inspectionLog: legacy.inspectionLog || [],
    modelPhotos: legacy.modelPhotos || {},
    indicador: [...indicadorNovos, ...(legacy.indicador || [])],
    rvt: [...rvtNovos, ...(legacy.rvt || [])],
  };
}

const saveQueues = new Map();

export function saveClientData(clienteId, data) {
  const prev = saveQueues.get(clienteId) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => doSaveClientData(clienteId, data));
  saveQueues.set(clienteId, next);
  return next;
}

const TIPOS_MODULO_VALIDOS = ['fumaca', 'calor', 'acionador', 'saida', 'rele', 'entrada', 'entrada_duplo', 'modulo_saida', 'detector_gas', 'outro'];

async function doSaveClientData(clienteId, data) {
  // Monta os dispositivos e VALIDA antes de tocar no banco — se algo estiver fora do esperado,
  // aborta aqui, sem ter apagado nada ainda (evita o cenário "apagou tudo, insert falhou, perdeu os dados").
  const dispositivosRows = [
    ...(data.devices || []).map((d) => ({
      id: d.id, cliente_id: clienteId, laco_id: d.loopId, painel_id: null,
      endereco: d.address || null, etiqueta: d.description || null,
      tipo_modulo: d.type || 'outro', modelo: d.modelo || null,
      categoria_funcional: d.categoriaFuncional || null, papel_sinal: d.papelSinal || null, sub_endereco: d.subEndereco || null,
      etiqueta_complementar: d.etiquetaComplementar || null, data_calibracao: d.dataCalibracao || null, proxima_calibracao: d.proximaCalibracao || null,
      proxima_inspecao: d.nextMaintenance || null, ultima_manutencao: d.lastMaintenance || null,
    })),
    ...(data.nacs || []).map((n) => ({
      id: n.id, cliente_id: clienteId, laco_id: null, painel_id: n.panelId,
      etiqueta: n.name || null, descricao: n.description || null, tipo_modulo: 'modulo_saida',
      proxima_inspecao: n.nextMaintenance || null, ultima_manutencao: n.lastMaintenance || null,
    })),
    ...(data.gasDetectors || []).map((g) => ({
      id: g.id, cliente_id: clienteId, laco_id: null, painel_id: null,
      etiqueta: g.name || null, descricao: g.location || null, modelo: g.modelo || null,
      tipo_modulo: 'detector_gas', categoria_funcional: g.type || 'Detector de Gás',
      proxima_inspecao: g.nextMaintenance || null, ultima_manutencao: g.lastMaintenance || null,
    })),
  ];
  const invalido = dispositivosRows.find((r) => !TIPOS_MODULO_VALIDOS.includes(r.tipo_modulo));
  if (invalido) {
    throw new Error(`Salvamento abortado (nada foi apagado): tipo de dispositivo desconhecido "${invalido.tipo_modulo}" no endereço ${invalido.endereco || invalido.etiqueta || invalido.id}.`);
  }

  const legacyPayload = {
    pumpDevices: data.pumpDevices || [],
    maintenanceLog: data.maintenanceLog || [],
    inspectionLog: data.inspectionLog || [],
    modelPhotos: data.modelPhotos || {},
    indicador: (data.indicador || []).filter((r) => !r.origemNovo),
    rvt: (data.rvt || []).filter((r) => !r.origemNovo),
  };
  const { error: legacyErr } = await supabase.from('kv_store').upsert({
    key: legacyKey(clienteId), value: JSON.stringify(legacyPayload),
    client_id: clienteId, updated_at: new Date().toISOString(),
  });
  if (legacyErr) throw legacyErr;

  // ---- Painéis: upsert (nunca apaga tudo primeiro) + remove só os que saíram da lista ----
  const panelRows = (data.panels || []).map((p) => ({
    id: p.id, cliente_id: clienteId, nome: p.name, localizacao: p.location || null,
    modelo: p.model || null, data_instalacao: p.installDate || null, observacoes: p.notes || null,
  }));
  if (panelRows.length) {
    const { error } = await supabase.from('paineis').upsert(panelRows);
    if (error) throw error;
  }
  {
    // Visitas (rvts) e itens de Combate a Incêndio que apontavam pra painéis que vão sair
    // perdem só a referência do painel (painel_id = null) — continuam existindo. Sem isso, a FK trava o delete.
    let qNull = supabase.from('rvts').update({ painel_id: null }).eq('cliente_id', clienteId).not('painel_id', 'is', null);
    if (panelRows.length) qNull = qNull.not('painel_id', 'in', `(${panelRows.map((p) => p.id).join(',')})`);
    const { error: nullErr } = await qNull;
    if (nullErr) throw nullErr;

    let qNullCombate = supabase.from('combate_conjuntos').update({ painel_id: null }).eq('cliente_id', clienteId).not('painel_id', 'is', null);
    if (panelRows.length) qNullCombate = qNullCombate.not('painel_id', 'in', `(${panelRows.map((p) => p.id).join(',')})`);
    const { error: nullErr2 } = await qNullCombate;
    if (nullErr2) throw nullErr2;

    let qNullBaterias = supabase.from('combate_baterias_cilindros').update({ painel_id: null }).eq('cliente_id', clienteId).not('painel_id', 'is', null);
    if (panelRows.length) qNullBaterias = qNullBaterias.not('painel_id', 'in', `(${panelRows.map((p) => p.id).join(',')})`);
    const { error: nullErr3 } = await qNullBaterias;
    if (nullErr3) throw nullErr3;

    let q = supabase.from('paineis').delete().eq('cliente_id', clienteId);
    if (panelRows.length) q = q.not('id', 'in', `(${panelRows.map((p) => p.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Laços: upsert + remove só os que saíram (dentro dos painéis do cliente) ----
  const painelIds = panelRows.map((p) => p.id);
  const loopRows = (data.loops || []).map((l) => ({
    id: l.id, painel_id: l.panelId, nome: l.name || null,
    numero: (l.name && l.name.match(/\d+/)) ? Number(l.name.match(/\d+/)[0]) : null,
  }));
  if (loopRows.length) {
    const { error } = await supabase.from('lacos').upsert(loopRows);
    if (error) throw error;
  }
  if (painelIds.length) {
    let q = supabase.from('lacos').delete().in('painel_id', painelIds);
    if (loopRows.length) q = q.not('id', 'in', `(${loopRows.map((l) => l.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Dispositivos: upsert + remove só os que saíram ----
  if (dispositivosRows.length) {
    const { error } = await supabase.from('dispositivos').upsert(dispositivosRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('dispositivos').delete().eq('cliente_id', clienteId);
    if (dispositivosRows.length) q = q.not('id', 'in', `(${dispositivosRows.map((d) => d.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Baterias de painel: upsert + remove só as que saíram ----
  const bateriasPainelRows = (data.bateriasPainel || []).map((b) => ({
    id: b.id, painel_id: b.panelId, cliente_id: clienteId, tecnico: b.tecnico || null,
    data_inspecao: b.dataInspecao || null,
    bateria1_tensao: b.bateria1Tensao === '' ? null : b.bateria1Tensao, bateria1_data: b.bateria1Data || null,
    bateria2_tensao: b.bateria2Tensao === '' ? null : b.bateria2Tensao, bateria2_data: b.bateria2Data || null,
    proxima_inspecao: b.proximaInspecao || null, fotos: b.fotos || [],
  }));
  if (bateriasPainelRows.length) {
    const { error } = await supabase.from('baterias_painel').upsert(bateriasPainelRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('baterias_painel').delete().eq('cliente_id', clienteId);
    if (bateriasPainelRows.length) q = q.not('id', 'in', `(${bateriasPainelRows.map((b) => b.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Fontes auxiliares: upsert + remove só as que saíram ----
  const fontesAuxiliaresRows = (data.fontesAuxiliares || []).map((f) => ({
    id: f.id, cliente_id: clienteId, nome: f.nome || null,
    tensao_saidas: f.tensaoSaidas === '' ? null : f.tensaoSaidas,
    tecnico: f.tecnico || null, data_inspecao: f.dataInspecao || null,
    bateria1_tensao: f.bateria1Tensao === '' ? null : f.bateria1Tensao, bateria1_data: f.bateria1Data || null,
    bateria2_tensao: f.bateria2Tensao === '' ? null : f.bateria2Tensao, bateria2_data: f.bateria2Data || null,
    proxima_inspecao: f.proximaInspecao || null, fotos: f.fotos || [],
  }));
  if (fontesAuxiliaresRows.length) {
    const { error } = await supabase.from('fontes_auxiliares').upsert(fontesAuxiliaresRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('fontes_auxiliares').delete().eq('cliente_id', clienteId);
    if (fontesAuxiliaresRows.length) q = q.not('id', 'in', `(${fontesAuxiliaresRows.map((f) => f.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Combate a Incêndio: Conjuntos (pai) → Sub-itens (filhos, FK) → Componentes ----
  const combateConjuntosRows = (data.combateConjuntos || []).map((c) => ({
    id: c.id, cliente_id: clienteId, tipo: c.tipo || null, agente: c.agente || null,
    painel_id: c.panelId || null, etiqueta: c.etiqueta || null,
  }));
  if (combateConjuntosRows.length) {
    const { error } = await supabase.from('combate_conjuntos').upsert(combateConjuntosRows);
    if (error) throw error;
  }

  const combateSubitensRows = (data.combateSubitens || []).map((s) => ({
    id: s.id, conjunto_id: s.conjuntoId, cliente_id: clienteId, categoria: s.categoria || null,
    tecnico: s.tecnico || null, data_inspecao: s.dataInspecao || null, resultado_teste: s.resultadoTeste || null,
    valor_medido: s.valorMedido === '' ? null : s.valorMedido, observacoes: s.observacoes || null, falha: s.falha || null,
    proxima_inspecao: s.proximaInspecao || null, fotos: s.fotos || [],
    data_retest_laboratorial: s.dataRetestLaboratorial || null, proxima_retest_laboratorial: s.proximaRetestLaboratorial || null,
  }));
  if (combateSubitensRows.length) {
    const { error } = await supabase.from('combate_subitens').upsert(combateSubitensRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('combate_subitens').delete().eq('cliente_id', clienteId);
    if (combateSubitensRows.length) q = q.not('id', 'in', `(${combateSubitensRows.map((s) => s.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  {
    let q = supabase.from('combate_conjuntos').delete().eq('cliente_id', clienteId);
    if (combateConjuntosRows.length) q = q.not('id', 'in', `(${combateConjuntosRows.map((c) => c.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  const combateComponentesRows = (data.combateComponentes || []).map((c) => ({
    id: c.id, cliente_id: clienteId, tipo: c.tipo || null, etiqueta: c.etiqueta || null,
    conjunto_id: c.conjuntoId || null, dispositivo_id: c.dispositivoId || null,
    tecnico: c.tecnico || null, data_inspecao: c.dataInspecao || null, resultado_teste: c.resultadoTeste || null,
    valor_medido: c.valorMedido === '' ? null : c.valorMedido, observacoes: c.observacoes || null, falha: c.falha || null,
    proxima_inspecao: c.proximaInspecao || null, fotos: c.fotos || [],
  }));
  if (combateComponentesRows.length) {
    const { error } = await supabase.from('combate_componentes').upsert(combateComponentesRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('combate_componentes').delete().eq('cliente_id', clienteId);
    if (combateComponentesRows.length) q = q.not('id', 'in', `(${combateComponentesRows.map((c) => c.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  // ---- Bateria de Cilindros (pai) → Cilindros (filhos, FK), mesma ordem de dependência ----
  const combateBateriasRows = (data.combateBaterias || []).map((b) => ({
    id: b.id, cliente_id: clienteId, agente: b.agente || null, etiqueta: b.etiqueta || null, painel_id: b.panelId || null,
  }));
  if (combateBateriasRows.length) {
    const { error } = await supabase.from('combate_baterias_cilindros').upsert(combateBateriasRows);
    if (error) throw error;
  }

  const combateCilindrosRows = (data.combateCilindros || []).map((c) => ({
    id: c.id, bateria_id: c.bateriaId, cliente_id: clienteId, identificacao: c.identificacao || null,
    tecnico: c.tecnico || null, data_inspecao: c.dataInspecao || null,
    resultado_valvula: c.resultadoValvula || null, resultado_manometro: c.resultadoManometro || null,
    resultado_corpo: c.resultadoCorpo || null, resultado_etiqueta: c.resultadoEtiqueta || null,
    observacoes: c.observacoes || null, falha: c.falha || null, proxima_inspecao: c.proximaInspecao || null, fotos: c.fotos || [],
    data_retest_laboratorial: c.dataRetestLaboratorial || null, proxima_retest_laboratorial: c.proximaRetestLaboratorial || null,
  }));
  if (combateCilindrosRows.length) {
    const { error } = await supabase.from('combate_cilindros').upsert(combateCilindrosRows);
    if (error) throw error;
  }
  {
    let q = supabase.from('combate_cilindros').delete().eq('cliente_id', clienteId);
    if (combateCilindrosRows.length) q = q.not('id', 'in', `(${combateCilindrosRows.map((c) => c.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }

  {
    let q = supabase.from('combate_baterias_cilindros').delete().eq('cliente_id', clienteId);
    if (combateBateriasRows.length) q = q.not('id', 'in', `(${combateBateriasRows.map((b) => b.id).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  }
}

export async function updateAtendimento(id, { falha, status, descritivo, fotos, dispositivoId }) {
  const patch = {};
  if (falha !== undefined) patch.falha = falha || null;
  if (status !== undefined) patch.status = status;
  if (descritivo !== undefined) patch.descritivo = descritivo || null;
  if (fotos !== undefined) patch.fotos = fotos;
  if (dispositivoId !== undefined) patch.dispositivo_id = dispositivoId || null;
  const { data, error } = await supabase.from('atendimentos').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAtendimento(id) {
  const { error } = await supabase.from('atendimentos').delete().eq('id', id);
  if (error) throw error;
}

export async function updateInspecao(id, { resultadoTeste, aparencia, comunicacaoLocal, comunicacaoRede, observacoes, falha, metodo, proximaInspecao, fotos, dispositivoId }) {
  const patch = {};
  if (resultadoTeste !== undefined) patch.resultado_teste = resultadoTeste || null;
  if (aparencia !== undefined) patch.aparencia = aparencia || null;
  if (comunicacaoLocal !== undefined) patch.comunicacao_local = comunicacaoLocal || null;
  if (comunicacaoRede !== undefined) patch.comunicacao_rede = comunicacaoRede || null;
  if (observacoes !== undefined) patch.observacoes = observacoes || null;
  if (falha !== undefined) patch.falha = falha || null;
  if (metodo !== undefined) patch.metodo = metodo || null;
  if (proximaInspecao !== undefined) patch.proxima_inspecao = proximaInspecao || null;
  if (fotos !== undefined) patch.fotos = fotos;
  if (dispositivoId !== undefined) patch.dispositivo_id = dispositivoId || null;
  const { data, error } = await supabase.from('inspecoes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInspecao(id) {
  const { error } = await supabase.from('inspecoes').delete().eq('id', id);
  if (error) throw error;
}

export async function updateOutroItem(rvtItemId, descricao, fotos) {
  const patch = { outro_descricao: descricao };
  if (fotos !== undefined) patch.outro_fotos = fotos;
  const { error } = await supabase.from('rvt_itens').update(patch).eq('id', rvtItemId);
  if (error) throw error;
}

// ---- Combate a Incêndio: registro de vistoria em massa + histórico (Indicador de Combate) ----

export async function updateCombateSubitem(id, patch) {
  const dbPatch = {};
  if (patch.tecnico !== undefined) dbPatch.tecnico = patch.tecnico || null;
  if (patch.dataInspecao !== undefined) dbPatch.data_inspecao = patch.dataInspecao || null;
  if (patch.resultadoTeste !== undefined) dbPatch.resultado_teste = patch.resultadoTeste || null;
  if (patch.falha !== undefined) dbPatch.falha = patch.falha || null;
  if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes || null;
  if (patch.proximaInspecao !== undefined) dbPatch.proxima_inspecao = patch.proximaInspecao || null;
  const { error } = await supabase.from('combate_subitens').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function updateCombateComponente(id, patch) {
  const dbPatch = {};
  if (patch.tecnico !== undefined) dbPatch.tecnico = patch.tecnico || null;
  if (patch.dataInspecao !== undefined) dbPatch.data_inspecao = patch.dataInspecao || null;
  if (patch.resultadoTeste !== undefined) dbPatch.resultado_teste = patch.resultadoTeste || null;
  if (patch.falha !== undefined) dbPatch.falha = patch.falha || null;
  if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes || null;
  if (patch.proximaInspecao !== undefined) dbPatch.proxima_inspecao = patch.proximaInspecao || null;
  const { error } = await supabase.from('combate_componentes').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function updateCombateCilindro(id, patch) {
  const dbPatch = {};
  if (patch.tecnico !== undefined) dbPatch.tecnico = patch.tecnico || null;
  if (patch.dataInspecao !== undefined) dbPatch.data_inspecao = patch.dataInspecao || null;
  if (patch.resultadoValvula !== undefined) dbPatch.resultado_valvula = patch.resultadoValvula || null;
  if (patch.resultadoManometro !== undefined) dbPatch.resultado_manometro = patch.resultadoManometro || null;
  if (patch.resultadoCorpo !== undefined) dbPatch.resultado_corpo = patch.resultadoCorpo || null;
  if (patch.resultadoEtiqueta !== undefined) dbPatch.resultado_etiqueta = patch.resultadoEtiqueta || null;
  if (patch.falha !== undefined) dbPatch.falha = patch.falha || null;
  if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes || null;
  if (patch.proximaInspecao !== undefined) dbPatch.proxima_inspecao = patch.proximaInspecao || null;
  const { error } = await supabase.from('combate_cilindros').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function agendarInspecaoDispositivo(dispositivoId, proximaInspecao) {
  const { error } = await supabase.from('dispositivos')
    .update({ proxima_inspecao: proximaInspecao || null })
    .eq('id', dispositivoId);
  if (error) throw error;
}

export async function agendarInspecaoCombate(kind, id, proximaInspecao) {
  if (kind === 'subitem') return updateCombateSubitem(id, { proximaInspecao });
  if (kind === 'componente') return updateCombateComponente(id, { proximaInspecao });
  if (kind === 'cilindro') return updateCombateCilindro(id, { proximaInspecao });
}

export async function createCombateHistorico({ clienteId, tipoItem, itemId, categoriaLabel, contextoLabel, tecnico, dataInspecao, resultado, falha, observacoes }) {
  const { error } = await supabase.from('combate_historico').insert({
    cliente_id: clienteId, tipo_item: tipoItem, item_id: itemId,
    categoria_label: categoriaLabel || null, contexto_label: contextoLabel || null,
    tecnico: tecnico || null, data_inspecao: dataInspecao || null,
    resultado: resultado || null, falha: falha || null, observacoes: observacoes || null,
  });
  if (error) throw error;
}

export async function listCombateHistorico(clienteId) {
  const { data, error } = await supabase.from('combate_historico').select('*').eq('cliente_id', clienteId).order('data_inspecao', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteVisita(rvtId) {
  const { data: itens } = await supabase.from('rvt_itens').select('atendimento_id, inspecao_id').eq('rvt_id', rvtId);
  const atendimentoIds = (itens || []).map((i) => i.atendimento_id).filter(Boolean);
  const inspecaoIds = (itens || []).map((i) => i.inspecao_id).filter(Boolean);
  if (atendimentoIds.length) await supabase.from('atendimentos').delete().in('id', atendimentoIds);
  if (inspecaoIds.length) await supabase.from('inspecoes').delete().in('id', inspecaoIds);
  const { error } = await supabase.from('rvts').delete().eq('id', rvtId);
  if (error) throw error;
}
