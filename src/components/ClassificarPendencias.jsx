import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listItensSemPendencia, contarPendenciasSemDetalhe, salvarPendencia,
  PENDENCIA_TIPOS, PENDENCIA_RESPONSAVEIS,
} from '../supabaseAdapter';

// TELA TEMPORÁRIA (só admin) — classificação retroativa dos itens antigos em Aguardando/
// Andamento que ainda não têm pendência. Marca vários → aplica Tipo + Responsável de uma vez;
// cada pendência nasce "sem detalhe" e é completada depois no card do item em Visitas.
// Remover (item 'classificar' do NAV_ITEMS em App.jsx + este arquivo) quando a lista zerar.

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

export default function ClassificarPendencias({ clienteAtualId }) {
  const [itens, setItens] = useState([]);
  const [semDetalhe, setSemDetalhe] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filtroCliente, setFiltroCliente] = useState(clienteAtualId || '');
  const [filtroPainel, setFiltroPainel] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  const [tipo, setTipo] = useState('');
  const [responsavel, setResponsavel] = useState('');
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

  async function aplicar() {
    if (!selecionados.length) { setMsg('Marque ao menos 1 item.'); return; }
    if (!tipo || !responsavel) { setMsg('Escolha o Tipo e o Responsável.'); return; }
    const grupos = agruparParaPendencia(selecionados);
    const tipoLabel = PENDENCIA_TIPOS.find((t) => t.value === tipo)?.label;
    const respLabel = PENDENCIA_RESPONSAVEIS.find((r) => r.value === responsavel)?.label;
    if (!window.confirm(`Criar ${grupos.length} pendência(s) "${tipoLabel} / ${respLabel}" para ${selecionados.length} item(ns)? O detalhe fica para completar depois no item da visita.`)) return;
    setAplicando(true); setMsg('');
    let ok = 0;
    try {
      for (const g of grupos) {
        await salvarPendencia({
          clienteId: g.clienteId, tipo, tipoOutro: tipo === 'outro' ? 'A definir' : '', responsavel,
          detalhe: '', materiais: [], desde: g.desde, previsao: '', origemRvtId: g.rvtId, alvos: g.alvos,
        });
        ok += 1;
      }
      setMsg(`${ok} pendência(s) criada(s) para ${selecionados.length} item(ns). Complete o detalhe no card do item, em Atendimentos → Visitas.`);
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
          Tela temporária. Itens em Aguardando/Andamento que ainda não têm pendência: marque, escolha Tipo e Responsável e aplique.
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

      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid #8B2F2F', borderRadius: 0 }}>
        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selecionados.length} selecionado(s)</strong>
        <select style={inputStyle} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Tipo...</option>
          {PENDENCIA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select style={inputStyle} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} aria-label="Responsável">
          <option value="">Responsável...</option>
          {PENDENCIA_RESPONSAVEIS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={aplicar} disabled={aplicando} style={{ ...btnStyle, opacity: aplicando ? 0.7 : 1 }}>
          {aplicando ? 'Aplicando...' : `Aplicar aos ${selecionados.length}`}
        </button>
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
