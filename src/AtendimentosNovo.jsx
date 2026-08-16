import { useEffect, useState, useCallback, useRef } from 'react';
import {
  createVisita, createAtendimento, createInspecao, addOutroToVisita, listVisitas, deleteVisita,
  getMetodoTeste, FUNCTIONAL_CATEGORY_MAP, PAPEL_SINAL_MAP, DEVICE_TYPE_LABELS,
} from './supabaseAdapter';

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--surface)' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
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

export default function AtendimentosNovo({ data, clientId, canEdit, onRefresh }) {
  const deviceOptions = buildDeviceOptions(data);
  const panelOptions = data.panels || [];

  const [visita, setVisita] = useState(null);
  const [itensVisita, setItensVisita] = useState([]);
  const [aba, setAba] = useState('manutencao');
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

  const [atForm, setAtForm] = useState({ dispositivoId: '', falha: '', status: 'aguardando', descritivo: '' });
  const [atFotos, setAtFotos] = useState([]);
  async function submitAtendimento(e) {
    e.preventDefault();
    if (!atForm.dispositivoId) { setMsg('Selecione um dispositivo.'); return; }
    try {
      const result = await createAtendimento({ ...atForm, tecnico: visita.tecnico, rvtId: visita.id, fotos: atFotos });
      const label = deviceOptions.find((o) => o.id === atForm.dispositivoId)?.label || '';
      setItensVisita((prev) => [...prev, { tipo: 'atendimento', falha: result.falha, status: result.status, dispositivoLabel: label, fotos: result.fotos }]);
      setAtForm({ dispositivoId: '', falha: '', status: 'aguardando', descritivo: '' });
      setAtFotos([]);
      if (onRefresh) onRefresh();
      setMsg('Item adicionado à visita.');
    } catch (err) {
      console.error(err);
      setMsg('Erro ao registrar atendimento.');
    }
  }

  const [inspForm, setInspForm] = useState({
    dispositivoId: '', resultadoTeste: 'Aprovado', aparencia: 'Ótimo',
    comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '',
    metodo: '', proximaInspecao: '',
  });
  const [inspFotos, setInspFotos] = useState([]);
  const inspDevice = deviceOptions.find((o) => o.id === inspForm.dispositivoId);
  const inspMetodo = inspDevice ? getMetodoTeste(inspDevice) : '';
  const inspCategoriaLabel = inspDevice ? (FUNCTIONAL_CATEGORY_MAP[inspDevice.categoriaFuncional] || '') : '';
  const inspPapelLabel = inspDevice ? (PAPEL_SINAL_MAP[inspDevice.papelSinal] || '') : '';
  useEffect(() => {
    setInspForm((prev) => ({ ...prev, metodo: inspMetodo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspForm.dispositivoId]);
  async function submitInspecao(e) {
    e.preventDefault();
    if (!inspForm.dispositivoId) { setMsg('Selecione um dispositivo.'); return; }
    try {
      const result = await createInspecao({
        ...inspForm, tecnico: visita.tecnico, dataInspecao: visita.data_visita, rvtId: visita.id, fotos: inspFotos,
      });
      const label = deviceOptions.find((o) => o.id === inspForm.dispositivoId)?.label || '';
      setItensVisita((prev) => [...prev, {
        tipo: 'inspecao', resultado: result.inspecao.resultado_teste, dispositivoLabel: label,
        criouCorretiva: !!result.atendimento, fotos: result.inspecao.fotos,
      }]);
      setInspForm({
        dispositivoId: '', resultadoTeste: 'Aprovado', aparencia: 'Ótimo',
        comunicacaoLocal: 'Conforme', comunicacaoRede: 'Conforme', observacoes: '', falha: '',
        metodo: '', proximaInspecao: '',
      });
      setInspFotos([]);
      if (onRefresh) onRefresh();
      setMsg(result.atendimento ? 'Inspeção adicionada — corretiva criada automaticamente.' : 'Item adicionado à visita.');
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Visitas técnicas (modelo novo)</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Uma visita pode reunir manutenções, inspeções e outros itens (reuniões, ajustes). Roda em paralelo ao Indicador/RVT antigos.
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

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setAba('manutencao')} style={tabBtnStyle(aba === 'manutencao')}>+ Manutenção</button>
            <button onClick={() => setAba('inspecao')} style={tabBtnStyle(aba === 'inspecao')}>+ Inspeção</button>
            <button onClick={() => setAba('outro')} style={tabBtnStyle(aba === 'outro')}>+ Outro</button>
          </div>

          {aba === 'manutencao' && (
            <form onSubmit={submitAtendimento} style={{ ...cardStyle, marginBottom: 16 }}>
              <Field label="Dispositivo">
                <select style={inputStyle} value={atForm.dispositivoId} onChange={(e) => setAtForm({ ...atForm, dispositivoId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {deviceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
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
              <button type="submit" disabled={!canEdit} style={btnStyle}>Adicionar à visita</button>
            </form>
          )}

          {aba === 'inspecao' && (
            <form onSubmit={submitInspecao} style={{ ...cardStyle, marginBottom: 16 }}>
              <Field label="Dispositivo">
                <select style={inputStyle} value={inspForm.dispositivoId} onChange={(e) => setInspForm({ ...inspForm, dispositivoId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {deviceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
              {(inspCategoriaLabel || inspMetodo) && (
                <div style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {inspCategoriaLabel && <div>Categoria: <strong style={{ color: 'var(--text-primary)' }}>{inspCategoriaLabel}</strong>{inspPapelLabel && ` · Papel do sinal: ${inspPapelLabel}`}</div>}
                  {inspMetodo && <div>Método de teste: <strong style={{ color: 'var(--text-primary)' }}>{inspMetodo}</strong></div>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <Field label="Falha (se preenchida, cria corretiva automática)">
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={inspForm.falha} onChange={(e) => setInspForm({ ...inspForm, falha: e.target.value })} />
              </Field>
              <Field label="Próxima inspeção">
                <input type="date" style={inputStyle} value={inspForm.proximaInspecao} onChange={(e) => setInspForm({ ...inspForm, proximaInspecao: e.target.value })} />
              </Field>
              <FotosField fotos={inspFotos} setFotos={setInspFotos} />
              <button type="submit" disabled={!canEdit} style={btnStyle}>Adicionar à visita</button>
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
        {loadingVisitas && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {visitas.map((v) => (
            <div key={v.id} style={cardStyle}>
              {canEdit && (
                <button type="button" onClick={() => handleDeleteVisita(v.id)}
                  style={{ float: 'right', background: 'transparent', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                  Excluir
                </button>
              )}
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                {v.data_visita} · {v.tecnico || 'sem técnico'} · {(v.rvt_itens || []).length} item(ns)
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {(v.rvt_itens || []).map((it) => {
                  if (it.outro_descricao) return <div key={it.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Outro · {it.outro_descricao}</div>;
                  if (it.atendimentos) return (
                    <div key={it.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {it.atendimentos.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'} · {it.atendimentos.status} · {it.atendimentos.dispositivos?.etiqueta || it.atendimentos.dispositivos?.endereco}
                      {(it.atendimentos.fotos || []).length > 0 && ` · ${it.atendimentos.fotos.length} foto(s)`}
                    </div>
                  );
                  if (it.inspecoes) return (
                    <div key={it.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Inspeção · {it.inspecoes.resultado_teste} · {it.inspecoes.dispositivos?.etiqueta || it.inspecoes.dispositivos?.endereco}
                      {(it.inspecoes.fotos || []).length > 0 && ` · ${it.inspecoes.fotos.length} foto(s)`}
                    </div>
                  );
                  return null;
                })}
              </div>
            </div>
          ))}
          {!loadingVisitas && visitas.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma visita registrada ainda.</p>}
        </div>
      </div>
    </div>
  );
}
