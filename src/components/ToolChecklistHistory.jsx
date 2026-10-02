// src/components/ToolChecklistHistory.jsx
//
// Uso: <ToolChecklistHistory clients={visibleClients} />

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TOOL_CHECKLISTS } from "../lib/toolChecklists";
import { AssinaturaPreview } from "./MajSignatureField";
import { ChecklistPdfIndividual } from "./ToolChecklistPdf";

const VINHO = "#8B2F2F";

function clienteNome(clientes, id) {
  if (!id) return "Avulso";
  const c = clientes.find((c) => c.id === id);
  return c ? c.name : "Cliente removido";
}

export default function ToolChecklistHistory({ clients = [] }) {
  const [registros, setRegistros] = useState(null);
  const [erro, setErro] = useState(null);
  const [filtroFerramenta, setFiltroFerramenta] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [aberto, setAberto] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [imprimindo, setImprimindo] = useState(null); // registro aberto como PDF

  async function carregar() {
    const { data, error } = await supabase
      .from("tool_checklists")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setErro(error.message);
    else setRegistros(data);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleExcluir(id) {
    setExcluindo(true);
    const { error } = await supabase.from("tool_checklists").delete().eq("id", id);
    setExcluindo(false);
    setConfirmando(null);
    if (error) {
      setErro(`Erro ao excluir: ${error.message}`);
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  }

  const filtrados = (registros || []).filter((r) => {
    if (filtroFerramenta && r.tool_type !== filtroFerramenta) return false;
    if (filtroCliente === "avulso" && r.cliente_id) return false;
    if (filtroCliente && filtroCliente !== "avulso" && r.cliente_id !== filtroCliente) return false;
    return true;
  });

  if (imprimindo) {
    return <ChecklistPdfIndividual record={imprimindo} clienteNome={clienteNome(clients, imprimindo.cliente_id)} onBack={() => setImprimindo(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">Histórico de Checklists de Ferramentas</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="field-input rounded p-2 text-sm" value={filtroFerramenta} onChange={(e) => setFiltroFerramenta(e.target.value)}>
          <option value="">Todas as ferramentas</option>
          {Object.entries(TOOL_CHECKLISTS).map(([key, t]) => (
            <option key={key} value={key}>{t.label}</option>
          ))}
        </select>
        <select className="field-input rounded p-2 text-sm" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
          <option value="">Todos os clientes</option>
          <option value="avulso">Avulso (sem cliente)</option>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {erro && <p className="text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>}
      {!registros && !erro && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>}
      {registros && filtrados.length === 0 && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nenhum registro encontrado.</p>}

      <div className="space-y-2">
        {filtrados.map((r) => {
          const qtdNC = (r.respostas || []).filter((it) => it.status === "NC").length;
          const isOpen = aberto === r.id;
          const isConfirmando = confirmando === r.id;
          return (
            <div key={r.id} className="border rounded" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="w-full text-left p-3 flex justify-between items-center gap-2">
                <button
                  type="button"
                  className="text-left flex-1"
                  onClick={() => setAberto(isOpen ? null : r.id)}
                >
                  <p className="text-sm font-semibold">
                    {TOOL_CHECKLISTS[r.tool_type]?.label || r.tool_type} — {r.tecnico_nome}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {new Date(r.created_at).toLocaleString("pt-BR")} · {clienteNome(clients, r.cliente_id)}
                    {r.marca_modelo ? ` · ${r.marca_modelo}` : ""}
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {qtdNC > 0 ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: "rgba(224,72,61,0.15)", color: "var(--status-danger)" }}>
                      {qtdNC} não conforme(s)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: "rgba(63,185,80,0.15)", color: "var(--status-ok)" }}>OK</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setImprimindo(r)}
                    className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
                  >
                    PDF
                  </button>

                  {!isConfirmando ? (
                    <button
                      type="button"
                      onClick={() => setConfirmando(r.id)}
                      className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
                    >
                      Excluir
                    </button>
                  ) : (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={excluindo}
                        onClick={() => handleExcluir(r.id)}
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                      >
                        {excluindo ? "..." : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
                      >
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                  {(r.respostas || []).map((it) => (
                    <div key={it.item} className="text-sm flex justify-between gap-2">
                      <span>{it.item}. {it.descricao}</span>
                      <span className="shrink-0 font-semibold" style={{ color: it.status === "NC" ? "var(--status-danger)" : "var(--text-secondary)" }}>
                        {it.status}
                      </span>
                    </div>
                  ))}
                  {r.observacoes && (
                    <p className="text-sm mt-2"><strong>Observações:</strong> {r.observacoes}</p>
                  )}
                  <div className="border-t pt-2 mt-2" style={{ borderColor: "var(--border)" }}>
                    {r.assinatura_valor ? (
                      <>
                        <AssinaturaPreview tipo={r.assinatura_tipo} valor={r.assinatura_valor} maxWidth={260} />
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          Assinado por <strong>{r.assinado_por_nome || r.tecnico_nome}</strong> · login <strong>{r.assinado_por_email || "—"}</strong>
                          {" · "}{r.assinado_em ? new Date(r.assinado_em).toLocaleString("pt-BR") : "—"}
                          {r.assinatura_origem === "salva" ? " · assinatura pré-cadastrada" : r.assinatura_origem === "importada" ? " · assinatura importada de arquivo" : ""}
                        </p>
                        {r.assinatura_hash && (
                          <p className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                            verificação SHA-256: {r.assinatura_hash.slice(0, 24)}…
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Sem assinatura (registro anterior à assinatura digital).</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
