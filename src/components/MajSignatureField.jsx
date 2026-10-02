// src/components/MajSignatureField.jsx
//
// Uso: <MajSignatureField value={assinatura} onChange={setAssinatura} />
// Assinatura interna de membro MAJ (checklist de ferramentas e, depois, DDS).
// Mesmo funcionamento do SignatureField do RVT (desenho / nome digitado / assinatura
// salva), mas com banco de assinatura salva SEPARADO (assinaturas_salvas_maj) e sem
// gravar nada sozinho: só devolve { tipo, valor, origem } pro formulário, que envia
// junto com o registro. Atribuição (uid/email/nome/data/hash) é carimbada por trigger
// no Postgres — o app não manda esses campos.

import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { assinaturaDeImagem } from "../lib/imagens";

const VINHO = "#8B2F2F";

export async function getAssinaturaSalvaMaj() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("assinaturas_salvas_maj")
    .select("tipo, valor")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function salvarAssinaturaSalvaMaj({ tipo, valor }) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from("assinaturas_salvas_maj").upsert({
    user_id: uid, tipo, valor, atualizado_em: new Date().toISOString(),
  });
  if (error) throw error;
}

async function apagarAssinaturaSalvaMaj() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from("assinaturas_salvas_maj").delete().eq("user_id", uid);
  if (error) throw error;
}

const btnBase = { fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };
const btnPrimario = { ...btnBase, background: VINHO, borderColor: VINHO, color: "white", fontWeight: 600 };
const abaStyle = (ativa) => (ativa ? { ...btnBase, background: VINHO, borderColor: VINHO, color: "white" } : btnBase);

export function AssinaturaPreview({ tipo, valor, maxWidth = 320 }) {
  if (tipo === "desenho") {
    return <img src={valor} alt="Assinatura" style={{ display: "block", width: "100%", maxWidth, height: "auto", background: "#fff", borderRadius: 6, border: "1px solid var(--border)" }} />;
  }
  return <p style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive', fontSize: 24, color: "var(--text-primary)", margin: "4px 0" }}>{valor}</p>;
}

