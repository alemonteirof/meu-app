import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { listPendenciasDetalhadas, darBaixaPendencias, PENDENCIA_TIPOS } from '../supabaseAdapter';
import { tipoPendenciaLabel, responsavelLabel, pendenciaSemDetalhe, diasEmAberto, formatQtd } from './Pendencias';
import { hojeLocal as hojeISO } from '../lib/datas';

// Indicador → aba "Pendências": visão consolidada do que está travando a conclusão dos itens
// abertos. Só leitura + baixa (MAJ). Cadastro continua em Atendimentos → Visitas.

const inputStyle = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' };
const RESP_ORDEM = ['cliente', 'maj'];

function formatDateBR(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Local legível dos itens da pendência (1 item ou "N itens: a, b, c"). */
export function localDaPendencia(p) {
  const itens = p.itens || [];
  if (!itens.length) return '—';
  const base = [itens[0].painel, itens[0].laco].filter(Boolean).join(' · ');
  const alvos = itens.length === 1 ? itens[0].alvo : `${itens.length} itens: ${itens.map((i) => i.alvo).join(', ')}`;
  return [base, alvos].filter(Boolean).join(' · ');
}
export function atividadeDaPendencia(p) {
  const it = (p.itens || [])[0];
  if (!it) return '';
  return [it.falha, it.descritivo].filter(Boolean).join(' — ');
}
export function detalheTexto(p) {
  if (p.tipo === 'material') {
    return (p.materiais || []).map((m) => [m.item, formatQtd(m), m.especificacao, m.marca, m.obs && `(${m.obs})`].filter(Boolean).join(' · ')).join('\n');
  }
  return p.detalhe || '';
}

/** Soma materiais iguais (mesmo item + especificação + unidade, sem diferenciar maiúsc./espaços). */
export function consolidarMateriais(pendencias) {
  const porResp = {};
  for (const p of pendencias) {
    if (p.tipo !== 'material') continue;
    for (const m of p.materiais || []) {
      const item = (m.item || '').trim();
      if (!item) continue;
      const unidade = m.unidade || 'un';
      const espec = (m.especificacao || '').trim();
      const chave = [item, espec, unidade].map((s) => s.toLowerCase().replace(/\s+/g, ' ')).join('|');
      const grupo = (porResp[p.responsavel] = porResp[p.responsavel] || new Map());
      const atual = grupo.get(chave) || { item, especificacao: espec, unidade, qtd: 0, semQtd: false, pendencias: 0, locais: [], _grafias: {} };
      if (m.qtd == null || m.qtd === '') atual.semQtd = true; else atual.qtd += Number(m.qtd) || 0;
      // Nome exibido = a grafia com mais quantidade somada (evita mostrar a versão "mal digitada").
      const g = `${item}\u0000${espec}`;
      atual._grafias[g] = (atual._grafias[g] || 0) + (Number(m.qtd) || 1);
      const melhor = Object.entries(atual._grafias).sort((a, b) => b[1] - a[1])[0][0].split('\u0000');
      atual.item = melhor[0]; atual.especificacao = melhor[1];
      atual.pendencias += 1;
      atual.locais.push(localDaPendencia(p));
      grupo.set(chave, atual);
    }
  }
  return Object.fromEntries(Object.entries(porResp).map(([r, mapa]) => [r, [...mapa.values()].sort((a, b) => a.item.localeCompare(b.item, 'pt-BR'))]));
}
function qtdTotal(m) {
  const n = Math.round(m.qtd * 100) / 100;
  return `${String(n).replace('.', ',')} ${m.unidade}${m.semQtd ? ' + s/ qtd' : ''}`;
}

function StatCard({ label, valor, destaque }) {
  return (
    <div className="rvt-summary-card" style={{ ...cardStyle, padding: 12, borderTop: '3px solid #8B2F2F', borderRadius: 10, background: 'var(--surface-raised, var(--surface))' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: destaque || 'var(--text-primary)' }}>{valor}</div>
    </div>
  );
}

function LinhaPendencia({ p, canEdit, onBaixa }) {
  const [abrirBaixa, setAbrirBaixa] = useState(false);
  const [baixa, setBaixa] = useState({ data: hojeISO(), obs: '' });
  const [saving, setSaving] = useState(false);
  const dias = diasEmAberto(p);
  const detalhe = detalheTexto(p);
  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 10 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
        {dias ?? '—'}<div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>dia{dias === 1 ? '' : 's'}</div>
      </div>
      <div style={{ minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
        <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{localDaPendencia(p)}</div>
        {atividadeDaPendencia(p) && <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, wordBreak: 'break-word' }}>{atividadeDaPendencia(p).slice(0, 220)}{atividadeDaPendencia(p).length > 220 ? '…' : ''}</div>}
        {detalhe
          ? <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detalhe}</div>
          : pendenciaSemDetalhe(p) && <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,159,0,.15)', color: 'var(--status-warn, #b07000)' }}>sem detalhe</span>}
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
          Desde {formatDateBR(p.desde)} · Previsão {p.previsao ? formatDateBR(p.previsao) : '—'}{p.origemData ? ` · RVT ${formatDateBR(p.origemData)}` : ''}
        </div>
        {canEdit && !abrirBaixa && (
          <button type="button" onClick={() => { setAbrirBaixa(true); setBaixa({ data: hojeISO(), obs: '' }); }} style={{ ...smallBtnStyle, marginTop: 6 }}>Dar baixa</button>
        )}
        {canEdit && abrirBaixa && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <input type="date" style={inputStyle} value={baixa.data} onChange={(e) => setBaixa((b) => ({ ...b, data: e.target.value }))} />
            <input style={{ ...inputStyle, flex: '1 1 160px' }} placeholder="Observação (opcional)" value={baixa.obs} onChange={(e) => setBaixa((b) => ({ ...b, obs: e.target.value }))} />
            <button type="button" onClick={() => setAbrirBaixa(false)} style={smallBtnStyle}>Cancelar</button>
            <button type="button" disabled={saving} style={{ ...btnStyle, padding: '6px 12px', fontSize: 12, opacity: saving ? 0.7 : 1 }}
              onClick={async () => { setSaving(true); const ok = await onBaixa(p, baixa); setSaving(false); if (ok) setAbrirBaixa(false); }}>
              Confirmar baixa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const thP = { textAlign: 'left', fontSize: 10, fontWeight: 600, padding: '4px 6px', borderBottom: '1px solid var(--text-primary)', color: 'var(--text-primary)' };
const tdP = { fontSize: 10.5, padding: '4px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' };

function PendenciasPrintView({ grupos, materiais, resumo, client, onBack }) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `Pendencias - ${(client?.name || '').replace(/[\\/:*?"<>|]/g, '-')} - ${formatDateBR(hojeISO()).replace(/\//g, '-')}`;
    return () => { document.title = anterior; };
  }, [client?.name]);
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={{ ...btnStyle, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>← Voltar</button>
        <button type="button" onClick={() => window.print()} style={btnStyle}>Imprimir / Salvar PDF</button>
      </div>
      <div className="print-area rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="rvt-brand-band">
          <div className="flex items-center gap-3 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="rvt-wordmark">
              <div className="rvt-wordmark-icon"><ShieldAlert size={16} style={{ color: '#fff' }} /></div>
              <div className="rvt-wordmark-text"><div className="maj">M.A.J</div><div className="sol">Soluções</div></div>
            </div>
            <div className="rvt-divider-v" />
            <div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{client?.name || ''}</p>
              {client?.address && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{client.address}</p>}
            </div>
          </div>
          <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 600, fontSize: 16, letterSpacing: '0.04em' }}>PENDÊNCIAS PARA CONCLUSÃO</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>Posição em {formatDateBR(hojeISO())}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            <StatCard label="Total em aberto" valor={resumo.total} />
            <StatCard label="Com o cliente" valor={resumo.cliente} />
            <StatCard label="Com a MAJ" valor={resumo.maj} />
            <StatCard label="Mais antiga" valor={resumo.maisAntiga != null ? `${resumo.maisAntiga} dias` : '—'} />
          </div>
          {grupos.map((g) => (
            <div key={g.responsavel} style={{ breakInside: 'auto' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', paddingBottom: 3, marginBottom: 6 }}>
                RESPONSÁVEL: {responsavelLabel({ responsavel: g.responsavel }).toUpperCase()} ({g.total})
              </p>
              {g.tipos.map((t) => (
                <div key={t.tipo} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{t.label} ({t.itens.length})</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead><tr>
                      <th style={{ ...thP, width: '20%' }}>Local</th><th style={{ ...thP, width: '20%' }}>Atividade</th>
                      <th style={{ ...thP, width: '26%' }}>Detalhe</th><th style={{ ...thP, width: '8%' }}>Desde</th>
                      <th style={{ ...thP, width: '6%' }}>Dias</th><th style={{ ...thP, width: '9%' }}>Previsão</th><th style={{ ...thP, width: '11%' }}>RVT de origem</th>
                    </tr></thead>
                    <tbody>
                      {t.itens.map((p) => (
                        <tr key={p.id} style={{ breakInside: 'avoid' }}>
                          <td style={tdP}>{localDaPendencia(p)}</td>
                          <td style={tdP}>{atividadeDaPendencia(p).slice(0, 160)}</td>
                          <td style={tdP}>{detalheTexto(p) || (pendenciaSemDetalhe(p) ? 'A detalhar' : '—')}</td>
                          <td style={tdP}>{formatDateBR(p.desde)}</td>
                          <td style={tdP}>{diasEmAberto(p) ?? '—'}</td>
                          <td style={tdP}>{p.previsao ? formatDateBR(p.previsao) : '—'}</td>
                          <td style={tdP}>{p.origemData ? formatDateBR(p.origemData) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(materiais).length > 0 && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', paddingBottom: 3, marginBottom: 6 }}>LISTA CONSOLIDADA DE MATERIAIS</p>
              {RESP_ORDEM.filter((r) => materiais[r]?.length).map((r) => (
                <div key={r} style={{ marginBottom: 10, breakInside: 'avoid' }}>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Responsável: {responsavelLabel({ responsavel: r }).toUpperCase()}</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead><tr>
                      <th style={{ ...thP, width: '30%' }}>Item</th><th style={{ ...thP, width: '28%' }}>Especificação</th>
                      <th style={{ ...thP, width: '14%' }}>Quantidade</th><th style={{ ...thP, width: '28%' }}>Onde</th>
                    </tr></thead>
                    <tbody>
                      {materiais[r].map((m) => (
                        <tr key={`${m.item}|${m.especificacao}|${m.unidade}`}>
                          <td style={tdP}>{m.item}</td><td style={tdP}>{m.especificacao || '—'}</td>
                          <td style={tdP}>{qtdTotal(m)}</td><td style={tdP}>{[...new Set(m.locais)].join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Monta o .xlsx (paisagem, aba 1 pendências + aba 2 materiais) e devolve o buffer. */
export async function montarPlanilhaPendencias({ pendencias, materiais, client }) {
  const { default: ExcelJS } = await import('exceljs');
  const VINHO = 'FF8B2F2F';
  const wb = new ExcelJS.Workbook();
  const cabecalho = (ws, colunas) => {
    ws.columns = colunas.map(([header, width]) => ({ header, width }));
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO } };
    r.alignment = { vertical: 'middle', wrapText: true };
    r.height = 22;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    ws.pageSetup.printTitlesRow = '1:1';
  };
  const bordas = (ws) => ws.eachRow((row) => row.eachCell((c) => {
    c.border = { top: { style: 'thin', color: { argb: 'FFD7DADC' } }, bottom: { style: 'thin', color: { argb: 'FFD7DADC' } }, left: { style: 'thin', color: { argb: 'FFD7DADC' } }, right: { style: 'thin', color: { argb: 'FFD7DADC' } } };
    c.alignment = { ...(c.alignment || {}), vertical: 'top', wrapText: true };
  }));
  const data = (s) => (s ? new Date(`${s}T00:00:00`) : null);

  const ws1 = wb.addWorksheet('Pendências');
  cabecalho(ws1, [['Cliente', 18], ['Local', 34], ['Atividade', 34], ['Tipo', 16], ['Detalhe', 44], ['Responsável', 12], ['Desde', 11], ['Dias aguardando', 10], ['Previsão', 11], ['RVT de origem', 12]]);
  for (const p of pendencias) {
    ws1.addRow([client?.name || '', localDaPendencia(p), atividadeDaPendencia(p), tipoPendenciaLabel(p),
      detalheTexto(p) || (pendenciaSemDetalhe(p) ? 'A detalhar' : ''), responsavelLabel(p),
      data(p.desde), diasEmAberto(p), data(p.previsao), data(p.origemData)]);
  }
  [7, 9, 10].forEach((i) => { ws1.getColumn(i).numFmt = 'dd/mm/yyyy'; });
  ws1.autoFilter = { from: 'A1', to: 'J1' };
  bordas(ws1);

  const ws2 = wb.addWorksheet('Materiais');
  cabecalho(ws2, [['Responsável', 12], ['Item', 34], ['Especificação', 30], ['Quantidade', 12], ['Unidade', 9], ['Nº de pendências', 12], ['Onde', 60]]);
  for (const r of RESP_ORDEM) {
    for (const m of materiais[r] || []) {
      ws2.addRow([responsavelLabel({ responsavel: r }), m.item, m.especificacao, Math.round(m.qtd * 100) / 100, m.unidade + (m.semQtd ? ' (+ itens sem qtd)' : ''), m.pendencias, [...new Set(m.locais)].join('; ')]);
    }
  }
  bordas(ws2);
  return wb.xlsx.writeBuffer();
}

async function exportarExcel({ pendencias, materiais, client }) {
  const buf = await montarPlanilhaPendencias({ pendencias, materiais, client });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Pendencias - ${(client?.name || 'cliente').replace(/[\\/:*?"<>|]/g, '-')} - ${formatDateBR(hojeISO()).replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PendenciasIndicador({ clientId, client, canEdit, onRefresh }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [filtroResp, setFiltroResp] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [fechados, setFechados] = useState({}); // grupos recolhidos por chave
  const [imprimindo, setImprimindo] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      setLista(await listPendenciasDetalhadas(clientId));
    } catch (e) {
      console.error(e);
      setErro('Não foi possível carregar as pendências.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { carregar(); }, [carregar]);

  const abertas = useMemo(() => lista.filter((p) => !p.baixaEm), [lista]);

  // "Sem impedimentos — pronto para executar": item ainda não resolvido, com pendência(s)
  // e todas já com baixa. Não é status no banco — o item segue em Andamento até o técnico resolver.
  const prontos = useMemo(() => {
    const porItem = new Map();
    for (const p of lista) {
      for (const it of p.itens || []) {
        const atual = porItem.get(it.chave) || { item: it, pendencias: [] };
        atual.pendencias.push(p);
        porItem.set(it.chave, atual);
      }
    }
    return [...porItem.values()]
      .filter((x) => x.item.status !== 'resolvido' && x.pendencias.every((p) => p.baixaEm))
      .map((x) => ({ ...x, ultimaBaixa: x.pendencias.map((p) => p.baixaEm).sort().pop() }))
      .sort((a, b) => a.ultimaBaixa.localeCompare(b.ultimaBaixa));
  }, [lista]);
  const filtradas = useMemo(() => abertas
    .filter((p) => !filtroResp || p.responsavel === filtroResp)
    .filter((p) => !filtroTipo || p.tipo === filtroTipo)
    .sort((a, b) => (diasEmAberto(b) ?? 0) - (diasEmAberto(a) ?? 0)), [abertas, filtroResp, filtroTipo]);

  const resumo = useMemo(() => {
    const dias = filtradas.map((p) => diasEmAberto(p)).filter((d) => d != null);
    return {
      total: filtradas.length,
      cliente: filtradas.filter((p) => p.responsavel === 'cliente').length,
      maj: filtradas.filter((p) => p.responsavel === 'maj').length,
      maisAntiga: dias.length ? Math.max(...dias) : null,
    };
  }, [filtradas]);

  // Responsável (Cliente primeiro) → Tipo (ordem da lista fixa) → mais antigas primeiro.
  const grupos = useMemo(() => RESP_ORDEM.map((r) => {
    const doResp = filtradas.filter((p) => p.responsavel === r);
    const tipos = PENDENCIA_TIPOS.map((t) => ({ tipo: t.value, label: t.label, itens: doResp.filter((p) => p.tipo === t.value) }))
      .filter((t) => t.itens.length);
    return { responsavel: r, total: doResp.length, tipos };
  }).filter((g) => g.total), [filtradas]);

  const materiais = useMemo(() => consolidarMateriais(filtradas), [filtradas]);

  async function baixa(p, { data, obs }) {
    try {
      await darBaixaPendencias([p.id], { data, obs });
      setMsg('Baixa registrada. Se o item estava Aguardando, agora está em Andamento.');
      await carregar();
      if (onRefresh) onRefresh();
      return true;
    } catch (e) {
      console.error(e);
      setMsg('Erro ao dar baixa. Tente de novo.');
      return false;
    }
  }

  if (imprimindo) {
    return <PendenciasPrintView grupos={grupos} materiais={materiais} resumo={resumo} client={client} onBack={() => setImprimindo(false)} />;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <StatCard label="Total em aberto" valor={resumo.total} />
        <StatCard label="Com o cliente" valor={resumo.cliente} />
        <StatCard label="Com a MAJ" valor={resumo.maj} />
        <StatCard label="Mais antiga" valor={resumo.maisAntiga != null ? `${resumo.maisAntiga} dias` : '—'} />
        <StatCard label="Prontos p/ executar" valor={prontos.length} destaque={prontos.length ? 'var(--status-ok)' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={inputStyle} value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} aria-label="Filtrar por responsável">
          <option value="">Responsável: todos</option>
          <option value="cliente">Cliente</option>
          <option value="maj">MAJ</option>
        </select>
        <select style={inputStyle} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Tipo: todos</option>
          {PENDENCIA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setImprimindo(true)} disabled={!filtradas.length} style={{ ...smallBtnStyle, padding: '8px 12px', fontSize: 13 }}>Imprimir</button>
        <button type="button" disabled={!filtradas.length || exportando} style={{ ...smallBtnStyle, padding: '8px 12px', fontSize: 13 }}
          onClick={async () => {
            setExportando(true);
            try { await exportarExcel({ pendencias: filtradas, materiais, client }); } catch (e) { console.error(e); setMsg('Erro ao gerar o Excel.'); }
            setExportando(false);
          }}>
          {exportando ? 'Gerando...' : 'Exportar Excel'}
        </button>
        </div>
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</p>}
      {erro && <p style={{ fontSize: 13, color: 'var(--status-danger)' }}>{erro}</p>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando pendências...</p>}
      {!loading && !erro && filtradas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {abertas.length ? 'Nenhuma pendência com esse filtro.' : 'Nenhuma pendência em aberto. As pendências são cadastradas no item da visita, em Atendimentos.'}
        </p>
      )}

      {grupos.map((g) => (
        <div key={g.responsavel} style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Com {g.responsavel === 'cliente' ? 'o cliente' : 'a MAJ'} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {g.total}</span>
          </h3>
          {g.tipos.map((t) => {
            const chave = `${g.responsavel}|${t.tipo}`;
            const aberto = !fechados[chave];
            return (
              <div key={chave} style={{ ...cardStyle, overflow: 'hidden' }}>
                <button type="button" onClick={() => setFechados((f) => ({ ...f, [chave]: aberto }))}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-raised, transparent)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
                  <span>{aberto ? '▾' : '▸'} {t.label}</span>
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{t.itens.length}</span>
                </button>
                {aberto && t.itens.map((p) => <LinhaPendencia key={p.id} p={p} canEdit={canEdit} onBaixa={baixa} />)}
              </div>
            );
          })}
        </div>
      ))}

      {prontos.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--status-ok)' }}>
            Sem impedimentos — pronto para executar <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {prontos.length}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: -4 }}>
            Itens com todas as pendências já com baixa. Continuam em Andamento até o técnico executar e registrar a resolução na visita.
          </p>
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            {prontos.map(({ item, pendencias, ultimaBaixa }) => (
              <div key={item.chave} style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' }}>
                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{[item.painel, item.laco, item.alvo].filter(Boolean).join(' · ')}</div>
                {(item.falha || item.descritivo) && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, wordBreak: 'break-word' }}>
                    {[item.falha, item.descritivo].filter(Boolean).join(' — ').slice(0, 200)}
                  </div>
                )}
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                  Baixa: {pendencias.map((p) => tipoPendenciaLabel(p)).join(', ')} · última em {formatDateBR(ultimaBaixa)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(materiais).length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Lista consolidada de materiais</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {RESP_ORDEM.filter((r) => materiais[r]?.length).map((r) => (
              <div key={r} style={{ ...cardStyle, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{r === 'cliente' ? 'Cliente providencia' : 'MAJ providencia'}</div>
                {materiais[r].map((m) => (
                  <div key={`${m.item}|${m.especificacao}|${m.unidade}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0', borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{m.item}{m.especificacao ? <span style={{ color: 'var(--text-secondary)' }}> · {m.especificacao}</span> : null}</span>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{qtdTotal(m)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
