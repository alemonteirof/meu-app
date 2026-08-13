// fix_filtros_layout.cjs
// Troca o layout flex (que quebra torto) por um grid fixo nos filtros
// do Historico.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

const alvo = `<div className="flex flex-wrap gap-2 items-end">
        <Field label="De">`;
const novo = `<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="De">`;

if (text.includes(`<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">\n        <Field label="De">`)) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

const count = text.split(alvo).length - 1;
if (count === 0) { console.error("ERRO: não achei o texto esperado. Nada foi alterado. Me chama."); process.exit(1); }
if (count > 1) { console.error(`ERRO: achei ${count} vezes (esperava 1). Nada foi alterado. Me chama.`); process.exit(1); }

text = text.split(alvo).join(novo);
fs.writeFileSync("src/App.jsx.bak_filtros_layout", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Layout dos filtros corrigido pra grade fixa.");
