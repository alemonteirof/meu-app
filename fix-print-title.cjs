// fix-print-title.cjs
// Faz o titulo do documento (usado pelo navegador como nome sugerido do PDF) virar
// "RVT - Cliente - DD-MM-AAAA" quando voce imprime/salva um relatorio de Atendimentos.
// Uso: coloque este arquivo na raiz do projeto (C:\Users\Raker\meu-app) e rode: node fix-print-title.cjs
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'AtendimentosNovo.jsx');

if (!fs.existsSync(filePath)) {
  console.error('ERRO: nao encontrei ' + filePath + '. Rode este script na raiz do projeto (onde fica a pasta src).');
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf8');
const hasCRLF = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const oldBlock = "function VisitaPrintView({ visitas, client, onBack }) {\n  const dias = [...new Set(visitas.map((v) => v.data_visita))].sort();\n  const isPeriodo = dias.length > 1;\n  const todosItens = visitas.flatMap((v) => itemsFromVisita(v));\n  const totalResolvidos = todosItens.filter((it) => it.status === 'Resolvido').length;\n  const tecnicos = [...new Set(visitas.map((v) => v.tecnico).filter(Boolean))];\n  const periodoLabel = isPeriodo ? `${formatDateBR(dias[0])} a ${formatDateBR(dias[dias.length - 1])}` : formatDateBR(dias[0]);\n\n  return (";
const newBlock = "function VisitaPrintView({ visitas, client, onBack }) {\n  const dias = [...new Set(visitas.map((v) => v.data_visita))].sort();\n  const isPeriodo = dias.length > 1;\n  const todosItens = visitas.flatMap((v) => itemsFromVisita(v));\n  const totalResolvidos = todosItens.filter((it) => it.status === 'Resolvido').length;\n  const tecnicos = [...new Set(visitas.map((v) => v.tecnico).filter(Boolean))];\n  const periodoLabel = isPeriodo ? `${formatDateBR(dias[0])} a ${formatDateBR(dias[dias.length - 1])}` : formatDateBR(dias[0]);\n\n  // Nome sugerido pelo navegador ao Imprimir/Salvar PDF (ex: \"RVT - NAL - 21-07-2026\").\n  // Usa \"-\" em vez de \"/\" na data porque \"/\" n\u00e3o \u00e9 um caractere v\u00e1lido em nome de arquivo.\n  useEffect(() => {\n    const tituloAnterior = document.title;\n    const dataArquivo = (d) => formatDateBR(d).replace(/\\//g, '-');\n    const rotuloData = isPeriodo ? `${dataArquivo(dias[0])}_a_${dataArquivo(dias[dias.length - 1])}` : dataArquivo(dias[0]);\n    const nomeCliente = (client?.name || '').replace(/[\\\\/:*?\"<>|]/g, '-').trim();\n    document.title = `RVT${nomeCliente ? ' - ' + nomeCliente : ''} - ${rotuloData}`;\n    return () => { document.title = tituloAnterior; };\n  }, [dias.join(','), client?.name, isPeriodo]);\n\n  return (";

if (!content.includes(oldBlock)) {
  if (content.includes(newBlock)) {
    console.log('O arquivo ja esta com essa correcao aplicada. Nada a fazer.');
    process.exit(0);
  }
  console.error('ERRO: nao encontrei o bloco esperado em AtendimentosNovo.jsx (o arquivo pode ja ter sido alterado). Nenhuma mudanca foi feita. Me chama que eu reviso.');
  process.exit(1);
}

content = content.replace(oldBlock, newBlock);
if (hasCRLF) content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('OK: titulo do PDF (RVT - Cliente - Data) configurado em src/AtendimentosNovo.jsx');
