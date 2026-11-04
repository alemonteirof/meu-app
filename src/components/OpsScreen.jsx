// src/components/OpsScreen.jsx
//
// Uso: <OpsScreen role={role} nomeUsuario={nome} onBack={() => ...} />
//      <OpsImpressaoPorId id="..." onBack={...} />   (rota #/ops/<id>/imprimir)
// OPS — Observação Preventiva de Segurança (exigência Nissan p/ terceiros, 2 por mês).
// Só membros MAJ (admin/operador). Sem assinatura digital (decisão 04/11/2026): o PDF
// (modelo Nissan, 2 páginas) é impresso e assinado no papel. Observador = quem registra;
// uid/email/nome/data e semana_iso são carimbados por trigger (migracao_ops.sql +
// migracao_ops_pagina2.sql). Correção: observador ou admin editam a qualquer momento;
// cada correção vai pra assinatura_auditoria_maj (evento 'corrigida' + snapshot).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  getOpsItens, OPS_FORM_VERSAO, OPS_PREDIOS, OPS_RESPOSTAS, OPS_TEXTOS, OPS_TEXTO_MAX, OPS_META_MES,
  OPS_ITENS_PNE, OPS_ITEM_DDS, semanaIso,
  OPS_PAG2, OPS_SIM_NAO, OPS_RISCOS_LINHAS, OPS_RISCOS_LINHA_MAX, OPS_MEDIDAS_LINHAS, OPS_MEDIDA_MAX,
} from "../lib/opsItens";
import OpsPrintView from "./OpsPrintView";
import { hojeLocal as hoje } from "../lib/datas";

const VINHO = "#8B2F2F";

const btnBase = { fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };
const btnPrimario = { ...btnBase, background: VINHO, borderColor: VINHO, color: "white", fontWeight: 600 };
const btnPerigo = { ...btnBase, borderColor: "var(--status-danger)", color: "var(--status-danger)" };
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 };
const rotulo = { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--text-secondary)" };

// Sem assinatura_valor (imagem base64) nas listas — não é exibida em lugar nenhum.
const COLUNAS = "id, data_ops, semana_iso, ano_iso, funcionario_observado, funcionario_observado_uid, predio, empresa, respostas, "
  + "comportamentos_preventivos, atos_inseguros, condicoes_inseguras, conhece_perigos_riscos, riscos, medidas, "
  + "form_versao, assinatura_hash, observador_uid, observador_email, observador_nome, assinado_em, corrigido_por_nome, corrigido_em";

const MEDIDA_VAZIA = { acao: "", prazo: "", responsavel: "" };
const MEDIDA_NA = { acao: "N/A", prazo: "N/A", responsavel: "N/A" };

const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const dataHoraBR = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "—");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (ym) => { const [y, m] = ym.split("-"); return `${MESES[Number(m) - 1]}/${y}`; };
const nomeObservador = (r) => r.observador_nome || r.observador_email || "—";

// Rota do robô do Box / link direto: #/ops/<id>/imprimir (tratada no Root do App.jsx)
export function abrirImpressaoOps(id) { window.location.hash = `#/ops/${id}/imprimir`; }

