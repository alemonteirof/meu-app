import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listItensSemPendencia, contarPendenciasSemDetalhe, salvarPendencia,
  listPendenciasDetalhadas, listPendencias, listNomesMateriais, listVisitas,
  PENDENCIA_TIPOS, PENDENCIA_RESPONSAVEIS,
} from '../supabaseAdapter';
import { PendenciaForm, pendenciaSemDetalhe, tipoPendenciaLabel, responsavelLabel } from './Pendencias';
import { localDaPendencia } from './PendenciasIndicador';

// TELA TEMPORÁRIA (só admin) — 3 abas: Classificar (itens antigos em Aguardando/Andamento sem
// pendência → Tipo(s) + Responsável em massa), Completar detalhe (pendências "sem detalhe") e
// Reenviar RVTs (visitas cujo RVT agora mostra pendências, p/ imprimir e mandar de novo ao cliente).
// REMOVER INTEIRA quando tudo estiver classificado: item 'classificar' de NAV_ITEMS e
// NAV_KEYS_BY_ROLE.admin + render da view em App.jsx + este arquivo (+ exports
// visitaTemPendencias/VisitaPrintView em AtendimentosNovo e listItensSemPendencia/
// contarPendenciasSemDetalhe no adapter, se não forem usados em outro lugar).

const inputStyle = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' };

function formatDateBR(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Itens selecionados viram pendências: os que formavam um grupo na mesma visita (mesma
    falha + descritivo, ex.: 5 sirenes do mesmo diagnóstico) ganham UMA pendência
    compartilhada; o resto ganha uma pendência cada. */
export function agruparParaPendencia(itens) {
  const grupos = new Map();
  for (const it of itens) {
    const chave = it.alvo.atendimentoId && it.rvtId
      ? `${it.clienteId}|${it.rvtId}|${it.falha}|${it.descritivo}`
      : it.chave;
    const g = grupos.get(chave) || { clienteId: it.clienteId, rvtId: it.rvtId, desde: it.dataVisita, alvos: [] };
    g.alvos.push(it.alvo);
    if (it.dataVisita && (!g.desde || it.dataVisita < g.desde)) g.desde = it.dataVisita;
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

function LinhaItem({ it, marcado, onToggle }) {
  const [verTudo, setVerTudo] = useState(false);
  const texto = [it.falha && `Falha: ${it.falha}`, it.descritivo && `Descritivo: ${it.descritivo}`].filter(Boolean).join('\n');
  const longo = texto.length > 220;
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', alignItems: 'start', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', cursor: 'pointer', background: marcado ? 'rgba(139,47,47,.10)' : 'transparent' }}>
      <input type="checkbox" checked={marcado} onChange={onToggle} style={{ marginTop: 3 }} />
      <div style={{ minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ wordBreak: 'break-word' }}>{[it.painel, it.laco, it.alvoLabel].filter(Boolean).join(' · ')}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Visita {formatDateBR(it.dataVisita)} · {it.status === 'andamento' ? 'Andamento' : 'Aguardando'}
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{it.cliente}</div>
        {texto && (
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5 }}>
            {longo && !verTudo ? `${texto.slice(0, 220)}…` : texto}
            {longo && (
              <button type="button" onClick={(e) => { e.preventDefault(); setVerTudo((v) => !v); }}
                style={{ ...smallBtnStyle, border: 'none', padding: '0 4px', color: '#8B2F2F' }}>{verTudo ? 'ver menos' : 'ver tudo'}</button>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

const tabBtn = (ativo) => ({
  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  background: ativo ? '#8B2F2F' : 'var(--surface)', color: ativo ? '#fff' : 'var(--text-primary)',
});

export default function ClassificarPendencias({ clienteAtualId, client }) {
  const [aba, setAba] = useState('classificar');
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={tabBtn(aba === 'classificar')} onClick={() => setAba('classificar')}>Classificar</button>
        <button type="button" style={tabBtn(aba === 'completar')} onClick={() => setAba('completar')}>Completar detalhe</button>
        <button type="button" style={tabBtn(aba === 'reenviar')} onClick={() => setAba('reenviar')}>Reenviar RVTs</button>
      </div>
      {aba === 'classificar' && <AbaClassificar clienteAtualId={clienteAtualId} />}
      {aba === 'completar' && <AbaCompletar clientId={clienteAtualId} client={client} />}
      {aba === 'reenviar' && <AbaReenviar clientId={clienteAtualId} client={client} />}
    </div>
  );
}

function TextoLongo({ texto, limite = 220 }) {
  const [verTudo, setVerTudo] = useState(false);
  if (!texto) return null;
  const longo = texto.length > limite;
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, color: 'var(--text-primary)' }}>
      {longo && !verTudo ? `${texto.slice(0, limite)}…` : texto}
      {longo && (
        <button type="button" onClick={() => setVerTudo((v) => !v)} style={{ ...smallBtnStyle, border: 'none', padding: '0 4px', color: '#8B2F2F' }}>
          {verTudo ? 'ver menos' : 'ver tudo'}
        </button>
      )}
    </div>
  );
}

