// implanta_dashboard_indicador.cjs
// Substitui exportIndicadorXlsx pela versao completa (multi-abas,
// KPIs com link, graficos como imagem via Chart.js, formatacao de
// status, comparacao com mes anterior, rodape). Adiciona import do
// Chart.js. Busca tolerante a CRLF.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const problemas = [];

function crlfSafeReplace(label, alvo, novo) {
  const escaped = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\r?\\n");
  const re = new RegExp(escaped, "g");
  const matches = text.match(re);
  if (!matches || matches.length === 0) { problemas.push(`[${label}] não achei: "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  if (matches.length > 1) { problemas.push(`[${label}] achei ${matches.length}x (esperava 1): "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  text = text.replace(re, () => novo);
}

if (text.includes("SITUAÇÃO DAS FALHAS")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) Import do Chart.js ===== */
crlfSafeReplace(
  "import-chartjs",
  `import ExcelJS from 'exceljs';`,
  `import ExcelJS from 'exceljs';\nimport Chart from 'chart.js/auto';`
);

/* ===== 2) Troca a funcao exportIndicadorXlsx inteira ===== */
const startMarker = "async function exportIndicadorXlsx() {";
const endMarker = "if (printMode) return <IndicadorPrintView entries={filtered} client={client} onBack={() => setPrintMode(false)} />;";

const startCount = text.split(startMarker).length - 1;
if (startCount === 0) { problemas.push("[exportIndicadorXlsx] não achei o início da função. Nada foi alterado."); }
else if (startCount > 1) { problemas.push(`[exportIndicadorXlsx] achei ${startCount} vezes o início (esperava 1). Nada foi alterado.`); }
else {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    problemas.push("[exportIndicadorXlsx] não achei o fim da função. Nada foi alterado.");
  } else {
    const novaFuncao = `async function exportIndicadorXlsx() {
    const VINHO = 'FF8B2F2F';
    const VINHO_ESCURO = 'FF5F1F1F';
    const CINZA_BORDA = 'FFD7DADC';
    const CINZA_CLARO = 'FFF2F3F4';
    const BRANCO = 'FFFFFFFF';
    const CINZA_TEXTO = 'FF55605C';
    const AZUL = 'FF3B82F6';
    const LARANJA = 'FFF59E0B';
    const VERMELHO = 'FFC0392B';
    const VERDE_KPI = 'FF27AE60';
    const AMARELO_KPI = 'FFF1C40F';
    const VERDE_CLARO = 'FFD5F0DD';
    const VERDE_TEXTO = 'FF1E7A3D';
    const VERMELHO_CLARO = 'FFFBDADA';
    const VERMELHO_TEXTO = 'FFA93226';
    const AMARELO_CLARO = 'FFFDF3CF';
    const AMARELO_TEXTO = 'FF9C7A0A';

    const HEADERS = ['Data', 'Tipo', 'Local', 'Endereço', 'Laço', 'Painel', 'Equipamento', 'Área', 'Falha', 'Status', 'Solução', 'Data Solução'];
    const COL_WIDTHS = [12, 12, 26, 10, 8, 14, 22, 14, 30, 14, 32, 12];
    const RODAPE_TEXTO = 'Documento gerado pelo Centro de Controle de Manutenção — M.A.J Eletro Eletrônica LTDA · CNPJ: 45.893.915/0001-01';

    let logoBase64 = null;
    try {
      const res = await fetch('/logo-maj.png');
      if (res.ok) {
        const buf = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        logoBase64 = btoa(binary);
      }
    } catch { /* segue sem logo */ }

    async function renderChartImage(config, w, h) {
      w = w || 680; h = h || 440;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const chart = new Chart(canvas.getContext('2d'), config);
      await new Promise((r) => setTimeout(r, 60));
      const dataUrl = canvas.toDataURL('image/png');
      chart.destroy();
      return dataUrl.split(',')[1];
    }

    const wb = new ExcelJS.Workbook();

    function desenhaBanner(ws, titulo) {
      ws.mergeCells('A1:B3');
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO } };
      ws.mergeCells('C1:L3');
      const banner = ws.getCell('C1');
      banner.value = \`M.A.J Soluções — \${titulo}\`;
      banner.font = { bold: true, size: 15, color: { argb: BRANCO } };
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO } };
      banner.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 24; ws.getRow(2).height = 24; ws.getRow(3).height = 24;

      if (logoBase64) {
        const imgId = wb.addImage({ base64: logoBase64, extension: 'png' });
        const colAw = (ws.getColumn(1).width || 10) * 7;
        const colBw = (ws.getColumn(2).width || 10) * 7;
        const largura = colAw + colBw;
        const altura = 24 * 3 * (4 / 3);
        const margem = 10;
        let alvoAltura = altura - margem * 2;
        let alvoLargura = alvoAltura * (486 / 331);
        if (alvoLargura > largura - margem * 2) {
          alvoLargura = largura - margem * 2;
          alvoAltura = alvoLargura * (331 / 486);
        }
        const offX = Math.max(0, (largura - alvoLargura) / 2);
        const offY = Math.max(0, (altura - alvoAltura) / 2);
        ws.addImage(imgId, {
          tl: { col: offX / colAw, row: offY / 24 },
          ext: { width: alvoLargura, height: alvoAltura },
        });
      }

      ws.mergeCells('A4:L4');
      const clienteCell = ws.getCell('A4');
      clienteCell.value = \`\${client?.name || ''}\${client?.address ? ' — ' + client.address : ''}\`;
      clienteCell.font = { bold: true, size: 11 };
      ws.getRow(4).height = 20;
    }

    function escreveRodape(ws, linha) {
      ws.mergeCells(\`A\${linha}:L\${linha}\`);
      const cell = ws.getCell(\`A\${linha}\`);
      cell.value = RODAPE_TEXTO;
      cell.font = { size: 7.5, italic: true, color: { argb: CINZA_TEXTO } };
      ws.getRow(linha).height = 16;
    }

    function corStatus(status) {
      if (status === 'Resolvido') return { fill: VERDE_CLARO, font: VERDE_TEXTO };
      if (status === 'Andamento') return { fill: VERMELHO_CLARO, font: VERMELHO_TEXTO };
      if (status === 'Aguardando') return { fill: AMARELO_CLARO, font: AMARELO_TEXTO };
      return null;
    }

    function escreveTabela(ws, linhas, headerRow) {
      headerRow = headerRow || 6;
      HEADERS.forEach((h, i) => {
        const cell = ws.getCell(headerRow, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: BRANCO } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO_ESCURO } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      ws.getRow(headerRow).height = 20;
      ws.views = [{ state: 'frozen', ySplit: headerRow }];

      let r = headerRow + 1;
      linhas.forEach((row) => {
        const valores = [
          formatDateBR(row.dataDiagnostico),
          row.tipo === 'inspecao' ? 'Inspeção' : row.tipo === 'manutencao' ? 'Manutenção' : 'Falha',
          row.etiqueta || '', row.endereco || '', row.laco || '', row.painel || '',
          row.equipamento || '', row.area || '', row.falha || '', row.status || '',
          row.solucao || '', formatDateBR(row.dataSolucao),
        ];
        valores.forEach((v, c) => {
          const cell = ws.getCell(r, c + 1);
          cell.value = v;
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: CINZA_BORDA } }, bottom: { style: 'thin', color: { argb: CINZA_BORDA } },
            left: { style: 'thin', color: { argb: CINZA_BORDA } }, right: { style: 'thin', color: { argb: CINZA_BORDA } },
          };
        });
        const corSt = corStatus(row.status);
        if (corSt) {
          const statusCell = ws.getCell(r, 10);
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSt.fill } };
          statusCell.font = { bold: true, color: { argb: corSt.font } };
        }
        ws.getRow(r).height = 30;
        r += 1;
      });
      if (linhas.length) {
        ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: r - 1, column: 12 } };
      }
      return r;
    }

    function criaAbaDados(nome, linhas, tituloExtra) {
      tituloExtra = tituloExtra || '';
      const ws = wb.addWorksheet(nome);
      ws.views = [{ showGridLines: false }];
      COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      desenhaBanner(ws, \`Relatório do Indicador\${tituloExtra}\`);
      ws.getRow(5).height = 6;
      const ultima = escreveTabela(ws, linhas);
      escreveRodape(ws, ultima + 2);
      return ws;
    }

    const registros = filtered;
    const falhas = registros.filter((r) => (r.tipo || 'falha') === 'falha');
    const manutencoes = registros.filter((r) => r.tipo === 'manutencao');
    const inspecoes = registros.filter((r) => r.tipo === 'inspecao');
    const total = registros.length;

    const hoje = new Date();
    function contaNoMes(lista, offsetMeses) {
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - offsetMeses, 1);
      return lista.filter((r) => {
        if (!r.dataDiagnostico) return false;
        const d = new Date(r.dataDiagnostico + 'T00:00:00');
        return d.getFullYear() === alvo.getFullYear() && d.getMonth() === alvo.getMonth();
      }).length;
    }
    function deltaTexto(lista) {
      const atual = contaNoMes(lista, 0);
      const anterior = contaNoMes(lista, 1);
      const diff = atual - anterior;
      if (diff > 0) return \`↑ +\${diff} vs mês anterior\`;
      if (diff < 0) return \`↓ \${diff} vs mês anterior\`;
      return '= igual ao mês anterior';
    }
    const todosRegistros = data.indicador || [];
    const todasFalhas = todosRegistros.filter((r) => (r.tipo || 'falha') === 'falha');
    const todasManut = todosRegistros.filter((r) => r.tipo === 'manutencao');
    const todasInsp = todosRegistros.filter((r) => r.tipo === 'inspecao');

    const kpis = [
      { label: 'TOTAL DE REGISTROS', valor: total, cor: VINHO, aba: 'Dados', delta: deltaTexto(todosRegistros) },
      { label: 'FALHAS', valor: falhas.length, cor: VERMELHO, aba: 'Falhas', delta: deltaTexto(todasFalhas) },
      { label: 'MANUTENÇÕES', valor: manutencoes.length, cor: LARANJA, aba: 'Manutenções', delta: deltaTexto(todasManut) },
      { label: 'INSPEÇÕES', valor: inspecoes.length, cor: AZUL, aba: 'Inspeções', delta: deltaTexto(todasInsp) },
    ];

    const statusFalhasCounts = { Resolvido: 0, Andamento: 0, Aguardando: 0 };
    falhas.forEach((r) => { if (statusFalhasCounts[r.status] !== undefined) statusFalhasCounts[r.status] += 1; });

    const resumo = wb.addWorksheet('Resumo');
    resumo.views = [{ showGridLines: false }];
    for (let i = 1; i <= 12; i++) resumo.getColumn(i).width = 13;
    desenhaBanner(resumo, 'Relatório do Indicador');

    resumo.mergeCells('A5:L5');
    resumo.getCell('A5').value = \`Gerado em: \${formatDateBR(todayISO())}\`;
    resumo.getCell('A5').font = { size: 9, italic: true, color: { argb: CINZA_TEXTO } };
    resumo.getRow(5).height = 16;
    resumo.getRow(6).height = 8;

    const kpiRow = 7;
    kpis.forEach((k, i) => {
      const c0 = i * 3 + 1;
      const c1 = c0 + 2;
      resumo.mergeCells(kpiRow, c0, kpiRow + 1, c1);
      const cell = resumo.getCell(kpiRow, c0);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CLARO } };
      cell.border = { top: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.value = \`\${k.valor}\\n\${k.label}\\n\${k.delta}\`;
      cell.font = { size: 9, bold: true, color: { argb: k.cor } };

      resumo.mergeCells(kpiRow + 2, c0, kpiRow + 2, c1);
      const linkCell = resumo.getCell(kpiRow + 2, c0);
      linkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.cor } };
      linkCell.border = { bottom: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      linkCell.alignment = { horizontal: 'center', vertical: 'middle' };
      linkCell.value = { text: '▸ Ver lista completa', hyperlink: \`#'\${k.aba}'!A1\` };
      linkCell.font = { size: 8.5, bold: true, color: { argb: BRANCO }, underline: true };
    });
    resumo.getRow(kpiRow).height = 24;
    resumo.getRow(kpiRow + 1).height = 24;
    resumo.getRow(kpiRow + 2).height = 16;
    resumo.getRow(kpiRow + 3).height = 10;

    const statusTituloRow = kpiRow + 4;
    resumo.mergeCells(\`A\${statusTituloRow}:L\${statusTituloRow}\`);
    resumo.getCell(\`A\${statusTituloRow}\`).value = 'SITUAÇÃO DAS FALHAS';
    resumo.getCell(\`A\${statusTituloRow}\`).font = { size: 10, bold: true, color: { argb: VINHO_ESCURO } };
    resumo.getRow(statusTituloRow).height = 18;

    const statusKpis = [
      { label: 'RESOLVIDO', valor: statusFalhasCounts.Resolvido, cor: VERDE_KPI },
      { label: 'EM ANDAMENTO', valor: statusFalhasCounts.Andamento, cor: VERMELHO },
      { label: 'AGUARDANDO', valor: statusFalhasCounts.Aguardando, cor: AMARELO_KPI },
    ];
    const statusKpiRow = statusTituloRow + 1;
    statusKpis.forEach((k, i) => {
      const c0 = i * 4 + 1;
      const c1 = c0 + 3;
      resumo.mergeCells(statusKpiRow, c0, statusKpiRow + 1, c1);
      const cell = resumo.getCell(statusKpiRow, c0);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CLARO } };
      cell.border = { top: { style: 'medium', color: { argb: k.cor } }, bottom: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.value = \`\${k.valor}\\n\${k.label}\`;
      cell.font = { size: 10, bold: true, color: { argb: k.cor } };
    });
    resumo.getRow(statusKpiRow).height = 24;
    resumo.getRow(statusKpiRow + 1).height = 24;
    resumo.getRow(statusKpiRow + 2).height = 10;

    const corHex = (argb) => '#' + argb.slice(2);
    const tipoPieImg = await renderChartImage({
      type: 'pie',
      data: {
        labels: ['Falha', 'Manutenção', 'Inspeção'],
        datasets: [{ data: [falhas.length, manutencoes.length, inspecoes.length], backgroundColor: [corHex(VERMELHO), corHex(LARANJA), corHex(AZUL)] }],
      },
      options: {
        responsive: false,
        plugins: {
          title: { display: true, text: 'Registros por Tipo', font: { size: 20, weight: 'bold' } },
          legend: { position: 'right', labels: { font: { size: 14 } } },
        },
      },
    });
    const statusPieImg = await renderChartImage({
      type: 'pie',
      data: {
        labels: ['Resolvido', 'Andamento', 'Aguardando'],
        datasets: [{ data: [statusFalhasCounts.Resolvido, statusFalhasCounts.Andamento, statusFalhasCounts.Aguardando], backgroundColor: [corHex(VERDE_KPI), corHex(VERMELHO), corHex(AMARELO_KPI)] }],
      },
      options: {
        responsive: false,
        plugins: {
          title: { display: true, text: 'Situação das Falhas', font: { size: 20, weight: 'bold' } },
          legend: { position: 'right', labels: { font: { size: 14 } } },
        },
      },
    });

    const chartRow = statusKpiRow + 3;
    const tipoPieId = wb.addImage({ base64: tipoPieImg, extension: 'png' });
    resumo.addImage(tipoPieId, { tl: { col: 0, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    const statusPieId = wb.addImage({ base64: statusPieImg, extension: 'png' });
    resumo.addImage(statusPieId, { tl: { col: 7, row: chartRow - 1 }, ext: { width: 420, height: 270 } });

    const notaRow = chartRow + 16;
    resumo.mergeCells(\`A\${notaRow}:L\${notaRow}\`);
    resumo.getCell(\`A\${notaRow}\`).value = 'Clique num cartão acima pra ver a lista daquele tipo. Gráfico de tendência mensal na aba "Tendência".';
    resumo.getCell(\`A\${notaRow}\`).font = { size: 9, italic: true, color: { argb: CINZA_TEXTO } };
    escreveRodape(resumo, notaRow + 2);

    const tendencia = wb.addWorksheet('Tendência');
    tendencia.views = [{ showGridLines: false }];
    for (let i = 1; i <= 12; i++) tendencia.getColumn(i).width = 13;
    desenhaBanner(tendencia, 'Relatório do Indicador — Tendência');
    tendencia.getRow(5).height = 10;

    const mesCounts = {};
    registros.forEach((r) => {
      if (!r.dataDiagnostico) return;
      const mes = r.dataDiagnostico.slice(5, 7) + '/' + r.dataDiagnostico.slice(0, 4);
      mesCounts[mes] = (mesCounts[mes] || 0) + 1;
    });
    const mesesOrdenados = Object.keys(mesCounts).sort((a, b) => {
      const [ma, aa] = a.split('/'); const [mb, ab] = b.split('/');
      return aa === ab ? ma - mb : aa - ab;
    });
    const lineImg = await renderChartImage({
      type: 'line',
      data: {
        labels: mesesOrdenados,
        datasets: [{ label: 'Registros', data: mesesOrdenados.map((m) => mesCounts[m]), borderColor: corHex(VINHO), backgroundColor: corHex(VINHO), tension: 0.2, borderWidth: 3 }],
      },
      options: {
        responsive: false,
        plugins: { title: { display: true, text: 'Registros por Mês', font: { size: 22, weight: 'bold' } }, legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }, 1000, 560);
    const lineId = wb.addImage({ base64: lineImg, extension: 'png' });
    tendencia.addImage(lineId, { tl: { col: 0, row: 5 }, ext: { width: 900, height: 500 } });

    criaAbaDados('Dados', registros);
    criaAbaDados('Falhas', falhas, ' — Falhas');
    criaAbaDados('Manutenções', manutencoes, ' — Manutenções');
    criaAbaDados('Inspeções', inspecoes, ' — Inspeções');

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`indicador_\${client?.name ? client.name.replace(/\\s+/g, '_') + '_' : ''}\${todayISO()}.xlsx\`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}` + "\n\n  ";
    text = text.slice(0, startIdx) + novaFuncao + text.slice(endIdx);
  }
}

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_dashboard_indicador", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Dashboard completo do Indicador (Excel) implantado.");
