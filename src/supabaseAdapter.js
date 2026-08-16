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

async function addItemToVisita(rvtId, { atendimentoId, inspecaoId, outroDescricao }) {
  if (!rvtId) return;
  const { error } = await supabase.from('rvt_itens').insert({
    rvt_id: rvtId, atendimento_id: atendimentoId || null,
    inspecao_id: inspecaoId || null, outro_descricao: outroDescricao || null,
  });
  if (error) throw error;
}

export async function addOutroToVisita(rvtId, descricao) {
  return addItemToVisita(rvtId, { outroDescricao: descricao });
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
    .update({ ultima_inspecao: dataFinal, proxima_inspecao: proximaInspecao || null })
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
        id, outro_descricao,
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

  const { data: dispositivos, error: eD } = await supabase.from('dispositivos').select('*').eq('cliente_id', clienteId);
  if (eD) throw eD;

  const { data: bateriasPainelRows, error: eBP } = await supabase.from('baterias_painel').select('*').eq('cliente_id', clienteId);
  if (eBP) throw eBP;
  const { data: fontesAuxiliaresRows, error: eFA } = await supabase.from('fontes_auxiliares').select('*').eq('cliente_id', clienteId);
  if (eFA) throw eFA;

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
  }));

  const nacs = dispositivos.filter((d) => !d.laco_id && d.painel_id).map((d) => ({
    id: d.id, panelId: d.painel_id, name: d.etiqueta || '', description: d.descricao || '',
    nextMaintenance: d.proxima_inspecao || '', lastMaintenance: d.ultima_manutencao || '',
  }));

  const gasDetectors = dispositivos.filter((d) => !d.laco_id && !d.painel_id).map((d) => ({
    id: d.id, name: d.etiqueta || '', modelo: d.modelo || '', location: d.descricao || '',
    type: d.categoria_funcional || '', nextMaintenance: d.proxima_inspecao || '', lastMaintenance: d.ultima_manutencao || '',
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
    bateriasPainel, fontesAuxiliares,
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
    // Visitas (rvts) que apontavam pra painéis que vão sair perdem só a referência do painel
    // (painel_id = null) — a visita e os itens dela continuam existindo. Sem isso, a FK trava o delete.
    let qNull = supabase.from('rvts').update({ painel_id: null }).eq('cliente_id', clienteId).not('painel_id', 'is', null);
    if (panelRows.length) qNull = qNull.not('painel_id', 'in', `(${panelRows.map((p) => p.id).join(',')})`);
    const { error: nullErr } = await qNull;
    if (nullErr) throw nullErr;

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
}

export async function updateAtendimento(id, { falha, status, descritivo, fotos }) {
  const patch = {};
  if (falha !== undefined) patch.falha = falha || null;
  if (status !== undefined) patch.status = status;
  if (descritivo !== undefined) patch.descritivo = descritivo || null;
  if (fotos !== undefined) patch.fotos = fotos;
  const { data, error } = await supabase.from('atendimentos').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAtendimento(id) {
  const { error } = await supabase.from('atendimentos').delete().eq('id', id);
  if (error) throw error;
}

export async function updateInspecao(id, { resultadoTeste, aparencia, comunicacaoLocal, comunicacaoRede, observacoes, falha, metodo, proximaInspecao, fotos }) {
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
  const { data, error } = await supabase.from('inspecoes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInspecao(id) {
  const { error } = await supabase.from('inspecoes').delete().eq('id', id);
  if (error) throw error;
}

export async function updateOutroItem(rvtItemId, descricao) {
  const { error } = await supabase.from('rvt_itens').update({ outro_descricao: descricao }).eq('id', rvtItemId);
  if (error) throw error;
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
