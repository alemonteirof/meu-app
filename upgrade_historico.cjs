// upgrade_historico.cjs
// Adiciona: filtros de Data/Tipo/Painel, aba Inspeção, e exclusão em
// cascata (apagar um item do histórico apaga RVT/Indicador/outro log
// ligados a ele pelo mesmo origemRvt).
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

function literalReplace(label, alvo, novo) {
  const count = text.split(alvo).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o texto: "${alvo.slice(0, 70)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes (esperava 1): "${alvo.slice(0, 70)}..."`); return; }
  text = text.split(alvo).join(novo);
}

if (text.includes("function getItemPanelName(")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) Helper getItemPanelName (antes do getItemLabelAndContext) ===== */
anchorReplace(
  "getItemPanelName",
  "function getItemLabelAndContext(data, category, itemId) {",
  "function getItemLabelAndContext(data, category, itemId) {",
  `function getItemPanelName(data, category, itemId) {
  if (category === 'devices') {
    const dItem = data.devices.find((x) => x.id === itemId);
    if (!dItem) return null;
    const loop = data.loops.find((l) => l.id === dItem.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    return panel ? panel.name : null;
  }
  if (category === 'nacs') {
    const n = data.nacs.find((x) => x.id === itemId);
    if (!n) return null;
    const panel = data.panels.find((p) => p.id === n.panelId);
    return panel ? panel.name : null;
  }
  return null;
}

`
);

/* ===== 2) HistoryView refeito (filtros + aba inspeção + excluir) ===== */
anchorReplace(
  "HistoryView",
  "function HistoryView({ data, filter, setFilter }) {",
  "function IndicadorView({",
  `function HistoryView({ data, filter, setFilter, onDeleteEntry }) {
  const [logType, setLogType] = useState('manutencao');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [panelFilter, setPanelFilter] = useState('all');

  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'devices', label: 'Dispositivos' },
    { value: 'nacs', label: 'Circuitos (NAC)' },
    { value: 'pumpDevices', label: 'Casa de Bombas' },
    { value: 'gasDetectors', label: 'Detectores de gás' },
  ];

  const sourceLog = logType === 'manutencao' ? (data.maintenanceLog || []) : (data.inspectionLog || []);

  const panelOptions = [...new Set(
    sourceLog.map((e) => getItemPanelName(data, e.category, e.itemId)).filter(Boolean)
  )].sort();

  const entries = sourceLog.filter((e) => {
    if (filter !== 'all' && e.category !== filter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (logType === 'manutencao' && tipoFilter !== 'all' && (e.tipo || 'preventiva') !== tipoFilter) return false;
    if (panelFilter !== 'all' && getItemPanelName(data, e.category, e.itemId) !== panelFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Histórico de {logType === 'manutencao' ? 'manutenções' : 'inspeções'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Registro de todas as {logType === 'manutencao' ? 'manutenções' : 'inspeções'} realizadas, da mais recente para a mais antiga.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        <button className="nav-tab" data-active={logType === 'manutencao'} onClick={() => setLogType('manutencao')}>Manutenção</button>
        <button className="nav-tab" data-active={logType === 'inspecao'} onClick={() => setLogType('inspecao')}>Inspeção</button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {filters.map((f) => (
          <button key={f.value} className="nav-tab" data-active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <Field label="De"><input type="date" className={inputCls} style={{ maxWidth: '160px' }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
        <Field label="Até"><input type="date" className={inputCls} style={{ maxWidth: '160px' }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
        {logType === 'manutencao' && (
          <Field label="Tipo">
            <select className={inputCls} style={{ maxWidth: '180px' }} value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
              <option value="all">Todos os tipos</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </Field>
        )}
        <Field label="Painel">
          <select className={inputCls} style={{ maxWidth: '220px' }} value={panelFilter} onChange={(e) => setPanelFilter(e.target.value)}>
            <option value="all">Todos os painéis</option>
            {panelOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum registro encontrado" description="As manutenções e inspeções registradas em dispositivos, circuitos e demais equipamentos aparecerão aqui." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const { label, context } = getItemLabelAndContext(data, entry.category, entry.itemId);
            return (
              <div key={entry.id} className="rounded-lg p-3.5 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="mono-chip">{formatDateBR(entry.date)}</span>
                    {onDeleteEntry && <IconButton title="Excluir" danger onClick={() => onDeleteEntry(logType, entry)}><Trash2 size={15} /></IconButton>}
                  </div>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{context}</div>
                {(entry.technician || entry.description) && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {entry.technician && <span>Técnico: {entry.technician}. </span>}
                    {entry.description}
                  </div>
                )}
                {logType === 'manutencao' && entry.nextDate && (
                  <div className="text-xs mono mt-1" style={{ color: 'var(--text-secondary)' }}>Próxima manutenção: {formatDateBR(entry.nextDate)}</div>
                )}
                {logType === 'inspecao' && entry.operationalStatus && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Status: {entry.operationalStatus}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

`
);

/* ===== 3) Funções de exclusão em cascata (antes do saveRvtReport) ===== */
anchorReplace(
  "delete-log-cascade",
  "function saveRvtReport(report) {",
  "function saveRvtReport(report) {",
  `function deleteMaintenanceLogEntry(entry) {
    updateData((prev) => {
      const origemRvt = entry.origemRvt;
      return {
        ...prev,
        maintenanceLog: (prev.maintenanceLog || []).filter((l) => l.id !== entry.id),
        rvt: origemRvt ? (prev.rvt || []).filter((r) => r.id !== origemRvt) : prev.rvt,
        indicador: origemRvt ? (prev.indicador || []).filter((r) => r.origemRvt !== origemRvt) : prev.indicador,
        inspectionLog: origemRvt ? (prev.inspectionLog || []).filter((l) => l.origemRvt !== origemRvt) : (prev.inspectionLog || []),
      };
    });
    setConfirmState(null);
  }
  function deleteInspectionLogEntry(entry) {
    updateData((prev) => {
      const origemRvt = entry.origemRvt;
      return {
        ...prev,
        inspectionLog: (prev.inspectionLog || []).filter((l) => l.id !== entry.id),
        rvt: origemRvt ? (prev.rvt || []).filter((r) => r.id !== origemRvt) : prev.rvt,
        indicador: origemRvt ? (prev.indicador || []).filter((r) => r.origemRvt !== origemRvt) : prev.indicador,
        maintenanceLog: origemRvt ? (prev.maintenanceLog || []).filter((l) => l.origemRvt !== origemRvt) : prev.maintenanceLog,
      };
    });
    setConfirmState(null);
  }
  function handleDeleteHistoryEntry(logType, entry) {
    setConfirmState({
      title: 'Excluir registro do histórico',
      message: entry.origemRvt
        ? 'Isso também vai excluir o RVT e os outros registros (Indicador/histórico) ligados a ele. Continuar?'
        : 'Excluir esse registro do histórico?',
      onConfirm: () => (logType === 'manutencao' ? deleteMaintenanceLogEntry(entry) : deleteInspectionLogEntry(entry)),
    });
  }

  `
);

/* ===== 4) Passa onDeleteEntry pro HistoryView ===== */
literalReplace(
  "call-site",
  "<HistoryView data={data} filter={historyFilter} setFilter={setHistoryFilter} />",
  "<HistoryView data={data} filter={historyFilter} setFilter={setHistoryFilter} onDeleteEntry={handleDeleteHistoryEntry} />"
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_historico", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Histórico atualizado com filtros, aba Inspeção e exclusão em cascata.");
