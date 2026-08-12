// fix_add_inspection_form.cjs
// Recria a função InspectionForm (usada no icone de inspeção individual),
// que sumiu numa das reconstruções anteriores.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("function InspectionForm(")) {
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

const novaFuncao = `function InspectionForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: item.operationalStatus || '',
    appearance: item.appearance || '',
    localComm: item.localComm || '',
    networkComm: item.networkComm || '',
    lastInspection: item.lastInspection || '',
    nextInspection: item.nextInspection || '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inputCls} value={v.operationalStatus} onChange={(e) => setV({ ...v, operationalStatus: e.target.value })}>
            <option value="">Não avaliado</option>
            {OPERATIONAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Aparência / visual">
          <select className={inputCls} value={v.appearance} onChange={(e) => setV({ ...v, appearance: e.target.value })}>
            <option value="">Não avaliado</option>
            {APPEARANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação local">
          <select className={inputCls} value={v.localComm} onChange={(e) => setV({ ...v, localComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação em rede">
          <select className={inputCls} value={v.networkComm} onChange={(e) => setV({ ...v, networkComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Última inspeção"><input type="date" className={inputCls} value={v.lastInspection}
          onChange={(e) => setV({ ...v, lastInspection: e.target.value })} /></Field>
        <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.nextInspection}
          onChange={(e) => setV({ ...v, nextInspection: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Salvar inspeção</Button>
      </FormActions>
    </form>
  );
}

`;

const idx = text.indexOf(marker);
text = text.slice(0, idx) + novaFuncao + text.slice(idx);

fs.writeFileSync(path, text, "utf8");
console.log("Pronto! InspectionForm recriada.");
