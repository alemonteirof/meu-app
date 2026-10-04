import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  listNaoConformidades, salvarNaoConformidade, excluirNaoConformidade, listVisitasResumo,
  listPendencias, listNomesMateriais,
  NC_CLASSIFICACOES, NC_CLASSIFICACAO_LABEL, NC_RISCOS, NC_STATUS, NC_NORMAS_SUGERIDAS,
} from '../supabaseAdapter';
import { compressImageFile } from '../lib/imagens';
import { hojeLocal } from '../lib/datas';
import { PendenciasItem } from './Pendencias';

// Não conformidades (NC): "fora da regra mesmo funcionando" (ex.: fontes sem certificação ou
// subdimensionadas). Classificação Normativa / Regras internas / Seguradora + embasamento.
// Cliente vê tudo (só leitura); equipe MAJ cadastra, trata e encerra (solução + fotos).

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 14,
};
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
const btnStyle = { background: '#8B2F2F', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' };
const smallBtnStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' };
const cardStyle = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' };

const RISCO_LABEL = Object.fromEntries(NC_RISCOS.map((r) => [r.value, r.label]));
const STATUS_LABEL = Object.fromEntries(NC_STATUS.map((s) => [s.value, s.label]));
const RISCO_COR = { alto: 'var(--status-danger)', medio: 'var(--status-warn, #b07000)', baixo: 'var(--text-secondary)' };
const STATUS_COR = { aberta: 'var(--status-danger)', em_tratamento: 'var(--status-warn, #b07000)', encerrada: 'var(--status-ok)' };

function formatDateBR(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function embasamentoTexto(nc) {
  return [nc.norma, nc.normaItem && `item ${nc.normaItem}`].filter(Boolean).join(' — ');
}
export function localTexto(nc) {
  return [nc.painel, nc.dispositivo, nc.localTexto].filter(Boolean).join(' · ');
}

function Badge({ children, cor }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: `1px solid ${cor}`, color: cor, whiteSpace: 'nowrap' }}>{children}</span>;
}

