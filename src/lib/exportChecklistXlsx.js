// src/lib/exportChecklistXlsx.js
import ExcelJS from "exceljs";
import { TOOL_CHECKLISTS, STATUS_OPTIONS } from "./toolChecklists";

const VINHO = "FF8B2F2F";
const VINHO_ESCURO = "FF5F1F1F";
const CINZA_CLARO = "FFE1E1E1";
const BRANCO = "FFFFFFFF";

async function logoBase64() {
  try {
    const res = await fetch("/logo-maj-branco.png");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

function fmtData(record) {
  const d = record.data_checklist ? new Date(record.data_checklist + "T00:00:00") : new Date(record.created_at);
  return d.toLocaleDateString("pt-BR");
}

export async function exportChecklistToXlsx(record, clienteNome) {
  const checklist = TOOL_CHECKLISTS[record.tool_type];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Checklist", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });

  ws.columns = [
    { width: 5 },
    { width: 55 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
  ];

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;

  ws.mergeCells("A1:F2");
  const bannerCell = ws.getCell("A1");
  bannerCell.value = `M.A.J Soluções — CHECK LIST PRÉ OPERACIONAL\n${checklist.label}`;
  bannerCell.font = { bold: true, color: { argb: BRANCO }, size: 13 };
  bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  bannerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const base64 = await logoBase64();
  if (base64) {
    const imgId = wb.addImage({ base64, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.05, row: 0.1 }, ext: { width: 60, height: 38 } });
  }

  ws.mergeCells("A3:F3");
  const epiCell = ws.getCell("A3");
  epiCell.value = "EPIs obrigatórios: " + checklist.epis.join("  ·  ");
  epiCell.font = { bold: true, size: 9 };
  epiCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CLARO } };
  epiCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(3).height = 26;

  const campos = [
    ["Código:", checklist.codigo],
    ["Data:", fmtData(record)],
    ["Técnico responsável:", record.tecnico_nome],
    ["Cliente/Local:", clienteNome || "Avulso"],
    ["Marca/Modelo:", record.marca_modelo || "-"],
    ["Identificação/TAG:", record.identificacao_tag || "-"],
  ];
  let r = 4;
  campos.forEach(([label, valor]) => {
    ws.mergeCells(`A${r}:B${r}`);
    const lc = ws.getCell(`A${r}`);
    lc.value = label;
    lc.font = { bold: true, size: 9 };
    ws.mergeCells(`C${r}:F${r}`);
    const vc = ws.getCell(`C${r}`);
    vc.value = valor;
    vc.font = { size: 9 };
    r += 1;
  });

  r += 1;
  const headerRow = ["Nº", "Descrição", "C", "NC", "P", "NA"];
  headerRow.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: BRANCO }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO_ESCURO } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  r += 1;

  const respostas = record.respostas || [];
  respostas.forEach((item) => {
    ws.getCell(r, 1).value = item.item;
    ws.getCell(r, 2).value = item.descricao;
    ws.getCell(r, 2).alignment = { wrapText: true, vertical: "middle" };
    STATUS_OPTIONS.forEach((opt, i) => {
      const cell = ws.getCell(r, 3 + i);
      cell.value = item.status === opt.value ? "X" : "";
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: item.status === opt.value, color: item.status === "NC" && item.status === opt.value ? { argb: "FFCC0000" } : undefined };
    });
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    }
    ws.getRow(r).height = 24;
    r += 1;
  });

  r += 1;
  if (record.observacoes) {
    ws.mergeCells(`A${r}:F${r}`);
    const oc = ws.getCell(`A${r}`);
    oc.value = `Observações: ${record.observacoes}`;
    oc.font = { italic: true, size: 9 };
    oc.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = 30;
    r += 2;
  } else {
    r += 1;
  }

  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).border = { bottom: { style: "thin" } };
  ws.mergeCells(`D${r}:F${r}`);
  ws.getCell(`D${r}`).border = { bottom: { style: "thin" } };
  r += 1;
  ws.mergeCells(`A${r}:C${r}`);
  ws.getCell(`A${r}`).value = "Técnico responsável (assinatura)";
  ws.getCell(`A${r}`).font = { italic: true, size: 8 };
  ws.getCell(`A${r}`).alignment = { horizontal: "center" };
  ws.mergeCells(`D${r}:F${r}`);
  ws.getCell(`D${r}`).value = "Encarregado/Supervisor (visto)";
  ws.getCell(`D${r}`).font = { italic: true, size: 8 };
  ws.getCell(`D${r}`).alignment = { horizontal: "center" };

  ws.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checklist_${record.tool_type}_${fmtData(record).replaceAll("/", "-")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
