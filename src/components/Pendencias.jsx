import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PENDENCIA_TIPOS, PENDENCIA_RESPONSAVEIS, MATERIAL_UNIDADES,
  salvarPendencia, excluirPendencia, darBaixaPendencias, reabrirPendencia, chaveAlvoPendencia,
} from '../supabaseAdapter';
import { hojeLocal as hojeISO } from '../lib/datas';

// "Pendências para conclusão" — o que um item em Aguardando/Andamento está aguardando.
// Cadastro/baixa só em Atendimentos → Visitas (equipe MAJ); RVT e Indicador só exibem.

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' };

const TIPO_LABEL = Object.fromEntries(PENDENCIA_TIPOS.map((t) => [t.value, t.label]));
const RESP_LABEL = Object.fromEntries(PENDENCIA_RESPONSAVEIS.map((r) => [r.value, r.label]));

export function tipoPendenciaLabel(p) {
  if (p.tipo === 'outro' && p.tipoOutro) return p.tipoOutro;
  return TIPO_LABEL[p.tipo] || p.tipo;
}
export function responsavelLabel(p) {
  return RESP_LABEL[p.responsavel] || p.responsavel;
}
/** Classificada (tipo + responsável) mas ainda sem o detalhe preenchido. */
export function pendenciaSemDetalhe(p) {
  return p.tipo === 'material' ? !(p.materiais || []).some((m) => (m.item || '').trim()) : !(p.detalhe || '').trim();
}
export function diasEmAberto(p) {
  if (!p.desde) return null;
  const fim = new Date(`${p.baixaEm || hojeISO()}T00:00:00`);
  return Math.max(0, Math.round((fim - new Date(`${p.desde}T00:00:00`)) / 86400000));
}
export function formatQtd(m) {
  if (m.qtd == null || m.qtd === '') return '';
  return `${String(m.qtd).replace('.', ',')} ${m.unidade || 'un'}`;
}
function formatDateBR(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
const chaveAlvo = chaveAlvoPendencia;

/** Pendências ligadas a um alvo ({atendimentoId} ou {rvtItemId}). */
export function pendenciasDoAlvo(lista, alvo) {
  const k = chaveAlvo(alvo);
  return (lista || []).filter((p) => p.alvos.some((a) => chaveAlvo(a) === k));
}

const novoMaterial = () => ({ item: '', qtd: '', unidade: 'un', especificacao: '', marca: '', obs: '' });

export function PendenciaForm({ inicial, sugestoes, nomesMateriais, saving, onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    ...inicial,
    materiais: inicial.materiais?.length ? inicial.materiais.map((m) => ({ ...novoMaterial(), ...m, qtd: m.qtd ?? '' })) : [novoMaterial()],
  }));
  const [extras, setExtras] = useState(() => new Set((sugestoes || []).map((s) => chaveAlvo(s.alvo))));
  const [erro, setErro] = useState('');
  const listId = useRef(`mat-${Math.random().toString(36).slice(2)}`).current;
  const set = (patch) => { setErro(''); setF((prev) => ({ ...prev, ...patch })); };
  const setMat = (i, patch) => set({ materiais: f.materiais.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  function salvar() {
    if (!f.tipo) { setErro('Escolha o tipo.'); return; }
    if (!f.responsavel) { setErro('Escolha o responsável.'); return; }
    if (f.tipo === 'outro' && !(f.tipoOutro || '').trim()) { setErro('Diga qual é o tipo.'); return; }
    const extrasAlvos = (sugestoes || []).filter((s) => extras.has(chaveAlvo(s.alvo))).map((s) => s.alvo);
    onSave({ ...f, alvos: [...f.alvos, ...extrasAlvos] });
  }

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', gap: 10 }}>
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Tipo *</span>
          <select style={inputStyle} value={f.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            <option value="">Escolha...</option>
            {PENDENCIA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Responsável *</span>
          <select style={inputStyle} value={f.responsavel} onChange={(e) => set({ responsavel: e.target.value })}>
            <option value="">Escolha...</option>
            {PENDENCIA_RESPONSAVEIS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      {f.tipo === 'outro' && (
        <div>
          <span style={labelStyle}>Qual? *</span>
          <input style={inputStyle} value={f.tipoOutro} onChange={(e) => set({ tipoOutro: e.target.value })} placeholder="Ex.: Projeto aprovado pelo bombeiro" />
        </div>
      )}
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Desde</span>
          <input type="date" style={inputStyle} value={f.desde} onChange={(e) => set({ desde: e.target.value })} />
        </div>
        <div>
          <span style={labelStyle}>Previsão (opcional)</span>
          <input type="date" style={inputStyle} value={f.previsao} onChange={(e) => set({ previsao: e.target.value })} />
        </div>
      </div>

      {f.tipo === 'material' ? (
        <div>
          <span style={labelStyle}>Itens de material</span>
          <datalist id={listId}>{(nomesMateriais || []).map((n) => <option key={n} value={n} />)}</datalist>
          <div style={{ display: 'grid', gap: 8 }}>
            {f.materiais.map((m, i) => (
              <div key={i} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={inputStyle} list={listId} value={m.item} onChange={(e) => setMat(i, { item: e.target.value })} placeholder="Item (ex.: Sirene audiovisual)" />
                  {f.materiais.length > 1 && (
                    <button type="button" onClick={() => set({ materiais: f.materiais.filter((_, j) => j !== i) })} style={smallBtnStyle} aria-label="Remover item">✕</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 80px minmax(0,1fr)', gap: 6 }}>
                  <input type="number" min="0" step="any" inputMode="decimal" style={inputStyle} value={m.qtd} onChange={(e) => setMat(i, { qtd: e.target.value })} placeholder="Qtd" />
                  <select style={inputStyle} value={m.unidade} onChange={(e) => setMat(i, { unidade: e.target.value })}>
                    {MATERIAL_UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input style={inputStyle} value={m.especificacao} onChange={(e) => setMat(i, { especificacao: e.target.value })} placeholder="Especificação" />
                </div>
                <div className="grid-2-mobile-safe">
                  <input style={inputStyle} value={m.marca} onChange={(e) => setMat(i, { marca: e.target.value })} placeholder="Marca/modelo (opcional)" />
                  <input style={inputStyle} value={m.obs} onChange={(e) => setMat(i, { obs: e.target.value })} placeholder="Observação (opcional)" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => set({ materiais: [...f.materiais, novoMaterial()] })} style={{ ...smallBtnStyle, marginTop: 6 }}>+ Outro item</button>
        </div>
      ) : f.tipo ? (
        <div>
          <span style={labelStyle}>Detalhe</span>
          <textarea style={{ ...inputStyle, minHeight: 70 }} value={f.detalhe} onChange={(e) => set({ detalhe: e.target.value })}
            placeholder="O que falta, com quem, onde..." />
        </div>
      ) : null}

      {(sugestoes || []).length > 0 && (
        <div>
          <span style={labelStyle}>Vale também para (mesma falha nesta visita):</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {sugestoes.map((s) => {
              const k = chaveAlvo(s.alvo);
              return (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={extras.has(k)} onChange={() => setExtras((prev) => {
                    const next = new Set(prev);
                    if (next.has(k)) next.delete(k); else next.add(k);
                    return next;
                  })} />
                  {s.label}
                </label>
              );
            })}
          </div>
        </div>
      )}
      {inicial.id && inicial.alvos.length > 1 && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pendência compartilhada com {inicial.alvos.length} itens — a mudança vale para todos.</p>
      )}

      {erro && <p style={{ fontSize: 12, color: 'var(--status-danger)' }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallBtnStyle}>Cancelar</button>
        <button type="button" onClick={salvar} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}

/** Resumo de 1 pendência (detalhe ou materiais). */
function PendenciaResumo({ p }) {
  const dias = diasEmAberto(p);
  return (
    <div style={{ fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }}>
        <strong>{tipoPendenciaLabel(p)}</strong>
        <span>· {responsavelLabel(p)}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          desde {formatDateBR(p.desde)}{dias != null && !p.baixaEm ? ` (${dias} dia${dias === 1 ? '' : 's'})` : ''}
          {p.previsao ? ` · prev. ${formatDateBR(p.previsao)}` : ''}
        </span>
        {pendenciaSemDetalhe(p) && !p.baixaEm && (
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,159,0,.15)', color: 'var(--status-warn, #b07000)' }}>sem detalhe</span>
        )}
        {p.alvos.length > 1 && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>· compartilhada ({p.alvos.length} itens)</span>}
      </div>
      {p.tipo === 'material'
        ? (p.materiais || []).map((m, i) => (
          <div key={i} style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
            {m.item}{formatQtd(m) ? ` · ${formatQtd(m)}` : ''}{m.especificacao ? ` · ${m.especificacao}` : ''}{m.marca ? ` · ${m.marca}` : ''}{m.obs ? ` (${m.obs})` : ''}
          </div>
        ))
        : p.detalhe && <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{p.detalhe}</div>}
      {p.baixaEm && (
        <div style={{ color: 'var(--status-ok)', fontSize: 12 }}>
          Baixa em {formatDateBR(p.baixaEm)}{p.baixaPorNome ? ` por ${p.baixaPorNome}` : ''}{p.baixaObs ? ` — ${p.baixaObs}` : ''}
        </div>
      )}
    </div>
  );
}

/** Bloco "Pendências para conclusão" no card de um item da visita.
    ctx = { lista, clienteId, nomesMateriais, recarregar } (vem do AtendimentosNovo).
    sugestoes = outros itens abertos da mesma visita com a mesma falha ([{alvo, label}]). */
export function PendenciasItem({ ctx, alvo, aberto, canEdit, dataPadrao, rvtId, sugestoes }) {
  const minhas = pendenciasDoAlvo(ctx?.lista, alvo);
  const abertas = minhas.filter((p) => !p.baixaEm);
  const comBaixa = minhas.filter((p) => p.baixaEm);
  const [form, setForm] = useState(null); // pendência em edição (nova = sem id)
  const [baixaId, setBaixaId] = useState(null);
  const [baixa, setBaixa] = useState({ data: hojeISO(), obs: '' });
  const [verBaixadas, setVerBaixadas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!ctx || (!aberto && minhas.length === 0)) return null;

  async function executar(fn, ok) {
    setSaving(true); setMsg('');
    try {
      await fn();
      if (ok) setMsg(ok);
      await ctx.recarregar();
      return true;
    } catch (err) {
      console.error(err);
      setMsg('Erro ao salvar a pendência. Tente de novo.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function novaPendencia() {
    setForm({ id: null, clienteId: ctx.clienteId, tipo: '', tipoOutro: '', responsavel: '', detalhe: '', materiais: [],
      desde: dataPadrao || hojeISO(), previsao: '', origemRvtId: rvtId || null, alvos: [alvo] });
  }
  async function salvar(p) {
    if (await executar(() => salvarPendencia({ ...p, clienteId: ctx.clienteId }), 'Pendência salva.')) setForm(null);
  }
  async function confirmarBaixa(p) {
    if (await executar(() => darBaixaPendencias([p.id], { data: baixa.data, obs: baixa.obs, rvtId: null }), 'Baixa registrada.')) setBaixaId(null);
  }
  async function excluir(p) {
    const extra = p.alvos.length > 1 ? ` Ela é compartilhada com ${p.alvos.length} itens e sai de todos.` : '';
    if (!window.confirm(`Excluir esta pendência cadastrada por engano?${extra} Para registrar que foi resolvida, use "Dar baixa".`)) return;
    await executar(() => excluirPendencia(p.id), 'Pendência excluída.');
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          Pendências para conclusão{abertas.length ? ` (${abertas.length} aberta${abertas.length === 1 ? '' : 's'})` : ''}
        </span>
        {canEdit && aberto && !form && (
          <button type="button" onClick={novaPendencia} style={{ ...smallBtnStyle, border: '1px solid #8B2F2F', color: '#8B2F2F' }}>+ Adicionar</button>
        )}
      </div>
      {aberto && minhas.length === 0 && !form && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Nenhuma pendência cadastrada.</p>
      )}
      {aberto && minhas.length > 0 && abertas.length === 0 && (
        <p style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, padding: '4px 8px', borderRadius: 6, display: 'inline-block', background: 'rgba(39,174,96,.15)', color: 'var(--status-ok)' }}>
          ✓ Sem impedimentos — pronto para executar
        </p>
      )}

      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {abertas.map((p) => (
          <div key={p.id} style={{ padding: 8, borderRadius: 8, border: `1px solid ${pendenciaSemDetalhe(p) ? 'rgba(245,159,0,.5)' : 'var(--border)'}` }}>
            {form?.id === p.id ? (
              <PendenciaForm inicial={form} nomesMateriais={ctx.nomesMateriais} saving={saving} onSave={salvar} onCancel={() => setForm(null)} />
            ) : (
              <>
                <PendenciaResumo p={p} />
                {canEdit && baixaId !== p.id && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <button type="button" onClick={() => setForm({ ...p })} style={smallBtnStyle}>{pendenciaSemDetalhe(p) ? 'Completar' : 'Editar'}</button>
                    <button type="button" onClick={() => { setBaixaId(p.id); setBaixa({ data: hojeISO(), obs: '' }); }} style={smallBtnStyle}>Dar baixa</button>
                    <button type="button" onClick={() => excluir(p)} style={{ ...smallBtnStyle, color: 'var(--status-danger)' }}>Excluir</button>
                  </div>
                )}
                {canEdit && baixaId === p.id && (
                  <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                    <div className="grid-2-mobile-safe">
                      <div>
                        <span style={labelStyle}>Data da baixa</span>
                        <input type="date" style={inputStyle} value={baixa.data} onChange={(e) => setBaixa((b) => ({ ...b, data: e.target.value }))} />
                      </div>
                      <div>
                        <span style={labelStyle}>Observação (opcional)</span>
                        <input style={inputStyle} value={baixa.obs} onChange={(e) => setBaixa((b) => ({ ...b, obs: e.target.value }))} placeholder="Ex.: material entregue" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setBaixaId(null)} style={smallBtnStyle}>Cancelar</button>
                      <button type="button" onClick={() => confirmarBaixa(p)} disabled={saving} style={{ ...btnStyle, padding: '5px 12px', fontSize: 12 }}>Confirmar baixa</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {form && !form.id && (
          <PendenciaForm inicial={form} sugestoes={(sugestoes || []).filter((s) => !s.jaTem)} nomesMateriais={ctx.nomesMateriais}
            saving={saving} onSave={salvar} onCancel={() => setForm(null)} />
        )}
      </div>

      {comBaixa.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => setVerBaixadas((v) => !v)} style={{ ...smallBtnStyle, border: 'none', padding: '2px 0' }}>
            {verBaixadas ? '▾' : '▸'} {comBaixa.length} com baixa
          </button>
          {verBaixadas && (
            <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
              {comBaixa.map((p) => (
                <div key={p.id} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', opacity: 0.85 }}>
                  <PendenciaResumo p={p} />
                  {canEdit && (
                    <button type="button" onClick={() => executar(() => reabrirPendencia(p.id), 'Pendência reaberta.')} style={{ ...smallBtnStyle, marginTop: 6 }}>Reabrir</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {msg && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{msg}</p>}
    </div>
  );
}

/** Pendências de um alvo vigentes num dia (RVT é diário): já existiam e ainda não tinham
    baixa naquela data. Reimprimir um RVT antigo mostra a situação daquele dia. */
export function pendenciasVigentesNoDia(lista, alvo, dia) {
  if (!alvo) return [];
  return pendenciasDoAlvo(lista, alvo)
    .filter((p) => (!p.desde || p.desde <= dia) && (!p.baixaEm || p.baixaEm > dia))
    .sort((a, b) => (a.desde || '').localeCompare(b.desde || ''));
}

const thPrint = { textAlign: 'left', fontWeight: 600, fontSize: 10, padding: '3px 6px', borderBottom: '1px solid var(--text-primary)' };
const tdPrint = { fontSize: 11, padding: '3px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', wordBreak: 'break-word' };

/** Bloco "Pendências para conclusão" no fim do card do item no RVT impresso.
    Legível em preto e branco: borda escura e responsável escrito por extenso (não só cor). */
export function PendenciasPrintBlock({ pendencias, dia }) {
  if (!pendencias?.length) return null;
  const diasAte = (p) => {
    if (!p.desde) return null;
    return Math.max(0, Math.round((new Date(`${dia}T00:00:00`) - new Date(`${p.desde}T00:00:00`)) / 86400000));
  };
  return (
    <div className="rvt-pendencias" style={{ marginTop: 10, border: '1px solid var(--text-primary)', padding: '8px 10px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 6 }}>PENDÊNCIAS PARA CONCLUSÃO</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {pendencias.map((p, i) => {
          const d = diasAte(p);
          return (
            <div key={p.id} style={{ breakInside: 'avoid', paddingTop: i ? 6 : 0, borderTop: i ? '1px dashed var(--border)' : 'none' }}>
              <p style={{ fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                <strong>{i + 1}. {tipoPendenciaLabel(p)}</strong>
                {' — Responsável: '}<strong>{responsavelLabel(p).toUpperCase()}</strong>
                {' · Desde '}{formatDateBR(p.desde)}{d ? ` (${d} dia${d === 1 ? '' : 's'} aguardando)` : ''}
                {' · Previsão '}{p.previsao ? formatDateBR(p.previsao) : '—'}
              </p>
              {p.tipo === 'material' && p.materiais?.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, tableLayout: 'fixed', color: 'var(--text-primary)' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thPrint, width: '30%' }}>Item</th>
                      <th style={{ ...thPrint, width: '12%' }}>Qtd</th>
                      <th style={{ ...thPrint, width: '24%' }}>Especificação</th>
                      <th style={{ ...thPrint, width: '17%' }}>Marca/modelo</th>
                      <th style={{ ...thPrint, width: '17%' }}>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.materiais.map((m, mi) => (
                      <tr key={mi}>
                        <td style={tdPrint}>{m.item}</td>
                        <td style={tdPrint}>{formatQtd(m) || '—'}</td>
                        <td style={tdPrint}>{m.especificacao || '—'}</td>
                        <td style={tdPrint}>{m.marca || '—'}</td>
                        <td style={tdPrint}>{m.obs || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : p.detalhe ? (
                <p style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.detalhe}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Aviso ao resolver uma corretiva que ainda tem pendência aberta.
    const { dialog, perguntar } = usePerguntaBaixa();  →  renderizar {dialog};
    await perguntar(pendencias) → 'baixa' | 'sem' | 'voltar'. */
export function usePerguntaBaixa() {
  const [estado, setEstado] = useState(null); // { pendencias, resolve }
  function perguntar(pendencias) {
    return new Promise((resolve) => setEstado({ pendencias, resolve }));
  }
  function responder(r) {
    estado?.resolve(r);
    setEstado(null);
  }
  const n = estado?.pendencias.length || 0;
  // Portal no <body>: dentro da tela, um ancestral com transform (animação) prendia o
  // position:fixed e o fundo escuro não cobria a tela toda.
  const dialog = estado ? createPortal(
    <div onClick={() => responder('voltar')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, maxWidth: 440, width: '100%' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Esta corretiva tem {n} pendência{n === 1 ? '' : 's'} aberta{n === 1 ? '' : 's'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {estado.pendencias.map((p) => `${tipoPendenciaLabel(p)} (${responsavelLabel(p)})`).join(', ')}. Dar baixa junto com a resolução?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => responder('voltar')} style={smallBtnStyle}>Voltar</button>
          <button type="button" onClick={() => responder('sem')} style={smallBtnStyle}>Resolver sem baixa</button>
          <button type="button" onClick={() => responder('baixa')} style={btnStyle}>Resolver e dar baixa</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;
  return { dialog, perguntar };
}
