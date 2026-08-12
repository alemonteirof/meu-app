// fix_encoding4.cjs
// Versão 4: adiciona o símbolo de Euro (\u20AC) que faltava nas versões anteriores
// Uso: node fix_encoding4.cjs

const fs = require("fs");
const iconv = require("iconv-lite");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");

const padrao = /[\u0080-\u00FF\u2018\u2019\u201A\u201C\u201D\u201E\u2013\u2014\u2020\u2021\u2026\u2022\u02C6\u02DC\u2039\u203A\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u2122\u2030\u20AC]{2,}/g;

let trocas = 0;
const fixed = text.replace(padrao, (m) => {
  try {
    const bytes = iconv.encode(m, "win1252");
    const corrigido = iconv.decode(bytes, "utf8");
    if (corrigido !== m && !corrigido.includes("\uFFFD")) {
      trocas += 1;
      return corrigido;
    }
    return m;
  } catch {
    return m;
  }
});

fs.writeFileSync(path, fixed, "utf8");
console.log(`Pronto. ${trocas} trechos corrigidos em ${path}.`);
