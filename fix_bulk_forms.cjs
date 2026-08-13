// fix_bulk_forms.cjs
// Confere/recria BulkMaintenanceForm (sumiu inteiro) e o bloco que
// desenha o modal de inspecao em lote (sumiu, so ficou o "abrir").
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const avisos = [];
const problemas = [];

function selfInsertBefore(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker);
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

/* ===== 1) BulkMaintenanceForm ===== */
if (!text.includes("function BulkMaintenanceForm(")) {
  avisos.push("BulkMaintenanceForm tinha sumido — recriando.");
  selfInsertBefore(
    "BulkMaintenanceForm",
    "function MaintenanceForm(",
    `function BulkMaintenanceForm({ count, onSubmit, onCancel }) {
  const [v, setV] = useState({ date: todayISO(), technician: '', description: '', tipo: 'preventiva', intervalMonths: '', nextDate: '' });
  function handleIntervalChange(months) {
    setV((prev) => ({ ...prev, intervalMonths: months, nextDate: addMonthsToDate(prev.date, months) || prev.nextDate }));
  }
  function handleDateChange(date) {
    setV((prev) => ({ ...prev, date, nextDate: prev.intervalMonths ? addMonthsToDate(date, prev.intervalMonths) : prev.nextDate }));
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Este registro será aplicado aos <strong>{count} dispositivos selecionados</strong>, com a mesma data, técnico e observações.
      </p>
      <Field label="Tipo de manutenção">
        <select className={inputCls} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
          <option value="preventiva">Preventiva</option>
          <option value="corretiva">Corretiva</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da manutenção *"><input type="date" className={inputCls} value={v.date} required
          onChange={(e) => handleDateChange(e.target.value)} /></Field>
        <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
          onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      </div>
      <Field label="Observações / serviço realizado"><textarea rows={3} className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Limpeza preventiva, troca de bateria..." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Periodicidade">
          <select className={inputCls} value={v.intervalMonths} onChange={(e) => handleIntervalChange(e.target.value)}>
            <option value="">Definir manualmente</option>
            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Próxima manutenção"><input type="date" className={inputCls} value={v.nextDate}
          onChange={(e) => setV({ ...v, nextDate: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar em {count} dispositivo(s)</Button>
      </FormActions>
    </form>
  );
}

`
  );
} else {
  avisos.push("BulkMaintenanceForm já existia — ok.");
}

/* ===== 2) Bloco que desenha o modal de inspecao em lote ===== */
if (!text.includes("modal?.type === 'bulkInspection'")) {
  avisos.push("Bloco que desenha o modal de inspeção em lote tinha sumido — recriando.");
  selfInsertBefore(
    "modal-bulkInspection-render",
    "{confirmState && (",
    `{modal?.type === 'bulkInspection' && (
        <Modal title={\`Registrar inspeção em lote (\${modal.context.ids.length} dispositivos)\`} onClose={closeModal} wide>
          <BulkInspectionForm count={modal.context.ids.length} onSubmit={submitBulkInspection} onCancel={closeModal} />
        </Modal>
      )}
      `
  );
} else {
  avisos.push("Bloco do modal de inspeção em lote já existia — ok.");
}

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_bulk_forms", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Avisos:");
avisos.forEach((a) => console.log(" - " + a));
console.log("Backup salvo em src/App.jsx.bak_bulk_forms");