function Texto({ item }) {
  return (
    <span>
      {item.destaque && <b>{item.destaque}</b>}
      {item.texto === ":" ? "" : item.texto}
      {item.inline && <>{item.destaque ? ": " : " "}{item.inline}</>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formulário (novo ou correção)
// ---------------------------------------------------------------------------
function OpsForm({ registros, membros, nomeUsuario, editando, onSalvo, onCancelar }) {
  const itens = getOpsItens(editando?.form_versao || OPS_FORM_VERSAO);
  const [dataOps, setDataOps] = useState(editando?.data_ops || hoje());
  const membroInicial = editando?.funcionario_observado_uid && membros.some((m) => m.id === editando.funcionario_observado_uid)
    ? editando.funcionario_observado_uid : (editando ? "__outro" : "");
  const [funcSel, setFuncSel] = useState(membroInicial);
  const [funcLivre, setFuncLivre] = useState(membroInicial === "__outro" ? editando?.funcionario_observado || "" : "");
  const [predio, setPredio] = useState(editando?.predio || "");
  const [respostas, setRespostas] = useState(editando?.respostas || {});
  const [textos, setTextos] = useState(() => Object.fromEntries(OPS_TEXTOS.map((t) => [t.campo, editando?.[t.campo] || ""])));
  // Página 2
  const [conhece, setConhece] = useState(editando?.conhece_perigos_riscos || "");
  const [riscos, setRiscos] = useState(editando?.riscos || "");
  const [medidas, setMedidas] = useState(() => (editando?.medidas?.length ? editando.medidas.map((m) => ({ ...MEDIDA_VAZIA, ...m })) : [{ ...MEDIDA_VAZIA }]));
  const [confirmaSemana, setConfirmaSemana] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ddsDoDia, setDdsDoDia] = useState(null); // { tema_codigo, tema_titulo } | false | null

  const funcUid = funcSel && funcSel !== "__outro" ? funcSel : null;
  const funcNome = funcUid ? (membros.find((m) => m.id === funcUid)?.nome || "") : funcLivre.trim();
  const { semana, ano } = semanaIso(dataOps);
  const mes = (dataOps || "").slice(0, 7);
  const outros = registros.filter((r) => r.id !== editando?.id);
  const noMes = outros.filter((r) => (r.data_ops || "").startsWith(mes)).length;
  const mesmaSemana = outros.filter((r) => r.semana_iso === semana && r.ano_iso === ano);
  const faltando = itens.filter((i) => !respostas[String(i.n)]).map((i) => i.n);

  useEffect(() => { setConfirmaSemana(false); }, [semana, ano]);

  // Item 15: se o observado é usuário do app e assinou o DDS da data, sugere SIM (sem marcar)
  useEffect(() => {
    let vivo = true;
    setDdsDoDia(null);
    if (!funcUid || !dataOps) return undefined;
    (async () => {
      const { data: sess } = await supabase.from("dds_sessoes").select("id, tema_codigo, tema_titulo").eq("data_dds", dataOps);
      const ids = (sess || []).map((s) => s.id);
      if (!ids.length) { if (vivo) setDdsDoDia(false); return; }
      const { data: ass } = await supabase.from("dds_assinaturas").select("dds_id").in("dds_id", ids).eq("assinado_por_uid", funcUid).limit(1);
      if (!vivo) return;
      const s = ass?.[0] && sess.find((x) => x.id === ass[0].dds_id);
      setDdsDoDia(s || false);
    })();
    return () => { vivo = false; };
  }, [funcUid, dataOps]);

  const marcar = (n, v) => setRespostas((p) => ({ ...p, [String(n)]: v }));

  async function salvar() {
    setErro("");
    if (!dataOps) return setErro("Informe a data.");
    if (!funcNome) return setErro("Informe o funcionário observado.");
    if (!predio.trim()) return setErro("Informe o prédio.");
    if (faltando.length) return setErro(`Responda todos os itens. Faltando: ${faltando.join(", ")}.`);
    const vazio = OPS_TEXTOS.find((t) => !textos[t.campo].trim());
    if (vazio) return setErro(`Preencha "${vazio.titulo.replace(":", "")}". Se não houver nada, escreva isso (ex: "Nenhum ato inseguro observado").`);
    if (!conhece) return setErro(`Página 2: responda SIM ou NÃO em "${OPS_PAG2.pergunta}"`);
    const linhasRiscos = riscos.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!linhasRiscos.length) return setErro(`Página 2: preencha "${OPS_PAG2.riscosTitulo}" (um risco por linha).`);
    if (linhasRiscos.length > OPS_RISCOS_LINHAS) return setErro(`Página 2: no máximo ${OPS_RISCOS_LINHAS} riscos (são ${OPS_RISCOS_LINHAS} linhas na folha).`);
    if (linhasRiscos.some((l) => l.length > OPS_RISCOS_LINHA_MAX)) return setErro(`Página 2: cada risco com no máximo ${OPS_RISCOS_LINHA_MAX} caracteres (para caber na linha da folha).`);
    const medidasOk = medidas.map((m) => ({ acao: m.acao.trim(), prazo: m.prazo.trim(), responsavel: m.responsavel.trim() }))
      .filter((m) => m.acao || m.prazo || m.responsavel);
    if (medidasOk.some((m) => !m.acao)) return setErro("Página 2: toda linha de medida corretiva precisa da ação (o que fazer).");
    if (mesmaSemana.length && !confirmaSemana) return setErro(`Já existe OPS na semana ${semana}. Escolha outra data ou confirme abaixo.`);

    const campos = {
      data_ops: dataOps,
      funcionario_observado: funcNome,
      funcionario_observado_uid: funcUid,
      predio: predio.trim(),
      respostas: Object.fromEntries(itens.map((i) => [String(i.n), respostas[String(i.n)]])),
      ...Object.fromEntries(OPS_TEXTOS.map((t) => [t.campo, textos[t.campo].trim()])),
      conhece_perigos_riscos: conhece,
      riscos: linhasRiscos.join("\n"),
      medidas: medidasOk,
    };
    setSalvando(true);
    const q = editando
      ? supabase.from("ops_registros").update(campos).eq("id", editando.id)
      // observador/data/semana são carimbados por trigger no banco; sem assinatura digital
      : supabase.from("ops_registros").insert({ ...campos, form_versao: OPS_FORM_VERSAO });
    const { data, error } = await q.select(COLUNAS).single();
    setSalvando(false);
    if (error) return setErro(`Erro ao salvar: ${error.message}`);
    onSalvo(data);
  }

  const btnResp = (ativo) => ({
    flex: 1, padding: "12px 0", fontSize: 15, fontWeight: 700, borderRadius: 8, cursor: "pointer",
    border: `2px solid ${ativo ? VINHO : "var(--border)"}`,
    background: ativo ? VINHO : "var(--surface-raised)", color: ativo ? "white" : "var(--text-primary)",
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="rounded-lg p-4 text-white" style={{ backgroundColor: VINHO }}>
        <h1 className="text-lg font-bold">{editando ? "Corrigir OPS" : "Novo OPS"}</h1>
        <p className="text-sm opacity-90">
          OPS de {mes ? nomeMes(mes) : "—"}: <b>{noMes + (editando ? 1 : 0)} de {OPS_META_MES}</b> {editando ? "registrados" : "já registrados"}
          {semana ? ` · semana ${semana}` : ""}
        </p>
        {editando && (
          <p className="text-xs opacity-80 mt-1">
            Registrado por {nomeObservador(editando)} em {dataHoraBR(editando.assinado_em)}. A autoria original é mantida; a correção fica registrada na trilha.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label style={rotulo}>Data</label>
          <input type="date" className="field-input w-full rounded p-2" value={dataOps} onChange={(e) => setDataOps(e.target.value)} />
        </div>
        <div>
          <label style={rotulo}>Funcionário observado</label>
          <select className="field-input w-full rounded p-2" value={funcSel} onChange={(e) => setFuncSel(e.target.value)}>
            <option value="">Selecione…</option>
            {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            <option value="__outro">Outro (digitar nome)</option>
          </select>
          {funcSel === "__outro" && (
            <input className="field-input w-full rounded p-2 mt-2" value={funcLivre} onChange={(e) => setFuncLivre(e.target.value)} placeholder="Nome do funcionário" />
          )}
        </div>
      </div>

      {mesmaSemana.length > 0 && (
        <div style={{ ...card, borderColor: "var(--status-warning, #d4a017)" }}>
          <p className="text-sm">
            ⚠ Já existe OPS na <b>semana {semana}</b> ({mesmaSemana.map((r) => `${dataBR(r.data_ops)} · ${r.funcionario_observado}`).join("; ")}).
            O arquivo no Box ("OPS SEMANA {semana}") vai repetir. Escolha outra data ou confirme.
          </p>
          <label className="text-sm flex items-center gap-2 mt-2" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={confirmaSemana} onChange={(e) => setConfirmaSemana(e.target.checked)} />
            Confirmo registrar mesmo assim
          </label>
        </div>
      )}

      <div>
        <label style={rotulo}>Prédio</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {OPS_PREDIOS.map((p) => (
            <button key={p} type="button" onClick={() => setPredio(p)} style={predio === p ? { ...btnPrimario, fontSize: 12 } : { ...btnBase, fontSize: 12 }}>{p}</button>
          ))}
        </div>
        <input className="field-input w-full rounded p-2" value={predio} onChange={(e) => setPredio(e.target.value)} placeholder="Ou digite o prédio" />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">Itens ({itens.length - faltando.length} de {itens.length} respondidos)</p>
        </div>
        {itens.map((item) => {
          const v = respostas[String(item.n)];
          return (
            <div key={item.n} style={{ ...card, borderLeft: `4px solid ${v ? VINHO : "var(--border)"}` }}>
              <p className="text-sm mb-2"><span style={{ color: "var(--text-secondary)" }}>{item.n}.</span> <Texto item={item} /></p>
              <div className="flex gap-2">
                {OPS_RESPOSTAS.map((r) => (
                  <button key={r.valor} type="button" onClick={() => marcar(item.n, r.valor)} style={btnResp(v === r.valor)}>{r.rotulo}</button>
                ))}
              </div>
              {item.n === OPS_ITENS_PNE[1] && (
                <button type="button" onClick={() => OPS_ITENS_PNE.forEach((n) => marcar(n, "na"))} style={{ ...btnBase, fontSize: 12, marginTop: 8 }}>
                  N/A nos dois (itens {OPS_ITENS_PNE.join(" e ")} — sem PNE)
                </button>
              )}
              {item.n === OPS_ITEM_DDS && ddsDoDia && (
                <div className="text-xs mt-2 flex items-center gap-2 flex-wrap" style={{ color: "var(--status-ok)" }}>
                  ✓ {funcNome} assinou o DDS do dia: {ddsDoDia.tema_codigo} — {ddsDoDia.tema_titulo}
                  {v !== "sim" && <button type="button" onClick={() => marcar(item.n, "sim")} style={{ ...btnBase, fontSize: 11, padding: "2px 8px" }}>Marcar SIM</button>}
                </div>
              )}
              {item.n === OPS_ITEM_DDS && ddsDoDia === false && (
                <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Nenhuma assinatura de {funcNome} em DDS nesta data no CCM.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Levantamento de fatos particulares</p>
        {OPS_TEXTOS.map((t) => (
          <div key={t.campo}>
            <label style={rotulo}><b style={{ color: "var(--text-primary)" }}>{t.titulo}</b> {t.orientacao}</label>
            <textarea className="field-input w-full rounded p-2" rows={3} maxLength={OPS_TEXTO_MAX} value={textos[t.campo]}
              onChange={(e) => setTextos((p) => ({ ...p, [t.campo]: e.target.value }))} placeholder={t.exemplo} />
            <p className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>{textos[t.campo].length}/{OPS_TEXTO_MAX}</p>
          </div>
        ))}
      </div>

      {/* Página 2 do modelo Nissan */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Página 2 — {OPS_PAG2.titulo.replace(":", "")}</p>
        <div style={{ ...card, borderLeft: `4px solid ${conhece ? VINHO : "var(--border)"}` }}>
          <p className="text-sm mb-2">{OPS_PAG2.pergunta}</p>
          <div className="flex gap-2">
            {OPS_SIM_NAO.map((r) => (
              <button key={r.valor} type="button" onClick={() => setConhece(r.valor)} style={btnResp(conhece === r.valor)}>{r.rotulo}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={rotulo}><b style={{ color: "var(--text-primary)" }}>{OPS_PAG2.riscosTitulo}</b> Um risco por linha (até {OPS_RISCOS_LINHAS}).</label>
          <textarea className="field-input w-full rounded p-2" rows={OPS_RISCOS_LINHAS} value={riscos}
            onChange={(e) => setRiscos(e.target.value)} placeholder={"Ex:\nQueda com e sem diferença de nível\nTropeço"} />
          <p className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>
            {riscos.split("\n").filter((l) => l.trim()).length}/{OPS_RISCOS_LINHAS} linhas
          </p>
        </div>
        <div>
          <label style={rotulo}><b style={{ color: "var(--text-primary)" }}>{OPS_PAG2.medidasTitulo}</b> {OPS_PAG2.medidasOrientacao}</label>
          <div className="space-y-2">
            {medidas.map((m, i) => (
              <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "1.6rem 1fr 6.5rem 8rem 2rem" }}>
                <span className="text-sm self-center" style={{ color: "var(--text-secondary)" }}>{i + 1}</span>
                <input className="field-input rounded p-2" maxLength={OPS_MEDIDA_MAX.acao} value={m.acao} placeholder="Ação (o que)"
                  onChange={(e) => setMedidas((p) => p.map((x, j) => (j === i ? { ...x, acao: e.target.value } : x)))} />
                <input className="field-input rounded p-2" maxLength={OPS_MEDIDA_MAX.prazo} value={m.prazo} placeholder="Prazo"
                  onChange={(e) => setMedidas((p) => p.map((x, j) => (j === i ? { ...x, prazo: e.target.value } : x)))} />
                <input className="field-input rounded p-2" maxLength={OPS_MEDIDA_MAX.responsavel} value={m.responsavel} placeholder="Responsável"
                  onChange={(e) => setMedidas((p) => p.map((x, j) => (j === i ? { ...x, responsavel: e.target.value } : x)))} />
                <button type="button" title="Remover linha" style={{ ...btnBase, padding: "4px 0" }}
                  onClick={() => setMedidas((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [{ ...MEDIDA_VAZIA }]))}>×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {medidas.length < OPS_MEDIDAS_LINHAS && (
              <button type="button" onClick={() => setMedidas((p) => [...p, { ...MEDIDA_VAZIA }])} style={{ ...btnBase, fontSize: 12 }}>+ Linha</button>
            )}
            <button type="button" onClick={() => setMedidas([{ ...MEDIDA_NA }])} style={{ ...btnBase, fontSize: 12 }}>Nenhuma (N/A)</button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Linhas em branco não saem na folha. Até {OPS_MEDIDAS_LINHAS} linhas.</p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Assinatura: o PDF sai com "{OPS_PAG2.assinatura}" em branco — imprima e colete a assinatura no papel.
        </p>
      </div>

      {erro && <p className="text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} style={btnBase}>Cancelar</button>
        <button type="button" disabled={salvando} onClick={salvar} style={{ ...btnPrimario, flex: 1, padding: "10px 12px", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando..." : editando ? "Salvar correção" : "Salvar OPS"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Histórico (por mês)
// ---------------------------------------------------------------------------
function OpsHistorico({ registros, erro, uid, isAdmin, onCorrigir, onExcluido }) {
  const [confirmar, setConfirmar] = useState(null);
  const [msg, setMsg] = useState("");

  const porMes = useMemo(() => {
    const g = {};
    (registros || []).forEach((r) => { const k = (r.data_ops || "").slice(0, 7); (g[k] = g[k] || []).push(r); });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [registros]);

  async function excluir(r) {
    setConfirmar(null);
    const { error } = await supabase.from("ops_registros").delete().eq("id", r.id);
    if (error) { setMsg(`Erro ao excluir: ${error.message}`); return; }
    onExcluido();
  }

  if (erro) return <p className="max-w-2xl mx-auto p-4 text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>;
  if (!registros) return <p className="max-w-2xl mx-auto p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {msg && <p className="text-sm" style={{ color: "var(--status-danger)" }}>{msg}</p>}
      {porMes.length === 0 && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nenhum OPS registrado ainda.</p>}
      {porMes.map(([mes, lista]) => (
        <div key={mes} className="space-y-2">
          <p className="text-sm font-semibold">
            {nomeMes(mes)} <span style={{ color: lista.length >= OPS_META_MES ? "var(--status-ok)" : "var(--text-secondary)", fontWeight: 400 }}>· {lista.length} de {OPS_META_MES}</span>
          </p>
          {lista.map((r) => {
            const podeCorrigir = isAdmin || r.observador_uid === uid;
            return (
              <div key={r.id} style={card}>
                <div className="flex justify-between gap-2 flex-wrap">
                  <div className="text-sm">
                    <p className="font-semibold">{dataBR(r.data_ops)} · Semana {r.semana_iso} · {r.predio}</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Observador: {nomeObservador(r)} · Funcionário: {r.funcionario_observado}
                    </p>
                    {r.corrigido_em && (
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Corrigido em {dataHoraBR(r.corrigido_em)} por {r.corrigido_por_nome || "—"}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap items-start">
                    <button type="button" onClick={() => abrirImpressaoOps(r.id)} style={btnPrimario}>Gerar PDF</button>
                    {podeCorrigir && <button type="button" onClick={() => onCorrigir(r)} style={btnBase}>Corrigir</button>}
                    {isAdmin && <button type="button" onClick={() => setConfirmar(r.id)} style={btnPerigo}>Excluir</button>}
                  </div>
                </div>
                {confirmar === r.id && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm mb-2">Excluir este OPS? A trilha de auditoria guarda uma cópia, mas ele some da lista.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmar(null)} style={btnBase}>Cancelar</button>
                      <button type="button" onClick={() => excluir(r)} style={{ ...btnPrimario, background: "var(--status-danger)", borderColor: "var(--status-danger)" }}>Confirmar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impressão por id (rota #/ops/<id>/imprimir — usada pelo robô do Box e pelo Histórico)
// ---------------------------------------------------------------------------
export function OpsImpressaoPorId({ id, onBack }) {
  const [registro, setRegistro] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    supabase.from("ops_registros").select(COLUNAS).eq("id", id).maybeSingle().then(({ data, error }) => {
      if (!vivo) return;
      if (error) setErro(error.message);
      else if (!data) setErro("OPS não encontrado (ou sem acesso).");
      else setRegistro(data);
    });
    return () => { vivo = false; };
  }, [id]);

  if (erro) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3" style={{ color: "var(--text-primary)" }}>
        <p className="text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>
        <button type="button" onClick={onBack} style={btnBase}>← Voltar</button>
      </div>
    );
  }
  if (!registro) return <p className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>;
  return <div style={{ color: "var(--text-primary)" }}><OpsPrintView registro={registro} onBack={onBack} /></div>;
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export default function OpsScreen({ role, nomeUsuario = "", abaInicial = "novo", onBack }) {
  const [aba, setAba] = useState(abaInicial); // "novo" | "historico"
  const [editando, setEditando] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [membros, setMembros] = useState([]);
  const [uid, setUid] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState("");
  const [formKey, setFormKey] = useState(0);
  const isAdmin = role === "admin";

  const carregar = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setUid(u?.user?.id || null);
    const { data, error } = await supabase.from("ops_registros").select(COLUNAS)
      .order("data_ops", { ascending: false }).order("assinado_em", { ascending: false }).limit(500);
    if (error) { setErro(error.message); return; }
    setErro(null);
    setRegistros(data || []);
  }, []);

  useEffect(() => {
    carregar();
    supabase.rpc("ops_membros_maj").then(({ data }) => setMembros(data || []));
  }, [carregar]);

  const abaBtn = (key, label) => (
    <button type="button" onClick={() => { setAba(key); setEditando(null); setAviso(""); }} className="text-sm px-3 py-1 rounded border"
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
          {abaBtn("novo", "Novo OPS")}
          {abaBtn("historico", "Histórico")}
        </div>
      </div>

      {aviso && <p className="max-w-2xl mx-auto px-4 text-sm" style={{ color: "var(--status-ok)" }}>{aviso}</p>}

      {aba === "novo" && registros && (
        <OpsForm key={`novo-${formKey}`} registros={registros} membros={membros} nomeUsuario={nomeUsuario}
          onCancelar={() => { setFormKey((k) => k + 1); setAba("historico"); }}
          onSalvo={() => { carregar(); setFormKey((k) => k + 1); setAviso("OPS salvo. Use \"Gerar PDF\" para imprimir e colher a assinatura."); setAba("historico"); }} />
      )}
      {aba === "novo" && !registros && !erro && <p className="max-w-2xl mx-auto p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</p>}
      {aba === "novo" && erro && <p className="max-w-2xl mx-auto p-4 text-sm" style={{ color: "var(--status-danger)" }}>{erro}</p>}

      {aba === "historico" && editando && (
        <OpsForm key={`edit-${editando.id}`} registros={registros || []} membros={membros} nomeUsuario={nomeUsuario} editando={editando}
          onCancelar={() => setEditando(null)}
          onSalvo={() => { carregar(); setEditando(null); setAviso("Correção salva (registrada na trilha de auditoria)."); }} />
      )}
      {aba === "historico" && !editando && (
        <OpsHistorico registros={registros} erro={erro} uid={uid} isAdmin={isAdmin}
          onCorrigir={(r) => { setAviso(""); setEditando(r); }} onExcluido={carregar} />
      )}
    </div>
  );
}
