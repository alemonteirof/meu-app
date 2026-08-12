// fix_card_split_v2.cjs
// Versao com regex tolerante a CRLF (quebra de linha do Windows).
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("Última inspeção: {formatDateBR(status && status.lastInspection)}")) {
  console.log("Já está certo — não precisa mudar nada.");
  process.exit(0);
}

const re = /Última manutenção: \{formatDateBR\(status && status\.lastMaintenance\)\}(\r?\n)(\s*)<\/div>/;
const matches = text.match(new RegExp(re.source, "g"));
if (!matches || matches.length === 0) {
  console.error("ERRO: não achei o texto esperado (nem com CRLF). Nada foi alterado. Me chama.");
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`ERRO: achei ${matches.length} vezes (esperava 1). Nada foi alterado. Me chama.`);
  process.exit(1);
}

text = text.replace(re, (full, quebra, indent) => {
  return `Última manutenção: {formatDateBR(status && status.lastMaintenance)}${quebra}${indent}</div>${quebra}${indent}<div className="text-xs mt-0.5 mono" style={{ color: 'var(--text-secondary)' }}>${quebra}${indent}  Última inspeção: {formatDateBR(status && status.lastInspection)}${quebra}${indent}</div>`;
});

fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Card agora mostra Última manutenção e Última inspeção separadas.");
