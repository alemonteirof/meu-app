// Excel das Pendências (Indicador → Pendências → Exportar Excel).
// Aba "Dashboard": indicadores, filtro de responsável (lista suspensa que recalcula números e
// gráficos), tabelas-resumo e gráficos nativos do Excel. Aba "Pendências": base completa com
// filtro automático e destaque de atraso. Aba "Materiais": um material por linha, agrupado por atividade.
// O ExcelJS não gera gráficos — o arquivo sai do ExcelJS e os gráficos (DrawingML) são
// injetados depois no .zip via JSZip, apontando para as tabelas-resumo (fórmulas) do Dashboard.
// Módulo JS puro (sem React/Supabase): recebe linhas já formatadas pelo chamador.

const VINHO = '8B2F2F';
const GRAFITE = '5B6670';
// Pendências da MAJ: tom mais claro e sem destaque de atraso (números continuam completos).
const MAJ_COR = 'C3C8CF';
const MAJ_TXT = '8A9099';
const TEXTO = '1F2328';
const CINZA_TXT = '6B7280';
const CARD_BG = 'F4F5F7';
const LINHA = 'D7DADC';
const ZEBRA = 'F7F7F8';
const RESP = ['Cliente', 'MAJ'];
const FAIXAS = [['0–15 dias', 0, 15], ['16–30 dias', 16, 30], ['31–60 dias', 31, 60], ['61–90 dias', 61, 90], ['+90 dias', 91, Infinity]];

export function faixaDias(d) {
  if (d == null) return 'Sem data';
  return FAIXAS.find(([, lo, hi]) => d >= lo && d <= hi)[0];
}

const argb = (hex) => `FF${hex}`;
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const fino = (hex = LINHA) => ({ style: 'thin', color: { argb: argb(hex) } });
const bordaFina = { top: fino(), bottom: fino(), left: fino(), right: fino() };
const dataXl = (s) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const dataBR = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
const fx3 = (formula, result) => ({ formula, result });

/**
 * @param linhas     [{ responsavel:'Cliente'|'MAJ', tipo, local, atividade, detalhe, desde, dias, previsao, origem,
 *                     materiais: [{ item, especificacao, marca, qtd, unidade, obs }] }] (datas ISO)
 * @param tipos      [{ label, criterio }] — ordem fixa das categorias; criterio = texto do COUNTIFS (aceita curinga)
 * @param posicao    'YYYY-MM-DD' — data de referência (dias/vencimento já calculados até ela)
 */
