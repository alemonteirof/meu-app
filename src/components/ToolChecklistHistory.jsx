// src/components/ToolChecklistHistory.jsx
//
// Uso: <ToolChecklistHistory clients={visibleClients} />

import { useEffect, useState } from "react";
import { supabase } from "../App";
import { TOOL_CHECKLISTS } from "../lib/toolChecklists";
import { exportChecklistToXlsx } from "../lib/exportChecklistXlsx";

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

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">Histórico de Checklists de Ferramentas</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="border rounded p-2 text-sm" value={filtroFerramenta} onChange={(e) => setFiltroFerramenta(e.target.value)}>
          <option value="">Todas as ferramentas</option>
          {Object.entries(TOOL_CHECKLISTS).map(([key, t]) => (
            <option key={key} value={key}>{t.label}</option>
          ))}
        </select>
        <select className="border rounded p-2 text-sm" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
          <option value="">Todos os clientes</option>
          <option value="avulso">Avulso (sem cliente)</option>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {!registros && !erro && <p className="text-sm text-gray-500">Carregando...</p>}
      {registros && filtrados.length === 0 && <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>}

      <div className="space-y-2">
        {filtrados.map((r) => {
          const qtdNC = (r.respostas || []).filter((it) => it.status === "NC").length;
          const isOpen = aberto === r.id;
          const isConfirmando = confirmando === r.id;
          return (
            <div key={r.id} className="border rounded">
              <div className="w-full text-left p-3 flex justify-between items-center gap-2">
                <button
                  type="button"
                  className="text-left flex-1"
                  onClick={() => setAberto(isOpen ? null : r.id)}
                >
                  <p className="text-sm font-semibold">
                    {TOOL_CHECKLISTS[r.tool_type]?.label || r.tool_type} — {r.tecnico_nome}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString("pt-BR")} · {clienteNome(clients, r.cliente_id)}
                    {r.marca_modelo ? ` · ${r.marca_modelo}` : ""}
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {qtdNC > 0 ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-700">
                      {qtdNC} não conforme(s)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-700">OK</span>
                  )}
                  <button
                    type="button"
                    onClick={() => exportChecklistToXlsx(r, clienteNome(clients, r.cliente_id))}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    Exportar .xlsx
                  </button>

                  {!isConfirmando ? (
                    <button
                      type="button"
                      onClick={() => setConfirmando(r.id)}
                      className="text-xs px-2 py-1 rounded border border-red-300 text-red-600"
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
                      >
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t p-3 space-y-2">
                  {(r.respostas || []).map((it) => (
                    <div key={it.item} className="text-sm flex justify-between gap-2">
                      <span>{it.item}. {it.descricao}</span>
                      <span className={`shrink-0 font-semibold ${it.status === "NC" ? "text-red-600" : "text-gray-600"}`}>
                        {it.status}
                      </span>
                    </div>
                  ))}
                  {r.observacoes && (
                    <p className="text-sm mt-2"><strong>Observações:</strong> {r.observacoes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
