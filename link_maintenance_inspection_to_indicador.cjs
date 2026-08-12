// link_maintenance_inspection_to_indicador.cjs
// Faz manutenção e inspeção individuais (registradas direto no dispositivo)
// também criarem um registro no Indicador (com tipo Falha/Manutenção/Inspeção)
// e um RVT de item único — igual já acontece quando se vincula ao RVT.
// Valida tudo antes de escrever. Uso: node link_maintenance_inspection_to_indicador.cjs

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

/* ================= 1) Helper: resolveIndicadorFields (antes do MaintenanceForm) ================= */
anchorReplace(
  "Helper",
  "function MaintenanceForm(",
  "function MaintenanceForm(",
  `function resolveIndicadorFields(data, category, item) {
  if (category === 'devices') {
    const loop = data.loops.find((l) => l.id === item.loopId);
    const panel = data.panels.find((p) => p.id === loop?.panelId);
    const tipoLabel = DEVICE_TYPE_MAP[item.type]?.label || 'Dispositivo';
    return {
      etiqueta: item.description || \`\${tipoLabel} \${item.address}\`,
      endereco: item.address, laco: loop?.name || '', painel: panel?.name || '',
      equipamento: tipoLabel + (item.modelo ? \` (\${item.modelo})\` : ''), area: '',
    };
  }
  if (category === 'nacs') {
    const panel = data.panels.find((p) => p.id === item.panelId);
    return { etiqueta: item.name, endereco: '', laco: '', painel: panel?.name || '', equipamento: 'Circuito NAC', area: '' };
  }
  if (category === 'pumpDevices') {
    return { etiqueta: item.name, endereco: '', laco: '', painel: '', equipamento: item.type || 'Casa de Bombas', area: '' };
  }
  if (category === 'gasDetectors') {
    return { etiqueta: item.name, endereco: '', laco: '', painel: '', equipamento: 'Detector de Gás', area: '' };
  }
  return { etiqueta: item.name || '', endereco: '', laco: '', painel: '', equipamento: '', area: '' };
}

`
);

/* ================= 2) MaintenanceForm com campos do Indicador ================= */
anchorReplace(
  "MaintenanceForm",
  "function MaintenanceForm(",
  "function InspectionForm(",
  `function MaintenanceForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    date: todayISO(), technician: '', description: '', tipo: 'preventiva',
    intervalMonths: item.intervalMonths || '', nextDate: item.nextMaintenance || '',
    falha: '', status: 'Resolvido', explanacao: '', solucao: '',
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
      <Field label="Falha encontrada (opcional)"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Deixe em branco se não houve problema" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {INDICATOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Periodicidade">
          <select className={inputCls} value={v.intervalMonths} onChange={(e) => handleIntervalChange(e.target.value)}>
            <option value="">Definir manualmente</option>
            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Próxima manutenção"><input type="date" className={inputCls} value={v.nextDate}
        onChange={(e) => setV({ ...v, nextDate: e.target.value })} /></Field>
      <Field label="Explanação (opcional)"><textarea rows={2} className={inputCls} value={v.explanacao}
        onChange={(e) => setV({ ...v, explanacao: e.target.value })} /></Field>
      <Field label="Solução (opcional)"><textarea rows={2} className={inputCls} value={v.solucao}
        onChange={(e) => setV({ ...v, solucao: e.target.value })} /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar</Button>
      </FormActions>
    </form>
  );
}

`
);

/* ================= 3) InspectionForm com técnico e observação ================= */
anchorReplace(
  "InspectionForm",
  "function InspectionForm(",
  "function ClientForm(",
  `function InspectionForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: item.operationalStatus || '',
    appearance: item.appearance || '',
    localComm: item.localComm || '',
    networkComm: item.networkComm || '',
    lastInspection: item.lastInspection || todayISO(),
    nextInspection: item.nextInspection || '',
    technician: '', falha: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
        onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
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
      <Field label="Observação / falha encontrada (opcional)"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Deixe em branco se não houve problema" /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Salvar inspeção</Button>
      </FormActions>
    </form>
  );
}

`
);

/* ================= 4) submitMaintenance: cria Indicador + RVT também ================= */
anchorReplace(
  "submitMaintenance",
  "function submitMaintenance(values) {",
  "function submitBulkMaintenance(values) {",
  `function submitMaintenance(values) {
    const { category, id } = modal.context;
    const fields = resolveIndicadorFields(data, category, modal.item);
    const falhaTexto = (values.falha || '').trim() || 'Realizado sem apontamentos';
    const statusFinal = values.status || 'Resolvido';
    const novoIndicador = {
      id: uid(), tipo: 'manutencao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: values.description || '', status: statusFinal,
      explanacao: values.explanacao || '', dataDiagnostico: values.date,
      dataIntervencao1: values.date, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: statusFinal === 'Resolvido' ? values.date : '',
      solucao: values.solucao || '', fotos: [],
    };
    const novoRvt = {
      id: uid(), data: values.date, tecnico: values.technician,
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
      const logEntry = { id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '', tipo: values.tipo || 'preventiva' };
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

/* ================= 5) submitInspection: cria Indicador (tipo Inspeção) + RVT também ================= */
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
    const novoIndicador = {
      id: uid(), tipo: 'inspecao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
      explanacao: '', dataDiagnostico: dataInspecao,
      dataIntervencao1: dataInspecao, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: dataInspecao, solucao: '', fotos: [],
    };
    const novoRvt = {
      id: uid(), data: dataInspecao, tecnico: values.technician || '',
      itens: [{
        id: uid(), deviceId: id, categoria: category,
        etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
        equipamento: fields.equipamento, area: fields.area,
        falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
        explanacao: '', dataIntervencao: dataInspecao, solucao: '', fotos: [],
      }],
    };
    updateData((prev) => {
      const logEntry = { id: uid(), category, itemId: id, date: dataInspecao, operationalStatus: values.operationalStatus || '' };
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

/* ================= Resultado ================= */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_link_indicador", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Tudo conectado com sucesso! Backup salvo em src/App.jsx.bak_link_indicador");
