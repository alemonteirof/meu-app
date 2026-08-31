import { useEffect, useState, useCallback, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  createVisita, createAtendimento, createInspecao, addOutroToVisita, createDiagnosticoOutro, listVisitas, deleteVisita,
  updateAtendimento, updateInspecao, updateOutroItem, converterOutroParaAtendimento,
  getMetodoTeste, FUNCTIONAL_CATEGORY_MAP, DEVICE_TYPE_LABELS,
  COMBATE_CONJUNTO_TIPOS, COMBATE_COMPONENTE_TIPO_MAP, conjuntoSubitemInfo,
  updateCombateSubitem, updateCombateComponente, updateCombateCilindro, createCombateHistorico, agendarInspecaoDispositivo, agendarInspecaoCombate,
  salvarAssinaturaVisita, listAssinaturaAuditoria,
  getAssinaturaSalva, salvarAssinaturaSalva, apagarAssinaturaSalva,
} from './supabaseAdapter';
import { falhasParaMarca, getFalhaPorCodigo, normalizarMarca, CATEGORIAS_FALHA } from './lib/falhasPorMarca';

/** Prefixo do id de opção sintética "o painel em si" no seletor de itens de visita
    (mesma ideia de bp:/fa:). Só corretiva/manutenção — inspeção de painel fica fora. */
const PAINEL_OPT_PREFIX = 'pn:';

const ATIVIDADE_LABELS = {
  reuniao: 'Reunião',
  preparacao: 'Preparação',
  diagnostico: 'Diagnóstico',
  seguranca_trabalho: 'Segurança do Trabalho',
  manutencao_nao_cadastrada: 'Manutenção (item não cadastrado)',
};

/** Detalhe textual de um item "Outro", específico por atividade — reaproveitado
    no resumo (ItemResumo) e na montagem da impressão (itemsFromVisita). */
