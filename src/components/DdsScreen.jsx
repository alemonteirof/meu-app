// src/components/DdsScreen.jsx
//
// Uso: <DdsScreen role={role} nomeUsuario={nome} onBack={() => ...} />
// DDS (Diálogo Diário de Segurança) — só membros MAJ (admin/operador).
// Fluxo: alguém abre o DDS do dia (tema sugerido = próximo da sequência) →
// cada participante entra com o PRÓPRIO login e assina a presença →
// quem abriu (ou admin) encerra → lista vira PDF (Imprimir / Salvar PDF).
// Assinatura reaproveita MajSignatureField; uid/email/nome/data/hash são
// carimbados por trigger (migracao_dds.sql) e vão pra assinatura_auditoria_maj.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { DDS_TEMAS, DDS_DURACAO, getTemaDds, proximoTemaDds } from "../lib/ddsTemas";
import MajSignatureField, { AssinaturaPreview } from "./MajSignatureField";
import MajFolhaImpressao, { ResumoCard } from "./MajFolhaImpressao";

const VINHO = "#8B2F2F";

const btnBase = { fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };
const btnPrimario = { ...btnBase, background: VINHO, borderColor: VINHO, color: "white", fontWeight: 600 };
const btnPerigo = { ...btnBase, borderColor: "var(--status-danger)", color: "var(--status-danger)" };
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 };

const hoje = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const dataHoraBR = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "—");
const nomeAssinante = (a) => a.assinado_por_nome || a.assinado_por_email || "—";

