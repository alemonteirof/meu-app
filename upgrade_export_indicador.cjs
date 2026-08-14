// upgrade_export_indicador.cjs
// 1) Cria IndicadorPrintView (mesmo visual de marca do RvtDetail: faixa
//    vinho, logo, cards) e liga o botao "Imprimir/Salvar PDF" a ele.
// 2) Troca a exportacao Excel de xlsx (sem suporte a estilo na versao
//    gratuita) pra exceljs (com cabecalho vinho, negrito, largura).
// Busca tolerante a CRLF. Uso: node upgrade_export_indicador.cjs
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const problemas = [];

function crlfSafeReplace(label, alvo, novo, opcional = false) {
  const escaped = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\r?\\n");
  const re = new RegExp(escaped, "g");
  const matches = text.match(re);
  if (!matches || matches.length === 0) {
    if (opcional) return;
    problemas.push(`[${label}] não achei: "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`);
    return;
  }
  if (matches.length > 1) { problemas.push(`[${label}] achei ${matches.length}x (esperava 1): "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  text = text.replace(re, () => novo);
}

if (text.includes("function IndicadorPrintView(")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) Import do ExcelJS ===== */
crlfSafeReplace(
  "import-exceljs",
  `import * as XLSX from 'xlsx';`,
  `import * as XLSX from 'xlsx';\nimport ExcelJS from 'exceljs';`
);

/* ===== 2) IndicadorPrintView (antes do IndicadorView) ===== */
crlfSafeReplace(
  "IndicadorPrintView",
  `function IndicadorView({ data, canEdit, onCreate, onEdit, onDelete, onImportFile, onLinkDevices, onBulkDelete, onDeleteByStatus, onDeleteAll }) {`,
  `function IndicadorPrintView({ entries, client, onBack }) {
  const countFalha = entries.filter((r) => (r.tipo || 'falha') === 'falha').length;
  const countManutencao = entries.filter((r) => r.tipo === 'manutencao').length;
  const countInspecao = entries.filter((r) => r.tipo === 'inspecao').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <Button variant="secondary" onClick={onBack}><ArrowLeft size={15} /> Voltar</Button>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Imprimir / Salvar PDF</Button>
      </div>

      <div className="print-area rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="rvt-brand-band">
          <div className="flex items-center gap-3 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="rvt-wordmark">
              <div className="rvt-wordmark-icon"><ShieldAlert size={16} style={{ color: '#fff' }} /></div>
              <div className="rvt-wordmark-text">
                <div className="maj">M.A.J</div>
                <div className="sol">Soluções</div>
              </div>
            </div>
            <div className="rvt-divider-v" />
            <div className="flex items-center gap-3">
              {client?.branding?.logoData
                ? <img src={client.branding.logoData} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.4)' }} />
                : null}
              <div>
                <p className="font-display font-semibold text-base" style={{ color: '#fff' }}>{client?.name || ''}</p>
                {client?.address && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{client.address}</p>}
              </div>
            </div>
          </div>
          <div className="text-right" style={{ position: 'relative', zIndex: 1 }}>
            <p className="font-display font-semibold text-base" style={{ color: '#fff', letterSpacing: '0.04em' }}>RELATÓRIO DO INDICADOR</p>
            <p className="text-xs mono" style={{ color: 'rgba(255,255,255,0.75)' }}>Indicador · {formatDateBR(todayISO())}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Total de registros</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{entries.length}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Falhas</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--status-danger)' }}>{countFalha}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Manutenções</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{countManutencao}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Inspeções</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{countInspecao}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {entries.map((r, i) => (
            <div key={r.id} className="rvt-item-card rounded-lg p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', breakInside: 'avoid' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mono"
                    style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.etiqueta || 'Item'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ color: r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)', border: \`1px solid \${r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)'}\` }}>
                    {r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ color: indicatorStatusColor(r.status), border: \`1px solid \${indicatorStatusColor(r.status)}\` }}>
                    {r.status || 'Sem status'}
                  </span>
                </div>
              </div>

              {(r.endereco || r.laco || r.painel || r.equipamento) && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {r.endereco && <span className="mono-chip">END {r.endereco}</span>}
                  {r.laco && <span className="mono-chip">{r.laco}</span>}
                  {r.painel && <span>{r.painel}</span>}
                  {r.equipamento && <span>· {r.equipamento}</span>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <RvtFieldLabel>Falha</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{r.falha || '—'}</p>
                </div>
                {r.dataDiagnostico && (
                  <div>
                    <RvtFieldLabel>Data diagnóstico</RvtFieldLabel>
                    <p className="text-xs mono" style={{ color: 'var(--text-primary)' }}>{formatDateBR(r.dataDiagnostico)}</p>
                  </div>
                )}
              </div>

              {r.descritivo && (
                <div className="mb-2">
                  <RvtFieldLabel>Descritivo</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.descritivo}</p>
                </div>
              )}
              {r.explanacao && (
                <div className="mb-2">
                  <RvtFieldLabel>Explanação</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.explanacao}</p>
                </div>
              )}
              {r.solucao && (
                <div className="mb-2 rounded-md p-2" style={{ background: 'rgba(79,138,109,0.08)' }}>
                  <RvtFieldLabel>Solução aplicada</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--status-ok)' }}>{r.solucao}</p>
                </div>
              )}

              {r.fotos && r.fotos.length > 0 && (
                <div className="mt-3">
                  <RvtFieldLabel>Registro fotográfico</RvtFieldLabel>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                    {r.fotos.map((f, fi) => (
                      <img key={fi} src={f} alt="" className="w-full aspect-square rounded-md object-cover" style={{ border: '1px solid var(--border)' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="rvt-footer-band">
          <div className="rvt-footer-icon"><ShieldAlert size={9} style={{ color: 'var(--accent)' }} /></div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Documento gerado pelo Centro de Controle de Manutenção — M.A.J Eletro Eletrônica LTDA · CNPJ: 45.893.915/0001-01
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}

function IndicadorView({ data, canEdit, client, onCreate, onEdit, onDelete, onImportFile, onLinkDevices, onBulkDelete, onDeleteByStatus, onDeleteAll }) {`
);

