// src/components/ToolChecklistForm.jsx
//
// Uso: <ToolChecklistForm clients={visibleClients} nomeUsuario={nomeDoPerfil} />

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TOOL_CHECKLISTS, STATUS_OPTIONS } from "../lib/toolChecklists";
import MajSignatureField from "./MajSignatureField";
import { hojeLocal } from "../lib/datas";

const VINHO = "#8B2F2F";

function nomeEquipamento(eq) {
  return `${eq.marca}${eq.modelo ? " " + eq.modelo : ""}${eq.especificacoes ? " (" + eq.especificacoes + ")" : ""}`;
}

export default function ToolChecklistForm({ clients = [], nomeUsuario = "" }) {
  const [toolType, setToolType] = useState("furadeira_impacto");
  const [equipamentos, setEquipamentos] = useState([]);
  const [equipamentoId, setEquipamentoId] = useState("");
  const [vinculado, setVinculado] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [tecnicoNome, setTecnicoNome] = useState(nomeUsuario);
  const [tag, setTag] = useState("");
  const [dataChecklist, setDataChecklist] = useState(hojeLocal);
  const [observacoes, setObservacoes] = useState("");
  const [respostas, setRespostas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [assinatura, setAssinatura] = useState(null); // { tipo, valor, origem }

  const checklist = TOOL_CHECKLISTS[toolType];
  const statusOptions = checklist.statusOptions
    ? STATUS_OPTIONS.filter((opt) => checklist.statusOptions.includes(opt.value))
    : STATUS_OPTIONS;

  useEffect(() => {
    setRespostas({});
    setEquipamentoId("");
    supabase
      .from("equipamentos")
      .select("*")
      .eq("tool_type", toolType)
      .eq("ativo", true)
      .order("marca")
      .then(({ data }) => setEquipamentos(data || []));
  }, [toolType]);

  function marcarStatus(itemIdx, status) {
    setRespostas((prev) => ({ ...prev, [itemIdx]: status }));
  }

  const todosRespondidos = checklist.itens.every((_, i) => respostas[i]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);

    if (!tecnicoNome.trim()) {
      setMensagem({ tipo: "erro", texto: "Preencha o nome do técnico responsável." });
      return;
    }
    if (!equipamentoId) {
      setMensagem({ tipo: "erro", texto: "Selecione qual equipamento está sendo checado." });
      return;
    }
    if (!todosRespondidos) {
      setMensagem({ tipo: "erro", texto: "Marque um status pra todos os itens antes de enviar." });
      return;
    }
    if (vinculado && !clienteId) {
      setMensagem({ tipo: "erro", texto: 'Selecione o cliente ou desmarque "vinculado a cliente".' });
      return;
    }
    if (!assinatura) {
      setMensagem({ tipo: "erro", texto: "Assine o checklist antes de enviar." });
      return;
    }

    setSalvando(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setSalvando(false);
      setMensagem({ tipo: "erro", texto: "Não foi possível identificar o usuário logado." });
      return;
    }

    const equipamento = equipamentos.find((e) => e.id === equipamentoId);

    const payload = {
      tool_type: toolType,
      equipamento_id: equipamentoId,
      marca_modelo: equipamento ? nomeEquipamento(equipamento) : null,
      identificacao_tag: tag || null,
      data_checklist: dataChecklist,
      tecnico_id: userData.user.id,
      tecnico_nome: tecnicoNome.trim(),
      cliente_id: vinculado ? clienteId : null,
      observacoes: observacoes || null,
      respostas: checklist.itens.map((descricao, i) => ({
        item: i + 1,
        descricao,
        status: respostas[i],
      })),
      // uid/email/nome/data/hash da assinatura são carimbados por trigger no banco
      assinatura_tipo: assinatura.tipo,
      assinatura_valor: assinatura.valor,
      assinatura_origem: assinatura.origem,
    };

    const { error } = await supabase.from("tool_checklists").insert(payload);
    setSalvando(false);

    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro ao salvar: ${error.message}` });
    } else {
      setMensagem({ tipo: "ok", texto: "Checklist registrado com sucesso." });
      setRespostas({});
      setTag("");
      setObservacoes("");
      setAssinatura(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-4" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">Check List – Pré Operacional</h1>
        <p className="text-sm opacity-90">{checklist.label} · {checklist.codigo}</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Ferramenta</label>
        <select className="field-input w-full rounded p-2" value={toolType} onChange={(e) => setToolType(e.target.value)}>
          {Object.entries(TOOL_CHECKLISTS).map(([key, t]) => (
            <option key={key} value={key}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Equipamento</label>
        <select className="field-input w-full rounded p-2" value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
          <option value="">Selecione qual unidade...</option>
          {equipamentos.map((eq) => (
            <option key={eq.id} value={eq.id}>{nomeEquipamento(eq)}</option>
          ))}
        </select>
        {equipamentos.length === 0 && (
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Nenhum equipamento cadastrado pra essa ferramenta ainda.</p>
        )}
      </div>

      <div className="rounded border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold mb-2">EPIs obrigatórios</p>
        <ul className="text-sm grid grid-cols-2 gap-1" style={{ color: "var(--text-secondary)" }}>
          {checklist.epis.map((epi) => (<li key={epi}>☐ {epi}</li>))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Técnico responsável</label>
          <input className="field-input w-full rounded p-2" value={tecnicoNome} onChange={(e) => setTecnicoNome(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Data</label>
          <input type="date" className="field-input w-full rounded p-2" value={dataChecklist} onChange={(e) => setDataChecklist(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Identificação/TAG (opcional)</label>
        <input className="field-input w-full rounded p-2" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      <div className="flex items-center gap-2">
        <input id="vinculado" type="checkbox" checked={vinculado} onChange={(e) => setVinculado(e.target.checked)} />
        <label htmlFor="vinculado" className="text-sm">Vincular a um cliente específico</label>
      </div>

      {vinculado && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Cliente</label>
          <select className="field-input w-full rounded p-2" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {checklist.itens.map((item, i) => (
          <div key={i} className="border rounded p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-sm mb-2"><strong>{i + 1}.</strong> {item}</p>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => marcarStatus(i, opt.value)}
                  className="text-xs px-3 py-1 rounded border"
                  style={respostas[i] === opt.value
                    ? { backgroundColor: VINHO, borderColor: VINHO, color: "white" }
                    : { background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {opt.value}
                </button>
              ))}
            </div>
            {checklist.avisoNC && respostas[i] === "NC" && (
              <p className="text-xs font-semibold mt-2" style={{ color: "var(--status-danger)" }}>⚠ {checklist.avisoNC}</p>
            )}
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Observações</label>
        <textarea className="field-input w-full rounded p-2" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>

      <MajSignatureField value={assinatura} onChange={setAssinatura} nomeSugerido={tecnicoNome} />

      {mensagem && (
        <p className="text-sm" style={{ color: mensagem.tipo === "erro" ? "var(--status-danger)" : "var(--status-ok)" }}>{mensagem.texto}</p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="w-full py-2 rounded text-white font-semibold disabled:opacity-50"
        style={{ backgroundColor: VINHO }}
      >
        {salvando ? "Salvando..." : "Registrar check list"}
      </button>
    </form>
  );
}
