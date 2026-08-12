// fix_card_split.cjs
// Adiciona a linha "Última inspeção" junto da "Última manutenção" no card.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

const alvo = "Última manutenção: {formatDateBR(status && status.lastMaintenance)}\n          </div>";
const novo = "Última manutenção: {formatDateBR(status && status.lastMaintenance)}\n          </div>\n          <div className=\"text-xs mt-0.5 mono\" style={{ color: 'var(--text-secondary)' }}>\n            Última inspeção: {formatDateBR(status && status.lastInspection)}\n          </div>";

if (text.includes("Última inspeção: {formatDateBR(status && status.lastInspection)}")) {
  console.log("Já está certo — não precisa mudar nada.");
  process.exit(0);
}

const count = text.split(alvo).length - 1;
if (count === 0) {
  console.error("ERRO: não achei o texto esperado. Nada foi alterado. Me chama.");
  process.exit(1);
}
if (count > 1) {
  console.error(`ERRO: achei ${count} vezes (esperava 1). Nada foi alterado. Me chama.`);
  process.exit(1);
}

text = text.split(alvo).join(novo);
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Card agora mostra Última manutenção e Última inspeção separadas.");
