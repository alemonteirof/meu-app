// rebuild_all.cjs
// Reconstrói de uma vez: edição de RVT, inspeção em lote, card com
// manutenção/inspeção separadas, e status baseado em inspeção.
// Valida TUDO antes de escrever qualquer coisa no arquivo.
// Uso: node rebuild_all.cjs

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

function literalReplace(label, alvo, novo, opcional = false) {
  const count = text.split(alvo).length - 1;
  if (count === 0) {
    if (opcional) return; // já pode ter sido aplicado antes, tudo bem
    problemas.push(`[${label}] não achei o texto: "${alvo.slice(0, 70)}..."`);
    return;
  }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes (esperava 1): "${alvo.slice(0, 70)}..."`); return; }
  text = text.split(alvo).join(novo);
}

/* ================= 1) RVT: saveRvtReport (atualiza em vez de duplicar) ================= */
anchorReplace(
  "RVT-save",
  "function saveRvtReport(report) {",
  "function deleteRvtReport(id) {",
  `function saveRvtReport(report) {
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
      const rvtSemAntigo = (prev.rvt || []).filter((r) => r.id !== report.id);
      const indicadorSemAntigo = (prev.indicador || []).filter((it) => it.origemRvt !== report.id);
      return {
        ...prev,
        rvt: [{ ...report }, ...rvtSemAntigo],
        indicador: [...indicadorEntries, ...indicadorSemAntigo],
      };
    });
  }
  `
);

/* ================= 2) RVT: RvtView (modo editar) ================= */
anchorReplace(
  "RVT-view",
  "function RvtView({ data, client, canEdit, onSaveReport, onDeleteReport }) {",
  "function IndicadorForm(",
  `function RvtView({ data, client, canEdit, onSaveReport, onDeleteReport }) {
  const reports = data.rvt || [];
  const [mode, setMode] = useState('list');
  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [visitDate, setVisitDate] = useState(todayISO());
  const [tecnico, setTecnico] = useState('');
  const [queue, setQueue] = useState([]);

  function handleAddItem(item) { setQueue((prev) => [...prev, item]); }
  function handleRemoveItem(id) { setQueue((prev) => prev.filter((it) => it.id !== id)); }

  function handleStartEdit(report) {
    setEditingId(report.id);
    setVisitDate(report.data);
    setTecnico(report.tecnico || '');
    setQueue(report.itens || []);
    setMode('new');
  }

  function handleCancelForm() {
    setMode('list');
    setEditingId(null);
    setVisitDate(todayISO());
    setTecnico('');
    setQueue([]);
  }

  function handleSave() {
    if (!visitDate || queue.length === 0) return;
    onSaveReport({ id: editingId || uid(), data: visitDate, tecnico, itens: queue });
    setVisitDate(todayISO()); setTecnico(''); setQueue([]);
    setEditingId(null);
    setMode('list');
  }

  const viewingReport = viewingId ? reports.find((r) => r.id === viewingId) : null;
  if (viewingReport) return <RvtDetail report={viewingReport} client={client} onBack={() => setViewingId(null)} />;

  if (mode === 'new') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Editar Relatório de Visita Técnica (RVT)' : 'Novo Relatório de Visita Técnica (RVT)'}</h2>
          <Button variant="secondary" onClick={handleCancelForm}><ArrowLeft size={15} /> Cancelar</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Data da visita *"><input type="date" className={inputCls} value={visitDate} required onChange={(e) => setVisitDate(e.target.value)} /></Field>
          <Field label="Técnico responsável"><input className={inputCls} value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Nome do técnico" /></Field>
        </div>

        {queue.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Itens desta visita ({queue.length})</p>
            {queue.map((it) => (
              <div key={it.id} className="rounded-lg p-3 flex items-start justify-between gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{it.etiqueta}{it.endereco ? \` · END \${it.endereco}\` : ''}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{it.falha} — {it.status}{it.fotos?.length ? \` · \${it.fotos.length} foto(s)\` : ''}</p>
                </div>
                <IconButton title="Remover" danger onClick={() => handleRemoveItem(it.id)}><Trash2 size={15} /></IconButton>
              </div>
            ))}
          </div>
        )}

        <RvtItemForm data={data} onAdd={handleAddItem} />

        <Button variant="primary" onClick={handleSave} disabled={queue.length === 0}>
          <CheckCircle2 size={16} /> {editingId ? 'Salvar alterações' : 'Salvar relatório de visita'} ({queue.length} item{queue.length === 1 ? '' : 's'})
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>RVT — Relatórios de Visita Técnica</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Registros de campo, com fotos, que alimentam o Indicador automaticamente.</p>
        </div>
        {canEdit && <Button variant="primary" onClick={() => setMode('new')}><Plus size={16} /> Novo RVT</Button>}
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={Camera} title="Nenhum RVT registrado ainda"
          description="Crie o primeiro relatório de visita técnica, selecionando os dispositivos direto dos painéis já cadastrados."
          actionLabel={canEdit ? 'Novo RVT' : undefined} onAction={canEdit ? () => setMode('new') : undefined} />
      ) : (
        <div className="flex flex-col gap-2">
          {[...reports].sort((a, b) => b.data.localeCompare(a.data)).map((r) => (
            <div key={r.id} className="rounded-lg p-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatDateBR(r.data)}{r.tecnico ? \` — \${r.tecnico}\` : ''}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.itens.length} item(ns) registrado(s)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setViewingId(r.id)}><FileText size={15} /> Ver / Imprimir</Button>
                {canEdit && <Button variant="secondary" onClick={() => handleStartEdit(r)}><Pencil size={15} /> Editar</Button>}
                {canEdit && <IconButton title="Excluir relatório" danger onClick={() => onDeleteReport(r)}><Trash2 size={15} /></IconButton>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

`
);

/* ================= 3) Inspeção em lote: BulkInspectionForm (antes de ClientForm) ================= */
anchorReplace(
  "Inspecao-form",
  "function ClientForm(",
  "function ClientForm(",
  `function BulkInspectionForm({ count, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: '', appearance: '', localComm: '', networkComm: '',
    lastInspection: todayISO(), nextInspection: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Este registro será aplicado aos <strong>{count} dispositivos selecionados</strong>.
      </p>
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
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar em {count} dispositivo(s)</Button>
      </FormActions>
    </form>
  );
}

`
);

/* ================= 4) Inspeção em lote: funções de estado ================= */
literalReplace(
  "Inspecao-open-modal",
  "function openBulkMaintainModal(category, ids) { setModal({ type: 'bulkMaintenance', context: { category, ids } }); }",
  "function openBulkMaintainModal(category, ids) { setModal({ type: 'bulkMaintenance', context: { category, ids } }); }\n  function openBulkInspectModal(category, ids) { setModal({ type: 'bulkInspection', context: { category, ids } }); }",
  true
);

literalReplace(
  "Inspecao-submit",
  `  function deleteDevicesBulk(ids) {
    updateData((prev) => ({ ...prev, devices: prev.devices.filter((d) => !ids.includes(d.id)) }));
    setConfirmState(null);
  }`,
  `  function deleteDevicesBulk(ids) {
    updateData((prev) => ({ ...prev, devices: prev.devices.filter((d) => !ids.includes(d.id)) }));
    setConfirmState(null);
  }
  function submitBulkInspection(values) {
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
  }`,
  true
);

literalReplace(
  "Inspecao-modal-jsx",
  `      {modal?.type === 'bulkMaintenance' && (
        <Modal title={\`Registrar manutenção em lote (\${modal.context.ids.length} dispositivos)\`} onClose={closeModal} wide>
          <BulkMaintenanceForm count={modal.context.ids.length} onSubmit={submitBulkMaintenance} onCancel={closeModal} />
        </Modal>
      )}`,
  `      {modal?.type === 'bulkMaintenance' && (
        <Modal title={\`Registrar manutenção em lote (\${modal.context.ids.length} dispositivos)\`} onClose={closeModal} wide>
          <BulkMaintenanceForm count={modal.context.ids.length} onSubmit={submitBulkMaintenance} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'bulkInspection' && (
        <Modal title={\`Registrar inspeção em lote (\${modal.context.ids.length} dispositivos)\`} onClose={closeModal} wide>
          <BulkInspectionForm count={modal.context.ids.length} onSubmit={submitBulkInspection} onCancel={closeModal} />
        </Modal>
      )}`,
  true
);

literalReplace(
  "Inspecao-call-site",
  "onBulkMaintainDevices={(ids) => openBulkMaintainModal('devices', ids)}",
  "onBulkMaintainDevices={(ids) => openBulkMaintainModal('devices', ids)}\n            onBulkInspectDevices={(ids) => openBulkInspectModal('devices', ids)}",
  true
);

literalReplace(
  "Inspecao-props",
  "onBulkMaintainDevices, onBulkDeleteDevices,",
  "onBulkMaintainDevices, onBulkInspectDevices, onBulkDeleteDevices,",
  true
);

literalReplace(
  "Inspecao-botao",
  `<Button variant="primary" onClick={() => { onBulkMaintainDevices(selectedIds); exitSelectMode(); }}><Wrench size={15} /> Registrar manutenção</Button>`,
  `<Button variant="primary" onClick={() => { onBulkMaintainDevices(selectedIds); exitSelectMode(); }}><Wrench size={15} /> Registrar manutenção</Button>\n                  <Button variant="secondary" onClick={() => { onBulkInspectDevices(selectedIds); exitSelectMode(); }}><Search size={15} /> Registrar inspeção</Button>`,
  true
);

/* ================= 5) Card: manutenção e inspeção separadas ================= */
literalReplace(
  "Card-split",
  `          <div className="text-xs mt-1.5 mono" style={{ color: 'var(--text-secondary)' }}>
            Última manutenção: {formatDateBR(status && status.lastMaintenance)}
          </div>`,
  `          <div className="text-xs mt-1.5 mono flex flex-col gap-0.5" style={{ color: 'var(--text-secondary)' }}>
            <span>Última manutenção: {formatDateBR(status && status.lastMaintenance)}</span>
            <span>Última inspeção: {formatDateBR(status && status.lastInspection)}</span>
          </div>`,
  true
);

/* ================= 6) Status baseado em inspeção (9 pontos) ================= */
literalReplace("Status-1",
  "items.forEach((it) => { counts[computeStatus(it.nextMaintenance).key]++; });",
  "  items.forEach((it) => { counts[computeStatus(it.nextInspection).key]++; });", true);

literalReplace("Status-2",
  ".filter((it) => ['overdue', 'soon'].includes(computeStatus(it.nextMaintenance).key))",
  "    .filter((it) => ['overdue', 'soon'].includes(computeStatus(it.nextInspection).key))", true);

literalReplace("Status-3",
  "status={{ ...computeStatus(it.nextMaintenance), lastMaintenance: it.lastMaintenance, operationalStatus: it.operationalStatus }}",
  "status={{ ...computeStatus(it.nextInspection), lastMaintenance: it.lastMaintenance, lastInspection: it.lastInspection, operationalStatus: it.operationalStatus }}", true);

literalReplace("Status-4",
  "status={{ ...computeStatus(d.nextMaintenance), lastMaintenance: d.lastMaintenance, operationalStatus: d.operationalStatus }}",
  "status={{ ...computeStatus(d.nextInspection), lastMaintenance: d.lastMaintenance, lastInspection: d.lastInspection, operationalStatus: d.operationalStatus }}", true);

literalReplace("Status-5",
  "status={{ ...computeStatus(n.nextMaintenance), lastMaintenance: n.lastMaintenance, operationalStatus: n.operationalStatus }}",
  "status={{ ...computeStatus(n.nextInspection), lastMaintenance: n.lastMaintenance, lastInspection: n.lastInspection, operationalStatus: n.operationalStatus }}", true);

literalReplace("Status-6",
  "status={{ ...computeStatus(item.nextMaintenance), lastMaintenance: item.lastMaintenance, operationalStatus: item.operationalStatus }}",
  "status={{ ...computeStatus(item.nextInspection), lastMaintenance: item.lastMaintenance, lastInspection: item.lastInspection, operationalStatus: item.operationalStatus }}", true);

literalReplace("Status-7",
  "...nacs.map((n) => computeStatus(n.nextMaintenance)),",
  "              ...nacs.map((n) => computeStatus(n.nextInspection)),", true);

literalReplace("Status-8",
  "const status = worstStatus(allDevices.map((d) => computeStatus(d.nextMaintenance)));",
  "                const status = worstStatus(allDevices.map((d) => computeStatus(d.nextInspection)));", true);

literalReplace("Status-9",
  "...data.devices.filter((d) => loops.some((l) => l.id === d.loopId)).map((d) => computeStatus(d.nextMaintenance)),",
  "              ...data.devices.filter((d) => loops.some((l) => l.id === d.loopId)).map((d) => computeStatus(d.nextInspection)),", true);

/* ================= Resultado ================= */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_rebuild", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Tudo reconstruído com sucesso! Backup salvo em src/App.jsx.bak_rebuild");
