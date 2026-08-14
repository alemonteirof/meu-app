// remove_old_export.cjs
// Remove a funcao exportIndicadorXlsx ANTIGA (baseada em xlsx, sem
// estilo) que ficou sobrando duplicada depois de criarmos a nova
// versao com ExcelJS.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("const rows = filtered.map((r) => ({")) {
  console.log("A função antiga já não existe mais — não precisa mudar nada.");
  process.exit(0);
}

const alvo = `  function exportIndicadorXlsx() {
    const rows = filtered.map((r) => ({
      'Data Diagnóstico': formatDateBR(r.dataDiagnostico),
      'Tipo': r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha',
      'Etiqueta': r.etiqueta || '',
      'Endereço': r.endereco || '',
      'Laço': r.laco || '',
      'Painel': r.painel || '',
      'Equipamento': r.equipamento || '',
      'Área': r.area || '',
      'Falha': r.falha || '',
      'Descritivo': r.descritivo || '',
      'Status': r.status || '',
      'Explanação': r.explanacao || '',
      'Solução': r.solucao || '',
      'Data Solução': formatDateBR(r.dataSolucao),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
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
    XLSX.writeFile(wb, \`indicador_\${todayISO()}.xlsx\`, { cellStyles: true });
  }
`;

const escaped = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\r?\\n");
const re = new RegExp(escaped, "g");
const matches = text.match(re);

if (!matches || matches.length === 0) {
  console.error("ERRO: não achei o texto exato da função antiga. Nada foi alterado. Me chama com um print do erro.");
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`ERRO: achei ${matches.length} vezes (esperava 1). Nada foi alterado. Me chama.`);
  process.exit(1);
}

text = text.replace(re, "");
fs.writeFileSync("src/App.jsx.bak_remove_old_export", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Função antiga (sem estilo) removida — agora só existe a versão com ExcelJS.");