function atividadeDetalhe(atividade, dados) {
  dados = dados || {};
  if (atividade === 'reuniao') return dados.comQuem || '';
  if (atividade === 'preparacao') return dados.finalidade || '';
  if (atividade === 'diagnostico') return [dados.falha, dados.dataAgendamento && `agendado ${formatDateBR(dados.dataAgendamento)}`].filter(Boolean).join(' · ');
  if (atividade === 'manutencao_nao_cadastrada') return [dados.nomeItem, dados.tipoManutencao, dados.status].filter(Boolean).join(' · ');
  return '';
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--surface)' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s ease' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', transition: 'color .15s ease, background .15s ease' };
const tabBtnStyle = (active) => ({
  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
  background: active ? '#8B2F2F' : 'var(--surface)', color: active ? '#fff' : 'var(--text-primary)', fontSize: 13, fontWeight: 600,
  transition: 'background .15s ease, color .15s ease',
});

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Data por extenso, usada só na visão "Relatórios" do cliente (mais amigável que dd/mm/aaaa).
function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MESES_PT[m - 1]} de ${y}`;
}

function statusColor(status) {
  if (status === 'Resolvido') return 'var(--status-ok)';
  if (status === 'Andamento') return 'var(--status-warn, #f59f00)';
  if (status === 'Aguardando') return 'var(--status-danger)';
  return 'var(--text-secondary)';
}

const MAX_FOTO_BYTES = 8 * 1024 * 1024; // 8 MB por foto — fotos vão em base64 na linha do banco

function filesToBase64(fileList) {
  return Promise.all(Array.from(fileList).map((file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error(`"${file.name}" não é uma imagem.`)); return; }
    if (file.size > MAX_FOTO_BYTES) { reject(new Error(`"${file.name}": ${(file.size / 1048576).toFixed(1)} MB. Limite de 8 MB por foto — reduza a resolução.`)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function FotosField({ fotos, setFotos }) {
  const inputRef = useRef(null);
  const [erroFoto, setErroFoto] = useState('');
  async function handleChange(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    setErroFoto('');
    try {
      const novas = await filesToBase64(e.target.files);
      setFotos((prev) => [...prev, ...novas]);
    } catch (err) {
      setErroFoto(err.message || 'Não foi possível anexar a foto.');
    }
    e.target.value = '';
  }
  return (
    <Field label="Fotos (opcional)">
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleChange} style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
        }}
      >
        + Anexar foto
      </button>
      {erroFoto && <p style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 6 }}>{erroFoto}</p>}
      {fotos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {fotos.map((f, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img src={f} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              <button type="button" onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))}
                style={{ position: 'absolute', top: -6, right: -6, background: '#8B2F2F', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}

function complementarTipoLabel(categoriaFuncional) {
  if (categoriaFuncional === 'detector_linear') return 'Detector Linear (Beam)';
  if (categoriaFuncional === 'detector_chama') return 'Detector de Chama';
  if (['detector_gas_hc', 'detector_gas_co2', 'detector_gas_outro'].includes(categoriaFuncional)) return 'Detector de Gás';
  if (categoriaFuncional === 'termovelocimetrico') return 'Termovelocimétrico';
  return null;
}
function papelSinalLabelAt(papel) {
  if (papel === 'falha') return 'Falha';
  if (papel === 'alarme') return 'Alarme';
  return papel || 'Sinal';
}

function buildDeviceOptions(data) {
  const options = [];
  // "O painel em si" como item selecionável — 1 opção sintética por painel, id previsível
  // (pn:<painelId>), sem ser linha de `dispositivos`. Fica no topo do grupo do próprio painel
  // (loopName null -> bucket "Sem laço"). Usada só em Manutenção/Corretiva.
  (data.panels || []).forEach((p) => {
    options.push({
      id: `${PAINEL_OPT_PREFIX}${p.id}`,
      label: `Painel (falha geral do sistema) — ${p.name}`,
      type: 'painel', kind: 'painel', painelSintetico: true,
      panelId: p.id, panelName: p.name, panelMarca: p.marca || '',
      loopId: null, loopName: null,
    });
  });
  (data.devices || []).forEach((d) => {
    const loop = (data.loops || []).find((l) => l.id === d.loopId);
    const panel = loop && (data.panels || []).find((p) => p.id === loop.panelId);
    const complementarTipo = complementarTipoLabel(d.categoriaFuncional);
    if (complementarTipo) {
      options.push({
        id: d.id,
        label: `${complementarTipo} — ${d.etiquetaComplementar || d.description || 'Sem etiqueta'} — ${papelSinalLabelAt(d.papelSinal)} (${d.address})`,
        type: d.type, categoriaFuncional: d.categoriaFuncional, papelSinal: d.papelSinal,
        panelId: null, panelName: 'Dispositivos Complementares',
        panelMarca: panel ? panel.marca || '' : '',
        loopId: loop ? loop.id : null, loopName: loop ? loop.name : null,
      });
      return;
    }
    options.push({
      id: d.id, label: `${d.description || DEVICE_TYPE_LABELS[d.type] || 'Dispositivo'} — End. ${d.address}${panel ? ' · ' + panel.name : ''}`,
      type: d.type, categoriaFuncional: d.categoriaFuncional, papelSinal: d.papelSinal,
      panelId: panel ? panel.id : null, panelName: panel ? panel.name : 'Sem painel',
      panelMarca: panel ? panel.marca || '' : '',
      loopId: loop ? loop.id : null, loopName: loop ? loop.name : null,
    });
  });
  (data.nacs || []).forEach((n) => {
    const panel = (data.panels || []).find((p) => p.id === n.panelId);
    options.push({
      id: n.id, label: `${n.name} (NAC)${panel ? ' · ' + panel.name : ''}`, type: 'saida',
      panelId: panel ? panel.id : null, panelName: panel ? panel.name : 'Sem painel',
      panelMarca: panel ? panel.marca || '' : '',
      loopId: null, loopName: null,
    });
  });
  (data.gasDetectors || []).forEach((g) => {
    options.push({
      id: g.id, label: `${g.name} (Detector de gás)`, type: 'gasDetector',
      panelId: null, panelName: 'Sem painel',
      loopId: null, loopName: null,
    });
  });
  // --- Complementares mantíveis: Rede (é dispositivo de verdade), Bateria de Painel e Fonte
  //     Auxiliar (tabelas próprias — id prefixado bp:/fa: e roteado no submit por decodeAlvo). ---
  (data.redeDispositivos || []).forEach((r) => {
    const panel = (data.panels || []).find((p) => p.id === r.panelId);
    options.push({
      id: r.id,
      label: `Rede — ${r.tipoLabel || 'Dispositivo'}${r.etiqueta ? ` — ${r.etiqueta}` : ''}${panel ? ' · ' + panel.name : ''}`,
      type: r.tipo, kind: 'dispositivo', complementarSemCodigo: true,
      panelId: panel ? panel.id : null, panelName: 'Dispositivos Complementares',
      panelMarca: '', loopId: null, loopName: null,
    });
  });
  (data.bateriasPainel || []).forEach((b) => {
    const panel = (data.panels || []).find((p) => p.id === b.panelId);
    options.push({
      id: `bp:${b.id}`, label: `Bateria de Painel${panel ? ' — ' + panel.name : ''}`,
      type: 'bateria_painel', kind: 'bateria_painel', complementarSemCodigo: true,
      panelId: panel ? panel.id : null, panelName: 'Dispositivos Complementares',
      panelMarca: '', loopId: null, loopName: null,
    });
  });
  (data.fontesAuxiliares || []).forEach((f) => {
    options.push({
      id: `fa:${f.id}`, label: `Fonte Auxiliar${f.nome ? ' — ' + f.nome : ''}`,
      type: 'fonte_auxiliar', kind: 'fonte_auxiliar', complementarSemCodigo: true,
      panelId: null, panelName: 'Dispositivos Complementares',
      panelMarca: '', loopId: null, loopName: null,
    });
  });
  return options;
}

/** Decodifica o id de opção do seletor no alvo real de um atendimento/inspeção.
    `bp:<id>` → Bateria de Painel, `fa:<id>` → Fonte Auxiliar, senão dispositivo. */
function decodeAlvo(optionId) {
  if (typeof optionId === 'string' && optionId.startsWith('bp:')) return { kind: 'bateria_painel', id: optionId.slice(3) };
  if (typeof optionId === 'string' && optionId.startsWith('fa:')) return { kind: 'fonte_auxiliar', id: optionId.slice(3) };
  if (typeof optionId === 'string' && optionId.startsWith(PAINEL_OPT_PREFIX)) return { kind: 'painel', id: optionId.slice(PAINEL_OPT_PREFIX.length) };
  return { kind: 'dispositivo', id: optionId };
}

/** { dispositivoId, bateriaPainelId, fonteAuxiliarId, painelId } a partir do id de opção. */
function idsPorAlvo(optionId) {
  const a = decodeAlvo(optionId);
  return {
    dispositivoId: a.kind === 'dispositivo' ? a.id : null,
    bateriaPainelId: a.kind === 'bateria_painel' ? a.id : null,
    fonteAuxiliarId: a.kind === 'fonte_auxiliar' ? a.id : null,
    painelId: a.kind === 'painel' ? a.id : null,
  };
}

/** Escopo de falha ('painel' | 'dispositivo' | '') implícito na seleção do seletor de itens:
    'painel' se TODOS os ids selecionados são a opção sintética de painel; 'dispositivo' se
    NENHUM é; '' (lista completa) se a seleção mistura os dois. */
function escopoDaSelecao(ids) {
  const lista = ids || [];
  if (lista.length === 0) return '';
  const nPainel = lista.filter((id) => typeof id === 'string' && id.startsWith(PAINEL_OPT_PREFIX)).length;
  if (nPainel === lista.length) return 'painel';
  if (nPainel === 0) return 'dispositivo';
  return '';
}

/** Lista unificada de itens de Combate a Incêndio pra vistoria em massa: sub-itens dos
    Conjuntos (Casa de Bombas/Hidrante/VGA/LGE/Sistema), Componentes (fluxostato etc.) e
    Cilindros — cada um carrega o rótulo de categoria e o "grupo" (pra marcar por tipo). */
function buildCombateOptions(data) {
  const options = [];
  (data.combateSubitens || []).forEach((s) => {
    const conjunto = (data.combateConjuntos || []).find((c) => c.id === s.conjuntoId);
    if (!conjunto) return;
    const info = conjuntoSubitemInfo(conjunto.tipo, s.categoria);
    const tipoLabel = COMBATE_CONJUNTO_TIPOS[conjunto.tipo]?.label || conjunto.tipo;
    options.push({
      id: s.id, kind: 'subitem', grupo: tipoLabel,
      label: `${info?.label || s.categoria} — ${conjunto.etiqueta} (${tipoLabel})`,
      categoriaLabel: info?.label || s.categoria, contextoLabel: conjunto.etiqueta,
    });
  });
  (data.combateComponentes || []).forEach((c) => {
    const info = COMBATE_COMPONENTE_TIPO_MAP[c.tipo];
    options.push({
      id: c.id, kind: 'componente', grupo: info?.label || c.tipo,
      label: `${c.etiqueta || info?.label} (${info?.label})`,
      categoriaLabel: info?.label || c.tipo, contextoLabel: c.etiqueta,
    });
  });
  (data.combateCilindros || []).forEach((c) => {
    const bateria = (data.combateBaterias || []).find((b) => b.id === c.bateriaId);
    options.push({
      id: c.id, kind: 'cilindro', grupo: 'Cilindro',
      label: `Cilindro ${c.identificacao}${bateria ? ' — ' + bateria.etiqueta : ''}`,
      categoriaLabel: 'Cilindro (checklist completo)', contextoLabel: bateria?.etiqueta || '',
    });
  });
  return options;
}

function ItemResumo({ item }) {
  const nFotos = (item.fotos || []).length;
    if (item.tipo === 'outro') {
    const label = ATIVIDADE_LABELS[item.atividade] || 'Outro';
    const dados = item.atividadeDados || {};
    const detalhe = atividadeDetalhe(item.atividade, dados);
    const texto = item.descricao || item.descritivo || '';
    return (
      <div style={{ fontSize: 13, color: '#F1EDEA' }}>
        <strong>{label}</strong>{detalhe && ` · ${detalhe}`}{texto && ` · ${texto}`}{nFotos > 0 && ` · ${nFotos} foto(s)`}
      </div>
    );
  }
  if (item.tipo === 'atendimento') {
    return (
      <div style={{ fontSize: 13, color: '#F1EDEA' }}>
        <strong style={{ color: item.falha ? 'var(--status-danger)' : 'var(--status-ok)' }}>
          {item.falha ? 'Corretiva' : 'Preventiva'}
        </strong> · {item.status} · {item.dispositivoLabel}{nFotos > 0 && ` · ${nFotos} foto(s)`}
        {item.falha && <div style={{ color: 'var(--text-secondary)' }}>{item.falha}</div>}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13, color: '#F1EDEA' }}>
      <strong>Inspeção</strong> · {item.resultado} · {item.dispositivoLabel}{nFotos > 0 && ` · ${nFotos} foto(s)`}
      {item.criouCorretiva && <div style={{ color: 'var(--status-danger)' }}>↳ gerou corretiva automática</div>}
    </div>
  );
}

/** Buscador + seleção múltipla de dispositivos — mesmo padrão de "Marcar todos" por tipo
    já usado na tela de Painéis (Laço inteiro / por tipo), calculado dinamicamente a partir
    dos tipos realmente presentes na lista filtrada (então Entrada Duplo, por ex., já entra sozinho). */
function CategoryButtons({ items, allLabel, onSelect, tipoLabel }) {
  const tiposPresentes = [...new Set(items.map((o) => o.type))];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Marcar:</span>
      <button type="button" onClick={() => onSelect(items.map((o) => o.id))}
        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #8B2F2F', color: '#8B2F2F', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
        {allLabel} ({items.length})
      </button>
      {tiposPresentes.map((tipo) => {
        const idsDoTipo = items.filter((o) => o.type === tipo).map((o) => o.id);
        return (
          <button key={tipo || 'sem-tipo'} type="button" onClick={() => onSelect(idsDoTipo)}
            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
            {tipoLabel(tipo)} ({idsDoTipo.length})
          </button>
        );
      })}
    </div>
  );
}

/** Buscador + seleção múltipla de dispositivos — agrupado Painel → Laço, com
    botões de "Marcar todos" por categoria em cada um dos dois níveis, além do
    geral no topo. */
function DeviceMultiSelect({ options, selectedIds, setSelectedIds }) {
  const [query, setQuery] = useState('');
  const [expandedPanels, setExpandedPanels] = useState(() => {
    const allPanelNames = [...new Set(options.map((o) => o.panelName))];
    const initial = {};
    allPanelNames.forEach((p) => { initial[p] = allPanelNames.length === 1; });
    return initial;
  });
  const [expandedLoops, setExpandedLoops] = useState({});
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const tiposPresentes = [...new Set(filtered.map((o) => o.type))];
  const panelNamesRaw = [...new Set(filtered.map((o) => o.panelName))];
  const panelNames = [
    ...panelNamesRaw.filter((p) => p !== 'Dispositivos Complementares' && p !== 'Sem painel'),
    ...panelNamesRaw.filter((p) => p === 'Sem painel'),
    ...panelNamesRaw.filter((p) => p === 'Dispositivos Complementares'),
  ];
  const grupos = panelNames.map((panelName) => {
    const itensDoPainel = filtered.filter((o) => o.panelName === panelName);
    const loopNamesRaw = [...new Set(itensDoPainel.map((o) => o.loopName || 'Sem laço'))];
    const subgrupos = loopNamesRaw.map((loopName) => ({
      loopName,
      itens: itensDoPainel.filter((o) => (o.loopName || 'Sem laço') === loopName),
    }));
    return { panelName, itens: itensDoPainel, subgrupos };
  });

  function tipoLabel(tipo) {
    if (tipo === 'gasDetector') return 'Detector de gás';
    return DEVICE_TYPE_LABELS[tipo] || tipo;
  }
  function addIds(ids) {
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  }
  function removeIds(ids) {
    const idsSet = new Set(ids);
    setSelectedIds((prev) => prev.filter((id) => !idsSet.has(id)));
  }
  function toggle(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function clearFilteredSelection() {
    const filteredIds = new Set(filtered.map((o) => o.id));
    setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
  }
  function togglePanel(panelName) {
    setExpandedPanels((prev) => ({ ...prev, [panelName]: !prev[panelName] }));
  }
  function toggleLoop(key) {
    setExpandedLoops((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Field label={`Dispositivo(s) — ${selectedIds.length} selecionado(s)`}>
      <input style={inputStyle} placeholder="Buscar por etiqueta, endereço, painel..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Marcar todos:</span>
        <button type="button" onClick={() => addIds(filtered.map((o) => o.id))}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #8B2F2F', color: '#8B2F2F', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>
          Todos ({filtered.length})
        </button>
        {tiposPresentes.map((tipo) => {
          const idsDoTipo = filtered.filter((o) => o.type === tipo).map((o) => o.id);
          return (
            <button key={tipo || 'sem-tipo'} type="button" onClick={() => addIds(idsDoTipo)} style={smallBtnStyle}>
              {tipoLabel(tipo)} ({idsDoTipo.length})
            </button>
          );
        })}
        {selectedIds.length > 0 && (
          <button type="button" onClick={clearFilteredSelection} style={smallBtnStyle}>Limpar seleção</button>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum dispositivo encontrado.</div>
        )}
        {grupos.map((grupo) => {
          const idsDoGrupo = grupo.itens.map((o) => o.id);
          const selecionadosNoGrupo = idsDoGrupo.filter((id) => selectedIds.includes(id));
          const todosSelecionados = idsDoGrupo.length > 0 && selecionadosNoGrupo.length === idsDoGrupo.length;
          const algunsSelecionados = selecionadosNoGrupo.length > 0 && !todosSelecionados;
          const aberto = !!expandedPanels[grupo.panelName];
          const temMultiplosLacos = grupo.subgrupos.length > 1;
          return (
            <div key={grupo.panelName}>
              <div
                onClick={() => togglePanel(grupo.panelName)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  ref={(el) => { if (el) el.indeterminate = algunsSelecionados; }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => (todosSelecionados ? removeIds(idsDoGrupo) : addIds(idsDoGrupo))}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                  {grupo.panelName} — {idsDoGrupo.length} dispositivo(s)
                  {selecionadosNoGrupo.length > 0 ? ` (${selecionadosNoGrupo.length} selecionado(s))` : ''}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{aberto ? '▲' : '▼'}</span>
              </div>
              {aberto && (
                <div style={{ padding: '6px 10px 6px 20px', borderBottom: '1px solid var(--border)' }}>
                  <CategoryButtons items={grupo.itens} allLabel="Painel inteiro" onSelect={addIds} tipoLabel={tipoLabel} />
                </div>
              )}
              {aberto && grupo.subgrupos.map((subgrupo) => {
                const chaveLaco = `${grupo.panelName}::${subgrupo.loopName}`;
                const idsDoLaco = subgrupo.itens.map((o) => o.id);
                const selecionadosNoLaco = idsDoLaco.filter((id) => selectedIds.includes(id));
                const todosNoLaco = idsDoLaco.length > 0 && selecionadosNoLaco.length === idsDoLaco.length;
                const algunsNoLaco = selecionadosNoLaco.length > 0 && !todosNoLaco;
                const lacoAberto = !temMultiplosLacos || !!expandedLoops[chaveLaco];
                return (
                  <div key={chaveLaco}>
                    {temMultiplosLacos && (
                      <div
                        onClick={() => toggleLoop(chaveLaco)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={todosNoLaco}
                          ref={(el) => { if (el) el.indeterminate = algunsNoLaco; }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => (todosNoLaco ? removeIds(idsDoLaco) : addIds(idsDoLaco))}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                          {subgrupo.loopName} — {idsDoLaco.length} dispositivo(s)
                          {selecionadosNoLaco.length > 0 ? ` (${selecionadosNoLaco.length} selecionado(s))` : ''}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lacoAberto ? '▲' : '▼'}</span>
                      </div>
                    )}
                    {lacoAberto && temMultiplosLacos && (
                      <div style={{ padding: '6px 10px 6px 30px', borderBottom: '1px solid var(--border)' }}>
                        <CategoryButtons items={subgrupo.itens} allLabel="Laço inteiro" onSelect={addIds} tipoLabel={tipoLabel} />
                      </div>
                    )}
                    {lacoAberto && subgrupo.itens.map((o) => (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px 7px 30px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Field>
  );
}

/** Versão "1 dispositivo só" do buscador acima — usada na reatribuição de item já
    cadastrado (Editar item), quando o técnico lançou no dispositivo errado. */
function DeviceSingleSelect({ options, selectedId, setSelectedId, label }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const atual = options.find((o) => o.id === selectedId);
  return (
    <Field label={label || 'Dispositivo vinculado'}>
      {atual && (
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, padding: '6px 8px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
          Atual: {atual.label}
        </div>
      )}
      <input style={inputStyle} placeholder="Buscar por etiqueta, endereço, painel..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum dispositivo encontrado.</div>
        )}
        {filtered.slice(0, 100).map((o) => (
          <div key={o.id} onClick={() => setSelectedId(o.id)}
            style={{
              padding: '7px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: o.id === selectedId ? 'rgba(139,47,47,0.15)' : 'transparent',
              color: o.id === selectedId ? '#8B2F2F' : 'var(--text-primary)', fontWeight: o.id === selectedId ? 600 : 400,
            }}>
            {o.label}
          </div>
        ))}
        {filtered.length > 100 && (
          <div style={{ padding: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Mostrando 100 de {filtered.length} — refine a busca.</div>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Campo "Falha" travado por marca (Hochiki / Notifier)
 * ------------------------------------------------------------------ */

const emptyFalha = () => ({ codigo: '', categoria: '', marca: '', detalhe: '' });

/** Texto legível gravado em `falha` (todos os consumidores atuais mostram essa string):
    rótulo PT da falha catalogada, ou o texto livre digitado no modo "Outro". */
function falhaTexto(v) {
  if (!v) return '';
  if (v.codigo) {
    const f = getFalhaPorCodigo(v.codigo);
    return f ? f.pt : '';
  }
  return v.detalhe || '';
}

/** Uma corretiva está "classificada" quando dá pra jogá-la numa categoria do card
    "Falhas mais comuns": ou veio da lista catalogada (tem código, logo tem categoria),
    ou o técnico escolheu uma categoria à mão no modo "Outro". Sem isso a corretiva
    cai em "Não classificado" — o que essa trava evita na origem. */
function falhaClassificada(sel) {
  const v = sel || {};
  return !!(v.codigo || v.categoria);
}

/** Reidrata o objeto do FalhaSelect a partir de um registro do banco
    (atendimento/inspeção de listVisitas). Registro legado sem código -> modo "Outro". */
function falhaSelFromRecord(row) {
  const r = row || {};
  const codigo = r.falha_codigo || '';
  if (codigo) {
    const f = getFalhaPorCodigo(codigo);
    return { codigo, categoria: r.falha_categoria || (f ? f.categoria : ''), marca: r.falha_marca || '', detalhe: '' };
  }
  return { codigo: '', categoria: '', marca: r.falha_marca || '', detalhe: r.falha || '' };
}

/** Alvo de um atendimento/inspeção já salvo (embeds de listVisitas): dispositivo, Bateria
    de Painel ou Fonte Auxiliar. Na edição o alvo é fixo (só leitura) — não se move corretiva
    entre um dispositivo e uma bateria. */
function alvoDeRegistro(r) {
  if (r?.bateria_painel_id) {
    const nome = r.baterias_painel?.paineis?.nome || '';
    return { alvoKind: 'bateria_painel', alvoLabel: `Bateria de Painel${nome ? ` — ${nome}` : ''}` };
  }
  if (r?.fonte_auxiliar_id) {
    return { alvoKind: 'fonte_auxiliar', alvoLabel: `Fonte Auxiliar${r.fontes_auxiliares?.nome ? ` — ${r.fontes_auxiliares.nome}` : ''}` };
  }
  if (r?.painel_id) {
    return { alvoKind: 'painel', alvoLabel: `Painel (falha geral do sistema)${r.paineis?.nome ? ` — ${r.paineis.nome}` : ''}` };
  }
  return { alvoKind: 'dispositivo', alvoLabel: '' };
}

/** Marca única dos painéis dos dispositivos selecionados — só retorna se todos
    convergem numa marca conhecida; senão '' (o seletor cai no campo "Outro"). */
function marcaDeDispositivos(ids, deviceOptions) {
  const selecionados = (ids || []).map((id) => (deviceOptions || []).find((o) => o.id === id)).filter(Boolean);
  // Complementar (bateria/fonte/rede) não tem código de evento de painel — cai sempre
  // no modo "Outro" do FalhaSelect (texto livre + categoria obrigatória).
  if (selecionados.some((o) => o.complementarSemCodigo)) return '';
  const marcas = new Set(selecionados.map((o) => normalizarMarca(o.panelMarca)).filter(Boolean));
  return marcas.size === 1 ? [...marcas][0] : '';
}

/** Combobox de falha com busca bilíngue (PT — EN), lista travada pela marca do painel.
    Sempre oferece "Outro (descrever)" -> textarea livre (codigo/categoria nulos). */
function FalhaSelect({ marca, value, onChange, label = 'Falha', hint, escopo }) {
  const v = value || emptyFalha();
  // escopo ('painel' | 'dispositivo'): quando o item da visita é o próprio painel, a lista
  // trava nas falhas de escopo painel; num dispositivo normal, nas de escopo dispositivo.
  const lista = falhasParaMarca(marca).filter((f) => !escopo || f.escopo === escopo);
  const marcaOk = lista.length > 0;
  const marcaNorm = normalizarMarca(marca);
  const selecionada = v.codigo ? getFalhaPorCodigo(v.codigo) : null;
  const [modoOutro, setModoOutro] = useState(() => !v.codigo && !!v.detalhe);
  const [trocando, setTrocando] = useState(false);
  const [query, setQuery] = useState('');

  const emOutro = !marcaOk || modoOutro;
  const q = query.trim().toLowerCase();
  const filtrada = q
    ? lista.filter((f) => f.pt.toLowerCase().includes(q) || f.en.toLowerCase().includes(q))
    : lista;

  function escolher(f) {
    onChange({ codigo: f.codigo, categoria: f.categoria, marca: marcaNorm, detalhe: '' });
    setTrocando(false);
    setModoOutro(false);
    setQuery('');
  }
  function limpar() {
    onChange(emptyFalha());
    setTrocando(false);
    setModoOutro(false);
    setQuery('');
  }
  function setDetalhe(texto) {
    onChange({ codigo: '', categoria: v.categoria || '', marca: marcaNorm || '', detalhe: texto });
  }
  function setCategoria(cat) {
    onChange({ codigo: '', categoria: cat, marca: marcaNorm || '', detalhe: v.detalhe || '' });
  }

  return (
    <Field label={label}>
      {hint && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '-2px 0 6px' }}>{hint}</p>}

      {emOutro ? (
        <>
          {selecionada && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Falha catalogada anterior: <strong>{selecionada.pt}</strong>. Edite abaixo para substituir por texto livre.
            </p>
          )}
          <textarea
            style={{ ...inputStyle, minHeight: 50 }}
            placeholder="Descreva a falha encontrada"
            value={v.detalhe || ''}
            onChange={(e) => setDetalhe(e.target.value)}
          />
          {(v.detalhe || '').trim() && (
            <div style={{ marginTop: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Categoria da falha <span style={{ color: '#8B2F2F' }}>(obrigatória em corretiva)</span>
              </label>
              <select style={inputStyle} value={v.categoria || ''} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione a categoria...</option>
                {Object.entries(CATEGORIAS_FALHA).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>{rotulo}</option>
                ))}
              </select>
            </div>
          )}
          {!marcaOk ? (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Painel sem marca Hochiki/Notifier definida (ou dispositivos de marcas diferentes) — descreva a falha livremente.
            </p>
          ) : (
            <button type="button" onClick={() => { setModoOutro(false); setDetalhe(''); }}
              style={{ ...smallBtnStyle, marginTop: 6 }}>
              ← Voltar para a lista {marcaNorm === 'notifier' ? 'Notifier' : 'Hochiki'}
            </button>
          )}
        </>
      ) : selecionada && !trocando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 160 }}>
            {selecionada.pt} <span style={{ color: 'var(--text-secondary)' }}>— {selecionada.en}</span>
          </span>
          <button type="button" onClick={() => setTrocando(true)} style={smallBtnStyle}>Trocar</button>
          <button type="button" onClick={limpar} style={smallBtnStyle}>Limpar</button>
        </div>
      ) : (
        <>
          <input
            style={inputStyle}
            placeholder={`Buscar falha ${marcaNorm === 'notifier' ? 'Notifier' : 'Hochiki'} (português ou inglês)...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 6 }}>
            {filtrada.slice(0, 120).map((f) => (
              <div key={f.codigo} onClick={() => escolher(f)}
                style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {f.pt} <span style={{ color: 'var(--text-secondary)' }}>— {f.en}</span>
              </div>
            ))}
            {filtrada.length === 0 && (
              <div style={{ padding: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma falha da lista bate com a busca.</div>
            )}
            <div onClick={() => { setModoOutro(true); setTrocando(false); }}
              style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', color: '#8B2F2F', fontWeight: 600 }}>
              + Outro (descrever)
            </div>
          </div>
          {selecionada && (
            <button type="button" onClick={() => setTrocando(false)} style={{ ...smallBtnStyle, marginTop: 6 }}>Cancelar troca</button>
          )}
        </>
      )}
    </Field>
  );
}

