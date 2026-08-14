// fix_pdf_and_excel_v2.cjs
// Versao com busca tolerante a CRLF (funciona independente de como o
// arquivo quebra linha).
// 1) Corrige o PDF em branco do Indicador (adiciona classe print-area).
// 2) Deixa o Excel exportado com cabecalho colorido e formatado.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

const problemas = [];

function crlfSafeReplace(label, alvo, novo) {
  const escaped = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\r?\\n");
  const re = new RegExp(escaped, "g");
  const matches = text.match(re);
  if (!matches || matches.length === 0) { problemas.push(`[${label}] não achei: "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  if (matches.length > 1) { problemas.push(`[${label}] achei ${matches.length}x (esperava 1): "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  text = text.replace(re, () => novo);
}

if (text.includes("indicador-print-area")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) Corrige PDF em branco: marca a área do Indicador como print-area ===== */
crlfSafeReplace(
  "print-area-marker",
  `function IndicadorView({ data, canEdit, onCreate, onEdit, onDelete, onImportFile, onLinkDevices, onBulkDelete, onDeleteByStatus, onDeleteAll }) {
  const list = data.indicador || [];`,
  `function IndicadorView({ data, canEdit, onCreate, onEdit, onDelete, onImportFile, onLinkDevices, onBulkDelete, onDeleteByStatus, onDeleteAll }) {
  const list = data.indicador || [];
  // indicador-print-area: classe usada pra liberar essa tela na impressão (ver CSS @media print)`
);

crlfSafeReplace(
  "print-area-div",
  `  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Indicador</h2>`,
  `  return (
    <div className="flex flex-col gap-4 print-area">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Indicador</h2>`
);

/* ===== 2) Excel com visual melhor (cabecalho colorido, negrito, largura) ===== */
crlfSafeReplace(
  "excel-visual",
  `    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
      { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicador');
    XLSX.writeFile(wb, \`indicador_\${todayISO()}.xlsx\`);`,
  `    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
      { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 },
    ];
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
    headerCols.forEach((col) => {
      const cell = ws[\`\${col}1\`];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: '8B2F2F' } },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      }
    });
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) {
          ws[addr].s = { alignment: { vertical: 'top', wrapText: true } };
        }
      }
    }
    ws['!rows'] = [{ hpt: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicador');
    XLSX.writeFile(wb, \`indicador_\${todayISO()}.xlsx\`, { cellStyles: true });`
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_pdf_excel", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! PDF corrigido e Excel com visual melhor.");
