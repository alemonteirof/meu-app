// fix_link_devices.cjs
// Corrige "Vincular aos dispositivos" pra nao apagar vinculos que ja
// existiam manualmente (RVT, manutencao/inspecao direta, seletor do
// Indicador) quando o casador por texto nao encontra correspondencia.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("// já estava vinculado manualmente")) {
  console.log("Já está corrigido — não precisa mudar nada.");
  process.exit(0);
}

const startMarker = "function linkIndicadorToDevices() {";
const endMarker = "function submitMaintenance(values) {";

const startCount = text.split(startMarker).length - 1;
if (startCount === 0) { console.error("ERRO: não achei o início. Nada foi alterado. Me chama."); process.exit(1); }
if (startCount > 1) { console.error(`ERRO: achei ${startCount} vezes o início (esperava 1). Nada foi alterado. Me chama.`); process.exit(1); }

const startIdx = text.indexOf(startMarker);
const endIdx = text.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error("ERRO: não achei o fim. Nada foi alterado. Me chama."); process.exit(1); }

const novaFuncao = `function linkIndicadorToDevices() {
    let matched = 0;
    let total = 0;
    updateData((prev) => {
      const list = prev.indicador || [];
      total = list.length;
      const linked = list.map((r) => {
        const deviceId = matchIndicadorRecordToDevice(r, prev);
        if (deviceId) {
          matched += 1;
          return { ...r, deviceId, categoria: 'devices' };
        }
        if (r.deviceId) {
          // já estava vinculado manualmente (RVT, manutenção/inspeção direta ou seletor do Indicador) — preserva
          matched += 1;
          return r;
        }
        return { ...r, deviceId: '' };
      });
      return { ...prev, indicador: linked };
    });
    return { matched, total, unmatched: total - matched };
  }
  `;

text = text.slice(0, startIdx) + novaFuncao + text.slice(endIdx);
fs.writeFileSync("src/App.jsx.bak_link_devices", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! 'Vincular aos dispositivos' agora preserva vínculos manuais.");
