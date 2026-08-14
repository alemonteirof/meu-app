// fix_charts_render.cjs
// Corrige renderChartImage: desliga animacao do Chart.js (que fazia a
// captura pegar o grafico ainda desenhando/vazio) e anexa o canvas
// temporariamente na pagina antes de capturar. Tambem passa a pular
// a imagem (sem quebrar o arquivo) se a captura falhar.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("canvas.style.position = 'fixed';")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

const problemas = [];

function crlfSafeReplace(label, alvo, novo) {
  const escaped = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\\r?\\n");
  const re = new RegExp(escaped, "g");
  const matches = text.match(re);
  if (!matches || matches.length === 0) { problemas.push(`[${label}] não achei: "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  if (matches.length > 1) { problemas.push(`[${label}] achei ${matches.length}x (esperava 1): "${alvo.slice(0, 70).replace(/\n/g, " / ")}..."`); return; }
  text = text.replace(re, () => novo);
}

/* ===== 1) renderChartImage: sem animacao, canvas anexado temporariamente, com log de erro ===== */
crlfSafeReplace(
  "renderChartImage",
  `    async function renderChartImage(config, w, h) {
      w = w || 680; h = h || 440;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const chart = new Chart(canvas.getContext('2d'), config);
      await new Promise((r) => setTimeout(r, 60));
      const dataUrl = canvas.toDataURL('image/png');
      chart.destroy();
      return dataUrl.split(',')[1];
    }`,
  `    async function renderChartImage(config, w, h) {
      w = w || 680; h = h || 440;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.position = 'fixed';
      canvas.style.left = '-9999px';
      canvas.style.top = '-9999px';
      document.body.appendChild(canvas);
      config.options = config.options || {};
      config.options.animation = false;
      config.options.responsive = false;
      let base64 = '';
      try {
        const chart = new Chart(canvas.getContext('2d'), config);
        await new Promise((r) => setTimeout(r, 50));
        const dataUrl = canvas.toDataURL('image/png');
        base64 = dataUrl.split(',')[1] || '';
        chart.destroy();
      } catch (e) {
        console.error('Erro ao gerar imagem do gráfico:', e);
      } finally {
        canvas.remove();
      }
      return base64;
    }`
);

/* ===== 2) So embuta as imagens dos graficos se a captura deu certo ===== */
crlfSafeReplace(
  "guard-tipo-pie",
  `    const chartRow = statusKpiRow + 3;
    const tipoPieId = wb.addImage({ base64: tipoPieImg, extension: 'png' });
    resumo.addImage(tipoPieId, { tl: { col: 0, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    const statusPieId = wb.addImage({ base64: statusPieImg, extension: 'png' });
    resumo.addImage(statusPieId, { tl: { col: 7, row: chartRow - 1 }, ext: { width: 420, height: 270 } });`,
  `    const chartRow = statusKpiRow + 3;
    if (tipoPieImg) {
      const tipoPieId = wb.addImage({ base64: tipoPieImg, extension: 'png' });
      resumo.addImage(tipoPieId, { tl: { col: 0, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    }
    if (statusPieImg) {
      const statusPieId = wb.addImage({ base64: statusPieImg, extension: 'png' });
      resumo.addImage(statusPieId, { tl: { col: 7, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    }`
);

crlfSafeReplace(
  "guard-line",
  `    const lineId = wb.addImage({ base64: lineImg, extension: 'png' });
    tendencia.addImage(lineId, { tl: { col: 0, row: 5 }, ext: { width: 900, height: 500 } });`,
  `    if (lineImg) {
      const lineId = wb.addImage({ base64: lineImg, extension: 'png' });
      tendencia.addImage(lineId, { tl: { col: 0, row: 5 }, ext: { width: 900, height: 500 } });
    }`
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_fix_charts", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Renderização dos gráficos corrigida.");
