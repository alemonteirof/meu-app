// fix_indicador_form.cjs
// Substitui a função IndicadorForm inteira (do jeito que ela estiver agora,
// mesmo bagunçada) por uma versão limpa e correta, com o seletor de
// dispositivo cadastrado. Não depende de número de linha.
// Uso: node fix_indicador_form.cjs

const fs = require("fs");
const path = "src/App.jsx";

const NOVA_FUNCAO = `function IndicadorForm({ initial, data, areaSuggestions, onSubmit, onCancel }) {
  const initialCategoria = initial?.deviceId && initial?.categoria ? initial.categoria : (initial ? 'outro' : 'devices');
  const initialDevice = initialCategoria === 'devices' && initial?.deviceId ? data.devices.find((d) => d.id === initial.deviceId) : null;
  const initialLoop = initialDevice ? data.loops.find((l) => l.id === initialDevice.loopId) : null;

  const [categoria, setCategoria] = useState(initialCategoria);
  const [panelId, setPanelId] = useState(initialLoop?.panelId || '');
  const [loopId, setLoopId] = useState(initialDevice?.loopId || '');
  const [deviceId, setDeviceId] = useState(initialCategoria === 'devices' ? (initial?.deviceId || '') : '');
  const [simpleId, setSimpleId] = useState(initialCategoria !== 'devices' && initialCategoria !== 'outro' ? (initial?.deviceId || '') : '');
  const [deviceQuery, setDeviceQuery] = useState('');

  const [v, setV] = useState(initial || {
    etiqueta: '', endereco: '', laco: '', equipamento: '', painel: '', area: '', falha: '', descritivo: '',
    status: 'Andamento', explanacao: '', dataDiagnostico: '', dataIntervencao1: '', dataIntervencao2: '',
    dataIntervencao3: '', dataIntervencao4: '', dataSolucao: '', solucao: '', fotos: [],
  });

  const panelLoops = data.loops.filter((l) => l.panelId === panelId);
  const loopDevices = data.devices.filter((d) => d.loopId === loopId).sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }));
  const deviceQ = deviceQuery.trim().toLowerCase();
  const filteredLoopDevices = deviceQ
    ? loopDevices.filter((d) => d.id === deviceId
        || \`\${d.address} \${DEVICE_TYPE_MAP[d.type]?.label || ''} \${d.modelo || ''} \${d.description || ''}\`.toLowerCase().includes(deviceQ))
    : loopDevices;

  function handleCategoriaChange(val) {
    setCategoria(val);
    setPanelId(''); setLoopId(''); setDeviceId(''); setSimpleId(''); setDeviceQuery('');
  }

  function handleSelectDevice(id) {
    setDeviceId(id);
    const device = data.devices.find((d) => d.id === id);
    if (!device) return;
    const loop = data.loops.find((l) => l.id === device.loopId);
    const panel = data.panels.find((p) => p.id === loop?.panelId);
    const tipoLabel = DEVICE_TYPE_MAP[device.type]?.label || 'Dispositivo';
    setV((prev) => ({
      ...prev,
      etiqueta: device.description || \`\${tipoLabel} \${device.address}\`,
      endereco: device.address, laco: loop?.name || '', painel: panel?.name || '',
      equipamento: tipoLabel + (device.modelo ? \` (\${device.modelo})\` : ''),
    }));
  }

  function handleSelectSimple(id) {
    setSimpleId(id);
    if (categoria === 'nacs') {
      const nac = data.nacs.find((n) => n.id === id);
      if (!nac) return;
      const panel = data.panels.find((p) => p.id === nac.panelId);
      setV((prev) => ({ ...prev, etiqueta: nac.name, endereco: '', laco: '', painel: panel?.name || '', equipamento: 'Circuito NAC' }));
    } else if (categoria === 'pumpDevices') {
      const it = data.pumpDevices.find((p) => p.id === id);
      if (!it) return;
      setV((prev) => ({ ...prev, etiqueta: it.name, endereco: '', laco: '', painel: '', equipamento: it.type || 'Casa de Bombas' }));
    } else if (categoria === 'gasDetectors') {
      const it = data.gasDetectors.find((g) => g.id === id);
      if (!it) return;
      setV((prev) => ({ ...prev, etiqueta: it.name, endereco: '', laco: '', painel: '', equipamento: 'Detector de Gás' }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!(v.etiqueta.trim() || v.falha.trim())) return;
    const deviceLink = categoria === 'devices' ? deviceId : (categoria !== 'outro' ? simpleId : '');
    onSubmit({ ...v, deviceId: deviceLink || '', categoria: deviceLink ? categoria : '' });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Vincular a dispositivo cadastrado?">
        <select className={inputCls} value={categoria} onChange={(e) => handleCategoriaChange(e.target.value)}>
          {RVT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      {categoria === 'devices' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <Field label="Painel">
            <select className={inputCls} value={panelId} onChange={(e) => { setPanelId(e.target.value); setLoopId(''); setDeviceId(''); setDeviceQuery(''); }}>
              <option value="">Selecione…</option>
              {data.panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Laço">
            <select className={inputCls} value={loopId} onChange={(e) => { setLoopId(e.target.value); setDeviceId(''); setDeviceQuery(''); }} disabled={!panelId}>
              <option value="">Selecione…</option>
              {panelLoops.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label={\`Dispositivo (endereço)\${loopId && loopDevices.length > 8 ? \` — \${filteredLoopDevices.length} de \${loopDevices.length}\` : ''}\`}>
            {loopId && loopDevices.length > 8 && (
              <div className="relative mb-1.5">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                <input className={\`\${inputCls} pl-8\`} placeholder="Buscar por endereço, tipo ou descrição..."
                  value={deviceQuery} onChange={(e) => setDeviceQuery(e.target.value)} />
              </div>
            )}
            <select className={inputCls} value={deviceId} onChange={(e) => handleSelectDevice(e.target.value)} disabled={!loopId}>
              <option value="">Selecione…</option>
              {filteredLoopDevices.map((d) => (
                <option key={d.id} value={d.id}>{d.address} — {DEVICE_TYPE_MAP[d.type]?.label}{d.description ? \` (\${d.description})\` : ''}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {categoria === 'nacs' && (
        <Field label="Circuito (NAC)">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.nacs.map((n) => {
              const panel = data.panels.find((p) => p.id === n.panelId);
              return <option key={n.id} value={n.id}>{n.name}{panel ? \` — \${panel.name}\` : ''}</option>;
            })}
          </select>
        </Field>
      )}
      {categoria === 'pumpDevices' && (
        <Field label="Equipamento da Casa de Bombas">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.pumpDevices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      {categoria === 'gasDetectors' && (
        <Field label="Detector de Gás">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.gasDetectors.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      )}

      <Field label="Etiqueta / Localização *"><input className={inputCls} value={v.etiqueta}
        onChange={(e) => setV({ ...v, etiqueta: e.target.value })} placeholder="Ex.: SECURITY OFFICE CORREDOR SL REUNIÃO" required /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Endereço"><input className={\`\${inputCls} mono\`} value={v.endereco}
          onChange={(e) => setV({ ...v, endereco: e.target.value })} placeholder="017" /></Field>
        <Field label="Laço"><input className={inputCls} value={v.laco}
          onChange={(e) => setV({ ...v, laco: e.target.value })} placeholder="1" /></Field>
        <Field label="Painel"><input className={inputCls} value={v.painel}
          onChange={(e) => setV({ ...v, painel: e.target.value })} placeholder="1" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Equipamento"><input className={inputCls} value={v.equipamento}
          onChange={(e) => setV({ ...v, equipamento: e.target.value })} placeholder="Ex.: Sensor de fumaça" /></Field>
        <Field label="Área">
          <input className={inputCls} list="indicador-area-list" value={v.area}
            onChange={(e) => setV({ ...v, area: e.target.value })} placeholder="Ex.: BODY" />
          <datalist id="indicador-area-list">{areaSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
      </div>
      <Field label="Falha"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Ex.: Dispositivo Desconectado" /></Field>
      <Field label="Descritivo"><textarea rows={2} className={inputCls} value={v.descritivo}
        onChange={(e) => setV({ ...v, descritivo: e.target.value })} /></Field>
      <Field label="Status">
        <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
          {INDICATOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Explanação"><textarea rows={2} className={inputCls} value={v.explanacao}
        onChange={(e) => setV({ ...v, explanacao: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data diagnóstico"><input type="date" className={inputCls} value={v.dataDiagnostico}
          onChange={(e) => setV({ ...v, dataDiagnostico: e.target.value })} /></Field>
        <Field label="Data solução"><input type="date" className={inputCls} value={v.dataSolucao}
          onChange={(e) => setV({ ...v, dataSolucao: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Intervenção 1"><input type="date" className={inputCls} value={v.dataIntervencao1}
          onChange={(e) => setV({ ...v, dataIntervencao1: e.target.value })} /></Field>
        <Field label="Intervenção 2"><input type="date" className={inputCls} value={v.dataIntervencao2}
          onChange={(e) => setV({ ...v, dataIntervencao2: e.target.value })} /></Field>
        <Field label="Intervenção 3"><input type="date" className={inputCls} value={v.dataIntervencao3}
          onChange={(e) => setV({ ...v, dataIntervencao3: e.target.value })} /></Field>
        <Field label="Intervenção 4"><input type="date" className={inputCls} value={v.dataIntervencao4}
          onChange={(e) => setV({ ...v, dataIntervencao4: e.target.value })} /></Field>
      </div>
      <Field label="Solução"><textarea rows={2} className={inputCls} value={v.solucao}
        onChange={(e) => setV({ ...v, solucao: e.target.value })} /></Field>
      <div className="mb-4">
        <MultiPhotoUpload photos={v.fotos} onChange={(fotos) => setV({ ...v, fotos })} />
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar registro</Button>
      </FormActions>
    </form>
  );
}

`;

let text = fs.readFileSync(path, "utf8");

const startMarker = "function IndicadorForm(";
const endMarker = "function ClientForm(";

const startIdx = text.indexOf(startMarker);
if (startIdx === -1) {
  console.error("ERRO: não achei 'function IndicadorForm(' no arquivo. Nada foi alterado.");
  process.exit(1);
}
const countStart = text.split(startMarker).length - 1;
if (countStart > 1) {
  console.error(`ERRO: achei ${countStart} ocorrências de 'function IndicadorForm(' — deveria ser só 1. Nada foi alterado. Me chama antes de continuar.`);
  process.exit(1);
}

const endIdx = text.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  console.error("ERRO: não achei 'function ClientForm(' depois do IndicadorForm. Nada foi alterado.");
  process.exit(1);
}

const before = text.slice(0, startIdx);
const after = text.slice(endIdx);
const novoConteudo = before + NOVA_FUNCAO + after;

fs.writeFileSync("src/App.jsx.bak_indicador", text, "utf8");
fs.writeFileSync(path, novoConteudo, "utf8");

console.log("Pronto! Backup salvo em src/App.jsx.bak_indicador");
console.log(`Trecho antigo tinha ${endIdx - startIdx} caracteres, foi trocado pela função nova.`);
