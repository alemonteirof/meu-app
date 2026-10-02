// src/components/ToolChecklistPdf.jsx
//
// PDFs do checklist de ferramentas (substituem os antigos .xlsx):
//   <ChecklistPdfIndividual record={r} clienteNome="..." onBack={...} />   — 1 preenchimento (A4 em pé)
//   <ChecklistPdfMes equipamento={eq} records={[...]} ano={2026} mes={10} onBack={...} /> — grade dias 1-31 (A4 deitado)
// Ambos usam MajFolhaImpressao (window.print, mesmo esquema do RVT/DDS).

import { TOOL_CHECKLISTS, STATUS_OPTIONS } from "../lib/toolChecklists";
import { AssinaturaPreview } from "./MajSignatureField";
import MajFolhaImpressao, { ResumoCard } from "./MajFolhaImpressao";

const VINHO = "#8B2F2F";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmtData = (r) => (r.data_checklist ? r.data_checklist.split("-").reverse().join("/") : new Date(r.created_at).toLocaleDateString("pt-BR"));
const fmtDataHora = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "—");
const opcoesDo = (checklist) => (checklist?.statusOptions ? STATUS_OPTIONS.filter((o) => checklist.statusOptions.includes(o.value)) : STATUS_OPTIONS);
const nomeEquip = (eq) => `${eq.marca}${eq.modelo ? " " + eq.modelo : ""}${eq.especificacoes ? " (" + eq.especificacoes + ")" : ""}`;
const arquivoSeguro = (s) => s.replace(/[\\/:*?"<>|]/g, "-");

const cel = { padding: "5px 6px", border: "1px solid var(--border)", verticalAlign: "middle" };
const celHead = { ...cel, background: VINHO, color: "#fff", fontWeight: 700, textAlign: "center" };
const mono = { fontFamily: "ui-monospace, Menlo, Consolas, monospace" };

function Epis({ checklist }) {
  return (
    <p style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, background: "var(--surface-raised)" }}>
      <strong>EPIs obrigatórios:</strong> {checklist.epis.join(" · ")}
    </p>
  );
}