export async function montarPlanilhaPendencias({ linhas, clienteNome, posicao, tipos }) {
  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([import('exceljs'), import('jszip')]);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CCM — MAJ Soluções';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const situacao = (l) => (!l.previsao ? 'Sem previsão' : l.previsao.slice(0, 10) < posicao ? 'Vencida' : 'No prazo');
  const dash = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }], properties: { tabColor: { argb: argb(VINHO) } } });
  const ws = wb.addWorksheet('Pendências', { views: [{ state: 'frozen', ySplit: 1 }] });
  const wm = wb.addWorksheet('Materiais', { views: [{ state: 'frozen', ySplit: 1 }] });

  // ---------- Aba de dados ----------
  const cabecalho = (sheet, colunas) => {
    sheet.columns = colunas.map(([header, width]) => ({ header, width }));
    const r = sheet.getRow(1);
    r.height = 30;
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = fill(VINHO);
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = { ...bordaFina, bottom: { style: 'medium', color: { argb: argb('5E1F1F') } } };
    });
    sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    sheet.headerFooter = { oddFooter: `&L${clienteNome} — Pendências&RPágina &P de &N` };
  };
  const corpo = (sheet, centralizadas = []) => sheet.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = bordaFina;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: centralizadas.includes(col) ? 'center' : undefined };
      if (n % 2 === 0) c.fill = fill(ZEBRA);
    });
  });

  cabecalho(ws, [['Nº', 6], ['Responsável', 13], ['Tipo', 24], ['Local', 34], ['Atividade', 34], ['Detalhe', 44], ['Desde', 11], ['Dias aguardando', 11], ['Faixa', 12], ['Previsão', 11], ['Situação da previsão', 13], ['RVT de origem', 12]]);
  linhas.forEach((l, i) => {
    ws.addRow([i + 1, l.responsavel, l.tipo, l.local, l.atividade, l.detalhe, dataXl(l.desde), l.dias, faixaDias(l.dias), dataXl(l.previsao), situacao(l), dataXl(l.origem)]);
  });
  [7, 10, 12].forEach((i) => { ws.getColumn(i).numFmt = 'dd/mm/yyyy'; });
  corpo(ws, [1, 2, 7, 8, 9, 10, 11, 12]);
  ws.getColumn(8).font = { bold: true };
  ws.eachRow((row, n) => {
    if (n > 1 && row.getCell(2).value === 'MAJ') row.eachCell((c, col) => { c.font = { bold: col === 8, color: { argb: argb(MAJ_TXT) } }; });
  });
  ws.autoFilter = { from: 'A1', to: 'L1' };
  const ultima = Math.max(2, linhas.length + 1);
  ws.addConditionalFormatting({
    ref: `H2:H${ultima}`,
    rules: [
      { type: 'expression', formulae: ['AND($B2="Cliente",$H2>90)'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF6D5D5' } }, font: { bold: true, color: { argb: argb(VINHO) } } } },
      { type: 'expression', formulae: ['AND($B2="Cliente",$H2>=31,$H2<=90)'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCEBD0' } }, font: { bold: true, color: { argb: 'FF8A5300' } } } },
    ],
  });
  ws.addConditionalFormatting({
    ref: `K2:K${ultima}`,
    rules: [{ type: 'expression', formulae: ['AND($B2="Cliente",$K2="Vencida")'], priority: 3, style: { font: { bold: true, color: { argb: argb(VINHO) } } } }],
  });

  // ---------- Aba de materiais (por atividade, sem somar nomes parecidos) ----------
  // Cada material fica na linha da sua atividade, exatamente como foi cadastrado — nada de
  // consolidar por nome (grafias diferentes do mesmo item confundiam o cliente). Blocos por
  // atividade com faixa alternada; filtro em todas as colunas; linha 3 soma só o que está visível.
  const colsMat = [['Nº da pendência', 10], ['Responsável', 13], ['Local', 32], ['Atividade', 36], ['Material', 30], ['Especificação', 24], ['Marca', 14], ['Quantidade', 11], ['Unidade', 9], ['Observação', 28]];
  wm.columns = colsMat.map(([, width]) => ({ width }));
  for (let c = 1; c <= colsMat.length; c++) wm.getCell(1, c).fill = fill(VINHO);
  wm.getRow(1).height = 26;
  wm.mergeCells(1, 1, 1, colsMat.length);
  Object.assign(wm.getCell('A1'), { value: `MATERIAIS POR ATIVIDADE  ·  ${clienteNome || ''}  ·  Posição em ${dataBR(posicao)}`, font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, alignment: { vertical: 'middle', indent: 1 } });
  wm.mergeCells(2, 1, 2, colsMat.length);
  wm.getRow(2).height = 32;
  Object.assign(wm.getCell('A2'), {
    value: 'COMO USAR: cada bloco de cor é uma atividade, com os materiais que ela precisa. Para ver só um material, só uma atividade ou só o que é do Cliente, clique na setinha ▼ do cabeçalho (linha 4) e escolha. A linha 3 soma a quantidade só do que estiver aparecendo.',
    font: { size: 10, color: { argb: argb(TEXTO) } }, fill: fill('FDF3D6'), alignment: { vertical: 'middle', wrapText: true, indent: 1 },
  });
  const matLinhas = [];
  linhas.forEach((l, i) => {
    (l.materiais || []).forEach((m) => matLinhas.push({ n: i + 1, l, m }));
  });
  matLinhas.sort((a, b) => (a.l.responsavel === b.l.responsavel ? a.n - b.n : a.l.responsavel === 'Cliente' ? -1 : 1));
  const iniMat = 5;
  const fimMat = Math.max(iniMat, iniMat + matLinhas.length - 1);
  wm.getRow(3).height = 22;
  wm.mergeCells(3, 1, 3, 7);
  const estTot = { font: { bold: true, size: 11, color: { argb: argb(VINHO) } }, fill: fill(CARD_BG), alignment: { vertical: 'middle', horizontal: 'right' }, border: { bottom: { style: 'medium', color: { argb: argb(VINHO) } } } };
  Object.assign(wm.getCell('A3'), { ...estTot, value: fx3(`"Linhas aparecendo: "&SUBTOTAL(103,E${iniMat}:E${fimMat})&"   ·   Quantidade somada (filtre por Material para somar 1 item):"`, `Linhas aparecendo: ${matLinhas.length}   ·   Quantidade somada (filtre por Material para somar 1 item):`) });
  Object.assign(wm.getCell('H3'), { ...estTot, value: fx3(`SUBTOTAL(109,H${iniMat}:H${fimMat})`, matLinhas.reduce((a, x) => a + (Number(x.m.qtd) || 0), 0)), numFmt: 'General', alignment: { vertical: 'middle', horizontal: 'center' } });
  for (const c of [9, 10]) Object.assign(wm.getCell(3, c), { fill: estTot.fill, border: estTot.border });
  const cab = wm.getRow(4);
  cab.height = 30;
  colsMat.forEach(([h], i) => Object.assign(cab.getCell(i + 1), { value: h, font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill(VINHO), alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }, border: bordaFina }));
  let bloco = -1; let ultimoN = null;
  matLinhas.forEach(({ n, l, m }, i) => {
    const primeira = n !== ultimoN;
    if (primeira) { bloco++; ultimoN = n; }
    const row = wm.getRow(iniMat + i);
    const qtd = m.qtd == null || m.qtd === '' ? null : Number(m.qtd);
    row.values = [n, l.responsavel, l.local, l.atividade, m.item || '', m.especificacao || '', m.marca || '', qtd, qtd == null ? '' : (m.unidade || 'un'), [m.obs, qtd == null && 'quantidade a definir'].filter(Boolean).join(' · ')];
    const maj = l.responsavel === 'MAJ';
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { ...bordaFina, ...(primeira ? { top: { style: 'medium', color: { argb: argb(maj ? 'BFC3C8' : VINHO) } } } : {}) };
      c.alignment = { vertical: 'top', wrapText: true, horizontal: [1, 2, 8, 9].includes(col) ? 'center' : undefined };
      if (bloco % 2 === 1) c.fill = fill(ZEBRA);
      // Repetição de Local/Atividade fica apagada (continua preenchida para o filtro funcionar).
      const repetida = !primeira && col <= 4;
      c.font = { bold: primeira && (col === 3 || col === 4) || col === 5 || col === 8, color: { argb: argb(repetida ? 'B4B9C0' : maj ? MAJ_TXT : TEXTO) } };
    });
  });
  wm.views = [{ state: 'frozen', ySplit: 4 }];
  wm.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: colsMat.length } };
  wm.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  wm.headerFooter = { oddFooter: `&L${clienteNome} — Materiais por atividade&RPágina &P de &N` };
  if (!matLinhas.length) {
    wm.mergeCells(iniMat, 1, iniMat, colsMat.length);
    Object.assign(wm.getCell(iniMat, 1), { value: 'Nenhuma pendência de material nesta exportação.', font: { italic: true, color: { argb: argb(CINZA_TXT) } } });
  }

  // ---------- Dashboard ----------
  const faixa = (col) => `'Pendências'!$${col}$2:$${col}$${ultima}`;
  const R = faixa('B'); const T = faixa('C'); const H = faixa('H'); const F = faixa('I'); const K = faixa('K');
  const conta = (pred) => linhas.filter(pred).length;
  const dias = linhas.map((l) => l.dias).filter((d) => d != null);

  dash.columns = [{ width: 2.5 }, ...Array.from({ length: 12 }, () => ({ width: 12.5 })), { width: 2.5 }, { width: 10, hidden: true }];
  const merge = (ref) => dash.mergeCells(ref);
  const celula = (ref, value, estilo = {}) => {
    const c = dash.getCell(ref);
    c.value = value;
    Object.assign(c, estilo);
    return c;
  };
  const fx = (formula, result) => ({ formula, result });

  // Faixa de título (vinho), mesma identidade do cabeçalho do RVT.
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 14; c++) dash.getCell(r, c).fill = fill(VINHO);
  [24, 18, 20].forEach((h, i) => { dash.getRow(i + 1).height = h; });
  merge('B1:J2');
  celula('B1', 'PENDÊNCIAS PARA CONCLUSÃO', { font: { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }, alignment: { vertical: 'middle' } });
  merge('B3:J3');
  celula('B3', `${clienteNome || ''}  ·  Posição em ${dataBR(posicao)}`, { font: { size: 11, color: { argb: 'FFF1DADA' } }, alignment: { vertical: 'middle' } });
  merge('K1:M2');
  celula('K1', 'M.A.J', { font: { bold: true, size: 20, color: { argb: 'FFFFFFFF' } }, alignment: { vertical: 'middle', horizontal: 'right' } });
  merge('K3:M3');
  celula('K3', 'Soluções', { font: { size: 10, color: { argb: 'FFF1DADA' } }, alignment: { vertical: 'middle', horizontal: 'right' } });

  // Filtro (lista suspensa) + células auxiliares ocultas na coluna O.
  dash.getRow(5).height = 22;
  merge('B5:C5');
  celula('B5', 'Filtrar responsável  ▸', { font: { bold: true, color: { argb: argb(TEXTO) } }, alignment: { vertical: 'middle', horizontal: 'right' } });
  merge('D5:E5');
  const filtro = celula('D5', 'Todos', {
    font: { bold: true, size: 12, color: { argb: argb(VINHO) } },
    fill: fill('FDF3D6'),
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  ['D5', 'E5'].forEach((r) => { dash.getCell(r).border = { top: { style: 'medium', color: { argb: argb(VINHO) } }, bottom: { style: 'medium', color: { argb: argb(VINHO) } }, left: { style: 'medium', color: { argb: argb(VINHO) } }, right: { style: 'medium', color: { argb: argb(VINHO) } } }; });
  filtro.dataValidation = {
    type: 'list', allowBlank: false, formulae: ['"Todos,Cliente,MAJ"'],
    showErrorMessage: true, errorTitle: 'Filtro', error: 'Escolha Todos, Cliente ou MAJ.',
    showInputMessage: true, promptTitle: 'Filtro', prompt: 'Escolha o responsável. Indicadores, tabelas e gráficos recalculam.',
  };
  merge('F5:M5');
  celula('F5', 'Clique na célula amarela e escolha Todos / Cliente / MAJ — indicadores, tabelas e gráficos recalculam.', { font: { italic: true, size: 9, color: { argb: argb(CINZA_TXT) } }, alignment: { vertical: 'middle' } });
  celula('O5', fx('IF($D$5="Todos","*",$D$5)', '*'));
  celula('O6', fx('OR($D$5="Todos",$D$5="Cliente")', true));
  celula('O7', fx('OR($D$5="Todos",$D$5="MAJ")', true));

  // Cards de indicadores (2 colunas cada).
  const totalCli = conta((l) => l.responsavel === 'Cliente');
  const totalMaj = conta((l) => l.responsavel === 'MAJ');
  const vencidas = conta((l) => situacao(l) === 'Vencida');
  const cards = [
    ['B', 'C', 'Total em aberto', fx(`COUNTIFS(${R},$O$5)`, linhas.length), '0'],
    ['D', 'E', 'Com o cliente', fx(`IF($O$6,COUNTIFS(${R},"Cliente"),0)`, totalCli), '0'],
    ['F', 'G', 'Com a MAJ', fx(`IF($O$7,COUNTIFS(${R},"MAJ"),0)`, totalMaj), '0'],
    ['H', 'I', 'Mais antiga', fx(`IFERROR(_xlfn.MAXIFS(${H},${R},$O$5),0)`, dias.length ? Math.max(...dias) : 0), '0 "dias"'],
    ['J', 'K', 'Tempo médio', fx(`IFERROR(ROUND(AVERAGEIFS(${H},${R},$O$5),0),0)`, dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0), '0 "dias"'],
    ['L', 'M', 'Previsão vencida', fx(`COUNTIFS(${R},$O$5,${K},"Vencida")`, vencidas), '0'],
  ];
  dash.getRow(7).height = 20;
  dash.getRow(8).height = 22;
  dash.getRow(9).height = 22;
  for (const [a, b, label, valor, numFmt] of cards) {
    merge(`${a}7:${b}7`);
    merge(`${a}8:${b}9`);
    for (const col of [a, b]) {
      for (const r of [7, 8, 9]) dash.getCell(`${col}${r}`).fill = fill(CARD_BG);
      dash.getCell(`${col}7`).border = { top: { style: 'thick', color: { argb: argb(VINHO) } } };
    }
    celula(`${a}7`, label.toUpperCase(), { font: { bold: true, size: 9, color: { argb: argb(GRAFITE) } }, alignment: { vertical: 'bottom', horizontal: 'center' } });
    celula(`${a}8`, valor, { numFmt, font: { bold: true, size: 22, color: { argb: argb(a === 'F' ? MAJ_TXT : TEXTO) } }, alignment: { vertical: 'middle', horizontal: 'center' } });
  }
  dash.addConditionalFormatting({ ref: 'L8', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: [0], priority: 1, style: { font: { bold: true, color: { argb: argb(VINHO) } } } }] });
  dash.addConditionalFormatting({ ref: 'H8', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: [90], priority: 2, style: { font: { bold: true, color: { argb: argb(VINHO) } } } }] });

  // Helpers das tabelas-resumo.
  const tituloSecao = (row, texto, sub) => {
    dash.getRow(row).height = 22;
    merge(`B${row}:M${row}`);
    const c = celula(`B${row}`, sub ? { richText: [{ text: texto, font: { bold: true, size: 12, color: { argb: argb(TEXTO) } } }, { text: `   ${sub}`, font: { italic: true, size: 9, color: { argb: argb(CINZA_TXT) } } }] } : texto, { alignment: { vertical: 'bottom' } });
    if (!sub) c.font = { bold: true, size: 12, color: { argb: argb(TEXTO) } };
    for (let col = 2; col <= 13; col++) dash.getCell(row, col).border = { bottom: { style: 'medium', color: { argb: argb(VINHO) } } };
  };
  const cabTabela = (row, colunas) => {
    merge(`B${row}:C${row}`);
    ['B', ...colunas.map(([col]) => col)].forEach((col, i) => {
      const c = celula(`${col}${row}`, i === 0 ? colunas.rotulo : colunas[i - 1][1], { font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, fill: fill(GRAFITE), alignment: { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' } });
      c.border = bordaFina;
    });
    dash.getCell(`C${row}`).fill = fill(GRAFITE);
  };
  const linhaTabela = (row, rotulo, valores, { total = false, zebra = false } = {}) => {
    merge(`B${row}:C${row}`);
    const estilo = { font: { bold: total, size: 10, color: { argb: argb(TEXTO) } }, border: total ? { ...bordaFina, top: { style: 'medium', color: { argb: argb(GRAFITE) } } } : bordaFina };
    if (total || zebra) estilo.fill = fill(total ? 'ECEEF1' : ZEBRA);
    celula(`B${row}`, rotulo, { ...estilo, alignment: { vertical: 'middle', wrapText: true } });
    Object.assign(dash.getCell(`C${row}`), { border: estilo.border, ...(estilo.fill ? { fill: estilo.fill } : {}) });
    for (const [col, v, numFmt] of valores) celula(`${col}${row}`, v, { ...estilo, numFmt: numFmt || '0', alignment: { vertical: 'middle', horizontal: 'center' } });
    if (String(rotulo).length > 24) dash.getRow(row).height = 28;
  };

  // Seção 1 — por responsável (+ situação da previsão).
  tituloSecao(11, 'Por responsável');
  const cab1 = [['D', 'Qtd'], ['E', '%']]; cab1.rotulo = 'Responsável';
  cabTabela(12, cab1);
  linhaTabela(13, 'Cliente', [['D', fx('D8', totalCli)], ['E', fx('IF($D$15=0,0,D13/$D$15)', linhas.length ? totalCli / linhas.length : 0), '0%']]);
  linhaTabela(14, 'MAJ', [['D', fx('F8', totalMaj)], ['E', fx('IF($D$15=0,0,D14/$D$15)', linhas.length ? totalMaj / linhas.length : 0), '0%']], { zebra: true });
  linhaTabela(15, 'Total', [['D', fx('SUM(D13:D14)', linhas.length)], ['E', fx('IF($D$15=0,0,1)', linhas.length ? 1 : 0), '0%']], { total: true });
  const cab1b = [['D', 'Qtd']]; cab1b.rotulo = 'Situação da previsão';
  cabTabela(17, cab1b);
  ['Vencida', 'No prazo', 'Sem previsão'].forEach((s, i) => {
    linhaTabela(18 + i, s, [['D', fx(`COUNTIFS(${R},$O$5,${K},"${s}")`, conta((l) => situacao(l) === s))]], { zebra: i % 2 === 1 });
  });

  // Seção 2 — por tipo, separado por responsável.
  tituloSecao(26, 'Por tipo de pendência');
  const cab2 = [['D', 'Cliente'], ['E', 'MAJ'], ['F', 'Total']]; cab2.rotulo = 'Tipo';
  cabTabela(27, cab2);
  const casa = (crit, txt) => (crit.endsWith('*') ? txt.startsWith(crit.slice(0, -1)) : txt === crit);
  const porTipo = tipos.map((t) => RESP.map((r) => conta((l) => l.responsavel === r && casa(t.criterio, l.tipo))));
  tipos.forEach((t, i) => {
    const row = 28 + i;
    linhaTabela(row, t.label, [
      ['D', fx(`IF($O$6,COUNTIFS(${R},"Cliente",${T},"${t.criterio}"),0)`, porTipo[i][0])],
      ['E', fx(`IF($O$7,COUNTIFS(${R},"MAJ",${T},"${t.criterio}"),0)`, porTipo[i][1])],
      ['F', fx(`D${row}+E${row}`, porTipo[i][0] + porTipo[i][1])],
    ], { zebra: i % 2 === 1 });
  });
  const fimTipo = 27 + tipos.length;
  linhaTabela(fimTipo + 1, 'Total', ['D', 'E', 'F'].map((col, j) => [col, fx(`SUM(${col}28:${col}${fimTipo})`, j < 2 ? porTipo.reduce((a, p) => a + p[j], 0) : porTipo.reduce((a, p) => a + p[0] + p[1], 0))]), { total: true });

  // Seção 3 — tempo aguardando (faixas de dias).
  tituloSecao(43, 'Tempo aguardando');
  const cab3 = [['D', 'Cliente'], ['E', 'MAJ'], ['F', 'Total']]; cab3.rotulo = 'Faixa';
  cabTabela(44, cab3);
  const porFaixa = FAIXAS.map(([rot]) => RESP.map((r) => conta((l) => l.responsavel === r && faixaDias(l.dias) === rot)));
  FAIXAS.forEach(([rot], i) => {
    const row = 45 + i;
    linhaTabela(row, rot, [
      ['D', fx(`IF($O$6,COUNTIFS(${R},"Cliente",${F},"${rot}"),0)`, porFaixa[i][0])],
      ['E', fx(`IF($O$7,COUNTIFS(${R},"MAJ",${F},"${rot}"),0)`, porFaixa[i][1])],
      ['F', fx(`D${row}+E${row}`, porFaixa[i][0] + porFaixa[i][1])],
    ], { zebra: i % 2 === 1 });
  });
  linhaTabela(50, 'Total', ['D', 'E', 'F'].map((col, j) => [col, fx(`SUM(${col}45:${col}49)`, j < 2 ? porFaixa.reduce((a, p) => a + p[j], 0) : porFaixa.reduce((a, p) => a + p[0] + p[1], 0))]), { total: true });

  // Seção 4 — as 10 mais antigas (lista fixa da exportação).
  tituloSecao(59, '10 pendências mais antigas', '(lista fixa — não acompanha o filtro)');
  const top = [...linhas].filter((l) => l.dias != null).sort((a, b) => b.dias - a.dias).slice(0, 10);
  const cab4 = [['B', 'Dias'], ['C', 'Responsável'], ['D', 'Tipo'], ['F', 'Local / atividade'], ['L', 'Previsão'], ['M', 'Situação']];
  merge('D60:E60'); merge('F60:K60');
  for (const [col, txt] of cab4) celula(`${col}60`, txt, { font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, fill: fill(GRAFITE), alignment: { vertical: 'middle', horizontal: col === 'F' ? 'left' : 'center' } });
  ['E', 'G', 'H', 'I', 'J', 'K'].forEach((col) => { dash.getCell(`${col}60`).fill = fill(GRAFITE); });
  top.forEach((l, i) => {
    const row = 61 + i;
    dash.getRow(row).height = 30;
    merge(`D${row}:E${row}`); merge(`F${row}:K${row}`);
    const cli = l.responsavel === 'Cliente';
    const corLinha = cli ? TEXTO : MAJ_TXT;
    const base = { font: { size: 10, color: { argb: argb(corLinha) } }, alignment: { vertical: 'middle', horizontal: 'center', wrapText: true } };
    for (let c = 2; c <= 13; c++) {
      const cel = dash.getCell(row, c);
      cel.border = { bottom: fino() };
      if (i % 2 === 1) cel.fill = fill(ZEBRA);
    }
    celula(`B${row}`, l.dias, { ...base, font: { bold: true, size: 12, color: { argb: argb(cli && l.dias > 90 ? VINHO : corLinha) } } });
    celula(`C${row}`, l.responsavel, base);
    celula(`D${row}`, l.tipo, base);
    celula(`F${row}`, [l.local, l.atividade].filter(Boolean).join(' — '), { ...base, alignment: { ...base.alignment, horizontal: 'left' } });
    celula(`L${row}`, dataXl(l.previsao), { ...base, numFmt: 'dd/mm/yyyy' });
    const sit = situacao(l);
    celula(`M${row}`, sit, { ...base, font: { ...base.font, bold: cli && sit === 'Vencida', color: { argb: argb(cli && sit === 'Vencida' ? VINHO : corLinha) } } });
  });
  const rodape = 61 + Math.max(top.length, 1) + 1;
  merge(`B${rodape}:M${rodape}`);
  celula(`B${rodape}`, 'Base completa (filtrável por qualquer coluna) na aba "Pendências"; materiais de cada atividade na aba "Materiais". Gerado pelo CCM — MAJ Soluções.', { font: { italic: true, size: 9, color: { argb: argb(CINZA_TXT) } } });
  dash.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: `A1:N${rodape}`, horizontalCentered: true, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

  // ---------- Gráficos nativos ----------
  const S = "'Dashboard'!";
  const tiposLabels = tipos.map((t) => t.label);
  const faixaLabels = FAIXAS.map(([r]) => r);
  const graficos = [
    {
      ancora: [6, 11, 13, 24],
      xml: graficoRosca({
        titulo: 'Distribuição por responsável',
        cat: { f: `${S}$B$13:$B$14`, vals: RESP },
        val: { f: `${S}$D$13:$D$14`, vals: [totalCli, totalMaj] },
        cores: [VINHO, MAJ_COR],
      }),
    },
    {
      ancora: [6, 26, 13, 41],
      xml: graficoBarras({
        titulo: 'Pendências por tipo', dir: 'bar',
        cat: { f: `${S}$B$28:$B$${fimTipo}`, vals: tiposLabels },
        series: [
          { nome: 'Cliente', nomeF: `${S}$D$27`, f: `${S}$D$28:$D$${fimTipo}`, vals: porTipo.map((p) => p[0]), cor: VINHO },
          { nome: 'MAJ', nomeF: `${S}$E$27`, f: `${S}$E$28:$E$${fimTipo}`, vals: porTipo.map((p) => p[1]), cor: MAJ_COR, corTexto: '4B5563' },
        ],
      }),
    },
    {
      ancora: [6, 43, 13, 57],
      xml: graficoBarras({
        titulo: 'Há quanto tempo estão aguardando', dir: 'col',
        cat: { f: `${S}$B$45:$B$49`, vals: faixaLabels },
        series: [
          { nome: 'Cliente', nomeF: `${S}$D$44`, f: `${S}$D$45:$D$49`, vals: porFaixa.map((p) => p[0]), cor: VINHO },
          { nome: 'MAJ', nomeF: `${S}$E$44`, f: `${S}$E$45:$E$49`, vals: porFaixa.map((p) => p[1]), cor: MAJ_COR, corTexto: '4B5563' },
        ],
      }),
    },
  ];

  const buf = await wb.xlsx.writeBuffer();
  return injetarGraficos(buf, JSZip, 'Dashboard', graficos);
}

// ---------- DrawingML (gráficos) ----------
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const solido = (hex) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const strRef = (f, vals) => `<c:strRef><c:f>${esc(f)}</c:f><c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef>`;
const numRef = (f, vals) => `<c:numRef><c:f>${esc(f)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef>`;
const txPr = (sz, cor, negrito = false) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${negrito ? 1 : 0}">${solido(cor)}<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
const semBorda = '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>';
const rotulos = (formato, extra, cor = 'FFFFFF') => `<c:dLbls><c:numFmt formatCode="${formato}" sourceLinked="0"/>${semBorda}${txPr(1000, cor, true)}${extra}</c:dLbls>`;

function envelope(titulo, plot) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>`
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="1200" b="1">${solido(TEXTO)}</a:rPr><a:t>${esc(titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>`
    + '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>'
    + `<c:spPr>${solido('FFFFFF')}<a:ln w="9525">${solido(LINHA)}</a:ln></c:spPr>${txPr(1000, '404040')}</c:chartSpace>`;
}

function graficoRosca({ titulo, cat, val, cores }) {
  const pontos = cores.map((cor, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${solido(cor)}<a:ln w="25400">${solido('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('');
  const lbl = rotulos('0%;;;', '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/>');
  return envelope(titulo, `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Pendências</c:v></c:tx>${pontos}${lbl}<c:cat>${strRef(cat.f, cat.vals)}</c:cat><c:val>${numRef(val.f, val.vals)}</c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`);
}

function graficoBarras({ titulo, dir, cat, series }) {
  const horizontal = dir === 'bar';
  const lbl = (cor) => rotulos('0;;;', '<c:dLblPos val="ctr"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>', cor);
  const sers = series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx>${strRef(s.nomeF, [s.nome])}</c:tx><c:spPr>${solido(s.cor)}</c:spPr><c:invertIfNegative val="0"/>${lbl(s.corTexto)}<c:cat>${strRef(cat.f, cat.vals)}</c:cat><c:val>${numRef(s.f, s.vals)}</c:val></c:ser>`).join('');
  const eixos = `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${solido('BFC3C8')}</a:ln></c:spPr><c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
    + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/><c:axPos val="${horizontal ? 'b' : 'l'}"/><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  return envelope(titulo, `<c:barChart><c:barDir val="${dir}"/><c:grouping val="stacked"/><c:varyColors val="0"/>${sers}<c:gapWidth val="55"/><c:overlap val="100"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>${eixos}`);
}

/** Injeta os gráficos (chartN.xml + drawing + rels + content types) na aba indicada do .xlsx. */
async function injetarGraficos(buf, JSZip, nomeAba, graficos) {
  const zip = await JSZip.loadAsync(buf);
  const ler = (p) => zip.file(p).async('string');
  const wbXml = await ler('xl/workbook.xml');
  const tagAba = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`name="${nomeAba}"`));
  const rid = /r:id="([^"]+)"/.exec(tagAba)[1];
  const wbRels = await ler('xl/_rels/workbook.xml.rels');
  const rel = [...wbRels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`));
  const alvo = /Target="([^"]+)"/.exec(rel)[1];
  const abaPath = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
  const abaRelsPath = abaPath.replace(/([^/]+)$/, '_rels/$1.rels');

  const ancoras = graficos.map(({ ancora: [c1, r1, c2, r2] }, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('');
  zip.file('xl/drawings/drawingCcm1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">${ancoras}</xdr:wsDr>`);
  zip.file('xl/drawings/_rels/drawingCcm1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${graficos.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/chart" Target="../charts/chartCcm${i + 1}.xml"/>`).join('')}</Relationships>`);
  graficos.forEach((g, i) => zip.file(`xl/charts/chartCcm${i + 1}.xml`, g.xml));

  const relDesenho = `<Relationship Id="rIdCcmDesenho" Type="${NS_R}/drawing" Target="../drawings/drawingCcm1.xml"/>`;
  const abaRels = zip.file(abaRelsPath)
    ? (await ler(abaRelsPath)).replace('</Relationships>', `${relDesenho}</Relationships>`)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relDesenho}</Relationships>`;
  zip.file(abaRelsPath, abaRels);

  let abaXml = await ler(abaPath);
  if (!/xmlns:r=/.test(abaXml.slice(0, 600))) abaXml = abaXml.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
  // <drawing> precisa vir antes destes elementos (ordem do schema do worksheet).
  const depois = ['<legacyDrawing', '<legacyDrawingHF', '<drawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>']
    .map((t) => abaXml.indexOf(t)).filter((i) => i >= 0);
  const pos = Math.min(...depois);
  abaXml = `${abaXml.slice(0, pos)}<drawing r:id="rIdCcmDesenho"/>${abaXml.slice(pos)}`;
  zip.file(abaPath, abaXml);

  let tipos = await ler('[Content_Types].xml');
  const overrides = '<Override PartName="/xl/drawings/drawingCcm1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
    + graficos.map((_, i) => `<Override PartName="/xl/charts/chartCcm${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('');
  tipos = tipos.replace('</Types>', `${overrides}</Types>`);
  zip.file('[Content_Types].xml', tipos);

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
