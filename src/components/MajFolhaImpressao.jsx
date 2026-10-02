// src/components/MajFolhaImpressao.jsx
//
// Uso: <MajFolhaImpressao titulo="DIÁLOGO DIÁRIO DE SEGURANÇA" subtitulo="..." nomeArquivo="DDS - ..."
//        orientacao="portrait" onBack={...}>...conteúdo...</MajFolhaImpressao>
// Folha de PDF interna MAJ (DDS, checklist) — mesmo esquema do RVT: window.print +
// .print-area + cabeçalho .rvt-brand-band. document.title vira o nome do arquivo.

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";

const VINHO = "#8B2F2F";
const btnBase = { fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)", cursor: "pointer" };
const btnPrimario = { ...btnBase, background: VINHO, borderColor: VINHO, color: "white", fontWeight: 600 };

export const MAJ_EMPRESA = "MAJ Sistemas de Prevenção e Combate a Incêndios LTDA · CNPJ 45.893.915/0001-01";

export function ResumoCard({ rotulo, valor }) {
  return (
    <div className="rvt-summary-card rounded-lg p-3" style={{ background: "var(--surface-raised)" }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>{rotulo}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{valor}</p>
    </div>
  );
}

export default function MajFolhaImpressao({ titulo, subtitulo, nomeArquivo, orientacao = "portrait", onBack, rodape, children }) {
  useEffect(() => {
    const anterior = document.title;
    document.title = nomeArquivo;
    return () => { document.title = anterior; };
  }, [nomeArquivo]);

  return (
    <div className={`${orientacao === "landscape" ? "max-w-6xl" : "max-w-4xl"} mx-auto p-4 flex flex-col gap-4`}>
      {/* o padrão global de impressão é A4 paisagem (RVT); aqui cada folha escolhe */}
      <style>{`@media print { @page { size: A4 ${orientacao}; margin: 12mm; } }`}</style>
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <button type="button" onClick={onBack} style={btnBase}>← Voltar</button>
        <button type="button" onClick={() => { document.title = nomeArquivo; window.print(); }} style={btnPrimario}>Imprimir / Salvar PDF</button>
      </div>

      {/* color aqui (e não só no wrapper da tela): a .print-area redefine --text-primary
          p/ escuro na impressão; herdado de fora, o texto ficava claro no papel branco */}
      <div className="print-area rounded-xl overflow-hidden flex flex-col" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
        <div className="rvt-brand-band">
          <div className="rvt-wordmark">
            <div className="rvt-wordmark-icon"><ShieldAlert size={16} style={{ color: "#fff" }} /></div>
            <div className="rvt-wordmark-text">
              <div className="maj">M.A.J</div>
              <div className="sol">Soluções</div>
            </div>
          </div>
          <div style={{ textAlign: "right", position: "relative", zIndex: 1 }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: 16, letterSpacing: "0.04em" }}>{titulo}</p>
            {subtitulo && <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{subtitulo}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
          {children}
          <div className="rvt-footer-band" style={{ flexDirection: "column", gap: 2, textAlign: "center", fontSize: 10, color: "var(--text-secondary)" }}>
            <p>{MAJ_EMPRESA}</p>
            {rodape && <p>{rodape}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
