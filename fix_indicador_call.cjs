// fix_indicador_call.cjs
// Adiciona "data={data}" na chamada <IndicadorForm .../>, direto no arquivo,
// sem depender do editor.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

const alvo = "<IndicadorForm initial={modal.initial} areaSuggestions=";
const novo = "<IndicadorForm initial={modal.initial} data={data} areaSuggestions=";

if (text.includes("<IndicadorForm initial={modal.initial} data={data}")) {
  console.log("Já está certo — não precisa mudar nada.");
  process.exit(0);
}

const count = text.split(alvo).length - 1;
if (count === 0) {
  console.error("ERRO: não achei o texto esperado. Nada foi alterado. Me chama.");
  process.exit(1);
}
if (count > 1) {
  console.error(`ERRO: achei ${count} ocorrências, deveria ser só 1. Nada foi alterado. Me chama.`);
  process.exit(1);
}

text = text.split(alvo).join(novo);
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! data={data} adicionado na chamada do IndicadorForm.");