export function ChecklistPdfIndividual({ record, clienteNome, onBack }) {
  const checklist = TOOL_CHECKLISTS[record.tool_type];
  const opcoes = opcoesDo(checklist);

  return (
    <MajFolhaImpressao
      titulo="CHECK LIST PRÉ-OPERACIONAL"
      subtitulo={`${checklist?.label || record.tool_type} · ${checklist?.codigo || ""}`}
      nomeArquivo={arquivoSeguro(`Checklist - ${checklist?.label || record.tool_type} - ${fmtData(record).replace(/\//g, "-")}`)}
      onBack={onBack}
      rodape={`Documento gerado a partir do registro digital do CCM em ${new Date().toLocaleString("pt-BR")}.`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResumoCard rotulo="Data" valor={fmtData(record)} />
        <ResumoCard rotulo="Técnico responsável" valor={record.tecnico_nome || "—"} />
        <ResumoCard rotulo="Cliente / local" valor={clienteNome || "Avulso"} />
        <ResumoCard rotulo="Equipamento" valor={`${record.marca_modelo || "—"}${record.identificacao_tag ? ` · TAG ${record.identificacao_tag}` : ""}`} />
      </div>

      {checklist && <Epis checklist={checklist} />}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...celHead, width: 32 }}>Nº</th>
            <th style={{ ...celHead, textAlign: "left" }}>Descrição</th>
            {opcoes.map((o) => <th key={o.value} style={{ ...celHead, width: 40 }}>{o.value}</th>)}
          </tr>
        </thead>
        <tbody>
          {(record.respostas || []).map((it) => (
            <tr key={it.item} style={{ breakInside: "avoid" }}>
              <td style={{ ...cel, textAlign: "center" }}>{it.item}</td>
              <td style={cel}>{it.descricao}</td>
              {opcoes.map((o) => {
                const marcado = it.status === o.value;
                return (
                  <td key={o.value} style={{ ...cel, textAlign: "center", fontWeight: 700, color: marcado && o.value === "NC" ? "#CC0000" : undefined }}>
                    {marcado ? "X" : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>Legenda: {opcoes.map((o) => `${o.value} = ${o.label}`).join(" · ")}</p>

      {record.observacoes && (
        <p style={{ fontSize: 12 }}><strong>Observações:</strong> {record.observacoes}</p>
      )}

      <div className="grid grid-cols-2 gap-6" style={{ breakInside: "avoid", marginTop: 8 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ minHeight: 64, display: "flex", alignItems: "flex-end", justifyContent: "center", borderBottom: "1px solid var(--text-secondary)", paddingBottom: 4 }}>
            {record.assinatura_valor && <AssinaturaPreview tipo={record.assinatura_tipo} valor={record.assinatura_valor} maxWidth={220} />}
          </div>
          <p style={{ fontSize: 10, fontStyle: "italic", marginTop: 4 }}>Técnico responsável (assinatura)</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ minHeight: 64, borderBottom: "1px solid var(--text-secondary)" }} />
          <p style={{ fontSize: 10, fontStyle: "italic", marginTop: 4 }}>Encarregado/Supervisor (visto)</p>
        </div>
      </div>
      <p style={{ fontSize: 9, color: "var(--text-secondary)" }}>
        {record.assinatura_valor
          ? <>Assinado digitalmente por {record.assinado_por_nome || record.tecnico_nome} (login {record.assinado_por_email || "—"}) em {fmtDataHora(record.assinado_em)} · verificação SHA-256: <span style={mono}>{record.assinatura_hash || "—"}</span></>
          : "Registro anterior à assinatura digital (sem assinatura)."}
      </p>
    </MajFolhaImpressao>
  );
}

export function ChecklistPdfMes({ equipamento, records, ano, mes, onBack }) {
  const checklist = TOOL_CHECKLISTS[equipamento.tool_type];
  const opcoes = opcoesDo(checklist);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  // 1 registro por dia (o mais recente, se houver mais de um)
  const porDia = {};
  records.forEach((r) => {
    if (!r.data_checklist) return;
    const [a, m, d] = r.data_checklist.split("-").map(Number);
    if (a !== ano || m !== mes) return;
    if (!porDia[d] || new Date(r.created_at) > new Date(porDia[d].created_at)) porDia[d] = r;
  });
  const diasComRegistro = Object.keys(porDia).map(Number).sort((a, b) => a - b);
  const tecnicos = [...new Set(records.map((r) => r.tecnico_nome).filter(Boolean))];
  const comObs = records.filter((r) => r.observacoes && r.observacoes.trim());
  const celDia = { ...cel, padding: "3px 0", textAlign: "center", fontSize: 9 };

  return (
    <MajFolhaImpressao
      titulo="CHECK LIST PRÉ-OPERACIONAL — CONSOLIDADO DO MÊS"
      subtitulo={`${checklist?.label || equipamento.tool_type} · ${checklist?.codigo || ""}`}
      nomeArquivo={arquivoSeguro(`Checklist mensal - ${nomeEquip(equipamento)} - ${MESES[mes - 1]} ${ano}`)}
      orientacao="landscape"
      onBack={onBack}
      rodape={`Documento consolidado a partir dos registros digitais do CCM — gerado em ${new Date().toLocaleString("pt-BR")}.`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResumoCard rotulo="Mês / ano" valor={`${MESES[mes - 1]}/${ano}`} />
        <ResumoCard rotulo="Equipamento" valor={nomeEquip(equipamento)} />
        <ResumoCard rotulo="Técnicos no período" valor={tecnicos.join(", ") || "—"} />
        <ResumoCard rotulo="Dias com checklist" valor={`${diasComRegistro.length} de ${diasNoMes}`} />
      </div>

      {checklist && <Epis checklist={checklist} />}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 26 }} />
          <col style={{ width: "28%" }} />
          {dias.map((d) => <col key={d} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={celHead} colSpan={2}>ITENS A SEREM OBSERVADOS</th>
            <th style={celHead} colSpan={diasNoMes}>DIAS DO MÊS</th>
          </tr>
          <tr>
            <th style={{ ...cel, background: "var(--surface-raised)" }}>Nº</th>
            <th style={{ ...cel, background: "var(--surface-raised)" }}>Descrição</th>
            {dias.map((d) => <th key={d} style={{ ...celDia, background: "var(--surface-raised)", fontWeight: 700 }}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {(checklist?.itens || []).map((descricao, idx) => (
            <tr key={idx} style={{ breakInside: "avoid" }}>
              <td style={{ ...cel, textAlign: "center" }}>{idx + 1}</td>
              <td style={{ ...cel, fontSize: 9 }}>{descricao}</td>
              {dias.map((d) => {
                const st = porDia[d]?.respostas?.[idx]?.status || "";
                return <td key={d} style={{ ...celDia, fontWeight: st === "NC" ? 700 : 400, color: st === "NC" ? "#CC0000" : undefined }}>{st}</td>;
              })}
            </tr>
          ))}
          <tr>
            <td style={cel} />
            <td style={{ ...cel, fontWeight: 700, fontSize: 9 }}>ASSINADO (assinatura digital do técnico)</td>
            {dias.map((d) => <td key={d} style={{ ...celDia, fontWeight: 700 }}>{porDia[d] ? (porDia[d].assinatura_valor ? "✓" : "—") : ""}</td>)}
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>
        Legenda: {opcoes.map((o) => `${o.value} = ${o.label}`).join(" · ")} · célula em branco = não houve checklist naquele dia
      </p>

      {diasComRegistro.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Assinaturas do mês</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...celHead, width: 50 }}>Dia</th>
                <th style={{ ...celHead, textAlign: "left" }}>Técnico / login</th>
                <th style={{ ...celHead, width: 150 }}>Assinado em</th>
                <th style={{ ...celHead, width: "30%" }}>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {diasComRegistro.map((d) => {
                const r = porDia[d];
                return (
                  <tr key={d} style={{ breakInside: "avoid" }}>
                    <td style={{ ...cel, textAlign: "center" }}>{d}</td>
                    <td style={cel}>
                      <div style={{ fontWeight: 600 }}>{r.assinado_por_nome || r.tecnico_nome}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{r.assinado_por_email || "—"}</div>
                    </td>
                    <td style={{ ...cel, textAlign: "center" }}>{fmtDataHora(r.assinado_em)}</td>
                    <td style={cel}>
                      {r.assinatura_valor ? (
                        <>
                          <AssinaturaPreview tipo={r.assinatura_tipo} valor={r.assinatura_valor} maxWidth={160} />
                          <div style={{ ...mono, fontSize: 8, color: "var(--text-secondary)" }}>SHA-256 {(r.assinatura_hash || "—").slice(0, 16)}…</div>
                        </>
                      ) : <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Registro anterior à assinatura digital</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comObs.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Observações registradas no mês</p>
          {comObs.map((r) => (
            <p key={r.id} style={{ fontSize: 11 }}><strong>Dia {Number(r.data_checklist.split("-")[2])}:</strong> {r.observacoes}</p>
          ))}
        </div>
      )}
    </MajFolhaImpressao>
  );
}
