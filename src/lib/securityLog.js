import * as Sentry from '@sentry/react';
import { supabase } from '../supabaseClient';

// Registra um evento de segurança em 2 lugares: tabela security_events + Sentry.
// Nunca lança — logar não pode quebrar o fluxo do app.
export async function logSecurityEvent(eventType, { email = null, detail = null } = {}) {
  const suspeito = /falhou|negad|bloque/i.test(eventType);
  try {
    let userId = null;
    try { userId = (await supabase?.auth.getUser())?.data?.user?.id ?? null; } catch { /* pré-login */ }
    if (supabase) {
      await supabase.from('security_events').insert({
        event_type: eventType, user_id: userId, email, detail,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
    }
  } catch (e) { console.error('logSecurityEvent (supabase) falhou', e); }
  try {
    Sentry.captureMessage(`security:${eventType}`, { level: suspeito ? 'warning' : 'info', extra: { email, detail } });
  } catch { /* Sentry pode não estar configurado */ }
}
