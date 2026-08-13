// add_export_indicador.cjs
// Adiciona exportacao do Indicador em Excel (.xlsx) e PDF/Imprimir
// (reaproveitando a lib xlsx e o padrao window.print() ja usados no app).
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("function exportIndicadorXlsx(")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

const problemas = [];

function selfInsertAfter(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker) + marker.length;
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

function selfInsertBefore(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker);
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

/* ===== 1) Função exportIndicadorXlsx (logo depois de linkedCount) ===== */
selfInsertAfter(
  "exportIndicadorXlsx",
  "const linkedCount = list.filter((r) => r.deviceId).length;",
  `
  function exportIndicadorXlsx() {
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicador');
    XLSX.writeFile(wb, \`indicador_\${todayISO()}.xlsx\`);
  }
`
);

/* ===== 2) Botões de Exportar Excel e Imprimir/Salvar PDF ===== */
selfInsertBefore(
  "botoes-export",
  `<label className="btn btn-secondary cursor-pointer" style={importing ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>`,
  `{list.length > 0 && (
              <>
                <Button variant="secondary" onClick={exportIndicadorXlsx}><FileText size={15} /> Exportar Excel</Button>
                <Button variant="secondary" onClick={() => window.print()} className="print:hidden"><Printer size={15} /> Imprimir / Salvar PDF</Button>
              </>
            )}
            `
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_export_indicador", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Exportação Excel e PDF/Imprimir adicionadas ao Indicador.");