function ConteudoTema({ tema, compacto = false }) {
  if (!tema) return <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tema não encontrado no banco de temas.</p>;
  const rotulo = (t) => <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>{t}</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {tema.categoria} · {tema.referencia} · {DDS_DURACAO}{tema.retomadaDe ? ` · retomada do ${tema.retomadaDe}` : ""}
      </p>
      <div>{rotulo("1. Abertura")}<p style={{ fontStyle: "italic" }}>{tema.abertura}</p></div>
      <div>{rotulo("2. Mensagem principal")}<p style={{ lineHeight: 1.55 }}>{tema.mensagem}</p></div>
      <div>
        {rotulo("3. Pontos-chave")}
        <ul style={{ paddingLeft: 18, listStyle: "disc" }}>{tema.pontosChave.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      {!compacto && <div>{rotulo("4. Pergunta para a equipe")}<p>{tema.pergunta}</p></div>}
      <div>{rotulo(compacto ? "Fechamento" : "5. Fechamento")}<p style={{ fontWeight: 700 }}>{tema.fechamento}</p></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Abrir novo DDS
// ---------------------------------------------------------------------------
function NovoDds({ ultimoCodigo, onCriado, onCancelar }) {
  const sugerido = proximoTemaDds(ultimoCodigo);
  const [codigo, setCodigo] = useState(sugerido.codigo);
  const [dataDds, setDataDds] = useState(hoje);
  const [local, setLocal] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const tema = getTemaDds(codigo);

  async function abrir() {
    setErro("");
    setSalvando(true);
    const { data, error } = await supabase
      .from("dds_sessoes")
      .insert({ tema_codigo: tema.codigo, tema_titulo: tema.titulo, data_dds: dataDds, local: local.trim() || null })
      .select()
      .single();
    setSalvando(false);
    if (error) { setErro(`Erro ao abrir: ${error.message}`); return; }
    onCriado(data);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">Abrir novo DDS</h1>
        <p className="text-sm opacity-90">Depois de aberto, cada participante entra com o próprio login e assina.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tema</label>
        <select className="field-input w-full rounded p-2" value={codigo} onChange={(e) => setCodigo(e.target.value)}>
          {DDS_TEMAS.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.codigo} — {t.titulo}{t.codigo === sugerido.codigo ? "  (sugerido)" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          Sugerido: próximo da sequência{ultimoCodigo ? ` (último DDS aberto foi o ${ultimoCodigo})` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Data</label>
          <input type="date" className="field-input w-full rounded p-2" value={dataDds} onChange={(e) => setDataDds(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Local (opcional)</label>
          <input className="field-input w-full rounded p-2" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Base MAJ, cliente X" />
        </div>
      </div>

      <div style={card}><p className="font-semibold mb-2">{tema.codigo} — {tema.titulo}</p><ConteudoTema tema={tema} /></div>

      {erro && <p className="text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} style={btnBase}>Cancelar</button>
        <button type="button" disabled={salvando} onClick={abrir} style={{ ...btnPrimario, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Abrindo..." : "Abrir DDS"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folha de presença (PDF via window.print — mesmo esquema do RVT)
// ---------------------------------------------------------------------------
function DdsImpressao({ sessao, assinaturas, onBack }) {
  const tema = getTemaDds(sessao.tema_codigo);
  const nomeArquivo = `DDS - ${sessao.tema_codigo} - ${dataBR(sessao.data_dds).replace(/\//g, "-")}`;

  const rodape = `Encerrado em ${dataHoraBR(sessao.encerrado_em)}${sessao.encerrado_por_nome ? ` por ${sessao.encerrado_por_nome}` : ""}. `
    + "Login, data/hora e código de verificação de cada assinatura foram registrados no servidor (CCM).";

  return (
    <MajFolhaImpressao titulo="DIÁLOGO DIÁRIO DE SEGURANÇA" subtitulo={`Lista de presença · ${sessao.tema_codigo}`}
      nomeArquivo={nomeArquivo} onBack={onBack} rodape={rodape}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResumoCard rotulo="Data" valor={dataBR(sessao.data_dds)} />
            <ResumoCard rotulo="Local" valor={sessao.local || "—"} />
            <ResumoCard rotulo="Conduzido por" valor={sessao.criado_por_nome || sessao.criado_por_email || "—"} />
            <ResumoCard rotulo="Participantes" valor={String(assinaturas.length)} />
          </div>

          <div className="rvt-item-card rounded-lg p-4" style={{ background: "var(--surface-raised)", borderLeft: `4px solid ${VINHO}` }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{sessao.tema_codigo} — {sessao.tema_titulo}</p>
            <ConteudoTema tema={tema} compacto />
          </div>

          <div>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Participantes</p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
              Ao assinar, cada participante declara que participou deste DDS, entendeu o conteúdo e vai aplicá-lo.
            </p>
            {assinaturas.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nenhuma assinatura registrada.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: 6, width: 28 }}>#</th>
                    <th style={{ padding: 6 }}>Nome / login</th>
                    <th style={{ padding: 6 }}>Data e hora</th>
                    <th style={{ padding: 6, width: "38%" }}>Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {assinaturas.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)", breakInside: "avoid" }}>
                      <td style={{ padding: 6, verticalAlign: "middle" }}>{i + 1}</td>
                      <td style={{ padding: 6, verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 600 }}>{nomeAssinante(a)}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>{a.assinado_por_email}</div>
                      </td>
                      <td style={{ padding: 6, verticalAlign: "middle" }}>{dataHoraBR(a.assinado_em)}</td>
                      <td style={{ padding: 6, verticalAlign: "middle" }}>
                        <AssinaturaPreview tipo={a.assinatura_tipo} valor={a.assinatura_valor} maxWidth={200} />
                        {a.assinatura_hash && (
                          <div style={{ color: "var(--text-secondary)", fontSize: 9, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                            SHA-256 {a.assinatura_hash.slice(0, 16)}…
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
    </MajFolhaImpressao>
  );
}

// ---------------------------------------------------------------------------
// Detalhe do DDS: conteúdo + assinar + lista de presença + encerrar
// ---------------------------------------------------------------------------
function DdsDetalhe({ sessaoInicial, uid, isAdmin, nomeUsuario, onBack, onMudou }) {
  const [sessao, setSessao] = useState(sessaoInicial);
  const [assinaturas, setAssinaturas] = useState(null);
  const [assinatura, setAssinatura] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // 'encerrar' | 'excluir' | null
  const [imprimindo, setImprimindo] = useState(false);
  const tema = getTemaDds(sessao.tema_codigo);
  const aberto = sessao.status === "aberto";
  const podeEncerrar = aberto && (sessao.criado_por_uid === uid || isAdmin);
  const jaAssinei = (assinaturas || []).some((a) => a.assinado_por_uid === uid);

  const carregar = useCallback(async () => {
    const [{ data: s }, { data: a, error }] = await Promise.all([
      supabase.from("dds_sessoes").select("*").eq("id", sessaoInicial.id).maybeSingle(),
      supabase.from("dds_assinaturas").select("*").eq("dds_id", sessaoInicial.id).order("assinado_em"),
    ]);
    if (s) setSessao(s);
    if (error) setMsg({ tipo: "erro", texto: error.message });
    else setAssinaturas(a || []);
  }, [sessaoInicial.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // Enquanto aberto, atualiza a lista de presença sozinho (outros assinam em outros celulares)
  useEffect(() => {
    if (!aberto) return undefined;
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [aberto, carregar]);

  async function assinar() {
    if (!assinatura) { setMsg({ tipo: "erro", texto: "Faça sua assinatura antes de confirmar presença." }); return; }
    setMsg(null);
    setEnviando(true);
    const { error } = await supabase.from("dds_assinaturas").insert({
      dds_id: sessao.id,
      // uid/email/nome/data/hash são carimbados por trigger no banco
      assinatura_tipo: assinatura.tipo,
      assinatura_valor: assinatura.valor,
      assinatura_origem: assinatura.origem,
    });
    setEnviando(false);
    if (error) {
      const dup = error.code === "23505";
      setMsg({ tipo: "erro", texto: dup ? "Você já assinou este DDS." : `Erro ao assinar: ${error.message}` });
    } else {
      setMsg({ tipo: "ok", texto: "Presença assinada." });
      setAssinatura(null);
      onMudou();
    }
    carregar();
  }

  async function encerrar() {
    setConfirmar(null);
    const { error } = await supabase.from("dds_sessoes").update({ status: "encerrado" }).eq("id", sessao.id);
    if (error) { setMsg({ tipo: "erro", texto: `Erro ao encerrar: ${error.message}` }); return; }
    setMsg({ tipo: "ok", texto: "DDS encerrado. Já pode gerar o PDF." });
    onMudou();
    carregar();
  }

  async function excluir() {
    setConfirmar(null);
    const { error } = await supabase.from("dds_sessoes").delete().eq("id", sessao.id);
    if (error) { setMsg({ tipo: "erro", texto: `Erro ao excluir: ${error.message}` }); return; }
    onMudou();
    onBack();
  }

  if (imprimindo && assinaturas) {
    return <DdsImpressao sessao={sessao} assinaturas={assinaturas} onBack={() => setImprimindo(false)} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <button type="button" onClick={onBack} className="text-sm underline" style={{ color: "var(--accent)" }}>← Lista de DDS</button>

      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <p className="text-xs opacity-80">{sessao.tema_codigo} · {dataBR(sessao.data_dds)}{sessao.local ? ` · ${sessao.local}` : ""}</p>
        <h1 className="text-lg font-bold">{sessao.tema_titulo}</h1>
        <p className="text-xs opacity-80 mt-1">
          Aberto por {sessao.criado_por_nome || sessao.criado_por_email || "—"} · {aberto ? "aberto para assinaturas" : `encerrado em ${dataHoraBR(sessao.encerrado_em)}`}
        </p>
      </div>

      <div style={card}><ConteudoTema tema={tema} /></div>

      <div style={card}>
        <div className="flex justify-between items-center mb-2 gap-2">
          <p className="text-sm font-semibold">Participantes ({assinaturas ? assinaturas.length : "…"})</p>
          {aberto && <button type="button" onClick={carregar} style={{ ...btnBase, fontSize: 12, padding: "4px 10px" }}>Atualizar</button>}
        </div>
        {assinaturas && assinaturas.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Ninguém assinou ainda.</p>
        )}
        <div className="space-y-2">
          {(assinaturas || []).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-sm">
                <p className="font-semibold">{nomeAssinante(a)}{a.assinado_por_uid === uid ? " (você)" : ""}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.assinado_por_email} · {dataHoraBR(a.assinado_em)}</p>
              </div>
              <AssinaturaPreview tipo={a.assinatura_tipo} valor={a.assinatura_valor} maxWidth={140} />
            </div>
          ))}
        </div>
      </div>

      {aberto && assinaturas && !jaAssinei && (
        <div className="space-y-2">
          <MajSignatureField value={assinatura} onChange={setAssinatura} nomeSugerido={nomeUsuario} />
          <button type="button" disabled={enviando} onClick={assinar} className="w-full py-2 rounded text-white font-semibold disabled:opacity-50" style={{ backgroundColor: VINHO }}>
            {enviando ? "Enviando..." : "Assinar presença neste DDS"}
          </button>
        </div>
      )}
      {aberto && jaAssinei && (
        <p className="text-sm" style={{ color: "var(--status-ok)" }}>✓ Você já assinou este DDS.</p>
      )}

      {msg && <p className="text-sm" style={{ color: msg.tipo === "erro" ? "var(--status-danger)" : "var(--status-ok)" }}>{msg.texto}</p>}

      <div className="flex gap-2 flex-wrap">
        {!aberto && <button type="button" onClick={() => setImprimindo(true)} style={btnPrimario}>Gerar PDF (lista de presença)</button>}
        {podeEncerrar && confirmar !== "encerrar" && (
          <button type="button" onClick={() => setConfirmar("encerrar")} style={btnPrimario}>Encerrar DDS</button>
        )}
        {isAdmin && confirmar !== "excluir" && (
          <button type="button" onClick={() => setConfirmar("excluir")} style={btnPerigo}>Excluir</button>
        )}
      </div>

      {confirmar && (
        <div style={{ ...card, borderColor: confirmar === "excluir" ? "var(--status-danger)" : VINHO }}>
          <p className="text-sm mb-2">
            {confirmar === "encerrar"
              ? `Encerrar o DDS com ${assinaturas?.length || 0} assinatura(s)? Depois de encerrado ninguém mais assina.`
              : "Excluir este DDS e todas as assinaturas? A trilha de auditoria guarda uma cópia, mas o DDS some da lista."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmar(null)} style={btnBase}>Cancelar</button>
            <button type="button" onClick={confirmar === "encerrar" ? encerrar : excluir} style={confirmar === "excluir" ? { ...btnPrimario, background: "var(--status-danger)", borderColor: "var(--status-danger)" } : btnPrimario}>
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista (abertos / encerrados)
// ---------------------------------------------------------------------------
function DdsLista({ sessoes, contagens, minhas, onAbrir, onNovo, erro }) {
  const abertos = (sessoes || []).filter((s) => s.status === "aberto");
  const encerrados = (sessoes || []).filter((s) => s.status === "encerrado");

  const linha = (s) => (
    <button key={s.id} type="button" onClick={() => onAbrir(s)} className="w-full text-left border rounded p-3 flex justify-between items-center gap-2"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
      <div>
        <p className="text-sm font-semibold">{s.tema_codigo} — {s.tema_titulo}</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {dataBR(s.data_dds)}{s.local ? ` · ${s.local}` : ""} · aberto por {s.criado_por_nome || s.criado_por_email || "—"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {s.status === "aberto" && !minhas.has(s.id) && (
          <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: "rgba(139,47,47,0.2)", color: "var(--text-primary)" }}>Falta sua assinatura</span>
        )}
        <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}>
          {contagens[s.id] || 0} assin.
        </span>
      </div>
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="rounded-lg p-4 text-white flex justify-between items-center gap-2 flex-wrap" style={{ backgroundColor: VINHO }}>
        <div>
          <h1 className="text-lg font-bold">DDS — Diálogo Diário de Segurança</h1>
          <p className="text-sm opacity-90">Lista de presença assinada por cada participante</p>
        </div>
        <button type="button" onClick={onNovo} style={{ ...btnBase, background: "white", color: VINHO, borderColor: "white", fontWeight: 600 }}>+ Abrir novo DDS</button>
      </div>

      {erro && <p className="text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>}
      {!sessoes && !erro && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>}

      {sessoes && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Abertos para assinatura ({abertos.length})</p>
            {abertos.length === 0 && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Nenhum DDS aberto agora.</p>}
            {abertos.map(linha)}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Encerrados ({encerrados.length})</p>
            {encerrados.length === 0 && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Nenhum DDS encerrado ainda.</p>}
            {encerrados.map(linha)}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export default function DdsScreen({ role, nomeUsuario = "", onBack }) {
  const [aba, setAba] = useState("lista"); // "lista" | "assinatura"
  const [view, setView] = useState({ tipo: "lista" }); // { tipo: 'lista' } | { tipo: 'novo' } | { tipo: 'detalhe', sessao }
  const [sessoes, setSessoes] = useState(null);
  const [contagens, setContagens] = useState({});
  const [minhas, setMinhas] = useState(new Set());
  const [uid, setUid] = useState(null);
  const [erro, setErro] = useState(null);
  const isAdmin = role === "admin";

  const carregar = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const meuUid = u?.user?.id || null;
    setUid(meuUid);
    const { data, error } = await supabase.from("dds_sessoes").select("*").order("data_dds", { ascending: false }).order("criado_em", { ascending: false }).limit(200);
    if (error) { setErro(error.message); return; }
    setSessoes(data || []);
    const ids = (data || []).map((s) => s.id);
    if (!ids.length) { setContagens({}); setMinhas(new Set()); return; }
    const { data: ass } = await supabase.from("dds_assinaturas").select("dds_id, assinado_por_uid").in("dds_id", ids);
    const cont = {};
    const meus = new Set();
    (ass || []).forEach((a) => {
      cont[a.dds_id] = (cont[a.dds_id] || 0) + 1;
      if (a.assinado_por_uid === meuUid) meus.add(a.dds_id);
    });
    setContagens(cont);
    setMinhas(meus);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // último aberto (por criação) define a sugestão do próximo tema
  const ultimoCodigo = (sessoes || []).slice().sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1))[0]?.tema_codigo || null;

  const abaBtn = (key, label) => (
    <button type="button" onClick={() => { setAba(key); setView({ tipo: "lista" }); }} className="text-sm px-3 py-1 rounded border"
      style={aba === key
        ? { backgroundColor: VINHO, color: "white", borderColor: VINHO }
        : { background: "var(--surface-raised)", color: "var(--text-primary)", borderColor: "var(--border)" }}>
      {label}
    </button>
  );

  return (
    <div style={{ colorScheme: "dark", color: "var(--text-primary)" }}>
      <div className="p-4 flex justify-between items-center flex-wrap gap-2 no-print">
        <button onClick={onBack} className="text-sm underline" style={{ color: "var(--accent)" }}>← Voltar</button>
        <div className="flex gap-2 flex-wrap">
          {abaBtn("lista", "DDS")}
          {abaBtn("assinatura", "Minha assinatura")}
        </div>
      </div>

      {aba === "assinatura" && (
        <div className="max-w-2xl mx-auto p-4"><MajSignatureField modoCadastro nomeSugerido={nomeUsuario} /></div>
      )}

      {aba === "lista" && view.tipo === "lista" && (
        <DdsLista sessoes={sessoes} contagens={contagens} minhas={minhas} erro={erro}
          onAbrir={(s) => setView({ tipo: "detalhe", sessao: s })} onNovo={() => setView({ tipo: "novo" })} />
      )}
      {aba === "lista" && view.tipo === "novo" && (
        <NovoDds ultimoCodigo={ultimoCodigo} onCancelar={() => setView({ tipo: "lista" })}
          onCriado={(s) => { carregar(); setView({ tipo: "detalhe", sessao: s }); }} />
      )}
      {aba === "lista" && view.tipo === "detalhe" && (
        <DdsDetalhe key={view.sessao.id} sessaoInicial={view.sessao} uid={uid} isAdmin={isAdmin} nomeUsuario={nomeUsuario}
          onBack={() => setView({ tipo: "lista" })} onMudou={carregar} />
      )}
    </div>
  );
}
