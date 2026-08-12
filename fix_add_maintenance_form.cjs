// fix_add_maintenance_form.cjs
// Recria a função MaintenanceForm (usada no icone de manutenção individual),
// que sumiu numa das reconstruções anteriores.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("function MaintenanceForm(")) {
  console.log("Já existe — não precisa recriar. Se o erro persistir, me chama de novo.");
  process.exit(0);
}

const marker = "function ClientForm(";
const count = text.split(marker).length - 1;
if (count === 0) {
  console.error("ERRO: não achei 'function ClientForm(' pra usar como referência. Nada foi alterado. Me chama.");
  process.exit(1);
}
if (count > 1) {
  console.error(`ERRO: achei ${count} vezes 'function ClientForm(' (esperava 1). Nada foi alterado. Me chama.`);
  process.exit(1);
}

const novaFuncao = `function MaintenanceForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    date: todayISO(), technician: '', description: '', tipo: 'preventiva',
    intervalMonths: item.intervalMonths || '', nextDate: item.nextMaintenance || '',
  });
  function handleIntervalChange(months) {
    setV((prev) => ({ ...prev, intervalMonths: months, nextDate: addMonthsToDate(prev.date, months) || prev.nextDate }));
  }
  function handleDateChange(date) {
    setV((prev) => ({ ...prev, date, nextDate: prev.intervalMonths ? addMonthsToDate(date, prev.intervalMonths) : prev.nextDate }));
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
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
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Teste funcional, limpeza, troca de bateria..." /></Field>
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
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar</Button>
      </FormActions>
    </form>
  );
}

`;

const idx = text.indexOf(marker);
text = text.slice(0, idx) + novaFuncao + text.slice(idx);

fs.writeFileSync(path, text, "utf8");
console.log("Pronto! MaintenanceForm recriada.");
