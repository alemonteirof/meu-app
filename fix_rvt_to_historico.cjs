// fix_rvt_to_historico.cjs
// Faz o RVT tambem escrever no Historico de manutencoes (maintenanceLog),
// nao so no Indicador. Preserva o comportamento de edicao (nao duplica).
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

if (text.includes("const historicoEntries = report.itens")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

const startMarker = "function saveRvtReport(report) {";
const endMarker = "function deleteRvtReport(id) {";

const startCount = text.split(startMarker).length - 1;
if (startCount === 0) { console.error("ERRO: não achei o início. Nada foi alterado. Me chama."); process.exit(1); }
if (startCount > 1) { console.error(`ERRO: achei ${startCount} vezes (esperava 1). Nada foi alterado. Me chama.`); process.exit(1); }

const startIdx = text.indexOf(startMarker);
const endIdx = text.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error("ERRO: não achei o fim. Nada foi alterado. Me chama."); process.exit(1); }

const novaFuncao = `function saveRvtReport(report) {
    updateData((prev) => {
      const indicadorEntries = report.itens.map((it) => ({
        id: uid(),
        deviceId: it.deviceId || '',
        categoria: it.categoria || '',
        etiqueta: it.etiqueta || '',
        endereco: it.endereco || '',
        laco: it.laco || '',
        painel: it.painel || '',
        area: it.area || '',
        equipamento: it.equipamento || '',
        falha: it.falha || '',
        descritivo: it.descritivo || '',
        status: it.status || '',
        explanacao: it.explanacao || '',
        dataDiagnostico: report.data,
        dataIntervencao1: it.dataIntervencao || '',
        dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
        dataSolucao: it.status === 'Resolvido' ? (it.dataIntervencao || report.data) : '',
        solucao: it.solucao || '',
        fotos: it.fotos || [],
        origemRvt: report.id,
      }));
      const historicoEntries = report.itens
        .filter((it) => it.deviceId && it.categoria)
        .map((it) => ({
          id: uid(),
          category: it.categoria,
          itemId: it.deviceId,
          date: it.dataIntervencao || report.data,
          technician: report.tecnico || '',
          description: it.descritivo || it.falha || '',
          nextDate: '',
          tipo: 'preventiva',
          origemRvt: report.id,
        }));
      const rvtSemAntigo = (prev.rvt || []).filter((r) => r.id !== report.id);
      const indicadorSemAntigo = (prev.indicador || []).filter((it) => it.origemRvt !== report.id);
      const maintenanceLogSemAntigo = (prev.maintenanceLog || []).filter((l) => l.origemRvt !== report.id);
      return {
        ...prev,
        rvt: [{ ...report }, ...rvtSemAntigo],
        indicador: [...indicadorEntries, ...indicadorSemAntigo],
        maintenanceLog: [...historicoEntries, ...maintenanceLogSemAntigo],
      };
    });
  }
  `;

text = text.slice(0, startIdx) + novaFuncao + text.slice(endIdx);
fs.writeFileSync("src/App.jsx.bak_rvt_historico", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! RVT agora também escreve no Histórico.");
