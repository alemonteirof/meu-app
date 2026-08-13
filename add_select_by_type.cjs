// add_select_by_type.cjs
// Adiciona botoes "marcar todos de um tipo" dentro do modo de selecao
// multipla, por laco. So marca as caixas, nao envia nada.
const fs = require("fs");
const path = "src/App.jsx";
let text = fs.readFileSync(path, "utf8");
const original = text;

const problemas = [];

function selfInsertAfter(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker) + marker.length;
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

function selfInsertBefore(label, marker, novoConteudo) {
  const count = text.split(marker).length - 1;
  if (count === 0) { problemas.push(`[${label}] não achei o marcador: "${marker.slice(0, 60)}..."`); return; }
  if (count > 1) { problemas.push(`[${label}] achei ${count} vezes o marcador (esperava 1): "${marker.slice(0, 60)}..."`); return; }
  const idx = text.indexOf(marker);
  text = text.slice(0, idx) + novoConteudo + text.slice(idx);
}

if (text.includes("function selectByType(")) {
  console.log("Já está aplicado — não precisa mudar nada.");
  process.exit(0);
}

/* ===== 1) Função selectByType (depois do estado de busca de dispositivo) ===== */
selfInsertAfter(
  "selectByType",
  "const [deviceSearch, setDeviceSearch] = useState('');",
  `
  function selectByType(ids) {
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  }`
);

/* ===== 2) Botões de tipo, dentro de cada laço, antes da lista de dispositivos ===== */
selfInsertBefore(
  "botoes-tipo",
  "{devices.length === 0 ? (",
  `{selectMode && devices.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Marcar todos:</span>
                            {[...new Set(devices.map((d) => d.type))].map((tipo) => {
                              const idsDoTipo = devices.filter((d) => d.type === tipo).map((d) => d.id);
                              return (
                                <button key={tipo} type="button" onClick={() => selectByType(idsDoTipo)}
                                  className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                  {DEVICE_TYPE_MAP[tipo]?.label || tipo} ({idsDoTipo.length})
                                </button>
                              );
                            })}
                          </div>
                        )}
                        `
);

/* ===== Resultado ===== */
if (problemas.length > 0) {
  console.error("NADA FOI ALTERADO. Problemas encontrados:\n");
  problemas.forEach((p) => console.error(" - " + p));
  process.exit(1);
}

fs.writeFileSync("src/App.jsx.bak_select_by_type", original, "utf8");
fs.writeFileSync(path, text, "utf8");
console.log("Pronto! Botões de 'marcar todos por tipo' adicionados.");
