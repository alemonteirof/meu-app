// src/components/OpsPrintView.jsx
//
// Uso: <OpsPrintView registro={row} onBack={...} />
// Folha do OPS no layout IGUAL ao modelo oficial da Nissan ("Modelo - OPS - Observação
// Preventiva de Segurança - TERCEIROS.doc"): A4 retrato, 1 página, SEM a faixa de marca
// do RVT. Depende só do registro gravado (mesmo registro => mesma folha) — o robô do Box
// abre #/ops/<id>/imprimir e salva o PDF. A assinatura fica no banco e NÃO aparece aqui.
// document.title = "OPS SEMANA XX" (nome do arquivo ao salvar PDF).

import { useEffect } from "react";
import { getOpsItens, OPS_RESPOSTAS, OPS_TEXTOS, OPS_EMPRESA, nomeArquivoOps } from "../lib/opsItens";

const VINHO = "#8B2F2F";
const AZUL = "#0000EE";
const VERMELHO = "#E00000";
const TIMES = '"Times New Roman", Times, serif';
const ARIAL = "Arial, Helvetica, sans-serif";
const LINHA = 5.2; // mm — altura de cada linha pautada do Levantamento

const btnBase = { fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };
const btnPrimario = { ...btnBase, background: VINHO, borderColor: VINHO, color: "white", fontWeight: 600 };

const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const bd = "1px solid #000";

function Bullet() {
  return <span style={{ display: "inline-block", width: "4mm", flexShrink: 0 }}>•</span>;
}

function TextoItem({ item }) {
  return (
    <div style={{ display: "flex", paddingLeft: `${item.recuo}mm`, alignItems: "baseline" }}>
      {item.bullet ? <Bullet /> : null}
      <div style={{ flex: 1 }}>
        {item.destaque && (
          <span style={{ color: AZUL, fontWeight: 700, textDecoration: "underline", fontSize: item.destaqueGrande ? "11.5pt" : undefined }}>
            {item.destaque}
          </span>
        )}
        {item.texto}
        {item.inline && (
          item.inlineRecuo != null ? (
            <span style={{ display: "inline-block", marginLeft: `${Math.max(item.inlineRecuo - 20, 4)}mm` }}>
              <span style={{ fontWeight: 700, marginRight: "3mm" }}>•</span>{item.inline}
            </span>
          ) : (
            <span style={{ marginLeft: "2mm" }}><span style={{ fontWeight: 700, marginRight: "3mm" }}>•</span>{item.inline}</span>
          )
        )}
      </div>
    </div>
  );
}

function BlocoTexto({ titulo, orientacao, valor }) {
  return (
    <>
      <tr>
        <td style={{ border: bd, borderTopWidth: 2, padding: "0.4mm 1mm", fontSize: "9.5pt" }}>
          <b>{titulo}</b> {orientacao}
        </td>
      </tr>
      <tr>
        <td style={{ border: bd, padding: "0 1mm" }}>
          <div style={{
            minHeight: `${LINHA * 5}mm`, lineHeight: `${LINHA}mm`, fontSize: "9.5pt", whiteSpace: "pre-wrap", wordBreak: "break-word",
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${LINHA}mm - 1px), #000 calc(${LINHA}mm - 1px), #000 ${LINHA}mm)`,
          }}>
            {valor}
          </div>
        </td>
      </tr>
    </>
  );
}