/* ===== 3) linkedCount + exportIndicadorXlsx (ExcelJS) + modo impressao ===== */
crlfSafeReplace(
  "export-e-printmode",
  `const linkedCount = list.filter((r) => r.deviceId).length;`,
  `const linkedCount = list.filter((r) => r.deviceId).length;
  const [printMode, setPrintMode] = useState(false);

  async function exportIndicadorXlsx() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Indicador');
    const headers = ['Data Diagnóstico', 'Tipo', 'Etiqueta', 'Endereço', 'Laço', 'Painel', 'Equipamento', 'Área', 'Falha', 'Descritivo', 'Status', 'Explanação', 'Solução', 'Data Solução'];
    ws.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B2F2F' } };
      cell.alignment = { vertical: 'middle' };
    });
    filtered.forEach((r) => {
      ws.addRow({
        'Data Diagnóstico': formatDateBR(r.dataDiagnostico),
        'Tipo': r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha',
        'Etiqueta': r.etiqueta || '',
        'Endereço': r.endereco || '',
        'Laço': r.laco || '',
        'Painel': r.painel || '',
        'Equipamento': r.equipamento || '',
        'Área': r.area || '',
        'Falha': r.falha || '',
        'Descritivo': r.descritivo || '',
        'Status': r.status || '',
        'Explanação': r.explanacao || '',
        'Solução': r.solucao || '',
        'Data Solução': formatDateBR(r.dataSolucao),
      });
    });
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = 24;
    });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`indicador_\${todayISO()}.xlsx\`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (printMode) return <IndicadorPrintView entries={filtered} client={client} onBack={() => setPrintMode(false)} />;`
);

/* ===== 4) Botao PDF agora abre a IndicadorPrintView em vez de imprimir a lista crua ===== */
crlfSafeReplace(
  "botao-pdf",
  `<Button variant="secondary" onClick={() => window.print()} className="print:hidden"><Printer size={15} /> Imprimir / Salvar PDF</Button>`,
  `<Button variant="secondary" onClick={() => setPrintMode(true)}><Printer size={15} /> Imprimir / Salvar PDF</Button>`
);

/* ===== 5) Passa client pro IndicadorView ===== */
crlfSafeReplace(
  "call-site-client",
  `<IndicadorView data={data} canEdit={canEdit}`,
  `<IndicadorView data={data} canEdit={canEdit} client={client}`
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_export_v2", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! PDF com visual MAJ e Excel estilizado (ExcelJS) aplicados.");
