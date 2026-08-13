// cascade_delete_rvt_indicador.cjs
// Faz a exclusao em cascata: apagar do RVT tambem apaga o Indicador
// e o Historico (manutencao/inspecao) gerados por ele; apagar do
// Indicador (quando vinculado a um RVT) tambem apaga o RVT e o Historico.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const problemas = [];

function anchorReplace(label, startMarker, endMarker, novoConteudo) {
  const startCount = text.split(startMarker).length - 1;
  if (startCount === 0) { problemas.push(`[${label}] não achei o início: "${startMarker.slice(0, 60)}..."`); return; }
  if (startCount > 1) { problemas.push(`[${label}] achei ${startCount} vezes o início (esperava 1): "${startMarker.slice(0, 60)}..."`); return; }
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker, startIdx);
  if (endIdx === -1) { problemas.push(`[${label}] não achei o fim depois do início: "${endMarker.slice(0, 60)}..."`); return; }
  text = text.slice(0, startIdx) + novoConteudo + text.slice(endIdx);
}

if (text.includes("// exclusão em cascata: se esse registro veio de um RVT")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) deleteIndicador: se tinha origemRvt, apaga o RVT e o histórico junto ===== */
anchorReplace(
  "deleteIndicador",
  "function deleteIndicador(id) {",
  "function deleteIndicadorBulk(ids) {",
  `function deleteIndicador(id) {
    updateData((prev) => {
      const registro = (prev.indicador || []).find((r) => r.id === id);
      // exclusão em cascata: se esse registro veio de um RVT, apaga o RVT e o histórico junto
      const origemRvt = registro?.origemRvt;
      return {
        ...prev,
        indicador: (prev.indicador || []).filter((r) => r.id !== id),
        rvt: origemRvt ? (prev.rvt || []).filter((r) => r.id !== origemRvt) : prev.rvt,
        maintenanceLog: origemRvt ? (prev.maintenanceLog || []).filter((l) => l.origemRvt !== origemRvt) : prev.maintenanceLog,
        inspectionLog: origemRvt ? (prev.inspectionLog || []).filter((l) => l.origemRvt !== origemRvt) : prev.inspectionLog,
      };
    });
    setConfirmState(null);
  }

  `
);

/* ===== 2) deleteRvtReport: apaga junto os registros do Indicador e do histórico que ele gerou ===== */
anchorReplace(
  "deleteRvtReport",
  "function deleteRvtReport(id) {",
  "async function handleImportIndicador(file) {",
  `function deleteRvtReport(id) {
    updateData((prev) => ({
      ...prev,
      rvt: (prev.rvt || []).filter((r) => r.id !== id),
      indicador: (prev.indicador || []).filter((r) => r.origemRvt !== id),
      maintenanceLog: (prev.maintenanceLog || []).filter((l) => l.origemRvt !== id),
      inspectionLog: (prev.inspectionLog || []).filter((l) => l.origemRvt !== id),
    }));
    setConfirmState(null);
  }

  `
);

/* ===== 3) submitMaintenance: marca o registro do Indicador e o log com origemRvt ===== */
anchorReplace(
  "submitMaintenance",
  "function submitMaintenance(values) {",
  "function submitBulkMaintenance(values) {",
  `function submitMaintenance(values) {
    const { category, id } = modal.context;
    const fields = resolveIndicadorFields(data, category, modal.item);
    const falhaTexto = (values.falha || '').trim() || 'Realizado sem apontamentos';
    const statusFinal = values.status || 'Resolvido';
    const rvtId = uid();
    const novoIndicador = {
      id: uid(), tipo: 'manutencao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: values.description || '', status: statusFinal,
      explanacao: values.explanacao || '', dataDiagnostico: values.date,
      dataIntervencao1: values.date, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: statusFinal === 'Resolvido' ? values.date : '',
      solucao: values.solucao || '', fotos: [], origemRvt: rvtId,
    };
    const novoRvt = {
      id: rvtId, data: values.date, tecnico: values.technician,
      itens: [{
        id: uid(), deviceId: id, categoria: category,
        etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
        equipamento: fields.equipamento, area: fields.area,
        falha: falhaTexto, descritivo: values.description || '', status: statusFinal,
        explanacao: values.explanacao || '', dataIntervencao: values.date,
        solucao: values.solucao || '', fotos: [],
      }],
    };
    updateData((prev) => {
      const list = prev[category];
      const logEntry = { id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '', tipo: values.tipo || 'preventiva', origemRvt: rvtId };
      return {
        ...prev,
        [category]: list.map((it) => (it.id === id
          ? { ...it, lastMaintenance: values.date, nextMaintenance: values.nextDate || '', intervalMonths: values.intervalMonths || it.intervalMonths }
          : it)),
        maintenanceLog: [logEntry, ...prev.maintenanceLog],
        indicador: [novoIndicador, ...(prev.indicador || [])],
        rvt: [novoRvt, ...(prev.rvt || [])],
      };
    });
    closeModal();
  }

  `
);

/* ===== 4) submitInspection: marca o registro do Indicador e o log com origemRvt ===== */
anchorReplace(
  "submitInspection",
  "function submitInspection(values) {",
  "function saveModelPhoto(",
  `function submitInspection(values) {
    const { category, id } = modal.context;
    const fields = resolveIndicadorFields(data, category, modal.item);
    const falhaTexto = (values.falha || '').trim() || 'Realizado sem apontamentos';
    const dataInspecao = values.lastInspection || todayISO();
    const resumo = [values.operationalStatus, values.appearance, values.localComm, values.networkComm].filter(Boolean).join(' · ');
    const rvtId = uid();
    const novoIndicador = {
      id: uid(), tipo: 'inspecao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
      explanacao: '', dataDiagnostico: dataInspecao,
      dataIntervencao1: dataInspecao, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: dataInspecao, solucao: '', fotos: [], origemRvt: rvtId,
    };
    const novoRvt = {
      id: rvtId, data: dataInspecao, tecnico: values.technician || '',
      itens: [{
        id: uid(), deviceId: id, categoria: category,
        etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
        equipamento: fields.equipamento, area: fields.area,
        falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
        explanacao: '', dataIntervencao: dataInspecao, solucao: '', fotos: [],
      }],
    };
    updateData((prev) => {
      const logEntry = { id: uid(), category, itemId: id, date: dataInspecao, operationalStatus: values.operationalStatus || '', origemRvt: rvtId };
      return {
        ...prev,
        [category]: prev[category].map((it) => (it.id === id ? { ...it, ...values } : it)),
        inspectionLog: [logEntry, ...(prev.inspectionLog || [])],
        indicador: [novoIndicador, ...(prev.indicador || [])],
        rvt: [novoRvt, ...(prev.rvt || [])],
      };
    });
    closeModal();
  }

  `
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_cascade_delete", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Exclusão em cascata entre RVT, Indicador e Histórico aplicada.");