function FotosInput({ label, fotos, setFotos }) {
  const ref = useRef(null);
  const [erro, setErro] = useState('');
  async function onChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setErro('');
    try {
      const novas = await Promise.all(files.map((f) => compressImageFile(f, 2048, 0.85)));
      setFotos([...(fotos || []), ...novas]);
    } catch (err) {
      setErro(err.message || 'Não foi possível anexar a foto.');
    }
  }
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <input ref={ref} type="file" accept="image/*" multiple onChange={onChange} style={{ display: 'none' }} />
      <button type="button" onClick={() => ref.current?.click()} style={{ ...smallBtnStyle, padding: '7px 12px', fontSize: 13, color: 'var(--text-primary)' }}>+ Anexar foto</button>
      {erro && <p style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 4 }}>{erro}</p>}
      {(fotos || []).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {fotos.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={f} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} aria-label="Remover foto"
                style={{ position: 'absolute', top: -6, right: -6, background: '#8B2F2F', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Fotos({ fotos, tamanho = 72 }) {
  if (!fotos?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      {fotos.map((f, i) => (
        <a key={i} href={f} target="_blank" rel="noreferrer">
          <img src={f} alt="" style={{ width: tamanho, height: tamanho, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
        </a>
      ))}
    </div>
  );
}

/** Bloco impresso de 1 NC — usado no RVT (seção "Não conformidades identificadas") e no
    relatório de NCs. Legível em P&B: rótulos por extenso, borda escura. */
export function NcPrintBlock({ nc, numero }) {
  const lbl = { fontSize: 9, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginTop: 6 };
  const txt = { fontSize: 11.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
  return (
    <div className="rvt-item-card rvt-pendencias" style={{ border: '1px solid var(--text-primary)', borderLeft: '4px solid #8B2F2F', padding: '10px 12px', breakInside: 'avoid', background: 'var(--surface-raised, var(--surface))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{numero ? `NC ${numero} · ` : ''}{nc.titulo}</p>
        <p style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          <strong>{NC_CLASSIFICACAO_LABEL[nc.classificacao]?.toUpperCase()}</strong>
          {nc.risco ? ` · Risco ${RISCO_LABEL[nc.risco]?.toUpperCase()}` : ''} · {STATUS_LABEL[nc.status]?.toUpperCase()}
        </p>
      </div>
      {embasamentoTexto(nc) && (<><p style={lbl}>Embasamento</p><p style={txt}>{embasamentoTexto(nc)}</p></>)}
      {localTexto(nc) && (<><p style={lbl}>Local</p><p style={txt}>{localTexto(nc)}</p></>)}
      {nc.descricao && (<><p style={lbl}>Constatação</p><p style={txt}>{nc.descricao}</p></>)}
      {nc.recomendacao && (<><p style={lbl}>Recomendação</p><p style={txt}>{nc.recomendacao}</p></>)}
      <Fotos fotos={nc.fotos} tamanho={88} />
      {nc.status === 'encerrada' && (
        <>
          <p style={lbl}>Solução aplicada ({formatDateBR(nc.encerradaEm)})</p>
          <p style={txt}>{nc.solucao || '—'}</p>
          <Fotos fotos={nc.fotosSolucao} tamanho={88} />
        </>
      )}
      <p style={{ ...txt, fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 6 }}>Constatada em {formatDateBR(nc.dataConstatacao)}</p>
    </div>
  );
}

function NcForm({ inicial, paineis, visitas, saving, onSave, onCancel }) {
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState('');
  const set = (patch) => { setErro(''); setF((p) => ({ ...p, ...patch })); };
  function salvar() {
    if (!f.titulo.trim()) { setErro('Dê um título para a não conformidade.'); return; }
    if (!f.classificacao) { setErro('Escolha a classificação.'); return; }
    onSave(f);
  }
  return (
    <div style={{ ...cardStyle, padding: 14, display: 'grid', gap: 10 }}>
      <div>
        <span style={labelStyle}>Título *</span>
        <input style={inputStyle} value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Fontes auxiliares sem certificação e subdimensionadas" />
      </div>
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Classificação *</span>
          <select style={inputStyle} value={f.classificacao} onChange={(e) => set({ classificacao: e.target.value })}>
            <option value="">Escolha...</option>
            {NC_CLASSIFICACOES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Risco</span>
          <select style={inputStyle} value={f.risco} onChange={(e) => set({ risco: e.target.value })}>
            <option value="">—</option>
            {NC_RISCOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Norma / referência</span>
          <input style={inputStyle} list="nc-normas" value={f.norma} onChange={(e) => set({ norma: e.target.value })} placeholder="Escolha ou digite" />
          <datalist id="nc-normas">{NC_NORMAS_SUGERIDAS.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div>
          <span style={labelStyle}>Item da norma (conforme o texto oficial)</span>
          <input style={inputStyle} value={f.normaItem} onChange={(e) => set({ normaItem: e.target.value })} placeholder="Ex.: 5.3.2" />
        </div>
      </div>
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Painel (opcional)</span>
          <select style={inputStyle} value={f.painelId} onChange={(e) => set({ painelId: e.target.value })}>
            <option value="">—</option>
            {paineis.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Local / área</span>
          <input style={inputStyle} value={f.localTexto} onChange={(e) => set({ localTexto: e.target.value })} placeholder="Ex.: Áreas Trim, Body e Plastic" />
        </div>
      </div>
      {f.dispositivo && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Dispositivo vinculado: {f.dispositivo}</p>}
      <div>
        <span style={labelStyle}>Constatação / evidência</span>
        <textarea style={{ ...inputStyle, minHeight: 90 }} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="O que foi encontrado, medições, por que está fora da regra" />
      </div>
      <div>
        <span style={labelStyle}>Recomendação</span>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={f.recomendacao} onChange={(e) => set({ recomendacao: e.target.value })} placeholder="O que precisa ser feito para ficar conforme" />
      </div>
      <div className="grid-2-mobile-safe">
        <div>
          <span style={labelStyle}>Data da constatação</span>
          <input type="date" style={inputStyle} value={f.dataConstatacao} onChange={(e) => set({ dataConstatacao: e.target.value })} />
        </div>
        <div>
          <span style={labelStyle}>Visita (sai no RVT dela)</span>
          <select style={inputStyle} value={f.rvtId} onChange={(e) => set({ rvtId: e.target.value })}>
            <option value="">— nenhuma —</option>
            {visitas.map((v) => <option key={v.id} value={v.id}>{formatDateBR(v.data_visita)}{v.tecnico ? ` · ${v.tecnico}` : ''}</option>)}
          </select>
        </div>
      </div>
      <FotosInput label="Fotos da constatação" fotos={f.fotos} setFotos={(fotos) => set({ fotos })} />
      {f.id && (
        <div>
          <span style={labelStyle}>Status</span>
          <select style={inputStyle} value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {NC_STATUS.filter((s) => s.value !== 'encerrada' || f.status === 'encerrada').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}
      {erro && <p style={{ fontSize: 12, color: 'var(--status-danger)' }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallBtnStyle}>Cancelar</button>
        <button type="button" onClick={salvar} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}

function EncerrarForm({ nc, saving, onSave, onCancel }) {
  const [solucao, setSolucao] = useState(nc.solucao || '');
  const [fotos, setFotos] = useState(nc.fotosSolucao || []);
  const [data, setData] = useState(hojeLocal());
  const [erro, setErro] = useState('');
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gap: 8 }}>
      <div>
        <span style={labelStyle}>Solução aplicada *</span>
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={solucao} onChange={(e) => { setErro(''); setSolucao(e.target.value); }} placeholder="O que foi feito para ficar conforme" />
      </div>
      <div style={{ maxWidth: 220 }}>
        <span style={labelStyle}>Data do encerramento</span>
        <input type="date" style={inputStyle} value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <FotosInput label="Fotos da solução" fotos={fotos} setFotos={setFotos} />
      {erro && <p style={{ fontSize: 12, color: 'var(--status-danger)' }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallBtnStyle}>Cancelar</button>
        <button type="button" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}
          onClick={() => { if (!solucao.trim()) { setErro('Descreva a solução aplicada.'); return; } onSave({ ...nc, status: 'encerrada', solucao, fotosSolucao: fotos, encerradaEm: data }); }}>
          Encerrar NC
        </button>
      </div>
    </div>
  );
}

function NcCard({ nc, canEdit, pendCtx, onEditar, onSalvar, onExcluir, saving }) {
  const [encerrando, setEncerrando] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${STATUS_COR[nc.status]}`, borderRadius: 0, padding: '10px 12px', display: 'grid', gap: 6 }}>
      <button type="button" onClick={() => setAberto((a) => !a)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 14, wordBreak: 'break-word' }}>{aberto ? '▾' : '▸'} {nc.titulo}</strong>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge cor="var(--text-primary)">{NC_CLASSIFICACAO_LABEL[nc.classificacao]}</Badge>
            {nc.risco && <Badge cor={RISCO_COR[nc.risco]}>Risco {RISCO_LABEL[nc.risco]}</Badge>}
            <Badge cor={STATUS_COR[nc.status]}>{STATUS_LABEL[nc.status]}</Badge>
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {[localTexto(nc), embasamentoTexto(nc), `constatada em ${formatDateBR(nc.dataConstatacao)}`].filter(Boolean).join(' · ')}
        </div>
      </button>
      {aberto && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
          {nc.descricao && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><span style={{ color: 'var(--text-secondary)' }}>Constatação: </span>{nc.descricao}</div>}
          {nc.recomendacao && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><span style={{ color: 'var(--text-secondary)' }}>Recomendação: </span>{nc.recomendacao}</div>}
          {nc.dataVisita && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Registrada na visita de {formatDateBR(nc.dataVisita)} (sai no RVT)</div>}
          <Fotos fotos={nc.fotos} />
          {nc.status === 'encerrada' && (
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(39,174,96,.10)' }}>
              <div style={{ color: 'var(--status-ok)', fontWeight: 600 }}>Encerrada em {formatDateBR(nc.encerradaEm)}{nc.encerradaPor ? ` por ${nc.encerradaPor}` : ''}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{nc.solucao}</div>
              <Fotos fotos={nc.fotosSolucao} />
            </div>
          )}
          <PendenciasItem ctx={pendCtx} alvo={{ naoConformidadeId: nc.id }} aberto={nc.status !== 'encerrada'} canEdit={canEdit}
            dataPadrao={nc.dataConstatacao} rvtId={nc.rvtId || null} />
          {canEdit && !encerrando && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" onClick={() => onEditar(nc)} style={smallBtnStyle}>Editar</button>
              {nc.status !== 'encerrada'
                ? <button type="button" onClick={() => setEncerrando(true)} style={{ ...smallBtnStyle, border: '1px solid var(--status-ok)', color: 'var(--status-ok)' }}>Encerrar</button>
                : <button type="button" onClick={() => onSalvar({ ...nc, status: 'em_tratamento' })} disabled={saving} style={smallBtnStyle}>Reabrir</button>}
              {!confirmaExcluir
                ? <button type="button" onClick={() => setConfirmaExcluir(true)} style={{ ...smallBtnStyle, color: 'var(--status-danger)' }}>Excluir</button>
                : (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--status-danger)' }}>
                    Excluir de vez (com as pendências dela)?
                    <button type="button" onClick={() => onExcluir(nc)} style={{ ...smallBtnStyle, border: '1px solid var(--status-danger)', color: 'var(--status-danger)' }}>Sim, excluir</button>
                    <button type="button" onClick={() => setConfirmaExcluir(false)} style={smallBtnStyle}>Não</button>
                  </span>
                )}
            </div>
          )}
          {canEdit && encerrando && (
            <EncerrarForm nc={nc} saving={saving} onCancel={() => setEncerrando(false)}
              onSave={async (n) => { const ok = await onSalvar(n); if (ok) setEncerrando(false); }} />
          )}
        </div>
      )}
    </div>
  );
}

function NcPrintView({ lista, client, onBack }) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `Nao conformidades - ${(client?.name || '').replace(/[\\/:*?"<>|]/g, '-')} - ${formatDateBR(hojeLocal()).replace(/\//g, '-')}`;
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
            <p style={{ color: '#fff', fontWeight: 600, fontSize: 16, letterSpacing: '0.04em' }}>RELATÓRIO DE NÃO CONFORMIDADES</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>Posição em {formatDateBR(hojeLocal())}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {lista.map((nc, i) => <NcPrintBlock key={nc.id} nc={nc} numero={i + 1} />)}
        </div>
      </div>
    </div>
  );
}

async function exportarExcel(lista, client) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Não conformidades');
  ws.columns = [
    ['Nº', 6], ['Título', 34], ['Classificação', 14], ['Norma / referência', 30], ['Item', 10], ['Local', 28], ['Risco', 9],
    ['Status', 13], ['Constatação', 50], ['Recomendação', 40], ['Constatada em', 12], ['Encerrada em', 12], ['Solução', 40],
  ].map(([header, width]) => ({ header, width }));
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B2F2F' } };
  h.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const d = (s) => (s ? new Date(`${s}T00:00:00`) : null);
  lista.forEach((nc, i) => ws.addRow([i + 1, nc.titulo, NC_CLASSIFICACAO_LABEL[nc.classificacao], nc.norma, nc.normaItem, localTexto(nc),
    RISCO_LABEL[nc.risco] || '', STATUS_LABEL[nc.status], nc.descricao, nc.recomendacao, d(nc.dataConstatacao), d(nc.encerradaEm), nc.solucao]));
  [11, 12].forEach((c) => { ws.getColumn(c).numFmt = 'dd/mm/yyyy'; });
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { ...(c.alignment || {}), vertical: 'top', wrapText: true }; }));
  ws.autoFilter = { from: 'A1', to: 'M1' };
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Nao conformidades - ${(client?.name || 'cliente').replace(/[\\/:*?"<>|]/g, '-')} - ${formatDateBR(hojeLocal()).replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const vazia = (clienteId) => ({
  id: null, clienteId, rvtId: '', classificacao: '', norma: '', normaItem: '', titulo: '', descricao: '', localTexto: '',
  painelId: '', dispositivoId: '', risco: '', recomendacao: '', fotos: [], dataConstatacao: hojeLocal(), status: 'aberta',
  solucao: '', fotosSolucao: [],
});

export default function NaoConformidades({ clientId, client, data, canEdit }) {
  const [lista, setLista] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [nomes, setNomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState({ classificacao: '', status: 'abertas', risco: '' });
  const [imprimindo, setImprimindo] = useState(false);
  const paineis = (data?.panels || []).map((p) => ({ id: p.id, name: p.name || p.nome || 'Painel' }));

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, v, p, n] = await Promise.all([listNaoConformidades(clientId), listVisitasResumo(clientId), listPendencias(clientId), listNomesMateriais()]);
      setLista(l); setVisitas(v); setPendencias(p); setNomes(n);
    } catch (e) {
      console.error(e);
      setMsg('Não foi possível carregar as não conformidades.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => { carregar(); }, [carregar]);

  const pendCtx = { lista: pendencias, clienteId: clientId, nomesMateriais: nomes, recarregar: carregar };

  const filtradas = useMemo(() => lista.filter((nc) => (!filtro.classificacao || nc.classificacao === filtro.classificacao)
    && (!filtro.risco || nc.risco === filtro.risco)
    && (filtro.status === 'todas' || (filtro.status === 'abertas' ? nc.status !== 'encerrada' : nc.status === filtro.status))), [lista, filtro]);
  const resumo = {
    abertas: lista.filter((n) => n.status === 'aberta').length,
    tratamento: lista.filter((n) => n.status === 'em_tratamento').length,
    encerradas: lista.filter((n) => n.status === 'encerrada').length,
    riscoAlto: lista.filter((n) => n.status !== 'encerrada' && n.risco === 'alto').length,
  };

  async function salvar(nc) {
    setSaving(true); setMsg('');
    try {
      await salvarNaoConformidade({ ...nc, clienteId: clientId });
      setForm(null);
      setMsg(nc.status === 'encerrada' ? 'Não conformidade encerrada.' : 'Não conformidade salva.');
      await carregar();
      return true;
    } catch (e) {
      console.error(e);
      setMsg('Erro ao salvar. Tente de novo.');
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function excluir(nc) {
    try { await excluirNaoConformidade(nc.id); setMsg('Não conformidade excluída.'); await carregar(); } catch (e) { console.error(e); setMsg('Erro ao excluir.'); }
  }

  if (imprimindo) return <NcPrintView lista={filtradas} client={client} onBack={() => setImprimindo(false)} />;

  const Stat = ({ label, valor, cor }) => (
    <div style={{ ...cardStyle, padding: 12, borderTop: '3px solid #8B2F2F', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor || 'var(--text-primary)' }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Não conformidades</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>O que está fora de norma, de regra interna ou de exigência da seguradora — mesmo funcionando.</p>
        </div>
        {canEdit && !form && <button type="button" onClick={() => setForm(vazia(clientId))} style={btnStyle}>+ Nova não conformidade</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat label="Abertas" valor={resumo.abertas} cor={resumo.abertas ? 'var(--status-danger)' : undefined} />
        <Stat label="Em tratamento" valor={resumo.tratamento} />
        <Stat label="Encerradas" valor={resumo.encerradas} cor={resumo.encerradas ? 'var(--status-ok)' : undefined} />
        <Stat label="Risco alto (abertas)" valor={resumo.riscoAlto} cor={resumo.riscoAlto ? 'var(--status-danger)' : undefined} />
      </div>

      {form && <NcForm inicial={form} paineis={paineis} visitas={visitas} saving={saving} onSave={salvar} onCancel={() => setForm(null)} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtro.status} onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))} aria-label="Filtrar por status">
          <option value="abertas">Não encerradas</option>
          <option value="aberta">Abertas</option>
          <option value="em_tratamento">Em tratamento</option>
          <option value="encerrada">Encerradas</option>
          <option value="todas">Todas</option>
        </select>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtro.classificacao} onChange={(e) => setFiltro((f) => ({ ...f, classificacao: e.target.value }))} aria-label="Filtrar por classificação">
          <option value="">Classificação: todas</option>
          {NC_CLASSIFICACOES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 'auto' }} value={filtro.risco} onChange={(e) => setFiltro((f) => ({ ...f, risco: e.target.value }))} aria-label="Filtrar por risco">
          <option value="">Risco: todos</option>
          {NC_RISCOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setImprimindo(true)} disabled={!filtradas.length} style={{ ...smallBtnStyle, padding: '8px 12px', fontSize: 13 }}>Imprimir</button>
          <button type="button" disabled={!filtradas.length} style={{ ...smallBtnStyle, padding: '8px 12px', fontSize: 13 }}
            onClick={() => exportarExcel(filtradas, client).catch((e) => { console.error(e); setMsg('Erro ao gerar o Excel.'); })}>Exportar Excel</button>
        </div>
      </div>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</p>}
      {loading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Carregando...</p>}
      {!loading && filtradas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lista.length ? 'Nenhuma não conformidade com esse filtro.' : 'Nenhuma não conformidade registrada.'}</p>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {filtradas.map((nc) => (
          <NcCard key={nc.id} nc={nc} canEdit={canEdit} pendCtx={pendCtx} saving={saving}
            onEditar={(n) => { setForm({ ...n }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onSalvar={salvar} onExcluir={excluir} />
        ))}
      </div>
    </div>
  );
}