// modoCadastro: usado na aba "Minha assinatura" — só cadastra/atualiza a assinatura
// pré-cadastrada do usuário (sempre salva, sem checkbox, sem "usar").
export default function MajSignatureField({ value, onChange, nomeSugerido = "", modoCadastro = false }) {
  const [modo, setModo] = useState("desenho"); // 'desenho' | 'texto' | 'importar'
  const [importada, setImportada] = useState(null); // data URL PNG da imagem importada
  const [nome, setNome] = useState(nomeSugerido);
  const [temTraco, setTemTraco] = useState(false);
  const [erro, setErro] = useState("");
  const [salva, setSalva] = useState(null);
  const [guardar, setGuardar] = useState(true);
  const canvasRef = useRef(null);
  const desenhandoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    getAssinaturaSalvaMaj().then((s) => { if (vivo) setSalva(s); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => { if (!nome && nomeSugerido) setNome(nomeSugerido); }, [nomeSugerido]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pontoNoCanvas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    desenhandoRef.current = true;
  };
  const moverTraco = (e) => {
    if (!desenhandoRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    const { x, y } = pontoNoCanvas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temTraco) setTemTraco(true);
  };
  const terminarTraco = () => { desenhandoRef.current = false; };
  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  };

  const aplicar = (assinatura) => {
    if (modoCadastro) {
      salvarAssinaturaSalvaMaj(assinatura)
        .then(() => { setSalva({ tipo: assinatura.tipo, valor: assinatura.valor }); limparCanvas(); onChange?.(assinatura); })
        .catch((e) => setErro(e?.message || "Não foi possível salvar a assinatura."));
      return;
    }
    onChange(assinatura);
    if (guardar && assinatura.origem !== "salva") {
      salvarAssinaturaSalvaMaj(assinatura)
        .then(() => setSalva({ tipo: assinatura.tipo, valor: assinatura.valor }))
        .catch(() => { /* não bloqueia o checklist */ });
    }
  };

  const importarArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    try { setImportada(await assinaturaDeImagem(file)); }
    catch (err) { setErro(err?.message || "Não foi possível ler a imagem."); }
  };

  const confirmar = () => {
    setErro("");
    if (modo === "importar") {
      if (!importada) { setErro("Escolha a imagem da assinatura antes de confirmar."); return; }
      aplicar({ tipo: "desenho", valor: importada, origem: "importada" });
      setImportada(null);
    } else if (modo === "desenho") {
      if (!temTraco) { setErro("Desenhe a assinatura antes de confirmar."); return; }
      aplicar({ tipo: "desenho", valor: canvasRef.current.toDataURL("image/png"), origem: "desenho" });
    } else {
      if (!nome.trim()) { setErro("Digite o nome completo antes de confirmar."); return; }
      aplicar({ tipo: "texto", valor: nome.trim(), origem: "texto" });
    }
  };

  const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 };
  const titulo = <p className="text-sm font-semibold mb-2">{modoCadastro ? "Minha assinatura pré-cadastrada" : "Assinatura do técnico responsável"}</p>;

  if (value && !modoCadastro) {
    return (
      <div style={cardStyle}>
        {titulo}
        <AssinaturaPreview tipo={value.tipo} valor={value.valor} />
        <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
          Login, data/hora e código de verificação serão registrados automaticamente ao enviar.
        </p>
        <button type="button" onClick={() => { onChange(null); setTemTraco(false); }} style={{ ...btnBase, marginTop: 8 }}>
          Refazer assinatura
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {titulo}

      {modoCadastro && !salva && (
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Você ainda não tem assinatura pré-cadastrada. Cadastre aqui pra usar com 1 clique na hora de assinar checklists.
        </p>
      )}

      {salva && (
        <div style={{ margin: "4px 0 12px", padding: 10, borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface-raised)" }}>
          <p className="text-xs" style={{ margin: 0 }}>
            {modoCadastro ? "Assinatura pré-cadastrada atual:" : "Você tem uma assinatura pré-cadastrada neste login."}
          </p>
          <div style={{ margin: "6px 0" }}><AssinaturaPreview tipo={salva.tipo} valor={salva.valor} maxWidth={220} /></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!modoCadastro && (
              <button type="button" onClick={() => onChange({ tipo: salva.tipo, valor: salva.valor, origem: "salva" })} style={btnPrimario}>
                Usar assinatura pré-cadastrada
              </button>
            )}
            <button type="button" onClick={() => apagarAssinaturaSalvaMaj().then(() => setSalva(null)).catch(() => {})} style={btnBase}>
              Remover
            </button>
          </div>
          {modoCadastro && (
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Pra trocar, faça uma nova abaixo e salve.</p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setModo("desenho"); setErro(""); }} style={abaStyle(modo === "desenho")}>Desenhar</button>
        <button type="button" onClick={() => { setModo("texto"); setErro(""); }} style={abaStyle(modo === "texto")}>Digitar nome</button>
        <button type="button" onClick={() => { setModo("importar"); setErro(""); }} style={abaStyle(modo === "importar")}>Importar assinatura</button>
      </div>

      {modo === "importar" ? (
        <div>
          <label style={{ ...btnBase, display: "inline-block" }}>
            Escolher arquivo (PNG, JPG…)
            <input type="file" accept="image/*" onChange={importarArquivo} style={{ display: "none" }} />
          </label>
          {importada && (
            <div style={{ marginTop: 8 }}><AssinaturaPreview tipo="desenho" valor={importada} maxWidth={360} /></div>
          )}
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            Dica: foto ou scan da assinatura em papel branco funciona — o fundo branco é removido automaticamente.
          </p>
        </div>
      ) : modo === "desenho" ? (
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
            style={{ display: "block", width: "100%", maxWidth: 600, height: 180, background: "#fff", borderRadius: 6, border: "1px solid var(--border)", touchAction: "none", cursor: "crosshair" }}
          />
          <button type="button" onClick={limparCanvas} style={{ ...btnBase, marginTop: 8 }}>Limpar</button>
        </div>
      ) : (
        <input className="field-input w-full rounded p-2" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
      )}

      {erro && <p className="text-xs mt-2" style={{ color: "var(--status-danger)" }}>{erro}</p>}

      {!modoCadastro && (
        <label className="text-xs" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
          {salva ? "Atualizar minha assinatura pré-cadastrada com esta" : "Pré-cadastrar esta assinatura neste login para reutilizar"}
        </label>
      )}

      <button type="button" onClick={confirmar} style={{ ...btnPrimario, marginTop: 10 }}>
        {modoCadastro ? (salva ? "Substituir assinatura" : "Salvar assinatura") : "Confirmar assinatura"}
      </button>
    </div>
  );
}
