import { useEffect, useState, useCallback, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  createVisita, createAtendimento, createInspecao, addOutroToVisita, listVisitas, deleteVisita,
  updateAtendimento, updateInspecao, updateOutroItem,
  getMetodoTeste, FUNCTIONAL_CATEGORY_MAP, DEVICE_TYPE_LABELS,
  COMBATE_CONJUNTO_TIPOS, COMBATE_COMPONENTE_TIPO_MAP, conjuntoSubitemInfo,
  updateCombateSubitem, updateCombateComponente, updateCombateCilindro, createCombateHistorico,
} from './supabaseAdapter';

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--surface)' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' };
const tabBtnStyle = (active) => ({
  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
  background: active ? '#8B2F2F' : 'var(--surface)', color: active ? '#fff' : 'var(--text-primary)', fontSize: 13, fontWeight: 600,
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

function statusColor(status) {
  if (status === 'Resolvido') return 'var(--status-ok)';
  if (status === 'Andamento') return 'var(--status-warn, #f59f00)';
  if (status === 'Aguardando') return 'var(--status-danger)';
  return 'var(--text-secondary)';
}

function filesToBase64(fileList) {
  return Promise.all(Array.from(fileList).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function FotosField({ fotos, setFotos }) {
  const inputRef = useRef(null);
  async function handleChange(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    const novas = await filesToBase64(e.target.files);
    setFotos((prev) => [...prev, ...novas]);
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

function buildDeviceOptions(data) {
  const options = [];
  (data.devices || []).forEach((d) => {
    const loop = (data.loops || []).find((l) => l.id === d.loopId);
    const panel = loop && (data.panels || []).find((p) => p.id === loop.panelId);
    options.push({
      id: d.id, label: `${d.description || DEVICE_TYPE_LABELS[d.type] || 'Dispositivo'} — End. ${d.address}${panel ? ' · ' + panel.name : ''}`,
      type: d.type, categoriaFuncional: d.categoriaFuncional, papelSinal: d.papelSinal,
    });
  });
  (data.nacs || []).forEach((n) => {
    const panel = (data.panels || []).find((p) => p.id === n.panelId);
    options.push({ id: n.id, label: `${n.name} (NAC)${panel ? ' · ' + panel.name : ''}`, type: 'saida' });
  });
  (data.gasDetectors || []).forEach((g) => {
    options.push({ id: g.id, label: `${g.name} (Detector de gás)`, type: 'gasDetector' });
  });
  return options;
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
    return <div style={{ fontSize: 13 }}><strong>Outro</strong> · {item.descricao}</div>;
  }
  if (item.tipo === 'atendimento') {
    return (
      <div style={{ fontSize: 13 }}>
        <strong style={{ color: item.falha ? 'var(--status-danger)' : 'var(--status-ok)' }}>
          {item.falha ? 'Corretiva' : 'Preventiva'}
        </strong> · {item.status} · {item.dispositivoLabel}{nFotos > 0 && ` · ${nFotos} foto(s)`}
        {item.falha && <div style={{ color: 'var(--text-secondary)' }}>{item.falha}</div>}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13 }}>
      <strong>Inspeção</strong> · {item.resultado} · {item.dispositivoLabel}{nFotos > 0 && ` · ${nFotos} foto(s)`}
      {item.criouCorretiva && <div style={{ color: 'var(--status-danger)' }}>↳ gerou corretiva automática</div>}
    </div>
  );
}

/** Buscador + seleção múltipla de dispositivos — mesmo padrão de "Marcar todos" por tipo
    já usado na tela de Painéis (Laço inteiro / por tipo), calculado dinamicamente a partir
    dos tipos realmente presentes na lista filtrada (então Entrada Duplo, por ex., já entra sozinho). */
function DeviceMultiSelect({ options, selectedIds, setSelectedIds }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const tiposPresentes = [...new Set(filtered.map((o) => o.type))];

  function tipoLabel(tipo) {
    if (tipo === 'gasDetector') return 'Detector de gás';
    return DEVICE_TYPE_LABELS[tipo] || tipo;
  }
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
      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum dispositivo encontrado.</div>
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
    if (it.outro_descricao !== null && it.outro_descricao !== undefined) {
      return { id: it.id, tipo: 'outro', etiqueta: 'Outro', status: 'Resolvido', descritivo: it.outro_descricao, fotos: [] };
    }
    if (it.atendimentos) {
      const a = it.atendimentos;
      return {
        id: it.id, tipo: 'atendimento',
        etiqueta: a.dispositivos?.etiqueta || a.dispositivos?.endereco || 'Dispositivo',
        endereco: a.dispositivos?.endereco || '',
        falha: a.falha || '', descritivo: a.descritivo || '',
        status: a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : '',
        fotos: a.fotos || [],
      };
    }
    if (it.inspecoes) {
      const i = it.inspecoes;
      return {
        id: it.id, tipo: 'inspecao',
        etiqueta: i.dispositivos?.etiqueta || i.dispositivos?.endereco || 'Dispositivo',
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
                {itensDoDia.map((it, i) => (
                  <div key={it.id} className="rvt-item-card rounded-lg p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', breakInside: 'avoid' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: '#8B2F2F', color: '#fff' }}>{i + 1}</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{it.etiqueta}{it.endereco ? ` · END ${it.endereco}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, flexShrink: 0, fontWeight: 600, color: statusColor(it.status), border: `1px solid ${statusColor(it.status)}` }}>
                        {it.status || 'Sem status'}
                      </span>
                    </div>
                    {it.falha && (
                      <div style={{ marginBottom: 6 }}>
                        <RvtFieldLabelLocal>Falha</RvtFieldLabelLocal>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{it.falha}</p>
                      </div>
                    )}
                    {it.descritivo && (
                      <div style={{ marginBottom: 6 }}>
                        <RvtFieldLabelLocal>{it.tipo === 'inspecao' ? 'Resultado / Método' : 'Descritivo'}</RvtFieldLabelLocal>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.descritivo}</p>
                      </div>
                    )}
                    {it.fotos && it.fotos.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <RvtFieldLabelLocal>Registro fotográfico</RvtFieldLabelLocal>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
                          {it.fotos.map((f, fi) => <img key={fi} src={f} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

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

/** Formulário inline de edição de 1 item de visita — o tipo de campos muda conforme
    o tipo do item (atendimento / inspeção / outro). */
function EditItemForm({ editForm, setEditForm, onSave, onCancel }) {
  if (!editForm) return null;
  if (editForm.kind === 'outro') {
    return (
      <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
        <Field label="Descrição">
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
        </Field>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onSave} style={btnStyle}>Salvar</button>
          <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
        </div>
      </div>
    );
  }
  if (editForm.kind === 'atendimento') {
    return (
      <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
        <Field label="Falha (deixe em branco para preventiva)">
          <textarea style={{ ...inputStyle, minHeight: 50 }} value={editForm.falha} onChange={(e) => setEditForm({ ...editForm, falha: e.target.value })} />
        </Field>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onSave} style={btnStyle}>Salvar</button>
          <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
        </div>
      </div>
    );
  }
  // inspecao
  return (
    <div style={{ ...cardStyle, marginTop: 8, padding: 10 }}>
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
      <Field label="Falha (se preenchida, cria/mantém corretiva)">
        <textarea style={{ ...inputStyle, minHeight: 50 }} value={editForm.falha} onChange={(e) => setEditForm({ ...editForm, falha: e.target.value })} />
      </Field>
      <Field label="Próxima inspeção">
        <input type="date" style={inputStyle} value={editForm.proximaInspecao} onChange={(e) => setEditForm({ ...editForm, proximaInspecao: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onSave} style={btnStyle}>Salvar</button>
        <button type="button" onClick={onCancel} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Cancelar</button>
      </div>
    </div>
  );
}

/** Card de 1 visita anterior — colapsado por padrão (só resumo), com seta pra expandir
    a lista de itens, e nesse modo expandido dá pra editar item por item. */
function VisitaCard({ visita, panelOptions, canEdit, expanded, onToggleExpand, onDelete, onVerImprimir, editingItemId, editForm, setEditForm, onStartEdit, onSaveEdit, onCancelEdit }) {
  const itens = itemsFromVisita(visita);
  const nManutencao = itens.filter((it) => it.tipo === 'atendimento').length;
  const nInspecao = itens.filter((it) => it.tipo === 'inspecao').length;
  const nOutro = itens.filter((it) => it.tipo === 'outro').length;
  const painel = panelOptions.find((p) => p.id === visita.painel_id);

  return (
    <div style={cardStyle}>
      <button type="button" onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, padding: 0, width: '100%', textAlign: 'left' }}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }}>{expanded ? '▾' : '▸'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
            {formatDateBR(visita.data_visita)} · {visita.tecnico || 'sem técnico'}{painel ? ` · ${painel.name}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {itens.length} item(ns){nManutencao > 0 && ` · ${nManutencao} manutenção(ões)`}{nInspecao > 0 && ` · ${nInspecao} inspeção(ões)`}{nOutro > 0 && ` · ${nOutro} outro(s)`}
          </div>
        </div>
      </button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" onClick={() => onVerImprimir(visita)} style={smallBtnStyle}>Ver / Imprimir</button>
        {canEdit && (
          <button type="button" onClick={onToggleExpand} style={smallBtnStyle}>Editar</button>
        )}
        {canEdit && (
          <button type="button" onClick={() => onDelete(visita.id)}
            style={{ ...smallBtnStyle, border: '1px solid var(--status-danger)', color: 'var(--status-danger)' }}>
            Excluir
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ display: 'grid', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {itens.map((it) => (
            <div key={it.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}><ItemResumo item={{ ...it, dispositivoLabel: it.etiqueta, resultado: it.status }} /></div>
                {canEdit && editingItemId !== it.id && (
                  <button type="button" onClick={() => onStartEdit(visita, it)} style={{ ...smallBtnStyle, flexShrink: 0 }}>Editar item</button>
                )}
              </div>
              {editingItemId === it.id && (
                <EditItemForm editForm={editForm} setEditForm={setEditForm} onSave={onSaveEdit} onCancel={onCancelEdit} />
              )}
            </div>
          ))}
          {itens.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum item nesta visita.</p>}
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
      <form onSubmit={submitVistoria} style={cardStyle}>
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
        <button type="submit" disabled={!canEdit || saving} style={btnStyle}>
          {saving ? 'Salvando...' : `Registrar vistoria${selectedIds.length > 1 ? ` (${selectedIds.length} itens)` : ''}`}
        </button>
      </form>
    </div>
  );
}

export default function AtendimentosNovo({ data, client, clientId, canEdit, onRefresh }) {
  const deviceOptions = buildDeviceOptions(data);
  const panelOptions = data.panels || [];

  const [visita, setVisita] = useState(null);
  const [itensVisita, setItensVisita] = useState([]);
  const [aba, setAba] = useState('manutencao');
  const [subAba, setSubAba] = useState('dispositivos');
  const [msg, setMsg] = useState('');

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

  const [atForm, setAtForm] = useState({ dispositivoIds: [], falha: '', status: 'aguardando', descritivo: '' });
  const [atFotos, setAtFotos] = useState([]);
  async function submitAtendimento(e) {
    e.preventDefault();
    if (atForm.dispositivoIds.length === 0) { setMsg('Selecione ao menos um dispositivo.'); return; }
    try {
      const novosItens = [];
      for (const dispositivoId of atForm.dispositivoIds) {
        const result = await createAtendimento({
          dispositivoId, falha: atForm.falha, status: atForm.status, descritivo: atForm.descritivo,
          tecnico: visita.tecnico, rvtId: visita.id, fotos: atFotos,
        });
        const label = deviceOptions.find((o) => o.id === dispositivoId)?.label || '';
        novosItens.push({ tipo: 'atendimento', falha: result.falha, status: result.status, dispositivoLabel: label, fotos: result.fotos });
      }
      setItensVisita((prev) => [...prev, ...novosItens]);
      setAtForm({ dispositivoIds: [], falha: '', status: 'aguardando', descritivo: '' });
      setAtFotos([]);
      if (onRefresh) onRefresh();
      setMsg(`${novosItens.length} item(ns) adicionado(s) à visita.`);
    } catch (err) {
      console.error(err);
      setMsg('Erro ao registrar atendimento.');
    }
  }

  const [inspForm, setInspForm] = useState({
    dispositivoIds: [], resultadoTeste: 'Aprovado', aparencia: 'Ótimo',
    comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '',
    proximaInspecao: '',
  });
  const [inspFotos, setInspFotos] = useState([]);
  const inspDevicesSelecionados = deviceOptions.filter((o) => inspForm.dispositivoIds.includes(o.id));
  const inspMetodosUnicos = [...new Set(inspDevicesSelecionados.map((d) => getMetodoTeste(d)).filter(Boolean))];
  const inspCategoriasUnicas = [...new Set(inspDevicesSelecionados.map((d) => FUNCTIONAL_CATEGORY_MAP[d.categoriaFuncional]).filter(Boolean))];
  async function submitInspecao(e) {
    e.preventDefault();
    if (inspForm.dispositivoIds.length === 0) { setMsg('Selecione ao menos um dispositivo.'); return; }
    try {
      const novosItens = [];
      let corretivasGeradas = 0;
      for (const dispositivoId of inspForm.dispositivoIds) {
        const device = deviceOptions.find((o) => o.id === dispositivoId);
        const result = await createInspecao({
          dispositivoId, tecnico: visita.tecnico, resultadoTeste: inspForm.resultadoTeste, aparencia: inspForm.aparencia,
          comunicacaoLocal: inspForm.comunicacaoLocal, comunicacaoRede: inspForm.comunicacaoRede,
          observacoes: inspForm.observacoes, falha: inspForm.falha, metodo: getMetodoTeste(device),
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
        comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '',
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
    }
  }

  const [outroTexto, setOutroTexto] = useState('');
  async function submitOutro(e) {
    e.preventDefault();
    if (!outroTexto.trim()) return;
    try {
      await addOutroToVisita(visita.id, outroTexto.trim());
      setItensVisita((prev) => [...prev, { tipo: 'outro', descricao: outroTexto.trim() }]);
      setOutroTexto('');
      if (onRefresh) onRefresh();
      setMsg('Item adicionado à visita.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao adicionar item.');
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

  function startEditItem(v, item) {
    const raw = (v.rvt_itens || []).find((it) => it.id === item.id);
    if (!raw) return;
    if (raw.outro_descricao !== null && raw.outro_descricao !== undefined) {
      setEditForm({ kind: 'outro', rvtItemId: raw.id, descricao: raw.outro_descricao });
    } else if (raw.atendimentos) {
      const a = raw.atendimentos;
      setEditForm({ kind: 'atendimento', id: a.id, falha: a.falha || '', status: a.status || 'aguardando', descritivo: a.descritivo || '' });
    } else if (raw.inspecoes) {
      const i = raw.inspecoes;
      setEditForm({
        kind: 'inspecao', id: i.id, resultadoTeste: i.resultado_teste || '', aparencia: i.aparencia || '',
        comunicacaoLocal: i.comunicacao_local || '', comunicacaoRede: i.comunicacao_rede || '',
        observacoes: i.observacoes || '', falha: i.falha || '', proximaInspecao: i.proxima_inspecao || '',
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
    try {
      if (editForm.kind === 'atendimento') {
        await updateAtendimento(editForm.id, { falha: editForm.falha, status: editForm.status, descritivo: editForm.descritivo });
      } else if (editForm.kind === 'inspecao') {
        await updateInspecao(editForm.id, {
          resultadoTeste: editForm.resultadoTeste, aparencia: editForm.aparencia,
          comunicacaoLocal: editForm.comunicacaoLocal, comunicacaoRede: editForm.comunicacaoRede,
          observacoes: editForm.observacoes, falha: editForm.falha, proximaInspecao: editForm.proximaInspecao,
        });
      } else if (editForm.kind === 'outro') {
        await updateOutroItem(editForm.rvtItemId, editForm.descricao);
      }
      cancelEditItem();
      refreshVisitas();
      if (onRefresh) onRefresh();
      setMsg('Item atualizado.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao salvar edição.');
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setSubAba('dispositivos')} style={tabBtnStyle(subAba === 'dispositivos')}>Visitas (SDAI)</button>
        <button onClick={() => setSubAba('combate')} style={tabBtnStyle(subAba === 'combate')}>Visitas (Sistemas de Combate)</button>
      </div>
      {subAba === 'combate' && (
        <VisitaCombateView data={data} clientId={clientId} canEdit={canEdit} onRefresh={onRefresh} />
      )}
      {subAba === 'dispositivos' && (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Visitas técnicas</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Uma visita pode reunir manutenções, inspeções e outros itens (reuniões, ajustes).
        </p>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {!visita ? (
        <form onSubmit={iniciarVisita} style={{ ...cardStyle, maxWidth: 420 }}>
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
      ) : (
        <div>
          <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Visita em andamento — {visita.tecnico || 'sem técnico'} · {visita.data_visita}
              {panelOptions.find((p) => p.id === visita.painel_id) && ` · ${panelOptions.find((p) => p.id === visita.painel_id).name}`}
            </div>
            <button onClick={finalizarVisita} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              Finalizar visita
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setAba('manutencao')} style={tabBtnStyle(aba === 'manutencao')}>+ Manutenção</button>
            <button onClick={() => setAba('inspecao')} style={tabBtnStyle(aba === 'inspecao')}>+ Inspeção</button>
            <button onClick={() => setAba('outro')} style={tabBtnStyle(aba === 'outro')}>+ Outro</button>
          </div>

          {aba === 'manutencao' && (
            <form onSubmit={submitAtendimento} style={{ ...cardStyle, marginBottom: 16 }}>
              <DeviceMultiSelect options={deviceOptions} selectedIds={atForm.dispositivoIds}
                setSelectedIds={(next) => setAtForm((prev) => ({ ...prev, dispositivoIds: typeof next === 'function' ? next(prev.dispositivoIds) : next }))} />
              <Field label="Falha (deixe em branco para preventiva)">
                <textarea style={{ ...inputStyle, minHeight: 60 }} value={atForm.falha} onChange={(e) => setAtForm({ ...atForm, falha: e.target.value })} />
              </Field>
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
              <button type="submit" disabled={!canEdit} style={btnStyle}>
                Adicionar à visita{atForm.dispositivoIds.length > 1 ? ` (${atForm.dispositivoIds.length} itens)` : ''}
              </button>
            </form>
          )}

          {aba === 'inspecao' && (
            <form onSubmit={submitInspecao} style={{ ...cardStyle, marginBottom: 16 }}>
              <DeviceMultiSelect options={deviceOptions} selectedIds={inspForm.dispositivoIds}
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
              <Field label="Falha (se preenchida, cria corretiva automática em todos os selecionados)">
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={inspForm.falha} onChange={(e) => setInspForm({ ...inspForm, falha: e.target.value })} />
              </Field>
              <Field label="Próxima inspeção">
                <input type="date" style={inputStyle} value={inspForm.proximaInspecao} onChange={(e) => setInspForm({ ...inspForm, proximaInspecao: e.target.value })} />
              </Field>
              <FotosField fotos={inspFotos} setFotos={setInspFotos} />
              <button type="submit" disabled={!canEdit} style={btnStyle}>
                Adicionar à visita{inspForm.dispositivoIds.length > 1 ? ` (${inspForm.dispositivoIds.length} itens)` : ''}
              </button>
            </form>
          )}

          {aba === 'outro' && (
            <form onSubmit={submitOutro} style={{ ...cardStyle, marginBottom: 16 }}>
              <Field label="Descrição (reunião, ajuste de documento, etc.)">
                <textarea style={{ ...inputStyle, minHeight: 70 }} value={outroTexto} onChange={(e) => setOutroTexto(e.target.value)} />
              </Field>
              <button type="submit" disabled={!canEdit} style={btnStyle}>Adicionar à visita</button>
            </form>
          )}

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Itens desta visita ({itensVisita.length})</h4>
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
      )}

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Visitas anteriores</h3>

        <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
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
          <div style={{ minWidth: 140 }}>
            <span style={labelStyle}>De</span>
            <input type="date" style={inputStyle} value={filtroDataDe} onChange={(e) => setFiltroDataDe(e.target.value)} />
          </div>
          <div style={{ minWidth: 140 }}>
            <span style={labelStyle}>Até</span>
            <input type="date" style={inputStyle} value={filtroDataAte} onChange={(e) => setFiltroDataAte(e.target.value)} />
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <span style={{ ...labelStyle, marginBottom: 8 }}>Imprimir período (várias visitas de uma vez, agrupadas por dia)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 140 }}>
              <span style={labelStyle}>De</span>
              <input type="date" style={inputStyle} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
            </div>
            <div style={{ minWidth: 140 }}>
              <span style={labelStyle}>Até</span>
              <input type="date" style={inputStyle} value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
            </div>
            <button type="button" onClick={imprimirPeriodo} style={btnStyle}>Gerar impressão do período</button>
          </div>
        </div>

        {loadingVisitas && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</p>}
        <div style={{ display: 'grid', gap: 18 }}>
          {diasVisitas.map((dia) => (
            <div key={dia}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {formatDateBR(dia)}
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {visitasFiltradas.filter((v) => v.data_visita === dia).map((v) => (
                  <VisitaCard key={v.id} visita={v} panelOptions={panelOptions} canEdit={canEdit}
                    expanded={expandedIds.has(v.id)} onToggleExpand={() => toggleExpand(v.id)}
                    onDelete={handleDeleteVisita} onVerImprimir={(vv) => setPrintTarget([vv])}
                    editingItemId={editingItemId} editForm={editForm} setEditForm={setEditForm}
                    onStartEdit={startEditItem} onSaveEdit={saveEditItem} onCancelEdit={cancelEditItem} />
                ))}
              </div>
            </div>
          ))}
          {!loadingVisitas && diasVisitas.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma visita encontrada.</p>}
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
