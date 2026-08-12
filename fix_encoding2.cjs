// fix_encoding2.cjs
// Versão 2: corrige mojibake tanto do tipo "Latin-1" quanto "Windows-1252"
// (cobre casos como "Ãš" -> "Ú" e "â€\"" -> "—" que o script anterior não pegava)
// Uso: node fix_encoding2.cjs

const fs = require("fs");
const iconv = require("iconv-lite");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");

// runs de 2+ caracteres que plausivelmente vieram de bytes UTF-8
// mal-interpretados como Windows-1252
const padrao = /[\u0080-\u009F\u00A0-\u00FF\u2018\u2019\u201A\u201C\u201D\u201E\u2013\u2014\u2026\u2022\u02C6\u02DC\u2039\u203A\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u2122]{2,}/g;

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
