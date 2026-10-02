// src/components/ToolEquipamentosAdmin.jsx
//
// Uso: <ToolEquipamentosAdmin />  (só admin — RLS equipamentos_write_admin)
// Cadastro das unidades (cintos, furadeiras, etc.) que aparecem no campo "Equipamento"
// do checklist. Sem exclusão: equipamento com checklist no histórico não pode ser
// apagado (FK), então o admin desativa — some do formulário, histórico continua.

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TOOL_CHECKLISTS } from "../lib/toolChecklists";

const VINHO = "#8B2F2F";
const VAZIO = { tool_type: "cinto_talabarte", marca: "", modelo: "", especificacoes: "" };

const btn = { fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };

export default function ToolEquipamentosAdmin() {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  async function carregar() {
    const { data, error } = await supabase.from("equipamentos").select("*").order("tool_type").order("marca");
    if (error) setMensagem({ tipo: "erro", texto: error.message });
    else setLista(data || []);
  }

  useEffect(() => { carregar(); }, []);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  function editar(eq) {
    setEditandoId(eq.id);
    setForm({ tool_type: eq.tool_type, marca: eq.marca || "", modelo: eq.modelo || "", especificacoes: eq.especificacoes || "" });
    setMensagem(null);
  }

  function cancelar() {
    setEditandoId(null);
    setForm(VAZIO);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);
    if (!form.marca.trim()) {
      setMensagem({ tipo: "erro", texto: "Preencha a marca." });
      return;
    }
    const payload = {
      tool_type: form.tool_type,
      marca: form.marca.trim(),
      modelo: form.modelo.trim() || null,
      especificacoes: form.especificacoes.trim() || null,
    };
    setSalvando(true);
    const { error } = editandoId
      ? await supabase.from("equipamentos").update(payload).eq("id", editandoId)
      : await supabase.from("equipamentos").insert(payload);
    setSalvando(false);
    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro ao salvar: ${error.message}` });
      return;
    }
    setMensagem({ tipo: "ok", texto: editandoId ? "Equipamento atualizado." : "Equipamento cadastrado." });
    cancelar();
    carregar();
  }

  async function alternarAtivo(eq) {
    const { error } = await supabase.from("equipamentos").update({ ativo: !eq.ativo }).eq("id", eq.id);
    if (error) setMensagem({ tipo: "erro", texto: error.message });
    else carregar();
  }

  const ehCinto = form.tool_type === "cinto_talabarte";
  const visiveis = (lista || []).filter((eq) => mostrarInativos || eq.ativo);
  const grupos = Object.entries(TOOL_CHECKLISTS)
    .map(([key, t]) => [key, t.label, visiveis.filter((eq) => eq.tool_type === key)])
    .filter(([, , itens]) => itens.length);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4" style={{ color: "var(--text-primary)" }}>
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">Equipamentos do checklist</h1>
        <p className="text-sm opacity-90">Cintos e ferramentas que aparecem no campo "Equipamento".</p>
      </div>

      <form onSubmit={handleSubmit} className="border rounded p-3 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold">{editandoId ? "Editar equipamento" : "Novo equipamento"}</p>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</label>
          <select className="field-input w-full rounded p-2" value={form.tool_type} onChange={set("tool_type")}>
            {Object.entries(TOOL_CHECKLISTS).map(([key, t]) => (
              <option key={key} value={key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Marca *</label>
            <input className="field-input w-full rounded p-2" value={form.marca} onChange={set("marca")} placeholder={ehCinto ? "Ex: Camper" : "Ex: Bosch"} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Modelo</label>
            <input className="field-input w-full rounded p-2" value={form.modelo} onChange={set("modelo")} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {ehCinto ? "CA / identificação" : "Especificações"}
          </label>
          <input className="field-input w-full rounded p-2" value={form.especificacoes} onChange={set("especificacoes")}
            placeholder={ehCinto ? "Ex: CA 35613 · unidade 01" : 'Ex: 20V, 4.1/2"'} />
        </div>

        {mensagem && (
          <p className="text-sm" style={{ color: mensagem.tipo === "erro" ? "var(--status-danger)" : "var(--status-ok)" }}>{mensagem.texto}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={salvando} className="px-4 py-2 rounded text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: VINHO }}>
            {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Cadastrar"}
          </button>
          {editandoId && <button type="button" onClick={cancelar} style={btn}>Cancelar</button>}
        </div>
      </form>

      <label className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
        Mostrar desativados
      </label>

      {!lista && !mensagem && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>}
      {lista && grupos.length === 0 && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nenhum equipamento cadastrado.</p>}

      {grupos.map(([key, label, itens]) => (
        <div key={key} className="space-y-2">
          <p className="text-sm font-semibold">{label} <span style={{ color: "var(--text-secondary)" }}>({itens.length})</span></p>
          {itens.map((eq) => (
            <div key={eq.id} className="border rounded p-3 flex justify-between items-center gap-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", opacity: eq.ativo ? 1 : 0.55 }}>
              <div className="text-sm">
                <strong>{eq.marca}</strong>{eq.modelo ? ` ${eq.modelo}` : ""}
                {eq.especificacoes && <span style={{ color: "var(--text-secondary)" }}> · {eq.especificacoes}</span>}
                {!eq.ativo && <span className="text-xs ml-2" style={{ color: "var(--status-warn)" }}>desativado</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => editar(eq)} style={btn}>Editar</button>
                <button type="button" onClick={() => alternarAtivo(eq)} style={btn}>{eq.ativo ? "Desativar" : "Reativar"}</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
