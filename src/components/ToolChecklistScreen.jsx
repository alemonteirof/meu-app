// src/components/ToolChecklistScreen.jsx
//
// Uso: <ToolChecklistScreen clients={visibleClients} role={role} onBack={() => ...} />
// Reúne as 3 telas do módulo de checklist de ferramentas num só lugar.

import { useState } from "react";
import ToolChecklistForm from "./ToolChecklistForm";
import ToolChecklistHistory from "./ToolChecklistHistory";
import ToolChecklistMonthExport from "./ToolChecklistMonthExport";

const VINHO = "#8B2F2F";

export default function ToolChecklistScreen({ clients = [], role, onBack }) {
  const [aba, setAba] = useState("form"); // "form" | "history" | "month"
  const isAdmin = role === "admin";

  const abaBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setAba(key)}
      className="text-sm px-3 py-1 rounded border"
      style={aba === key ? { backgroundColor: VINHO, color: "white", borderColor: VINHO } : {}}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="p-4 flex justify-between items-center flex-wrap gap-2">
        <button onClick={onBack} className="text-sm underline" style={{ color: "var(--accent)" }}>
          ← Voltar
        </button>
        <div className="flex gap-2">
          {abaBtn("form", "Preencher novo")}
          {isAdmin && abaBtn("history", "Ver histórico")}
          {isAdmin && abaBtn("month", "Exportar mês")}
        </div>
      </div>

      {aba === "form" && <ToolChecklistForm clients={clients} />}
      {aba === "history" && isAdmin && <ToolChecklistHistory clients={clients} />}
      {aba === "month" && isAdmin && <ToolChecklistMonthExport />}
    </div>
  );
}
