import React from 'react';
import FireGame from './FireGame';

/* Tela de erro/404 com o mini-jogo do extintor. Usada pelo ErrorBoundary
   (App.jsx) e pela rota desconhecida (404). */
export default function ErrorScreen({ code, title, message, detail, actions }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: '#181414' }}>
      <div className="w-full max-w-2xl rounded-2xl p-5 sm:p-7" style={{ background: '#221D1D', border: '1px solid #3E3232' }}>
        <div className="flex items-start gap-4 mb-5">
          <img src="/maj-emblem.png" alt="" style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.9, flexShrink: 0 }} />
          <div className="min-w-0">
            {code && (
              <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: '#C0504A', fontFamily: 'monospace' }}>{code}</p>
            )}
            <p className="font-semibold text-lg leading-snug" style={{ color: '#F1EDEA' }}>{title}</p>
            {message && <p className="text-sm mt-1" style={{ color: '#A79999' }}>{message}</p>}
          </div>
        </div>

        <FireGame />

        {detail && (
          <details className="mt-5 text-xs" style={{ color: '#7E7070' }}>
            <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
            <p className="mt-2 break-all" style={{ fontFamily: 'monospace' }}>{detail}</p>
          </details>
        )}

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {actions.map((a, i) => (
              <button key={a.label} onClick={a.onClick}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={i === 0
                  ? { background: '#8B2F2F', color: '#FFFFFF', border: 'none', cursor: 'pointer' }
                  : { background: 'transparent', color: '#D8CFCB', border: '1px solid #3E3232', cursor: 'pointer' }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