/** Aba "Completar detalhe": pendências abertas sem detalhe do cliente aberto, com o contexto do
    item (falha + descritivo antigo, onde o técnico escreveu em texto livre o que faltava). */
function AbaCompletar({ clientId, client }) {
  const [lista, setLista] = useState([]);
  const [nomes, setNomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, n] = await Promise.all([listPendenciasDetalhadas(clientId), listNomesMateriais()]);
      setLista(l); setNomes(n);
    } catch (e) {
      console.error(e);
      setMsg('Não foi possível carregar as pendências.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { carregar(); }, [carregar]);

  const semDetalhe = lista.filter((p) => !p.baixaEm && pendenciaSemDetalhe(p));

  async function salvar(p) {
    setSaving(true); setMsg('');
    try {
      await salvarPendencia({ ...p, clienteId: clientId });
      setEditId(null);
      setMsg('Detalhe salvo. A pendência continua no item da visita.');
      await carregar();
    } catch (e) {
      console.error(e);
      setMsg('Erro ao salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Completar detalhe</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Pendências de {client?.name || 'este cliente'} classificadas e ainda sem detalhe. Ao salvar, o detalhe fica gravado
          na pendência do item — aparece no card da visita, no RVT e no Indicador.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 6 }}><strong>{semDetalhe.length}</strong> sem detalhe</p>
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</p>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando...</p>}
      {!loading && semDetalhe.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma pendência sem detalhe.</p>
      )}
      {semDetalhe.map((p) => {
        const it = p.itens?.[0] || {};
        return (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderLeft: '4px solid #8B2F2F', borderRadius: 0, padding: '10px 12px', background: 'var(--surface)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-primary)' }}>
              <strong style={{ wordBreak: 'break-word' }}>{localDaPendencia(p)}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Visita {formatDateBR(p.origemData || p.desde)}</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{tipoPendenciaLabel(p)}</strong>
              <span style={{ color: 'var(--text-secondary)' }}> · {responsavelLabel(p)} · desde {formatDateBR(p.desde)}</span>
            </div>
            <TextoLongo texto={[it.falha && `Falha: ${it.falha}`, it.descritivo && `Descritivo: ${it.descritivo}`].filter(Boolean).join('\n')} />
            {editId === p.id ? (
              <PendenciaForm inicial={{ ...p }} nomesMateriais={nomes} saving={saving} onSave={salvar} onCancel={() => setEditId(null)} />
            ) : (
              <div>
                <button type="button" onClick={() => setEditId(p.id)} disabled={!!editId} style={{ ...smallBtnStyle, border: '1px solid #8B2F2F', color: '#8B2F2F' }}>Completar</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Aba "Reenviar RVTs": visitas do cliente aberto cujo RVT agora mostra pendências.
    Reaproveita o VisitaPrintView de Atendimentos (import dinâmico — AtendimentosNovo é lazy). */
function AbaReenviar({ clientId, client }) {
  const [mod, setMod] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [marcadas, setMarcadas] = useState(() => new Set());
  const [imprimir, setImprimir] = useState(null); // array de visitas | null

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [m, v, p] = await Promise.all([import('../AtendimentosNovo'), listVisitas(clientId), listPendencias(clientId)]);
      setMod(m); setVisitas(v); setPendencias(p);
    } catch (e) {
      console.error(e);
      setMsg('Não foi possível carregar as visitas.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { carregar(); }, [carregar]);

  const comPendencia = useMemo(() => {
    if (!mod) return [];
    return visitas
      .map((v) => {
        const pend = mod.visitaTemPendencias(v, pendencias);
        const unicas = [...new Map(pend.map((p) => [p.id, p])).values()];
        return { v, total: unicas.length, semDetalhe: unicas.filter(pendenciaSemDetalhe).length };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => a.v.data_visita.localeCompare(b.v.data_visita));
  }, [mod, visitas, pendencias]);

  if (imprimir && mod) {
    const Print = mod.VisitaPrintView;
    return <Print visitas={imprimir} client={client} pendencias={pendencias} podeAssinarTecnico onBack={() => { setImprimir(null); carregar(); }} />;
  }

  const selecionadas = comPendencia.filter((x) => marcadas.has(x.v.id)).map((x) => x.v);
  const todas = comPendencia.length > 0 && selecionadas.length === comPendencia.length;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Reenviar RVTs</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Visitas de {client?.name || 'este cliente'} cujo RVT agora mostra o bloco "Pendências para conclusão". Abra uma por uma
          (RVT individual, com assinaturas) ou marque várias e gere um PDF só.
        </p>
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</p>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando...</p>}
      {!loading && comPendencia.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma visita com pendência classificada ainda.</p>
      )}
      {comPendencia.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={todas} onChange={() => setMarcadas(todas ? new Set() : new Set(comPendencia.map((x) => x.v.id)))} />
            Marcar todas ({comPendencia.length})
          </label>
          <span style={{ flex: 1 }} />
          <button type="button" disabled={!selecionadas.length} onClick={() => setImprimir(selecionadas)} style={{ ...btnStyle, opacity: selecionadas.length ? 1 : 0.6 }}>
            Imprimir {selecionadas.length || ''} juntas
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {comPendencia.map(({ v, total, semDetalhe }) => (
          <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface)', display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={marcadas.has(v.id)} onChange={() => setMarcadas((prev) => {
              const next = new Set(prev);
              if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
              return next;
            })} />
            <div style={{ minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>{formatDateBR(v.data_visita)}</strong> · {v.tecnico || 'sem técnico'}
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {total} pendência(s)
                {semDetalhe > 0 && <span style={{ color: 'var(--status-warn, #b07000)' }}> · {semDetalhe} sem detalhe (complete antes de enviar)</span>}
              </div>
            </div>
            <button type="button" onClick={() => setImprimir([v])} style={{ ...smallBtnStyle, border: '1px solid #8B2F2F', color: '#8B2F2F' }}>Ver / Imprimir</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbaClassificar({ clienteAtualId }) {
  const [itens, setItens] = useState([]);
  const [semDetalhe, setSemDetalhe] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filtroCliente, setFiltroCliente] = useState(clienteAtualId || '');
  const [filtroPainel, setFiltroPainel] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  // Um item pode aguardar várias coisas ao mesmo tempo (ex.: Material + Condição de segurança +
  // Parada de máquina) — cada linha vira 1 pendência própria, com o seu responsável.
  const regraVazia = () => ({ tipo: '', responsavel: '', tipoOutro: '' });
  const [regras, setRegras] = useState(() => [regraVazia()]);
  const setRegra = (i, patch) => { setMsg(''); setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); };
  const [aplicando, setAplicando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, n] = await Promise.all([listItensSemPendencia(), contarPendenciasSemDetalhe()]);
      setItens(lista);
      setSemDetalhe(n);
    } catch (e) {
      console.error(e);
      setMsg('Não foi possível carregar os itens.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const clientes = useMemo(() => [...new Map(itens.map((i) => [i.clienteId, i.cliente])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [itens]);
  const paineis = useMemo(() => [...new Map(itens.filter((i) => (!filtroCliente || i.clienteId === filtroCliente) && i.painelId)
    .map((i) => [i.painelId, i.painel])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [itens, filtroCliente]);
  const filtrados = useMemo(() => itens.filter((i) => (!filtroCliente || i.clienteId === filtroCliente)
    && (!filtroPainel || i.painelId === filtroPainel)
    && (!de || i.dataVisita >= de) && (!ate || i.dataVisita <= ate)), [itens, filtroCliente, filtroPainel, de, ate]);
  const selecionados = filtrados.filter((i) => marcados.has(i.chave));
  const todosMarcados = filtrados.length > 0 && selecionados.length === filtrados.length;

  function toggle(chave) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave); else next.add(chave);
      return next;
    });
  }
  function toggleTodos() {
    setMarcados((prev) => {
      const next = new Set(prev);
      filtrados.forEach((i) => (todosMarcados ? next.delete(i.chave) : next.add(i.chave)));
      return next;
    });
  }

  // Confirmação dentro da tela (não usa window.confirm: alguns navegadores embutidos não mostram
  // a caixa e devolvem "Cancelar" sozinhos — o botão parecia não fazer nada).
  const [confirmacao, setConfirmacao] = useState(null); // { grupos, total, resumo } | null

  function aplicar() {
    if (!selecionados.length) { setMsg('Marque ao menos 1 item.'); return; }
    if (regras.some((r) => !r.tipo || !r.responsavel)) { setMsg('Escolha Tipo e Responsável em todas as linhas (ou remova a linha vazia).'); return; }
    const repetido = regras.find((r, i) => r.tipo !== 'outro' && regras.findIndex((x) => x.tipo === r.tipo) !== i);
    if (repetido) { setMsg(`O tipo "${PENDENCIA_TIPOS.find((t) => t.value === repetido.tipo)?.label}" aparece duas vezes.`); return; }
    const grupos = agruparParaPendencia(selecionados);
    const resumo = regras.map((r) => `${r.tipo === 'outro' ? (r.tipoOutro.trim() || 'Outro') : PENDENCIA_TIPOS.find((t) => t.value === r.tipo)?.label} / ${PENDENCIA_RESPONSAVEIS.find((x) => x.value === r.responsavel)?.label}`);
    setMsg('');
    setConfirmacao({ grupos, total: grupos.length * regras.length, resumo, nItens: selecionados.length });
  }

  async function confirmarAplicar() {
    const { grupos, nItens } = confirmacao;
    setConfirmacao(null);
    setAplicando(true); setMsg('');
    let ok = 0;
    try {
      for (const g of grupos) {
        for (const r of regras) {
          await salvarPendencia({
            clienteId: g.clienteId, tipo: r.tipo, tipoOutro: r.tipo === 'outro' ? (r.tipoOutro.trim() || 'A definir') : '', responsavel: r.responsavel,
            detalhe: '', materiais: [], desde: g.desde, previsao: '', origemRvtId: g.rvtId, alvos: g.alvos,
          });
          ok += 1;
        }
      }
      setMsg(`${ok} pendência(s) criada(s) para ${nItens} item(ns). Complete o detalhe no card do item, em Atendimentos → Visitas.`);
      setMarcados(new Set());
    } catch (e) {
      console.error(e);
      setMsg(`Erro depois de ${ok} pendência(s) criada(s). Recarreguei a lista; confira e tente de novo nos que sobraram.`);
    } finally {
      setAplicando(false);
      await carregar();
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Classificar pendências antigas</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Tela temporária. Itens em Aguardando/Andamento que ainda não têm pendência: marque, diga o que eles estão aguardando
          (pode ser mais de um tipo, cada um com seu responsável) e aplique.
          O "Desde" vem da data da visita. O detalhe fica para completar depois, no card do item em Atendimentos → Visitas.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 6 }}>
          <strong>{itens.length}</strong> sem classificação · <strong>{semDetalhe}</strong> pendência(s) sem detalhe
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <span style={labelStyle}>Cliente</span>
          <select style={inputStyle} value={filtroCliente} onChange={(e) => { setFiltroCliente(e.target.value); setFiltroPainel(''); }}>
            <option value="">Todos</option>
            {clientes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Painel</span>
          <select style={inputStyle} value={filtroPainel} onChange={(e) => setFiltroPainel(e.target.value)}>
            <option value="">Todos</option>
            {paineis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Visita de</span>
          <input type="date" style={inputStyle} value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <span style={labelStyle}>até</span>
          <input type="date" style={inputStyle} value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid #8B2F2F', borderRadius: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          <strong>{selecionados.length} selecionado(s)</strong>
          <span style={{ color: 'var(--text-secondary)' }}> · o que esses itens estão aguardando (uma linha por tipo):</span>
        </div>
        {regras.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ ...inputStyle, flex: '1 1 170px' }} value={r.tipo} onChange={(e) => setRegra(i, { tipo: e.target.value })} aria-label={`Tipo ${i + 1}`}>
              <option value="">Tipo...</option>
              {PENDENCIA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select style={{ ...inputStyle, flex: '1 1 130px' }} value={r.responsavel} onChange={(e) => setRegra(i, { responsavel: e.target.value })} aria-label={`Responsável ${i + 1}`}>
              <option value="">Responsável...</option>
              {PENDENCIA_RESPONSAVEIS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            {r.tipo === 'outro' && (
              <input style={{ ...inputStyle, flex: '1 1 170px' }} value={r.tipoOutro} onChange={(e) => setRegra(i, { tipoOutro: e.target.value })} placeholder="Qual? (opcional)" />
            )}
            {regras.length > 1 && (
              <button type="button" onClick={() => setRegras((rs) => rs.filter((_, j) => j !== i))} style={smallBtnStyle} aria-label={`Remover linha ${i + 1}`}>✕</button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setRegras((rs) => [...rs, regraVazia()])} style={{ ...smallBtnStyle, border: '1px solid #8B2F2F', color: '#8B2F2F' }}>+ Outro tipo</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={aplicar} disabled={aplicando || !!confirmacao} style={{ ...btnStyle, opacity: aplicando || confirmacao ? 0.7 : 1 }}>
            {aplicando ? 'Aplicando...' : `Aplicar aos ${selecionados.length}`}
          </button>
        </div>
        {confirmacao && (
          <div role="alertdialog" style={{ padding: 12, borderRadius: 8, border: '1px solid #8B2F2F', background: 'rgba(139,47,47,.10)', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>Criar {confirmacao.total} pendência(s) para {confirmacao.nItens} item(ns)?</strong>
              <ul style={{ margin: '6px 0 0 18px', listStyle: 'disc' }}>
                {confirmacao.resumo.map((linha) => <li key={linha}>{linha}</li>)}
              </ul>
              <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>O detalhe fica para completar depois, no item da visita.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmacao(null)} style={smallBtnStyle}>Cancelar</button>
              <button type="button" onClick={confirmarAplicar} style={btnStyle}>Confirmar</button>
            </div>
          </div>
        )}
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</p>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={todosMarcados} onChange={toggleTodos} disabled={!filtrados.length} />
          Marcar todos os {filtrados.length} da lista
        </label>
        {loading && <p style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Carregando...</p>}
        {!loading && filtrados.length === 0 && (
          <p style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            {itens.length ? 'Nenhum item com esse filtro.' : 'Tudo classificado. Esta tela já pode ser removida.'}
          </p>
        )}
        {filtrados.map((it) => <LinhaItem key={it.chave} it={it} marcado={marcados.has(it.chave)} onToggle={() => toggle(it.chave)} />)}
      </div>
    </div>
  );
}
