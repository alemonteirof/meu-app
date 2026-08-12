// fix_encoding.cjs
// Corrige acentuação corrompida (mojibake) em src/App.jsx
// Uso: node fix_encoding.cjs

const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");

let trocas = 0;
const fixed = text.replace(/[\u00C2\u00C3][\u0080-\u00BF]+/g, (m) => {
  try {
    const corrigido = Buffer.from(m, "latin1").toString("utf8");
    trocas += 1;
    return corrigido;
  } catch {
    return m;
  }
});

fs.writeFileSync(path, fixed, "utf8");
console.log(`Pronto. ${trocas} trechos corrigidos em ${path}.`);
