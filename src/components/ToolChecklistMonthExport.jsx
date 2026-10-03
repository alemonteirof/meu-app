// src/components/ToolChecklistMonthExport.jsx

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { TOOL_CHECKLISTS } from "../lib/toolChecklists";
import { ChecklistPdfMes } from "./ToolChecklistPdf";
import { dataLocalISO } from "../lib/datas";

const VINHO = "#8B2F2F";

function nomeEquipamento(eq) {
  const t = TOOL_CHECKLISTS[eq.tool_type]?.label || eq.tool_type;
  return `${t} — ${eq.marca}${eq.modelo ? " " + eq.modelo : ""}${eq.especificacoes ? " (" + eq.especificacoes + ")" : ""}${eq.ativo ? "" : " — desativado"}`;
}

export default function ToolChecklistMonthExport() {
  const [equipamentos, setEquipamentos] = useState(null);
  const [equipamentoId, setEquipamentoId] = useState("");
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [gerando, setGerando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [pdf, setPdf] = useState(null); // { equipamento, records, ano, mes } quando o PDF está aberto

  useEffect(() => {
    supabase
      .from("equipamentos")
      .select("*")
      .order("ativo", { ascending: false })
      .order("marca")
      .then(({ data, error }) => {
        if (error) setMensagem({ tipo: "erro", texto: error.message });
        else setEquipamentos(data);
      });
  }, []);

  const equipamentoSelecionado = useMemo(
    () => (equipamentos || []).find((e) => e.id === equipamentoId),
    [equipamentos, equipamentoId]
  );

  async function handleGerar() {
    setMensagem(null);
    if (!equipamentoId) {
      setMensagem({ tipo: "erro", texto: "Selecione um equipamento." });
      return;
    }
    const [ano, mes] = mesAno.split("-").map(Number);
    setGerando(true);

    const inicio = `${mesAno}-01`;
    const fim = dataLocalISO(new Date(ano, mes, 0));

    const { data, error } = await supabase
      .from("tool_checklists")
      .select("*")
      .eq("equipamento_id", equipamentoId)
      .gte("data_checklist", inicio)
      .lte("data_checklist", fim)
      .order("data_checklist");

    setGerando(false);

    if (error) {
      setMensagem({ tipo: "erro", texto: error.message });
      return;
    }
    if (!data || data.length === 0) {
      setMensagem({ tipo: "erro", texto: "Não há nenhum checklist registrado nesse mês pra esse equipamento." });
      return;
    }

    setPdf({ equipamento: equipamentoSelecionado, records: data, ano, mes });
  }

  if (pdf) {
    return <ChecklistPdfMes {...pdf} onBack={() => setPdf(null)} />;
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">PDF do checklist do mês</h1>
        <p className="text-sm opacity-90">Junta todos os preenchimentos de um equipamento num único PDF.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Equipamento</label>
        <select
          className="field-input w-full rounded p-2"
          value={equipamentoId}
          onChange={(e) => setEquipamentoId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {(equipamentos || []).map((eq) => (
            <option key={eq.id} value={eq.id}>{nomeEquipamento(eq)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Mês</label>
        <input
          type="month"
          className="field-input w-full rounded p-2"
          value={mesAno}
          onChange={(e) => setMesAno(e.target.value)}
        />
      </div>

      {mensagem && (
        <p className="text-sm" style={{ color: mensagem.tipo === "erro" ? "var(--status-danger)" : "var(--status-ok)" }}>{mensagem.texto}</p>
      )}

      <button
        type="button"
        onClick={handleGerar}
        disabled={gerando}
        className="w-full py-2 rounded text-white font-semibold disabled:opacity-50"
        style={{ backgroundColor: VINHO }}
      >
        {gerando ? "Gerando..." : "Gerar PDF do mês"}
      </button>
    </div>
  );
}