// Só a folha (sem botões) — reaproveitável.
export function OpsFolha({ registro }) {
  const itens = getOpsItens(registro.form_versao);
  const resp = registro.respostas || {};
  const cel = { border: bd, verticalAlign: "top", padding: "0.35mm 1.2mm" };
  const colResp = { width: "11mm" };
  const tituloLetra = { color: VERMELHO, fontSize: "20pt" };

  return (
    <div className="ops-folha" style={{ width: "186mm", margin: "0 auto", background: "#fff", color: "#000", fontFamily: TIMES, fontSize: "10pt", lineHeight: 1.2, padding: "0" }}>
      {/* Topo */}
      <div style={{ display: "flex", alignItems: "center", gap: "3mm", fontSize: "10.5pt" }}>
        <span>Logo Empresa:</span>
        <img src="/maj-logo-full-lightbg.png" alt="MAJ Soluções" style={{ height: "12mm", width: "auto" }} />
      </div>
      <h1 style={{ textAlign: "center", fontFamily: TIMES, fontWeight: 700, fontSize: "16pt", margin: "0 0 0.5mm", lineHeight: 1.1 }}>
        <span style={tituloLetra}>O</span>bservação <span style={tituloLetra}>P</span>reventiva de <span style={tituloLetra}>S</span>egurança
      </h1>

      {/* Cabeçalho */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "21%" }} /><col style={{ width: "31%" }} /><col style={{ width: "29%" }} /><col style={{ width: "19%" }} /></colgroup>
        <tbody>
          <tr>
            <td style={cel}>Observador:<div style={{ minHeight: "4.5mm" }}>{registro.observador_nome || registro.observador_email || ""}</div></td>
            <td style={cel}>Funcionário:<div style={{ minHeight: "4.5mm" }}>{registro.funcionario_observado}</div></td>
            <td style={cel}>Prédio: {registro.predio}<div>Empresa: {registro.empresa || OPS_EMPRESA}</div></td>
            <td style={cel}>Data:<div>{dataBR(registro.data_ops)}</div></td>
          </tr>
        </tbody>
      </table>

      {/* Instruções + itens */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: "-1px" }}>
        <colgroup><col /><col style={colResp} /><col style={colResp} /><col style={colResp} /></colgroup>
        <tbody>
          <tr>
            <td rowSpan={2} style={{ ...cel, fontSize: "8pt", lineHeight: 1.25 }}>
              * Verificação, nos diferentes domínios, da conformidade com o estado padrão e dos conhecimentos do pessoal.<br />
              * Ao final da observação, uma restituição é feita ao operador insistindo nos pontos positivos e a serem melhorados.
            </td>
            <td colSpan={3} style={{ ...cel, textAlign: "center", fontSize: "10.5pt", borderBottom: "none", paddingBottom: 0 }}>Conforme</td>
          </tr>
          <tr>
            {OPS_RESPOSTAS.map((r) => (
              <td key={r.valor} style={{ ...cel, borderTop: "none", textAlign: "center", fontSize: "8pt", height: "8mm" }}>{r.rotulo}</td>
            ))}
          </tr>
          {itens.map((item) => (
            <tr key={item.n} style={{ breakInside: "avoid" }}>
              <td style={cel}><TextoItem item={item} /></td>
              {OPS_RESPOSTAS.map((r) => (
                <td key={r.valor} style={{ ...cel, textAlign: "center", verticalAlign: "middle", fontFamily: ARIAL, fontWeight: 700, fontSize: "11pt" }}>
                  {resp[String(item.n)] === r.valor ? "X" : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Levantamento de fatos particulares */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "2mm", fontFamily: ARIAL, border: "2px solid #000" }}>
        <tbody>
          <tr>
            <td style={{ border: "2px solid #000", textAlign: "center", fontWeight: 700, fontSize: "10pt", padding: "0.4mm" }}>LEVANTAMENTO DE FATOS PARTICULARES</td>
          </tr>
          {OPS_TEXTOS.map((t) => (
            <BlocoTexto key={t.campo} titulo={t.titulo} orientacao={t.orientacao} valor={registro[t.campo]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OpsPrintView({ registro, onBack }) {
  const nomeArquivo = nomeArquivoOps(registro.semana_iso);

  useEffect(() => {
    const anterior = document.title;
    document.title = nomeArquivo;
    // sinal p/ o robô (navegador headless) saber que a folha terminou de montar
    document.body.dataset.opsPronto = registro.id;
    return () => { document.title = anterior; delete document.body.dataset.opsPronto; };
  }, [nomeArquivo, registro.id]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* @page próprio: A4 retrato (o padrão global de impressão é A4 paisagem do RVT) */}
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm 12mm; } .ops-folha { width: 100% !important; } }`}</style>
      <div className="flex items-center justify-between gap-3 flex-wrap no-print mb-3">
        {onBack ? <button type="button" onClick={onBack} style={btnBase}>← Voltar</button> : <span />}
        <button type="button" onClick={() => { document.title = nomeArquivo; window.print(); }} style={btnPrimario}>
          Imprimir / Salvar PDF ({nomeArquivo}.pdf)
        </button>
      </div>
      <div className="no-print text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
        Layout do modelo oficial Nissan. A assinatura do observador fica registrada no CCM e não sai na folha.
      </div>
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 6, padding: "4mm 0" }}>
        <div className="print-area" style={{ background: "#fff", color: "#000" }}>
          <OpsFolha registro={registro} />
        </div>
      </div>
    </div>
  );
}