/** Mesmo padrão do DeviceMultiSelect, só que pra itens de Combate a Incêndio — agrupa
    por "grupo" (Casa de Bombas, Hidrante, Fluxostato, Cilindro etc.) já calculado. */
function CombateMultiSelect({ options, selectedIds, setSelectedIds }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const gruposPresentes = [...new Set(filtered.map((o) => o.grupo))];

  function addIds(ids) {
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  }
  function toggle(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function clearFilteredSelection() {
    const filteredIds = new Set(filtered.map((o) => o.id));
    setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
  }

  return (
    <Field label={`Item(ns) de Combate — ${selectedIds.length} selecionado(s)`}>
      <input style={inputStyle} placeholder="Buscar por etiqueta, categoria, conjunto..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Marcar todos:</span>
        <button type="button" onClick={() => addIds(filtered.map((o) => o.id))}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #8B2F2F', color: '#8B2F2F', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>
          Todos ({filtered.length})
        </button>
        {gruposPresentes.map((grupo) => {
          const idsDoGrupo = filtered.filter((o) => o.grupo === grupo).map((o) => o.id);
          return (
            <button key={grupo || 'sem-grupo'} type="button" onClick={() => addIds(idsDoGrupo)} style={smallBtnStyle}>
              {grupo} ({idsDoGrupo.length})
            </button>
          );
        })}
        {selectedIds.length > 0 && (
          <button type="button" onClick={clearFilteredSelection} style={smallBtnStyle}>Limpar seleção</button>
        )}
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum item encontrado.</div>
        )}
        {filtered.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{o.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

/** Achata os rvt_itens de uma visita (formato bruto vindo do listVisitas) num array
    de itens de exibição — usado tanto no resumo colapsado quanto na impressão. */
function itemsFromVisita(v) {
  return (v.rvt_itens || []).map((it) => {
        if (it.outro_descricao || it.outro_atividade) {
      const atividade = it.outro_atividade || '';
      const atividadeDados = it.outro_atividade_dados || {};
      return { id: it.id, tipo: 'outro', etiqueta: ATIVIDADE_LABELS[atividade] || 'Outro', status: 'Resolvido',
        descritivo: it.outro_descricao || '', fotos: it.outro_fotos || [],
        atividade, atividadeDados };
    }
    if (it.atendimentos) {
      const a = it.atendimentos;
      const al = alvoDeRegistro(a);
      return {
        id: it.id, tipo: 'atendimento', dispositivoId: a.dispositivo_id || null,
        alvoKind: al.alvoKind, painelId: a.painel_id || null,
        etiqueta: al.alvoLabel || a.dispositivos?.etiqueta || a.dispositivos?.endereco || 'Dispositivo',
        endereco: a.dispositivos?.endereco || '',
        falha: a.falha || '', descritivo: a.descritivo || '',
        status: a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : '',
        fotos: a.fotos || [],
      };
    }
    if (it.inspecoes) {
      const i = it.inspecoes;
      const al = alvoDeRegistro(i);
      return {
        id: it.id, tipo: 'inspecao', dispositivoId: i.dispositivo_id || null,
        alvoKind: al.alvoKind, painelId: i.painel_id || null,
        etiqueta: al.alvoLabel || i.dispositivos?.etiqueta || i.dispositivos?.endereco || 'Dispositivo',
        endereco: i.dispositivos?.endereco || '',
        falha: i.falha || '',
        descritivo: [i.resultado_teste, i.metodo].filter(Boolean).join(' · '),
        status: 'Resolvido', fotos: i.fotos || [],
      };
    }
    return null;
  }).filter(Boolean);
}

function RvtFieldLabelLocal({ children }) {
  return <p style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{children}</p>;
}

/** Data/hora "dd/mm/aaaa às HH:MM" a partir de um ISO/timestamptz — reaproveita formatDateBR
    para a parte da data e só acrescenta a hora local. */
function formatDateTimeBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateBR(ymd)} às ${hh}:${mm}`;
}

/** Campo de assinatura de aprovação do cliente para 1 visita (rvt).
    Modos: desenho no canvas (mouse + touch), nome digitado, ou reutilizar a
    "assinatura salva" do usuário logado (pra não redesenhar toda visita).
    O formulário de captura fica fora da impressão (no-print); depois de confirmada,
    a assinatura + trilha de auditoria são exibidas somente-leitura e entram na impressão.

    Auditoria: a atribuição (login/uid/data) e o log append-only são gravados por
    trigger no Postgres (`assinatura_auditoria`) usando auth.uid()/auth.jwt() —
    não dá pra forjar pelo app. */
function SignatureField({ visita }) {
  const [confirmada, setConfirmada] = useState(
    visita?.assinatura_cliente
      ? {
          tipo: visita.assinatura_cliente_tipo || 'texto',
          valor: visita.assinatura_cliente,
          data: visita.assinatura_cliente_data,
          login: visita.assinatura_cliente_login || null,
          origem: visita.assinatura_cliente_origem || visita.assinatura_cliente_tipo || null,
        }
      : null,
  );
  const [modo, setModo] = useState('desenho'); // 'desenho' | 'texto'
  const [nome, setNome] = useState('');
  const [temTraco, setTemTraco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salva, setSalva] = useState(null);        // assinatura salva do usuário
  const [guardar, setGuardar] = useState(true);    // salvar esta assinatura p/ reutilizar
  const [auditoria, setAuditoria] = useState([]);
  const [verAuditoria, setVerAuditoria] = useState(false);
  const canvasRef = useRef(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    getAssinaturaSalva().then((s) => { if (vivo) setSalva(s); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!confirmada || !visita?.id) return;
    let vivo = true;
    listAssinaturaAuditoria(visita.id).then((a) => { if (vivo) setAuditoria(a); }).catch(() => {});
    return () => { vivo = false; };
  }, [confirmada, visita?.id]);

  const pontoNoCanvas = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const iniciarTraco = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pontoNoCanvas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhandoRef.current = true;
  };
  const moverTraco = (e) => {
    if (!desenhandoRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    const { x, y } = pontoNoCanvas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temTraco) setTemTraco(true);
  };
  const terminarTraco = () => { desenhandoRef.current = false; };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  };

  const gravar = async ({ tipo, valor, origem }) => {
    setErro('');
    setSalvando(true);
    try {
      const res = await salvarAssinaturaVisita(visita.id, { tipo, valor, origem });
      setConfirmada({ tipo, valor, data: res.data, login: res.login, origem: res.origem });
      if (guardar && origem !== 'salva') {
        try { await salvarAssinaturaSalva({ tipo, valor }); setSalva({ tipo, valor }); } catch { /* não bloqueia a visita */ }
      }
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar a assinatura. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmar = () => {
    setErro('');
    const tipo = modo === 'desenho' ? 'desenho' : 'texto';
    if (tipo === 'desenho') {
      if (!temTraco) { setErro('Desenhe a assinatura antes de confirmar.'); return; }
      gravar({ tipo, valor: canvasRef.current.toDataURL('image/png'), origem: 'desenho' });
    } else {
      if (!nome.trim()) { setErro('Digite o nome completo antes de confirmar.'); return; }
      gravar({ tipo, valor: nome.trim(), origem: 'texto' });
    }
  };

  const usarSalva = () => {
    if (!salva || salvando) return;
    gravar({ tipo: salva.tipo, valor: salva.valor, origem: 'salva' });
  };

  const removerSalva = async () => {
    try { await apagarAssinaturaSalva(); setSalva(null); } catch { /* ignora */ }
  };

  const origemLabel = (o) => (
    o === 'salva' ? 'assinatura salva do usuário'
      : o === 'texto' ? 'nome digitado no dispositivo'
        : 'desenho no dispositivo'
  );

  if (confirmada) {
    return (
      <div className="rvt-summary-card rounded-lg p-4" style={{ background: 'var(--surface-raised)' }}>
        <RvtFieldLabelLocal>Assinatura do cliente — aprovação do serviço</RvtFieldLabelLocal>
        {confirmada.tipo === 'desenho' ? (
          <img
            src={confirmada.valor}
            alt="Assinatura do cliente"
            style={{ display: 'block', width: '100%', maxWidth: 360, height: 'auto', background: '#fff', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
          />
        ) : (
          <p style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive', fontSize: 26, color: 'var(--text-primary)', margin: '6px 0 2px' }}>
            {confirmada.valor}
          </p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
          Confirmada em {formatDateTimeBR(confirmada.data)}
        </p>
        {confirmada.login && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Assinada pelo login <strong>{confirmada.login}</strong>
            {confirmada.origem ? ` · ${origemLabel(confirmada.origem)}` : ''}
          </p>
        )}

        {auditoria.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setVerAuditoria((v) => !v)}
              className="no-print"
              style={{ ...smallBtnStyle, fontSize: 11 }}
            >
              {verAuditoria ? 'Ocultar' : 'Ver'} trilha de auditoria ({auditoria.length})
            </button>
            <div className={verAuditoria ? '' : 'no-print'} style={{ marginTop: 6, display: verAuditoria ? 'block' : undefined }}>
              <RvtFieldLabelLocal>Trilha de auditoria da assinatura</RvtFieldLabelLocal>
              <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                {auditoria.map((ev) => (
                  <li key={ev.id} style={{ padding: '3px 0', borderTop: '1px solid var(--border)', wordBreak: 'break-word' }}>
                    <strong>{formatDateTimeBR(ev.criado_em)}</strong> — {ev.evento}
                    {' · '}login <strong>{ev.assinado_por_email || '—'}</strong>
                    {' · '}{origemLabel(ev.assinatura_origem)}
                    {ev.assinatura_hash ? (
                      <><br /><span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>verificação SHA-256: {ev.assinatura_hash.slice(0, 24)}…</span></>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rvt-summary-card rounded-lg p-4 no-print" style={{ background: 'var(--surface-raised)' }}>
      <RvtFieldLabelLocal>Assinatura do cliente — aprovação do serviço</RvtFieldLabelLocal>

      {salva && (
        <div style={{ margin: '8px 0 12px', padding: 10, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0 }}>
            Você tem uma assinatura salva neste login.
          </p>
          {salva.tipo === 'desenho' ? (
            <img src={salva.valor} alt="Assinatura salva" style={{ display: 'block', width: '100%', maxWidth: 240, height: 'auto', background: '#fff', borderRadius: 6, border: '1px solid var(--border)', margin: '6px 0' }} />
          ) : (
            <p style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive', fontSize: 22, color: 'var(--text-primary)', margin: '4px 0' }}>{salva.valor}</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" onClick={usarSalva} disabled={salvando} style={{ ...btnStyle, padding: '7px 16px', opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : 'Usar assinatura salva'}
            </button>
            <button type="button" onClick={removerSalva} style={smallBtnStyle}>Remover salva</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '6px 0 10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { setModo('desenho'); setErro(''); }} style={tabBtnStyle(modo === 'desenho')}>Desenhar</button>
        <button type="button" onClick={() => { setModo('texto'); setErro(''); }} style={tabBtnStyle(modo === 'texto')}>Digitar nome</button>
      </div>

      {modo === 'desenho' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            onMouseDown={iniciarTraco}
            onMouseMove={moverTraco}
            onMouseUp={terminarTraco}
            onMouseLeave={terminarTraco}
            onTouchStart={iniciarTraco}
            onTouchMove={moverTraco}
            onTouchEnd={terminarTraco}
            style={{ display: 'block', width: '100%', maxWidth: 600, height: 180, background: '#fff', borderRadius: 6, border: '1px solid var(--border)', touchAction: 'none', cursor: 'crosshair' }}
          />
          <button type="button" onClick={limparCanvas} style={{ ...smallBtnStyle, marginTop: 8 }}>Limpar</button>
        </div>
      ) : (
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo de quem aprova"
          style={inputStyle}
        />
      )}

      {erro && <p style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 8 }}>{erro}</p>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
        {salva ? 'Atualizar minha assinatura salva com esta' : 'Salvar esta assinatura neste login para reutilizar'}
      </label>

      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={confirmar} disabled={salvando} style={{ ...btnStyle, opacity: salvando ? 0.7 : 1 }}>
          {salvando ? 'Salvando...' : 'Confirmar assinatura'}
        </button>
      </div>
    </div>
  );
}

/** Layout de impressão — reaproveita as mesmas classes CSS globais (rvt-brand-band, print-area
    etc.) que o RVT antigo usava, então imprime/exporta exatamente igual. Aceita 1 visita (impressão
    individual) ou várias (impressão de período, agrupadas por dia dentro do mesmo documento). */
function VisitaPrintView({ visitas, client, onBack }) {
  const dias = [...new Set(visitas.map((v) => v.data_visita))].sort();
  const isPeriodo = dias.length > 1;
  const todosItens = visitas.flatMap((v) => itemsFromVisita(v));
  const totalResolvidos = todosItens.filter((it) => it.status === 'Resolvido').length;
  const tecnicos = [...new Set(visitas.map((v) => v.tecnico).filter(Boolean))];
  const periodoLabel = isPeriodo ? `${formatDateBR(dias[0])} a ${formatDateBR(dias[dias.length - 1])}` : formatDateBR(dias[0]);

  // Nome sugerido pelo navegador ao Imprimir/Salvar PDF (ex: "RVT - NAL - 21-07-2026").
  // Usa "-" em vez de "/" na data porque "/" não é um caractere válido em nome de arquivo.
  useEffect(() => {
    const tituloAnterior = document.title;
    const dataArquivo = (d) => formatDateBR(d).replace(/\//g, '-');
    const rotuloData = isPeriodo ? `${dataArquivo(dias[0])}_a_${dataArquivo(dias[dias.length - 1])}` : dataArquivo(dias[0]);
    const nomeCliente = (client?.name || '').replace(/[\\/:*?"<>|]/g, '-').trim();
    document.title = `RVT${nomeCliente ? ' - ' + nomeCliente : ''} - ${rotuloData}`;
    return () => { document.title = tituloAnterior; };
  }, [dias.join(','), client?.name, isPeriodo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <button type="button" onClick={onBack} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
          ← Voltar
        </button>
        <button type="button" onClick={() => window.print()} style={btnStyle}>Imprimir / Salvar PDF</button>
      </div>

      <div className="print-area rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="rvt-brand-band">
          <div className="flex items-center gap-3 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="rvt-wordmark">
              <div className="rvt-wordmark-icon"><ShieldAlert size={16} style={{ color: '#fff' }} /></div>
              <div className="rvt-wordmark-text">
                <div className="maj">M.A.J</div>
                <div className="sol">Soluções</div>
              </div>
            </div>
            <div className="rvt-divider-v" />
            <div className="flex items-center gap-3">
              {client?.branding?.logoData
                ? <img src={client.branding.logoData} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.4)' }} />
                : null}
              <div>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{client?.name || ''}</p>
                {client?.address && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{client.address}</p>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 600, fontSize: 16, letterSpacing: '0.04em' }}>RELATÓRIO DE VISITA TÉCNICA</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>RVT · {periodoLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
              <RvtFieldLabelLocal>{isPeriodo ? 'Período' : 'Data da visita'}</RvtFieldLabelLocal>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{periodoLabel}</p>
            </div>
            <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
              <RvtFieldLabelLocal>Técnico(s)</RvtFieldLabelLocal>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tecnicos.join(', ') || '—'}</p>
            </div>
            <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
              <RvtFieldLabelLocal>Itens registrados</RvtFieldLabelLocal>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{todosItens.length}</p>
            </div>
            <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
              <RvtFieldLabelLocal>Resolvidos</RvtFieldLabelLocal>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-ok)' }}>{totalResolvidos} de {todosItens.length}</p>
            </div>
          </div>

          {dias.map((dia) => {
            const itensDoDia = visitas.filter((v) => v.data_visita === dia).flatMap((v) => itemsFromVisita(v));
            return (
              <div key={dia} className="flex flex-col gap-3">
                {isPeriodo && (
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                    {formatDateBR(dia)}
                  </p>
                )}
                {itensDoDia.map((it, i) => {
                  const detalheOutro = it.tipo === 'outro' ? atividadeDetalhe(it.atividade, it.atividadeDados) : '';
                  const textoDescritivo = [detalheOutro, it.descritivo].filter(Boolean).join(' · ');
                  return (
                  <div key={it.id} className="rvt-item-card rounded-lg p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', breakInside: 'avoid' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: '#8B2F2F', color: '#fff' }}>{i + 1}</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{it.etiqueta}{it.endereco ? ` · END ${it.endereco}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, flexShrink: 0, fontWeight: 600, color: statusColor(it.status), border: `1px solid ${statusColor(it.status)}` }}>
                        {it.status || 'Sem status'}
                      </span>
                    </div>
                    {it.falha && (
                      <div style={{ marginBottom: 6 }}>
                        <RvtFieldLabelLocal>Falha</RvtFieldLabelLocal>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{it.falha}</p>
                      </div>
                    )}
                    <div className="rvt-item-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                      {textoDescritivo && (
                        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                          <RvtFieldLabelLocal>{it.tipo === 'inspecao' ? 'Resultado / Método' : 'Descritivo'}</RvtFieldLabelLocal>
                          <p style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{textoDescritivo}</p>
                        </div>
                      )}
                      {it.fotos && it.fotos.length > 0 && (
                        <div style={{ flex: '0 0 auto' }}>
                          <RvtFieldLabelLocal>Registro fotográfico</RvtFieldLabelLocal>
                          <div className="rvt-photo-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, maxWidth: 306 }}>
                            {it.fotos.map((f, fi) => (
                              <img key={fi} src={f} alt="" style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}

          {!isPeriodo && <SignatureField visita={visitas[0]} />}

          <div className="rvt-footer-band">
            <div className="rvt-footer-icon"><ShieldAlert size={9} style={{ color: 'var(--accent)' }} /></div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Documento gerado pelo Centro de Controle de Manutenção — M.A.J Eletro Eletrônica LTDA · CNPJ: 45.893.915/0001-01
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bloco "Converter para manutenção de equipamento" — só aparece em item
    "Outro → Manutenção de item não cadastrado". Cria uma corretiva real contra o
    equipamento escolhido (dispositivo / Bateria de Painel / Fonte Auxiliar), com a
    data da visita, e some com o item "Outro". */
function categoriaSugerida(texto) {
  const t = (texto || '').toLowerCase();
  if (/bateria|nobreak|no-break|fonte/.test(t)) return 'alimentacao';
  if (/conversor|fibra|rede|switch|placa de rede/.test(t)) return 'rede_paineis';
  return '';
}

function ConverterParaManutencao({ editForm, dados, onConvert, deviceOptions, saving }) {
  const textoBase = dados.nomeItem || editForm.descricao || '';
  const [alvo, setAlvo] = useState('');
  const [falha, setFalha] = useState(textoBase);
  const [categoria, setCategoria] = useState(() => categoriaSugerida(textoBase));
  const bloqueado = saving || !alvo || !categoria;
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Converter para manutenção de equipamento</p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Vira uma corretiva vinculada a um equipamento (dispositivo, Bateria de Painel ou Fonte Auxiliar), mantendo a data da visita. O item “Outro” deixa de existir.
      </p>
      <DeviceSingleSelect options={deviceOptions} selectedId={alvo} setSelectedId={setAlvo} />
      <Field label="Falha">
        <input style={inputStyle} value={falha} onChange={(e) => setFalha(e.target.value)} placeholder="Ex.: Substituição das baterias" />
      </Field>
      <Field label="Categoria da falha">
        <select style={inputStyle} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Selecione a categoria...</option>
          {Object.entries(CATEGORIAS_FALHA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Field>
      <button type="button" disabled={bloqueado}
        onClick={() => onConvert({ alvoOptionId: alvo, falha, falhaCategoria: categoria, status: dados.status })}
        style={{ ...btnStyle, opacity: bloqueado ? 0.6 : 1, marginTop: 4 }}>
        {saving ? 'Convertendo...' : 'Converter'}
      </button>
    </div>
  );
}

/** Formulário inline de edição de 1 item de visita — o tipo de campos muda conforme
    o tipo do item (atendimento / inspeção / outro). */
function EditItemForm({ editForm, setEditForm, onSave, onCancel, onConvert, deviceOptions, saving }) {
  if (!editForm) return null;
  if (editForm.kind === 'outro') {
    const dados = editForm.atividadeDados || {};
    const setDado = (campo, valor) => setEditForm({ ...editForm, atividadeDados: { ...dados, [campo]: valor } });
    return (
      <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
        <Field label="Atividade">
          <select style={inputStyle} value={editForm.atividade || ''} onChange={(e) => setEditForm({ ...editForm, atividade: e.target.value, atividadeDados: {} })}>
            <option value="">Genérico (sem categoria)</option>
            <option value="reuniao">Reunião</option>
            <option value="preparacao">Preparação</option>
            <option value="seguranca_trabalho">Segurança do Trabalho</option>
            <option value="manutencao_nao_cadastrada">Manutenção de Itens não cadastrados</option>
          </select>
        </Field>
        {editForm.atividade === 'diagnostico' && (
          <div style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Item criado por um Diagnóstico — a categoria não muda por aqui pra não perder o vínculo com a(s) Corretiva(s) já gerada(s).
          </div>
        )}
        {editForm.atividade === 'reuniao' && (
          <Field label="Com quem"><input style={inputStyle} value={dados.comQuem || ''} onChange={(e) => setDado('comQuem', e.target.value)} /></Field>
        )}
        {editForm.atividade === 'preparacao' && (
          <Field label="Para que"><input style={inputStyle} value={dados.finalidade || ''} onChange={(e) => setDado('finalidade', e.target.value)} /></Field>
        )}
        {editForm.atividade === 'manutencao_nao_cadastrada' && (
          <div className="grid-2-mobile-safe">
            <Field label="Nome do item"><input style={inputStyle} value={dados.nomeItem || ''} onChange={(e) => setDado('nomeItem', e.target.value)} /></Field>
            <Field label="Tipo de manutenção">
              <select style={inputStyle} value={dados.tipoManutencao || 'corretiva'} onChange={(e) => setDado('tipoManutencao', e.target.value)}>
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
              </select>
            </Field>
            {dados.tipoManutencao === 'corretiva' && (
              <Field label="Status">
                <select style={inputStyle} value={dados.status || 'aguardando'} onChange={(e) => setDado('status', e.target.value)}>
                  <option value="aguardando">Aguardando</option>
                  <option value="andamento">Andamento</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </Field>
            )}
          </div>
        )}
        {editForm.atividade === 'manutencao_nao_cadastrada' && onConvert && (
          <ConverterParaManutencao editForm={editForm} dados={dados} onConvert={onConvert} deviceOptions={deviceOptions} saving={saving} />
        )}
        <Field label={editForm.atividade === 'seguranca_trabalho' ? 'Detalhes' : 'Descrição'}>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
        </Field>
        <FotosField fotos={editForm.fotos || []} setFotos={(updater) => setEditForm((prev) => ({ ...prev, fotos: typeof updater === 'function' ? updater(prev.fotos || []) : updater }))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
        </div>
      </div>
    );
  }
  if (editForm.kind === 'atendimento') {
    return (
      <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
        {(editForm.alvoKind || 'dispositivo') === 'dispositivo'
          ? <DeviceSingleSelect options={deviceOptions} selectedId={editForm.dispositivoId} setSelectedId={(id) => setEditForm({ ...editForm, dispositivoId: id })} />
          : <Field label="Alvo"><div style={{ ...inputStyle, opacity: 0.75 }}>{editForm.alvoLabel}</div></Field>}
        <FalhaSelect
          label="Falha (deixe em branco para preventiva)"
          marca={(editForm.alvoKind === 'painel'
            ? deviceOptions?.find((o) => o.id === `${PAINEL_OPT_PREFIX}${editForm.painelId}`)
            : deviceOptions?.find((o) => o.id === editForm.dispositivoId))?.panelMarca || ''}
          escopo={editForm.alvoKind === 'painel' ? 'painel' : 'dispositivo'}
          value={editForm.falhaSel}
          onChange={(next) => setEditForm({ ...editForm, falhaSel: next, falha: falhaTexto(next) })}
        />
        <Field label="Status">
          <select style={inputStyle} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option value="aguardando">Aguardando</option>
            <option value="andamento">Andamento</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </Field>
        <Field label="Descritivo">
          <textarea style={{ ...inputStyle, minHeight: 50 }} value={editForm.descritivo} onChange={(e) => setEditForm({ ...editForm, descritivo: e.target.value })} />
        </Field>
        <FotosField fotos={editForm.fotos || []} setFotos={(updater) => setEditForm((prev) => ({ ...prev, fotos: typeof updater === 'function' ? updater(prev.fotos || []) : updater }))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
        </div>
      </div>
    );
  }
  // inspecao
  return (
    <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
      {(editForm.alvoKind || 'dispositivo') === 'dispositivo'
        ? <DeviceSingleSelect options={deviceOptions} selectedId={editForm.dispositivoId} setSelectedId={(id) => setEditForm({ ...editForm, dispositivoId: id })} />
        : <Field label="Alvo"><div style={{ ...inputStyle, opacity: 0.75 }}>{editForm.alvoLabel}</div></Field>}
      <div className="grid-2-mobile-safe">
        <Field label="Funcionamento (resultado do teste)">
          <select style={inputStyle} value={editForm.resultadoTeste} onChange={(e) => setEditForm({ ...editForm, resultadoTeste: e.target.value })}>
            <option>Aprovado</option><option>Reprovado</option><option>Não avaliado</option>
          </select>
        </Field>
        <Field label="Aparência">
          <select style={inputStyle} value={editForm.aparencia} onChange={(e) => setEditForm({ ...editForm, aparencia: e.target.value })}>
            <option>Ótimo</option><option>Bom</option><option>Regular</option><option>Precisa Trocar</option>
          </select>
        </Field>
        <Field label="Comunicação local">
          <select style={inputStyle} value={editForm.comunicacaoLocal} onChange={(e) => setEditForm({ ...editForm, comunicacaoLocal: e.target.value })}>
            <option>Conforme</option><option>Não conforme</option>
          </select>
        </Field>
        <Field label="Comunicação em rede">
          <select style={inputStyle} value={editForm.comunicacaoRede} onChange={(e) => setEditForm({ ...editForm, comunicacaoRede: e.target.value })}>
            <option>Conforme</option><option>Não conforme</option>
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea style={{ ...inputStyle, minHeight: 50 }} value={editForm.observacoes} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} />
      </Field>
      <FalhaSelect
        label="Falha (se preenchida, cria/mantém corretiva)"
        marca={deviceOptions?.find((o) => o.id === editForm.dispositivoId)?.panelMarca || ''}
        escopo="dispositivo"
        value={editForm.falhaSel}
        onChange={(next) => setEditForm({ ...editForm, falhaSel: next, falha: falhaTexto(next) })}
      />
      <Field label="Próxima inspeção">
        <input type="date" style={inputStyle} value={editForm.proximaInspecao} onChange={(e) => setEditForm({ ...editForm, proximaInspecao: e.target.value })} />
      </Field>
      <FotosField fotos={editForm.fotos || []} setFotos={(updater) => setEditForm((prev) => ({ ...prev, fotos: typeof updater === 'function' ? updater(prev.fotos || []) : updater }))} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onSave} style={btnStyle}>Salvar</button>
        <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
      </div>
    </div>
  );
}

/** Card de 1 visita anterior — colapsado por padrão (só resumo), com seta pra expandir
    a lista de itens, e nesse modo expandido dá pra editar item por item. Em visitas
    grandes (mais de 8 itens, mais de 1 painel/laço envolvido), a lista ganha busca e
    agrupamento por Painel/Laço — mesmo raciocínio já usado no Relatório de Inspeções. */
function VisitaCard({ visita, panelOptions, canEdit, expanded, onToggleExpand, onDelete, onVerImprimir, onReopen, editingItemId, editForm, setEditForm, onStartEdit, onSaveEdit, onCancelEdit, onConvertOutro, deviceOptions, savingEdit, reportMode = false }) {
  const itens = itemsFromVisita(visita);
  const nManutencao = itens.filter((it) => it.tipo === 'atendimento').length;
  const nInspecao = itens.filter((it) => it.tipo === 'inspecao').length;
  const nOutro = itens.filter((it) => it.tipo === 'outro').length;
  const painel = panelOptions.find((p) => p.id === visita.painel_id);
  const [itemQuery, setItemQuery] = useState('');
  const [gruposAbertos, setGruposAbertos] = useState({});

  function grupoDoItem(it) {
    if (it.alvoKind === 'painel') {
      const pOpt = (deviceOptions || []).find((o) => o.id === `${PAINEL_OPT_PREFIX}${it.painelId}`);
      return `${pOpt?.panelName || 'Painel'} — Painel (falha geral)`;
    }
    const opt = it.dispositivoId ? (deviceOptions || []).find((o) => o.id === it.dispositivoId) : null;
    if (!opt) return 'Outros / sem dispositivo vinculado';
    return `${opt.panelName}${opt.loopName ? ' — ' + opt.loopName : ''}`;
  }

  const q = itemQuery.trim().toLowerCase();
  const itensFiltrados = q
    ? itens.filter((it) => [it.etiqueta, it.endereco, it.falha, it.descritivo, it.descricao].filter(Boolean).join(' ').toLowerCase().includes(q))
    : itens;
  const gruposNomes = [...new Set(itensFiltrados.map(grupoDoItem))];
  const usarGrupos = itens.length > 8 && gruposNomes.length > 1;

  function renderItem(it) {
    return (
      <div key={it.id}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><ItemResumo item={{ ...it, dispositivoLabel: it.etiqueta, resultado: it.status }} /></div>
          {canEdit && editingItemId !== it.id && (
            <button type="button" onClick={() => onStartEdit(visita, it)} style={{ ...smallBtnStyle, flexShrink: 0 }}>Editar item</button>
          )}
        </div>
        {editingItemId === it.id && (
          <EditItemForm editForm={editForm} setEditForm={setEditForm} onSave={onSaveEdit} onCancel={onCancelEdit} onConvert={onConvertOutro} deviceOptions={deviceOptions} saving={savingEdit} />
        )}
      </div>
    );
  }

  return (
    <div style={cardStyle} className={reportMode ? 'rvt-report-card' : undefined} data-open={reportMode ? expanded : undefined}>
      <button type="button" onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, padding: 0, width: '100%', textAlign: 'left' }}>
        <span className={reportMode ? 'rvt-report-chevron' : undefined} style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2, display: 'inline-block' }}>
          {reportMode ? '▸' : (expanded ? '▾' : '▸')}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {reportMode ? (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                Relatório de {formatDateLong(visita.data_visita)}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {painel ? `${painel.name} · ` : ''}{itens.length} {itens.length === 1 ? 'serviço registrado' : 'serviços registrados'}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                {formatDateBR(visita.data_visita)} · {visita.tecnico || 'sem técnico'}{painel ? ` · ${painel.name}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {itens.length} item(ns){nManutencao > 0 && ` · ${nManutencao} manutenção(ões)`}{nInspecao > 0 && ` · ${nInspecao} inspeção(ões)`}{nOutro > 0 && ` · ${nOutro} outro(s)`}
              </div>
            </>
          )}
        </div>
      </button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" onClick={() => onVerImprimir(visita)} className={reportMode ? 'rvt-report-cta' : undefined}
          style={reportMode ? { ...btnStyle, padding: '7px 18px' } : smallBtnStyle}>
          {reportMode ? 'Ver relatório' : 'Ver / Imprimir'}
        </button>
        {canEdit && (
          <button type="button" onClick={onToggleExpand} style={smallBtnStyle}>Editar</button>
        )}
        {canEdit && (
          <button type="button" onClick={() => onReopen(visita)}
            style={{ ...smallBtnStyle, border: '1px solid #8B2F2F', color: '#8B2F2F' }}>
            + Adicionar itens
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={() => onDelete(visita.id)}
            style={{ ...smallBtnStyle, border: '1px solid var(--status-danger)', color: 'var(--status-danger)' }}>
            Excluir
          </button>
        )}
      </div>

      {expanded && (
        <div className="fade-in-up" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {itens.length > 8 && (
            <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Buscar item por etiqueta, endereço ou falha..." value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
          )}
          {usarGrupos ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {gruposNomes.map((nomeGrupo) => {
                const itensDoGrupo = itensFiltrados.filter((it) => grupoDoItem(it) === nomeGrupo);
                const aberto = !!gruposAbertos[nomeGrupo];
                return (
                  <div key={nomeGrupo}>
                    <div onClick={() => setGruposAbertos((prev) => ({ ...prev, [nomeGrupo]: !prev[nomeGrupo] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{nomeGrupo} — {itensDoGrupo.length} item(ns)</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{aberto ? '▲' : '▼'}</span>
                    </div>
                    {aberto && (
                      <div style={{ display: 'grid', gap: 6, padding: '6px 0 6px 12px' }}>
                        {itensDoGrupo.map(renderItem)}
                      </div>
                    )}
                  </div>
                );
              })}
              {itensFiltrados.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum item encontrado.</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {itensFiltrados.map(renderItem)}
              {itensFiltrados.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{itens.length === 0 ? 'Nenhum item nesta visita.' : 'Nenhum item encontrado.'}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Vistoria em massa dos itens de Combate a Incêndio — mesmo padrão de busca + seleção
    múltipla, só que sem "visita" formal como container (cada envio já grava direto:
    atualiza o item + registra 1 linha no histórico de combate). */
function VisitaCombateView({ data, clientId, canEdit, onRefresh }) {
  const options = buildCombateOptions(data);
  const [tecnico, setTecnico] = useState('');
  const [dataVistoria, setDataVistoria] = useState(new Date().toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState([]);
  const [resultado, setResultado] = useState('Aprovado');
  const [falha, setFalha] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [proximaInspecao, setProximaInspecao] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const temCilindroSelecionado = selectedIds.some((id) => options.find((o) => o.id === id)?.kind === 'cilindro');
  const [agendarCombateMode, setAgendarCombateMode] = useState(false);
  const [agendarCombateIds, setAgendarCombateIds] = useState([]);
  const [agendarCombateData, setAgendarCombateData] = useState(new Date().toISOString().slice(0, 10));
  const [savingAgendarCombate, setSavingAgendarCombate] = useState(false);
  async function handleAgendarCombate(e) {
    e.preventDefault();
    if (agendarCombateIds.length === 0) { setMsg('Selecione ao menos 1 item.'); return; }
    setSavingAgendarCombate(true);
    try {
      const opts = options.filter((o) => agendarCombateIds.includes(o.id));
      for (const item of opts) {
        await agendarInspecaoCombate(item.kind, item.id, agendarCombateData);
      }
      setMsg(`Próxima inspeção agendada para ${opts.length} item(ns).`);
      setAgendarCombateIds([]);
      setAgendarCombateMode(false);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao agendar inspeção.');
    } finally {
      setSavingAgendarCombate(false);
    }
  }
  async function submitVistoria(e) {
    e.preventDefault();
    if (selectedIds.length === 0) { setMsg('Selecione ao menos um item.'); return; }
    setSaving(true);
    try {
      let count = 0;
      for (const id of selectedIds) {
        const opt = options.find((o) => o.id === id);
        if (!opt) continue;
        const patchBase = { tecnico, dataInspecao: dataVistoria, falha, observacoes, proximaInspecao };
        if (opt.kind === 'subitem') {
          await updateCombateSubitem(id, { ...patchBase, resultadoTeste: resultado });
        } else if (opt.kind === 'componente') {
          await updateCombateComponente(id, { ...patchBase, resultadoTeste: resultado });
        } else if (opt.kind === 'cilindro') {
          await updateCombateCilindro(id, {
            ...patchBase, resultadoValvula: resultado, resultadoManometro: resultado, resultadoCorpo: resultado, resultadoEtiqueta: resultado,
          });
        }
        await createCombateHistorico({
          clienteId: clientId, tipoItem: opt.kind, itemId: id,
          categoriaLabel: opt.categoriaLabel, contextoLabel: opt.contextoLabel,
          tecnico, dataInspecao: dataVistoria, resultado, falha, observacoes,
        });
        count += 1;
      }
      setSelectedIds([]);
      setFalha('');
      setObservacoes('');
      setProximaInspecao('');
      if (onRefresh) onRefresh();
      setMsg(`${count} item(ns) registrado(s) no histórico de Combate.`);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao registrar vistoria.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Visitas (Sistemas de Combate)</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Vistoria em massa dos itens de Sistemas de Combate — Conjuntos, Componentes e Cilindros. Cada envio já grava no histórico (Indicador — sub-aba SPCI).
        </p>
      </div>
      {msg && (
        <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
          {msg}
        </div>
      )}
            {!agendarCombateMode ? (
        <div key="vistoria" className="fade-in-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <form onSubmit={submitVistoria} style={{ ...cardStyle, flex: '1 1 400px' }}>
            <div className="grid-2-mobile-safe">
              <Field label="Técnico"><input style={inputStyle} value={tecnico} onChange={(e) => setTecnico(e.target.value)} /></Field>
              <Field label="Data"><input type="date" style={inputStyle} value={dataVistoria} onChange={(e) => setDataVistoria(e.target.value)} /></Field>
            </div>
            <CombateMultiSelect options={options} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
            {temCilindroSelecionado && (
              <div style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                Cilindro selecionado: o resultado abaixo marca os 4 itens do checklist dele de uma vez (Válvula, Manômetro, Corpo, Etiqueta).
                Pra registrar cada item do cilindro separado, edita ele direto em Sistemas de Combate.
              </div>
            )}
            <div className="grid-2-mobile-safe">
              <Field label="Resultado">
                <select style={inputStyle} value={resultado} onChange={(e) => setResultado(e.target.value)}>
                  <option>Aprovado</option><option>Reprovado</option><option>Não avaliado</option>
                </select>
              </Field>
              <Field label="Próxima inspeção">
                <input type="date" style={inputStyle} value={proximaInspecao} onChange={(e) => setProximaInspecao(e.target.value)} />
              </Field>
            </div>
            <Field label="Falha (se reprovado)">
              <textarea style={{ ...inputStyle, minHeight: 50 }} value={falha} onChange={(e) => setFalha(e.target.value)} />
            </Field>
            <Field label="Observações">
              <textarea style={{ ...inputStyle, minHeight: 50 }} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Field>
            <button type="submit" disabled={!canEdit || saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : `Registrar vistoria${selectedIds.length > 1 ? ` (${selectedIds.length} itens)` : ''}`}
            </button>
          </form>
          <div style={{ ...cardStyle, maxWidth: 420, flex: '1 1 320px', border: '1px solid #8B2F2F' }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Agendar inspeção</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Programe a próxima inspeção nos itens selecionados, sem registrar uma vistoria completa.
            </p>
            <button type="button" onClick={() => setAgendarCombateMode(true)} style={{ ...btnStyle, background: 'transparent', color: '#8B2F2F', border: '1px solid #8B2F2F' }}>
              Selecionar itens
            </button>
          </div>
        </div>
      ) : (
        <form key="agendar-combate" className="fade-in-up" onSubmit={handleAgendarCombate} style={{ ...cardStyle, maxWidth: 480 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Agendar inspeção</h3>
          <CombateMultiSelect options={options} selectedIds={agendarCombateIds} setSelectedIds={setAgendarCombateIds} />
          <Field label="Próxima inspeção">
            <input type="date" style={inputStyle} value={agendarCombateData} onChange={(e) => setAgendarCombateData(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={!canEdit || savingAgendarCombate} style={{ ...btnStyle, opacity: savingAgendarCombate ? 0.7 : 1 }}>
              {savingAgendarCombate ? 'Agendando...' : `Agendar (${agendarCombateIds.length})`}
            </button>
            <button type="button" onClick={() => { setAgendarCombateMode(false); setAgendarCombateIds([]); }} style={{ ...btnStyle, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AtendimentosNovo({ data, client, clientId, canEdit: canEditProp, onRefresh, reportMode = false }) {
  // reportMode: usado pelo menu "Relatórios" (acesso do cliente/visualizador). Mostra só
  // a lista/impressão de relatórios de visita, sem os fluxos de criação/edição.
  const canEdit = reportMode ? false : canEditProp;
  const deviceOptions = buildDeviceOptions(data);
  // Inspeção / Agendar inspeção não aceitam "o painel em si" nesta etapa — só Manutenção e Diagnóstico.
  const deviceOptionsSemPainel = deviceOptions.filter((o) => o.kind !== 'painel');
  const panelOptions = data.panels || [];

  const [visita, setVisita] = useState(null);
  const [itensVisita, setItensVisita] = useState([]);
  const [aba, setAba] = useState('manutencao');
  const [subAba, setSubAba] = useState('dispositivos');
  const [msg, setMsg] = useState('');

    const [agendarSDAIMode, setAgendarSDAIMode] = useState(false);
  const [agendarSDAIIds, setAgendarSDAIIds] = useState([]);
  const [agendarSDAIData, setAgendarSDAIData] = useState(new Date().toISOString().slice(0, 10));
  const [savingAgendarSDAI, setSavingAgendarSDAI] = useState(false);
  async function handleAgendarSDAI(e) {
    e.preventDefault();
    if (agendarSDAIIds.length === 0) { setMsg('Selecione ao menos 1 item.'); return; }
    setSavingAgendarSDAI(true);
    try {
      for (const id of agendarSDAIIds) {
        await agendarInspecaoDispositivo(id, agendarSDAIData);
      }
      setMsg(`Próxima inspeção agendada para ${agendarSDAIIds.length} item(ns).`);
      setAgendarSDAIIds([]);
      setAgendarSDAIMode(false);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao agendar inspeção.');
    } finally {
      setSavingAgendarSDAI(false);
    }
  }
  const [startForm, setStartForm] = useState({ painelId: '', tecnico: '', data: new Date().toISOString().slice(0, 10) });
  async function iniciarVisita(e) {
    e.preventDefault();
    try {
      const v = await createVisita({
        clienteId: clientId, painelId: startForm.painelId || null,
        tecnico: startForm.tecnico, dataVisita: startForm.data,
      });
      setVisita(v);
      setItensVisita([]);
      setMsg('Visita iniciada. Adicione os itens realizados abaixo.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao iniciar visita.');
    }
  }

  function finalizarVisita() {
    setVisita(null);
    setItensVisita([]);
    setMsg('');
    refreshVisitas();
  }

  /** Reabre uma visita já salva (do histórico "Visitas anteriores") pra permitir
      adicionar novos itens a ela — reaproveita o mesmo workspace da visita em
      andamento (submitAtendimento/submitInspecao/submitOutro já gravam com rvtId:
      visita.id, então funciona igual pra visita nova ou reaberta). */
  function reabrirVisita(v) {
    setVisita(v);
    setItensVisita([]);
    setAba('manutencao');
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(v.id);
      return next;
    });
    setMsg('Visita reaberta — os itens que você adicionar agora entram nela.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function cancelarVisita() {
  if (!window.confirm('Cancelar esta visita? Tudo que foi salvo automaticamente até agora será apagado, e essa ação não pode ser desfeita.')) return;
  try {
    await deleteVisita(visita.id);
    setVisita(null);
    setItensVisita([]);
    setMsg('');
    refreshVisitas();
    if (onRefresh) onRefresh();
  } catch (err) {
    console.error(err);
    setMsg('Erro ao cancelar visita.');
  }
}

  const [atForm, setAtForm] = useState({ dispositivoIds: [], falha: '', falhaSel: emptyFalha(), status: 'aguardando', descritivo: '' });
  const [atFotos, setAtFotos] = useState([]);
  const [savingAtendimento, setSavingAtendimento] = useState(false);
  async function submitAtendimento(e) {
    e.preventDefault();
    if (atForm.dispositivoIds.length === 0) { setMsg('Selecione ao menos um dispositivo.'); return; }
    if (atForm.falha.trim() && !falhaClassificada(atForm.falhaSel)) {
      setMsg('Selecione a falha na lista ou escolha uma categoria antes de salvar a corretiva.'); return;
    }
    setSavingAtendimento(true);
    try {
      const novosItens = [];
      for (const optId of atForm.dispositivoIds) {
        const result = await createAtendimento({
          ...idsPorAlvo(optId), clienteId: clientId,
          falha: atForm.falha, status: atForm.status, descritivo: atForm.descritivo,
          falhaCodigo: atForm.falhaSel?.codigo || null, falhaMarca: atForm.falhaSel?.marca || null, falhaCategoria: atForm.falhaSel?.categoria || null,
          tecnico: visita.tecnico, rvtId: visita.id, fotos: atFotos,
        });
        const label = deviceOptions.find((o) => o.id === optId)?.label || '';
        novosItens.push({ tipo: 'atendimento', falha: result.falha, status: result.status, dispositivoLabel: label, fotos: result.fotos });
      }
      setItensVisita((prev) => [...prev, ...novosItens]);
      setAtForm({ dispositivoIds: [], falha: '', falhaSel: emptyFalha(), status: 'aguardando', descritivo: '' });
      setAtFotos([]);
      if (onRefresh) onRefresh();
      setMsg(`${novosItens.length} item(ns) adicionado(s) à visita.`);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao registrar atendimento.');
    } finally {
      setSavingAtendimento(false);
    }
  }

  const [inspForm, setInspForm] = useState({
    dispositivoIds: [], resultadoTeste: 'Aprovado', aparencia: 'Ótimo',
    comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '', falhaSel: emptyFalha(),
    proximaInspecao: '',
  });
  const [inspFotos, setInspFotos] = useState([]);
  const [savingInspecao, setSavingInspecao] = useState(false);
  const inspDevicesSelecionados = deviceOptions.filter((o) => inspForm.dispositivoIds.includes(o.id));
  const inspMetodosUnicos = [...new Set(inspDevicesSelecionados.map((d) => getMetodoTeste(d)).filter(Boolean))];
  const inspCategoriasUnicas = [...new Set(inspDevicesSelecionados.map((d) => FUNCTIONAL_CATEGORY_MAP[d.categoriaFuncional]).filter(Boolean))];
  async function submitInspecao(e) {
    e.preventDefault();
    if (inspForm.dispositivoIds.length === 0) { setMsg('Selecione ao menos um dispositivo.'); return; }
    if (inspForm.falha.trim() && !falhaClassificada(inspForm.falhaSel)) {
      setMsg('A falha vai gerar corretiva — selecione-a na lista ou escolha uma categoria antes de salvar.'); return;
    }
    setSavingInspecao(true);
    try {
      const novosItens = [];
      let corretivasGeradas = 0;
      for (const optId of inspForm.dispositivoIds) {
        const device = deviceOptions.find((o) => o.id === optId);
        const result = await createInspecao({
          ...idsPorAlvo(optId), clienteId: clientId,
          tecnico: visita.tecnico, resultadoTeste: inspForm.resultadoTeste, aparencia: inspForm.aparencia,
          comunicacaoLocal: inspForm.comunicacaoLocal, comunicacaoRede: inspForm.comunicacaoRede,
          observacoes: inspForm.observacoes, falha: inspForm.falha, metodo: getMetodoTeste(device),
          falhaCodigo: inspForm.falhaSel?.codigo || null, falhaMarca: inspForm.falhaSel?.marca || null, falhaCategoria: inspForm.falhaSel?.categoria || null,
          dataInspecao: visita.data_visita, proximaInspecao: inspForm.proximaInspecao, rvtId: visita.id, fotos: inspFotos,
        });
        if (result.atendimento) corretivasGeradas += 1;
        novosItens.push({
          tipo: 'inspecao', resultado: result.inspecao.resultado_teste, dispositivoLabel: device?.label || '',
          criouCorretiva: !!result.atendimento, fotos: result.inspecao.fotos,
        });
      }
      setItensVisita((prev) => [...prev, ...novosItens]);
      setInspForm({
        dispositivoIds: [], resultadoTeste: 'Aprovado', aparencia: 'Ótimo',
        comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '', falhaSel: emptyFalha(),
        proximaInspecao: '',
      });
      setInspFotos([]);
      if (onRefresh) onRefresh();
      setMsg(corretivasGeradas > 0
        ? `${novosItens.length} inspeção(ões) adicionada(s) — ${corretivasGeradas} corretiva(s) criada(s) automaticamente.`
        : `${novosItens.length} inspeção(ões) adicionada(s) à visita.`);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao registrar inspeção.');
    } finally {
      setSavingInspecao(false);
    }
  }

    const [outroTexto, setOutroTexto] = useState('');
  const [outroFotos, setOutroFotos] = useState([]);
  const [outroAtividade, setOutroAtividade] = useState('');
  const [outroComQuem, setOutroComQuem] = useState('');
  const [outroFinalidade, setOutroFinalidade] = useState('');
  const [outroDiagDispositivoIds, setOutroDiagDispositivoIds] = useState([]);
  const [outroDiagFalha, setOutroDiagFalha] = useState('');
  const [outroDiagFalhaSel, setOutroDiagFalhaSel] = useState(emptyFalha());
  const [outroDiagAgendamento, setOutroDiagAgendamento] = useState('');
  const [outroItemNome, setOutroItemNome] = useState('');
  const [outroItemTipoManutencao, setOutroItemTipoManutencao] = useState('corretiva');
  const [outroItemStatus, setOutroItemStatus] = useState('aguardando');
  const [savingOutro, setSavingOutro] = useState(false);

  function limparFormOutro() {
    setOutroTexto(''); setOutroFotos([]); setOutroAtividade('');
    setOutroComQuem(''); setOutroFinalidade('');
    setOutroDiagDispositivoIds([]); setOutroDiagFalha(''); setOutroDiagFalhaSel(emptyFalha()); setOutroDiagAgendamento('');
    setOutroItemNome(''); setOutroItemTipoManutencao('corretiva'); setOutroItemStatus('aguardando');
  }

    async function submitOutro(e) {
    e.preventDefault();
    setSavingOutro(true);
    try {
      if (outroAtividade === 'diagnostico') {
        if (outroDiagDispositivoIds.length === 0) { setMsg('Selecione ao menos um dispositivo pro diagnóstico.'); return; }
        if (!outroDiagFalha.trim()) { setMsg('Descreva a falha encontrada no diagnóstico.'); return; }
        if (!falhaClassificada(outroDiagFalhaSel)) { setMsg('Selecione a falha na lista ou escolha uma categoria — o diagnóstico gera corretiva.'); return; }
        const labels = outroDiagDispositivoIds.map((id) => deviceOptions.find((o) => o.id === id)?.label || '');
        const criados = await createDiagnosticoOutro({
          rvtId: visita.id, tecnico: visita.tecnico, clienteId: clientId,
          alvos: outroDiagDispositivoIds.map(decodeAlvo),
          falha: outroDiagFalha.trim(), dataAgendamento: outroDiagAgendamento,
          falhaCodigo: outroDiagFalhaSel.codigo || null, falhaMarca: outroDiagFalhaSel.marca || null, falhaCategoria: outroDiagFalhaSel.categoria || null,
          dispositivoLabels: labels, fotos: outroFotos,
        });
        setItensVisita((prev) => [
          ...prev,
          { tipo: 'outro', atividade: 'diagnostico', descricao: '',
            atividadeDados: { falha: outroDiagFalha.trim(), dataAgendamento: outroDiagAgendamento, dispositivos: labels }, fotos: [] },
          ...criados.map((a, i) => ({ tipo: 'atendimento', falha: a.falha, status: a.status, dispositivoLabel: labels[i] || '', fotos: a.fotos })),
        ]);
        setMsg(`Diagnóstico registrado — ${criados.length} corretiva(s) criada(s) (Aguardando).`);
      } else {
        if (outroAtividade === 'reuniao' && !outroComQuem.trim()) { setMsg('Informe com quem foi a reunião.'); return; }
        if (outroAtividade === 'preparacao' && !outroFinalidade.trim()) { setMsg('Informe para que é a preparação.'); return; }
        if (outroAtividade === 'manutencao_nao_cadastrada' && !outroItemNome.trim()) { setMsg('Informe o nome do item.'); return; }
        if ((outroAtividade === '' || outroAtividade === 'seguranca_trabalho') && !outroTexto.trim()) { setMsg('Descreva a atividade.'); return; }

        let dados = {};
        if (outroAtividade === 'reuniao') dados = { comQuem: outroComQuem.trim() };
        else if (outroAtividade === 'preparacao') dados = { finalidade: outroFinalidade.trim() };
        else if (outroAtividade === 'manutencao_nao_cadastrada') {
          dados = { nomeItem: outroItemNome.trim(), tipoManutencao: outroItemTipoManutencao };
          if (outroItemTipoManutencao === 'corretiva') dados.status = outroItemStatus;
        }

        await addOutroToVisita(visita.id, outroTexto.trim(), outroFotos, outroAtividade || null, dados);
        setItensVisita((prev) => [...prev, { tipo: 'outro', descricao: outroTexto.trim(), fotos: outroFotos, atividade: outroAtividade, atividadeDados: dados }]);
        setMsg('Item adicionado à visita.');
      }
      limparFormOutro();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      setMsg('Erro ao adicionar item.');
    } finally {
      setSavingOutro(false);
    }
  }

  const [visitas, setVisitas] = useState([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const refreshVisitas = useCallback(async () => {
    setLoadingVisitas(true);
    try {
      const v = await listVisitas(clientId);
      setVisitas(v);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVisitas(false);
    }
  }, [clientId]);
  useEffect(() => { refreshVisitas(); }, [refreshVisitas]);

  async function handleDeleteVisita(id) {
    if (!window.confirm('Excluir esta visita e todos os itens dentro dela? Essa acao nao pode ser desfeita.')) return;
    try {
      await deleteVisita(id);
      refreshVisitas();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      setMsg('Erro ao excluir visita.');
    }
  }

  // ---- Filtro + agrupamento por dia das visitas anteriores ----
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroPainelId, setFiltroPainelId] = useState('');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const visitasFiltradas = visitas.filter((v) => {
    if (filtroTecnico && !(v.tecnico || '').toLowerCase().includes(filtroTecnico.toLowerCase())) return false;
    if (filtroPainelId && v.painel_id !== filtroPainelId) return false;
    if (filtroDataDe && v.data_visita < filtroDataDe) return false;
    if (filtroDataAte && v.data_visita > filtroDataAte) return false;
    return true;
  });
  const diasVisitas = [...new Set(visitasFiltradas.map((v) => v.data_visita))].sort().reverse();

  // ---- Ver/Imprimir (individual ou período) ----
  const [printTarget, setPrintTarget] = useState(null); // array de visitas, ou null

  // ---- Editar item de uma visita já salva ----
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEditItem, setSavingEditItem] = useState(false);

  function startEditItem(v, item) {
    const raw = (v.rvt_itens || []).find((it) => it.id === item.id);
    if (!raw) return;
    if (raw.outro_descricao || raw.outro_atividade) {
      setEditForm({ kind: 'outro', rvtItemId: raw.id, rvtId: v.id, descricao: raw.outro_descricao || '', fotos: raw.outro_fotos || [],
        atividade: raw.outro_atividade || '', atividadeDados: raw.outro_atividade_dados || {},
        visitaData: v.data_visita, visitaTecnico: v.tecnico || '' });
    } else if (raw.atendimentos) {
      const a = raw.atendimentos;
      setEditForm({ kind: 'atendimento', id: a.id, dispositivoId: a.dispositivo_id || null, painelId: a.painel_id || null, ...alvoDeRegistro(a), falha: a.falha || '', falhaSel: falhaSelFromRecord(a), status: a.status || 'aguardando', descritivo: a.descritivo || '', fotos: a.fotos || [] });
    } else if (raw.inspecoes) {
      const i = raw.inspecoes;
      setEditForm({
        kind: 'inspecao', id: i.id, dispositivoId: i.dispositivo_id || null, painelId: i.painel_id || null, ...alvoDeRegistro(i), resultadoTeste: i.resultado_teste || '', aparencia: i.aparencia || '',
        comunicacaoLocal: i.comunicacao_local || '', comunicacaoRede: i.comunicacao_rede || '',
        observacoes: i.observacoes || '', falha: i.falha || '', falhaSel: falhaSelFromRecord(i), proximaInspecao: i.proxima_inspecao || '',
        fotos: i.fotos || [],
      });
    } else {
      return;
    }
    setEditingItemId(item.id);
  }
  function cancelEditItem() {
    setEditingItemId(null);
    setEditForm(null);
  }
  async function saveEditItem() {
    if (!editForm) return;
    if ((editForm.kind === 'atendimento' || editForm.kind === 'inspecao')
      && (editForm.falha || '').trim() && !falhaClassificada(editForm.falhaSel)) {
      setMsg('Selecione a falha na lista ou escolha uma categoria antes de salvar.'); return;
    }
    setSavingEditItem(true);
    try {
      // O alvo (dispositivo x bateria x fonte) é fixo na edição — só repassa dispositivoId quando o alvo é dispositivo.
      const alvoDispositivo = (editForm.alvoKind || 'dispositivo') === 'dispositivo';
      if (editForm.kind === 'atendimento') {
        await updateAtendimento(editForm.id, {
          falha: editForm.falha, status: editForm.status, descritivo: editForm.descritivo, fotos: editForm.fotos,
          ...(alvoDispositivo ? { dispositivoId: editForm.dispositivoId } : {}),
          falhaCodigo: editForm.falhaSel?.codigo || null, falhaMarca: editForm.falhaSel?.marca || null, falhaCategoria: editForm.falhaSel?.categoria || null,
        });
      } else if (editForm.kind === 'inspecao') {
        await updateInspecao(editForm.id, {
          resultadoTeste: editForm.resultadoTeste, aparencia: editForm.aparencia,
          comunicacaoLocal: editForm.comunicacaoLocal, comunicacaoRede: editForm.comunicacaoRede,
          observacoes: editForm.observacoes, falha: editForm.falha, proximaInspecao: editForm.proximaInspecao,
          falhaCodigo: editForm.falhaSel?.codigo || null, falhaMarca: editForm.falhaSel?.marca || null, falhaCategoria: editForm.falhaSel?.categoria || null,
          fotos: editForm.fotos,
          ...(alvoDispositivo ? { dispositivoId: editForm.dispositivoId } : {}),
        });
      } else if (editForm.kind === 'outro') {
        await updateOutroItem(editForm.rvtItemId, editForm.descricao, editForm.fotos, editForm.atividade, editForm.atividadeDados);
      }
      cancelEditItem();
      refreshVisitas();
      if (onRefresh) onRefresh();
      setMsg('Item atualizado.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao salvar edição.');
    } finally {
      setSavingEditItem(false);
    }
  }

  /** Converte o item "Outro → Manutenção de item não cadastrado" em edição numa Corretiva
      real contra o alvo escolhido (dispositivo / Bateria de Painel / Fonte Auxiliar). */
  async function converterItemOutro({ alvoOptionId, falha, falhaCategoria, status }) {
    if (!editForm || editForm.kind !== 'outro') return;
    if (!alvoOptionId) { setMsg('Escolha o equipamento (dispositivo, bateria ou fonte).'); return; }
    if (!falhaCategoria) { setMsg('Escolha a categoria da falha.'); return; }
    setSavingEditItem(true);
    try {
      const dados = editForm.atividadeDados || {};
      await converterOutroParaAtendimento({
        rvtId: editForm.rvtId, rvtItemId: editForm.rvtItemId, dataRegistro: editForm.visitaData,
        alvo: decodeAlvo(alvoOptionId), clienteId: clientId,
        falha: (falha || dados.nomeItem || editForm.descricao || '').trim(),
        falhaCategoria,
        status: status || dados.status || 'aguardando',
        descritivo: editForm.descricao || '', fotos: editForm.fotos || [],
        tecnico: editForm.visitaTecnico || '',
      });
      cancelEditItem();
      refreshVisitas();
      if (onRefresh) onRefresh();
      setMsg('Item convertido em manutenção do equipamento.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao converter o item.');
    } finally {
      setSavingEditItem(false);
    }
  }

  // ---- Imprimir período (várias visitas de uma vez, agrupadas por dia) ----
  const [periodoDe, setPeriodoDe] = useState('');
  const [periodoAte, setPeriodoAte] = useState('');
  function imprimirPeriodo() {
    const alvo = visitasFiltradas.filter((v) => {
      if (periodoDe && v.data_visita < periodoDe) return false;
      if (periodoAte && v.data_visita > periodoAte) return false;
      return true;
    });
    if (alvo.length === 0) { setMsg('Nenhuma visita no período selecionado.'); return; }
    setPrintTarget(alvo);
  }

  if (printTarget) {
    return <VisitaPrintView visitas={printTarget} client={client} onBack={() => setPrintTarget(null)} />;
  }

  return (
    <div>
      {!reportMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setSubAba('dispositivos')} style={tabBtnStyle(subAba === 'dispositivos')}>Visitas (SDAI)</button>
          <button onClick={() => setSubAba('combate')} style={tabBtnStyle(subAba === 'combate')}>Visitas (Sistemas de Combate)</button>
        </div>
      )}
      {!reportMode && subAba === 'combate' && (
        <div key="combate" className="fade-in-up">
          <VisitaCombateView data={data} clientId={clientId} canEdit={canEdit} onRefresh={onRefresh} />
        </div>
      )}
      {(reportMode || subAba === 'dispositivos') && (
    <div key="dispositivos" className="fade-in-up">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{reportMode ? 'Relatórios de visita técnica' : 'Visitas técnicas'}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {reportMode
            ? 'Consulte, visualize e imprima os relatórios das visitas técnicas realizadas.'
            : 'Uma visita pode reunir manutenções, inspeções e outros itens (reuniões, ajustes).'}
        </p>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
          {msg}
        </div>
      )}

            {!reportMode && (!visita ? (
        !agendarSDAIMode ? (
          <div key="start" className="fade-in-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <form onSubmit={iniciarVisita} style={{ ...cardStyle, maxWidth: 420, flex: '1 1 320px' }}>
              <h3 style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Iniciar visita técnica</h3>
              <Field label="Painel (opcional)">
                <select style={inputStyle} value={startForm.painelId} onChange={(e) => setStartForm({ ...startForm, painelId: e.target.value })}>
                  <option value="">Sem painel específico</option>
                  {panelOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Técnico">
                <input style={inputStyle} value={startForm.tecnico} onChange={(e) => setStartForm({ ...startForm, tecnico: e.target.value })} />
              </Field>
              <Field label="Data">
                <input type="date" style={inputStyle} value={startForm.data} onChange={(e) => setStartForm({ ...startForm, data: e.target.value })} />
              </Field>
              <button type="submit" disabled={!canEdit} style={btnStyle}>Iniciar visita</button>
            </form>
            <div style={{ ...cardStyle, maxWidth: 420, flex: '1 1 320px', border: '1px solid #8B2F2F' }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Agendar inspeção</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Programe a próxima inspeção nos itens selecionados, sem registrar uma visita completa.
              </p>
              <button type="button" onClick={() => setAgendarSDAIMode(true)} style={{ ...btnStyle, background: 'transparent', color: '#8B2F2F', border: '1px solid #8B2F2F' }}>
                Selecionar itens
              </button>
            </div>
          </div>
        ) : (
          <form key="agendar-sdai" className="fade-in-up" onSubmit={handleAgendarSDAI} style={{ ...cardStyle, maxWidth: 480 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Agendar inspeção</h3>
            <DeviceMultiSelect options={deviceOptionsSemPainel} selectedIds={agendarSDAIIds} setSelectedIds={setAgendarSDAIIds} />
            <Field label="Próxima inspeção">
              <input type="date" style={inputStyle} value={agendarSDAIData} onChange={(e) => setAgendarSDAIData(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={!canEdit || savingAgendarSDAI} style={{ ...btnStyle, opacity: savingAgendarSDAI ? 0.7 : 1 }}>
                {savingAgendarSDAI ? 'Agendando...' : `Agendar (${agendarSDAIIds.length})`}
              </button>
              <button type="button" onClick={() => { setAgendarSDAIMode(false); setAgendarSDAIIds([]); }} style={{ ...btnStyle, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
            </div>
          </form>
        )
      ) : (

        <div key="ativa" className="fade-in-up">
          <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Visita em andamento — {visita.tecnico || 'sem técnico'} · {visita.data_visita}
              {panelOptions.find((p) => p.id === visita.painel_id) && ` · ${panelOptions.find((p) => p.id === visita.painel_id).name}`}
            </div>
                        <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelarVisita} style={{ ...btnStyle, background: 'transparent', color: '#c0392b', border: '1px solid #c0392b' }}>
                Cancelar visita
              </button>
              <button onClick={finalizarVisita} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                Finalizar visita
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setAba('manutencao')} style={tabBtnStyle(aba === 'manutencao')}>+ Manutenção</button>
            <button onClick={() => setAba('inspecao')} style={tabBtnStyle(aba === 'inspecao')}>+ Inspeção</button>
            <button onClick={() => setAba('outro')} style={tabBtnStyle(aba === 'outro')}>+ Outro</button>
          </div>

          {aba === 'manutencao' && (
            <form key="manutencao" className="fade-in-up" onSubmit={submitAtendimento} style={{ ...cardStyle, marginBottom: 16 }}>
              <DeviceMultiSelect options={deviceOptions} selectedIds={atForm.dispositivoIds}
                setSelectedIds={(next) => setAtForm((prev) => ({ ...prev, dispositivoIds: typeof next === 'function' ? next(prev.dispositivoIds) : next }))} />
              <FalhaSelect
                label="Falha (deixe em branco para preventiva)"
                marca={marcaDeDispositivos(atForm.dispositivoIds, deviceOptions)}
                escopo={escopoDaSelecao(atForm.dispositivoIds)}
                value={atForm.falhaSel}
                onChange={(next) => setAtForm((prev) => ({ ...prev, falhaSel: next, falha: falhaTexto(next) }))}
              />
              <Field label="Status">
                <select style={inputStyle} value={atForm.status} onChange={(e) => setAtForm({ ...atForm, status: e.target.value })}>
                  <option value="aguardando">Aguardando</option>
                  <option value="andamento">Andamento</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </Field>
              <Field label="Descritivo">
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={atForm.descritivo} onChange={(e) => setAtForm({ ...atForm, descritivo: e.target.value })} />
              </Field>
              <FotosField fotos={atFotos} setFotos={setAtFotos} />
              <button type="submit" disabled={!canEdit || savingAtendimento} style={{ ...btnStyle, opacity: savingAtendimento ? 0.7 : 1 }}>
                {savingAtendimento ? 'Salvando...' : `Adicionar à visita${atForm.dispositivoIds.length > 1 ? ` (${atForm.dispositivoIds.length} itens)` : ''}`}
              </button>
            </form>
          )}

          {aba === 'inspecao' && (
            <form key="inspecao" className="fade-in-up" onSubmit={submitInspecao} style={{ ...cardStyle, marginBottom: 16 }}>
              <DeviceMultiSelect options={deviceOptionsSemPainel} selectedIds={inspForm.dispositivoIds}
                setSelectedIds={(next) => setInspForm((prev) => ({ ...prev, dispositivoIds: typeof next === 'function' ? next(prev.dispositivoIds) : next }))} />
              {(inspCategoriasUnicas.length > 0 || inspMetodosUnicos.length > 0) && (
                <div style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {inspCategoriasUnicas.length > 0 && <div>Categoria(s): <strong style={{ color: 'var(--text-primary)' }}>{inspCategoriasUnicas.join(', ')}</strong></div>}
                  {inspMetodosUnicos.length > 0 && <div>Método de teste: <strong style={{ color: 'var(--text-primary)' }}>{inspMetodosUnicos.join(' · ')}</strong></div>}
                  {inspMetodosUnicos.length > 1 && <div style={{ color: 'var(--status-warning, #d97706)' }}>Atenção: a seleção mistura categorias com métodos diferentes.</div>}
                </div>
              )}
              <div className="grid-2-mobile-safe">
                <Field label="Funcionamento (resultado do teste)">
                  <select style={inputStyle} value={inspForm.resultadoTeste} onChange={(e) => setInspForm({ ...inspForm, resultadoTeste: e.target.value })}>
                    <option>Aprovado</option><option>Reprovado</option><option>Não avaliado</option>
                  </select>
                </Field>
                <Field label="Aparência">
                  <select style={inputStyle} value={inspForm.aparencia} onChange={(e) => setInspForm({ ...inspForm, aparencia: e.target.value })}>
                    <option>Ótimo</option><option>Bom</option><option>Regular</option><option>Precisa Trocar</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2-mobile-safe">
                <Field label="Comunicação local">
                  <select style={inputStyle} value={inspForm.comunicacaoLocal} onChange={(e) => setInspForm({ ...inspForm, comunicacaoLocal: e.target.value })}>
                    <option>Conforme</option><option>Não conforme</option>
                  </select>
                </Field>
                <Field label="Comunicação em rede">
                  <select style={inputStyle} value={inspForm.comunicacaoRede} onChange={(e) => setInspForm({ ...inspForm, comunicacaoRede: e.target.value })}>
                    <option>Conforme</option><option>Não conforme</option>
                  </select>
                </Field>
              </div>
              <Field label="Observações">
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={inspForm.observacoes} onChange={(e) => setInspForm({ ...inspForm, observacoes: e.target.value })} />
              </Field>
              <FalhaSelect
                label="Falha (se preenchida, cria corretiva automática em todos os selecionados)"
                marca={marcaDeDispositivos(inspForm.dispositivoIds, deviceOptions)}
                escopo={escopoDaSelecao(inspForm.dispositivoIds)}
                value={inspForm.falhaSel}
                onChange={(next) => setInspForm((prev) => ({ ...prev, falhaSel: next, falha: falhaTexto(next) }))}
              />
              <Field label="Próxima inspeção">
                <input type="date" style={inputStyle} value={inspForm.proximaInspecao} onChange={(e) => setInspForm({ ...inspForm, proximaInspecao: e.target.value })} />
              </Field>
              <FotosField fotos={inspFotos} setFotos={setInspFotos} />
              <button type="submit" disabled={!canEdit || savingInspecao} style={{ ...btnStyle, opacity: savingInspecao ? 0.7 : 1 }}>
                {savingInspecao ? 'Salvando...' : `Adicionar à visita${inspForm.dispositivoIds.length > 1 ? ` (${inspForm.dispositivoIds.length} itens)` : ''}`}
              </button>
            </form>
          )}

                    {aba === 'outro' && (
            <form key="outro" className="fade-in-up" onSubmit={submitOutro} style={{ ...cardStyle, marginBottom: 16 }}>
              <Field label="Atividade">
                <select style={inputStyle} value={outroAtividade} onChange={(e) => setOutroAtividade(e.target.value)}>
                  <option value="">Genérico (sem categoria)</option>
                  <option value="reuniao">Reunião</option>
                  <option value="preparacao">Preparação</option>
                  <option value="diagnostico">Diagnóstico</option>
                  <option value="seguranca_trabalho">Segurança do Trabalho</option>
                  <option value="manutencao_nao_cadastrada">Manutenção de Itens não cadastrados</option>
                </select>
              </Field>

              {outroAtividade === 'reuniao' && (
                <Field label="Com quem (ex: Bombeiros, Manutenção, Logística, Diretoria)">
                  <input style={inputStyle} value={outroComQuem} onChange={(e) => setOutroComQuem(e.target.value)} />
                </Field>
              )}

              {outroAtividade === 'preparacao' && (
                <Field label="Para que (ex: Manutenção Corretiva, Manutenção Preventiva, Inspeção, Mudança de Layout)">
                  <input style={inputStyle} value={outroFinalidade} onChange={(e) => setOutroFinalidade(e.target.value)} />
                </Field>
              )}

              {outroAtividade === 'diagnostico' && (
                <>
                  <DeviceMultiSelect options={deviceOptions} selectedIds={outroDiagDispositivoIds} setSelectedIds={setOutroDiagDispositivoIds} />
                  <FalhaSelect
                    label="Falha encontrada"
                    marca={marcaDeDispositivos(outroDiagDispositivoIds, deviceOptions)}
                    escopo={escopoDaSelecao(outroDiagDispositivoIds)}
                    value={outroDiagFalhaSel}
                    onChange={(next) => { setOutroDiagFalhaSel(next); setOutroDiagFalha(falhaTexto(next)); }}
                  />
                  <Field label="Data de agendamento da manutenção">
                    <input type="date" style={inputStyle} value={outroDiagAgendamento} onChange={(e) => setOutroDiagAgendamento(e.target.value)} />
                  </Field>
                  <div style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Ao salvar, uma Corretiva com status Aguardando é criada automaticamente pra cada dispositivo selecionado, já com essa falha e a data de agendamento.
                  </div>
                </>
              )}

              {outroAtividade === 'manutencao_nao_cadastrada' && (
                <div className="grid-2-mobile-safe">
                  <Field label="Nome do item">
                    <input style={inputStyle} value={outroItemNome} onChange={(e) => setOutroItemNome(e.target.value)} />
                  </Field>
                  <Field label="Tipo de manutenção">
                    <select style={inputStyle} value={outroItemTipoManutencao} onChange={(e) => setOutroItemTipoManutencao(e.target.value)}>
                      <option value="corretiva">Corretiva</option>
                      <option value="preventiva">Preventiva</option>
                    </select>
                  </Field>
                  {outroItemTipoManutencao === 'corretiva' && (
                    <Field label="Status">
                      <select style={inputStyle} value={outroItemStatus} onChange={(e) => setOutroItemStatus(e.target.value)}>
                        <option value="aguardando">Aguardando</option>
                        <option value="andamento">Andamento</option>
                        <option value="resolvido">Resolvido</option>
                      </select>
                    </Field>
                  )}
                </div>
              )}

              {outroAtividade !== 'diagnostico' && (
                <Field label={outroAtividade === 'seguranca_trabalho' ? 'Detalhes' : 'Descrição (reunião, ajuste de documento, etc.)'}>
                  <textarea style={{ ...inputStyle, minHeight: 70 }} value={outroTexto} onChange={(e) => setOutroTexto(e.target.value)} />
                </Field>
              )}

              <FotosField fotos={outroFotos} setFotos={setOutroFotos} />
              <button type="submit" disabled={!canEdit || savingOutro} style={{ ...btnStyle, opacity: savingOutro ? 0.7 : 1 }}>
                {savingOutro ? 'Salvando...' : 'Adicionar à visita'}
              </button>
            </form>
          )}

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Itens adicionados agora ({itensVisita.length})</h4>
            {itemsFromVisita(visita).length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Essa visita já tinha {itemsFromVisita(visita).length} item(ns) salvos antes — eles continuam lá, essa lista mostra só o que você está adicionando agora.
              </p>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {itensVisita.map((it, idx) => (
                <div key={idx} style={{ ...cardStyle, padding: 10 }}>
                  <ItemResumo item={it} />
                </div>
              ))}
              {itensVisita.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum item ainda.</p>}
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <h3 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reportMode ? 'Relatórios disponíveis' : 'Visitas anteriores'}</h3>
          {reportMode && !loadingVisitas && (
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {visitasFiltradas.length} {visitasFiltradas.length === 1 ? 'relatório' : 'relatórios'}
            </span>
          )}
        </div>

        <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          {!reportMode && (
            <>
              <div style={{ minWidth: 160 }}>
                <span style={labelStyle}>Técnico</span>
                <input style={inputStyle} value={filtroTecnico} onChange={(e) => setFiltroTecnico(e.target.value)} placeholder="Buscar técnico..." />
              </div>
              <div style={{ minWidth: 160 }}>
                <span style={labelStyle}>Painel</span>
                <select style={inputStyle} value={filtroPainelId} onChange={(e) => setFiltroPainelId(e.target.value)}>
                  <option value="">Todos os painéis</option>
                  {panelOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div style={{ minWidth: 140 }}>
            <span style={labelStyle}>{reportMode ? 'De (data)' : 'De'}</span>
            <input type="date" style={inputStyle} value={filtroDataDe} onChange={(e) => setFiltroDataDe(e.target.value)} />
          </div>
          <div style={{ minWidth: 140 }}>
            <span style={labelStyle}>{reportMode ? 'Até (data)' : 'Até'}</span>
            <input type="date" style={inputStyle} value={filtroDataAte} onChange={(e) => setFiltroDataAte(e.target.value)} />
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>
            {reportMode ? 'Baixar um período inteiro em PDF (relatórios agrupados por dia)' : 'Imprimir período (várias visitas de uma vez, agrupadas por dia)'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 140 }}>
              <span style={labelStyle}>De</span>
              <input type="date" style={inputStyle} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
            </div>
            <div style={{ minWidth: 140 }}>
              <span style={labelStyle}>Até</span>
              <input type="date" style={inputStyle} value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
            </div>
            <button type="button" onClick={imprimirPeriodo} className={reportMode ? 'rvt-report-cta' : undefined} style={btnStyle}>
              {reportMode ? 'Gerar PDF do período' : 'Gerar impressão do período'}
            </button>
          </div>
        </div>

        {loadingVisitas && (
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ width: '45%', height: 14 }} />
                <div className="skeleton" style={{ width: '25%', height: 11 }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: reportMode ? 12 : 18 }}>
          {!loadingVisitas && diasVisitas.map((dia, idx) => (
            <div key={dia} className={reportMode ? 'rvt-report-group' : undefined} style={reportMode ? { '--i': Math.min(idx, 6) } : undefined}>
              {!reportMode && (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {formatDateBR(dia)}
                </p>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                {visitasFiltradas.filter((v) => v.data_visita === dia).map((v) => (
                  <VisitaCard key={v.id} visita={v} panelOptions={panelOptions} canEdit={canEdit} deviceOptions={deviceOptions} reportMode={reportMode}
                    expanded={expandedIds.has(v.id)} onToggleExpand={() => toggleExpand(v.id)}
                    onDelete={handleDeleteVisita} onVerImprimir={(vv) => setPrintTarget([vv])} onReopen={reabrirVisita}
                    editingItemId={editingItemId} editForm={editForm} setEditForm={setEditForm}
                    onStartEdit={startEditItem} onSaveEdit={saveEditItem} onCancelEdit={cancelEditItem} onConvertOutro={converterItemOutro} savingEdit={savingEditItem} />
                ))}
              </div>
            </div>
          ))}
          {!loadingVisitas && diasVisitas.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {reportMode
                ? 'Nenhum relatório por aqui ainda. Assim que uma visita técnica for concluída, o relatório aparece nesta lista.'
                : 'Nenhuma visita encontrada.'}
            </p>
          )}
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
