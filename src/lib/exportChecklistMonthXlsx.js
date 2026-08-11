// src/lib/exportChecklistMonthXlsx.js
//
// Junta todos os checklists de UM equipamento num mês só, no formato de
// grade (dias 1-31), igual ao template original — mas já preenchido.

import ExcelJS from "exceljs";
import { TOOL_CHECKLISTS, STATUS_OPTIONS } from "./toolChecklists";

const VINHO = "FF8B2F2F";
const VINHO_ESCURO = "FF5F1F1F";
const CINZA_CLARO = "FFE1E1E1";
const BRANCO = "FFFFFFFF";
const VERMELHO = "FFCC0000";

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

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export async function exportMonthToXlsx(equipamento, records, year, month) {
  const checklist = TOOL_CHECKLISTS[equipamento.tool_type];
  const daysInMonth = new Date(year, month, 0).getDate();

  const porDia = {};
  records.forEach((r) => {
    if (!r.data_checklist) return;
    const d = new Date(r.data_checklist + "T00:00:00");
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
    const dia = d.getDate();
    if (!porDia[dia] || new Date(r.created_at) > new Date(porDia[dia].created_at)) {
      porDia[dia] = r;
    }
  });

  const tecnicos = [...new Set(records.map((r) => r.tecnico_nome).filter(Boolean))];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Checklist do mês", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  const nCols = 2 + daysInMonth;
  ws.getColumn(1).width = 4.5;
  ws.getColumn(2).width = 40;
  for (let d = 1; d <= daysInMonth; d++) ws.getColumn(2 + d).width = 3.6;

  function colLetter(n) {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  const lastCol = colLetter(nCols);

  ws.mergeCells(`A1:${lastCol}2`);
  const banner = ws.getCell("A1");
  banner.value = `M.A.J Soluções — CHECK LIST PRÉ OPERACIONAL (CONSOLIDADO DO MÊS)\n${checklist.label} — ${equipamento.marca}${equipamento.modelo ? " " + equipamento.modelo : ""}${equipamento.especificacoes ? " (" + equipamento.especificacoes + ")" : ""}`;
  banner.font = { bold: true, color: { argb: BRANCO }, size: 12 };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  banner.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;

  const base64 = await logoBase64();
  if (base64) {
    const imgId = wb.addImage({ base64, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.05, row: 0.1 }, ext: { width: 55, height: 35 } });
  }

  ws.mergeCells(`A3:${lastCol}3`);
  const epiCell = ws.getCell("A3");
  epiCell.value = "EPIs obrigatórios: " + checklist.epis.join("  ·  ");
  epiCell.font = { bold: true, size: 8 };
  epiCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CLARO } };
  epiCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(3).height = 16;

  ws.mergeCells(`A4:F4`);
  ws.getCell("A4").value = `Mês/Ano: ${MESES[month - 1]}/${year}`;
  ws.getCell("A4").font = { bold: true, size: 9 };
  ws.mergeCells(`G4:${lastCol}4`);
  ws.getCell("G4").value = `Técnicos no período: ${tecnicos.join(", ") || "-"}`;
  ws.getCell("G4").font = { size: 9, italic: true };
  ws.getRow(4).height = 15;
  ws.getRow(5).height = 5;

  const headerRow = 6;
  ws.mergeCells(`A${headerRow}:B${headerRow}`);
  const h1 = ws.getCell(`A${headerRow}`);
  h1.value = "ITENS A SEREM OBSERVADOS";
  h1.font = { bold: true, color: { argb: BRANCO }, size: 9 };
  h1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  h1.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(`C${headerRow}:${lastCol}${headerRow}`);
  const h2 = ws.getCell(`C${headerRow}`);
  h2.value = "DIAS DO MÊS";
  h2.font = { bold: true, color: { argb: BRANCO }, size: 9 };
  h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  h2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(headerRow).height = 14;

  const daysRow = headerRow + 1;
  ws.getCell(`A${daysRow}`).value = "Nº";
  ws.getCell(`B${daysRow}`).value = "DESCRIÇÃO";
  for (let d = 1; d <= daysInMonth; d++) {
    const c = ws.getCell(daysRow, 2 + d);
    c.value = d;
    c.font = { bold: true, size: 6.5 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CLARO } };
  }
  ["A", "B"].forEach((col) => {
    const c = ws.getCell(`${col}${daysRow}`);
    c.font = { bold: true, size: 7.5 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_CLARO } };
  });
  ws.getRow(daysRow).height = 13;

  const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  let r = daysRow + 1;
  checklist.itens.forEach((descricao, idx) => {
    ws.getCell(r, 1).value = idx + 1;
    ws.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(r, 2).value = descricao;
    ws.getCell(r, 2).alignment = { wrapText: true, vertical: "middle" };
    ws.getCell(r, 2).font = { size: 8 };

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = ws.getCell(r, 2 + d);
      cell.border = thinBorder;
      const registroDoDia = porDia[d];
      if (registroDoDia) {
        const resposta = (registroDoDia.respostas || [])[idx];
        if (resposta) {
          cell.value = resposta.status;
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { size: 7, bold: resposta.status === "NC", color: resposta.status === "NC" ? { argb: VERMELHO } : undefined };
        }
      }
    }
    ws.getCell(r, 1).border = thinBorder;
    ws.getCell(r, 2).border = thinBorder;
    ws.getRow(r).height = 22;
    r += 1;
  });

  r += 1;
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = "Legenda:   C = Conforme   NC = Não Conforme   P = Parcialmente   NA = Não se Aplica   (célula em branco = não houve checklist naquele dia)";
  ws.getCell(`A${r}`).font = { bold: true, size: 8 };

  const comObs = records.filter((rec) => rec.observacoes && rec.observacoes.trim());
  if (comObs.length) {
    r += 2;
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    ws.getCell(`A${r}`).value = "Observações registradas no mês:";
    ws.getCell(`A${r}`).font = { bold: true, size: 8 };
    comObs.forEach((rec) => {
      r += 1;
      const dia = new Date(rec.data_checklist + "T00:00:00").getDate();
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      ws.getCell(`A${r}`).value = `Dia ${dia}: ${rec.observacoes}`;
      ws.getCell(`A${r}`).font = { size: 8, italic: true };
      ws.getCell(`A${r}`).alignment = { wrapText: true };
    });
  }

  r += 2;
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = `Documento consolidado a partir dos registros digitais do sistema MAJ — gerado em ${new Date().toLocaleString("pt-BR")}.`;
  ws.getCell(`A${r}`).font = { italic: true, size: 7, color: { argb: "FF666666" } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checklist_mensal_${equipamento.marca}_${MESES[month - 1]}_${year}.xlsx`.replace(/\s+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
