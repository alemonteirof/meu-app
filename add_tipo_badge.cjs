// add_tipo_badge.cjs
// 1) Confere/recria (se necessario) submitBulkInspection e o modal de
//    inspecao em lote, caso tenham sumido nas reconstrucoes anteriores.
// 2) Adiciona o selo visual Falha/Manutencao/Inspecao em cada registro
//    do Indicador.
// Uso: node add_tipo_badge.cjs

const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const problemas = [];
const avisos = [];

function selfInsertBefore(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker);
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

function literalReplace(label, alvo, novo) {
  const count = text.split(alvo).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o texto: "${alvo.slice(0, 70)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes (esperava 1): "${alvo.slice(0, 70)}..."`); return; }
  text = text.split(alvo).join(novo);
}

/* ===== 1) Confere/recria submitBulkInspection ===== */
if (!text.includes("function submitBulkInspection(")) {
  avisos.push("submitBulkInspection tinha sumido — recriando.");
  selfInsertBefore(
    "submitBulkInspection",
    "function submitInspection(values) {",
    `function submitBulkInspection(values) {
    const { category, ids } = modal.context;
    updateData((prev) => {
      const logEntries = ids.map((id) => ({ id: uid(), category, itemId: id, date: values.lastInspection || todayISO(), operationalStatus: values.operationalStatus || '' }));
      return {
        ...prev,
        [category]: prev[category].map((it) => (ids.includes(it.id) ? { ...it, ...values } : it)),
        inspectionLog: [...logEntries, ...(prev.inspectionLog || [])],
      };
    });
    closeModal();
  }
  `
  );
} else {
  avisos.push("submitBulkInspection já existia — ok.");
}

/* ===== 2) Confere/recria o modal de inspecao em lote ===== */
if (!text.includes("'bulkInspection'")) {
  avisos.push("Modal de inspeção em lote tinha sumido — recriando.");
  selfInsertBefore(
    "modal-bulkInspection",
    "{confirmState && (",
    `{modal?.type === 'bulkInspection' && (
        <Modal title={\`Registrar inspeção em lote (\${modal.context.ids.length} dispositivos)\`} onClose={closeModal} wide>
          <BulkInspectionForm count={modal.context.ids.length} onSubmit={submitBulkInspection} onCancel={closeModal} />
        </Modal>
      )}
      `
  );
} else {
  avisos.push("Modal de inspeção em lote já existia — ok.");
}

/* ===== 3) Selo visual Falha/Manutenção/Inspeção no Indicador ===== */
if (text.includes("r.tipo === 'inspecao' ? 'Inspeção'")) {
  avisos.push("Selo do Indicador já existia — ok.");
} else {
  literalReplace(
    "Badge-tipo",
    `{ctx && <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>Vinculado</span>}`,
    `{ctx && <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>Vinculado</span>}
                    <span className="text-xs px-2 py-1 rounded-md" style={{
                      color: r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)',
                      border: \`1px solid \${r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)'}\`,
                    }}>
                      {r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha'}
                    </span>`
  );
}

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_tipo_badge", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Avisos:");
avisos.forEach((a) => console.log(" - " + a));
console.log("Backup salvo em src/App.jsx.bak_tipo_badge");
