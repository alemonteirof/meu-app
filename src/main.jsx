import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0,
})

// Depois de um deploy novo, abas abertas com a versão antiga pedem chunks com hash
// que não existe mais — recarrega a página (1x a cada 10s, pra não entrar em loop).
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('ccm-chunk-reload') || 0)
    if (Date.now() - last < 10000) return
    sessionStorage.setItem('ccm-chunk-reload', String(Date.now()))
  } catch { /* sessionStorage bloqueado: recarrega mesmo assim */ }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
