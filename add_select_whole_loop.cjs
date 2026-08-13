// add_select_whole_loop.cjs
// Adiciona botao "Laco inteiro (N)" junto dos botoes de "marcar todos por tipo".
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");

if (text.includes("Laço inteiro (")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

const marker = `<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Marcar todos:</span>`;
const count = text.split(marker).length - 1;
if (count === 0) { console.error("ERRO: não achei o marcador. Nada foi alterado. Me chama."); process.exit(1); }
if (count > 1) { console.error(`ERRO: achei ${count} vezes (esperava 1). Nada foi alterado. Me chama.`); process.exit(1); }

const novo = `${marker}
                            <button type="button" onClick={() => selectByType(devices.map((d) => d.id))}
                              className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                              Laço inteiro ({devices.length})
                            </button>`;

text = text.split(marker).join(novo);
fs.writeFileSync("src/App.jsx.bak_select_loop", fs.readFileSync(path, "utf8"), "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Botão 'Laço inteiro' adicionado.");
