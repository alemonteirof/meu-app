// src/lib/opsItens.js
//
// OPS — Observação Preventiva de Segurança (modelo Nissan p/ terceiros).
// O banco guarda só as respostas por número ({ "1": "sim"|"nao"|"na", … "18" })
// + form_versao. Os textos vivem aqui, por versão: se a Nissan mudar o modelo,
// criar uma versão nova e manter a antiga (registros antigos continuam imprimindo igual).
//
// Cada item: destaque = trecho azul/negrito/sublinhado; texto = resto (preto).
// Layout no PDF (copiado do .doc): bullet = mostra "•" antes; recuo = mm a partir da
// borda da coluna de texto; inline = 2º bullet no meio da linha (itens 3, 6, 8),
// com inlineRecuo = mm onde esse bullet começa (null = logo após o texto).

export const OPS_FORM_VERSAO = "nissan-terceiros-v1";
export const OPS_EMPRESA = "MAJ SOLUÇÕES";
export const OPS_META_MES = 2;

export const OPS_PREDIOS = [
  "SECURITY OFFICE", "PAINT", "TRIM", "PLASTIC", "BODY", "POWER TRAIN", "CENTRAL COP", "SESÉ CBU",
];

export const OPS_RESPOSTAS = [
  { valor: "sim", rotulo: "SIM" },
  { valor: "nao", rotulo: "NÃO" },
  { valor: "na", rotulo: "N/A" },
];

const NISSAN_V1 = [
  { n: 1, bullet: true, recuo: 6, destaque: "Funcionário portadores de necessidade especial ou reabilitado", texto: ":", destaqueGrande: true },
  { n: 2, bullet: true, recuo: 6, texto: "O posto de trabalho apresenta-se seguro para PNE?" },
  { n: 3, bullet: true, recuo: 6, destaque: "Ordem", texto: ":", inline: "Impressão do conjunto (arrumação no Posto e nos corredores)", inlineRecuo: 30 },
  { n: 4, bullet: true, recuo: 6, destaque: "Uso e estado dos Equipamentos de Proteção Individual (EPI)", texto: ": Funcionário está utilizando os EPI´s pertinentes a sua atividade, conforme determinado na matriz de EPI" },
  { n: 5, bullet: true, recuo: 40, texto: "Ficha de entrega de EPI está atualizada" },
  { n: 6, bullet: true, recuo: 6, destaque: "Equipamentos e Máquinas", texto: ":", inline: "As seguranças coletivas funcionam", inlineRecuo: null },
  { n: 7, bullet: true, recuo: 40, texto: "Os controles periódicos de conformidade são feitos (Check List)" },
  { n: 8, bullet: true, recuo: 6, destaque: "Ferramentas e ferramentais", texto: ":", inline: "Em bom estado, utilizados em conformidade", inlineRecuo: null },
  { n: 9, bullet: true, recuo: 12, destaque: "As Empilhadeiras/Rebocador", texto: " os pedestres e condutores têm um comportamento seguro (velocidade 10km/, cinto, cruzamento, farol ligado…)" },
  { n: 10, bullet: false, recuo: 33, texto: "A chave é retirada da ignição quando o operador desce" },
  { n: 11, bullet: true, recuo: 12, destaque: "Equipamento de combate a incêndio", texto: ": estão em perfeito estado e uso" },
  { n: 12, bullet: false, recuo: 71, texto: "Livres de obstrução, de fácil acesso" },
  { n: 13, bullet: true, recuo: 12, destaque: "Produto inflamáveis", texto: ": guardados dentro de armário corta fogo e possuem as FDS? (FISPQ)" },
  { n: 14, bullet: true, recuo: 12, destaque: "Os produtos Químicos estão identificados corretamente?", texto: " Tem as FDS? (FISPQ)" },
  { n: 15, bullet: true, recuo: 12, destaque: "Participou do DDS de hoje?", texto: " Qual foi o tema abordado?" },
  { n: 16, bullet: true, recuo: 12, destaque: "O operador executa as suas atividades de forma segura?", texto: " Sem pressa, sem se colocar ou colocar outras pessoas em situação de risco?" },
  { n: 17, bullet: true, recuo: 12, destaque: "O funcionário conhece as 10 Regras de Segurança?", texto: " Sabe como contribuir para redução de acidentes?" },
  { n: 18, bullet: true, recuo: 12, destaque: "Funcionário conhece o ramal e o número telefone de emergência?", texto: " Sabe o que fazer em caso de acidente?" },
];

const VERSOES = { [OPS_FORM_VERSAO]: NISSAN_V1 };

export function getOpsItens(versao = OPS_FORM_VERSAO) {
  return VERSOES[versao] || NISSAN_V1;
}

// Itens 1 e 2 tratam de PNE — atalho "N/A nos dois" no formulário.
export const OPS_ITENS_PNE = [1, 2];
// Item ligado ao DDS do dia (sugestão a partir de dds_assinaturas).
export const OPS_ITEM_DDS = 15;

export const OPS_TEXTOS = [
  { campo: "comportamentos_preventivos", titulo: "Comportamentos preventivos observados:", orientacao: "Valorizar para encorajar a pessoa a continuar", exemplo: "Ex: Uso correto de EPI e área de trabalho organizada" },
  { campo: "atos_inseguros", titulo: "Atos inseguros observados:", orientacao: "Comentar para convencer a pessoa de mudar seu comportamento", exemplo: "Se não houver: Nenhum ato inseguro observado" },
  { campo: "condicoes_inseguras", titulo: "Condições inseguras constatadas:", orientacao: "Analisar para definir as ações a serem tomadas", exemplo: "Se não houver: Nenhuma condição insegura constatada" },
];
// ~5 linhas do quadro no PDF (A4, Arial 9pt) — acima disso a folha passa de 1 página.
export const OPS_TEXTO_MAX = 480;

// Semana ISO 8601 de uma data 'AAAA-MM-DD' — mesma regra do Postgres
// (extract(week) / extract(isoyear)) usada no trigger ops_assinar.
export function semanaIso(iso) {
  if (!iso) return { semana: null, ano: null };
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dia = dt.getUTCDay() || 7; // seg=1 … dom=7
  dt.setUTCDate(dt.getUTCDate() + 4 - dia); // quinta-feira da mesma semana
  const ano = dt.getUTCFullYear();
  const semana = Math.ceil(((dt - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7);
  return { semana, ano };
}

export const nomeArquivoOps = (semana) => `OPS SEMANA ${String(semana ?? "").padStart(2, "0")}`;
