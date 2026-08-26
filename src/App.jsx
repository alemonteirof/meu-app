import AtendimentosNovo from './AtendimentosNovo';
import {
  loadClientData, saveClientData, createVisita, createAtendimento, createInspecao, updateAtendimento, deleteAtendimento, updateInspecao, deleteInspecao,
  FUNCTIONAL_CATEGORIES, PAPEL_SINAL_OPTIONS, CATEGORIAS_COM_PAPEL_SINAL, FUNCTIONAL_CATEGORY_MAP, PAPEL_SINAL_MAP, getMetodoTeste,
  COMBATE_CONJUNTO_TIPOS, COMBATE_AGUA_TIPOS, COMBATE_GAS_AGENTES, conjuntoSubitemInfo,
  COMBATE_COMPONENTE_TIPOS, COMBATE_COMPONENTE_TIPO_MAP, COMBATE_CILINDRO_ITENS, COMBATE_RETEST_LABORATORIAL_MESES,
  listCombateHistorico,
} from './supabaseAdapter';
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Cpu, Wind, Clock, Plus, X, Pencil, Trash2,
  ChevronDown, ChevronRight, ArrowLeft, Cloud, Thermometer, Hand, LogOut,
  LogIn, ToggleLeft, Bell, CheckCircle2, AlertTriangle, Search, Wrench,
  Loader2, Inbox, ShieldAlert, ClipboardList, ClipboardCheck, Settings,
  ImagePlus, UserCog, Building2, KeyRound, Printer, Upload, Palette, Users, UserPlus,
  FileSpreadsheet, FileText, Activity, BarChart3, PieChart, Camera, Zap, Menu, MoreHorizontal, Flame,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import Chart from 'chart.js/auto';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ------------------------------------------------------------------ */
/* Supabase (banco de dados + login de usuários)                      */
/* ------------------------------------------------------------------ */
import { createClient } from '@supabase/supabase-js';
import ToolChecklistForm from './components/ToolChecklistForm';
import ToolChecklistScreen from './components/ToolChecklistScreen';
import ToolChecklistHistory from './components/ToolChecklistHistory';


import { supabase } from './supabaseClient';
export { supabase };

/* ------------------------------------------------------------------ */
/* Storage: window.storage -> Supabase (tabela kv_store)               */
/* ------------------------------------------------------------------ */
/* Todo o app já lê/grava dados através de window.storage.get/set/    */
/* delete/list. Aqui plugamos essa mesma interface no Supabase quando  */
/* as chaves VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY existirem, ou  */
/* caímos de volta para o localStorage do navegador (útil para testar */
/* localmente antes de configurar o Supabase).                        */
if (typeof window !== 'undefined') {
  if (supabase) {
    window.storage = {
      async get(key) {
        const { data, error } = await supabase.from('kv_store').select('value').eq('key', key).maybeSingle();
        if (error) throw error;
        return data ? { key, value: data.value } : null;
      },
      async set(key, value) {
        const client_id = key.startsWith('pci-dados-cliente-') ? key.replace('pci-dados-cliente-', '') : null;
        const { error } = await supabase.from('kv_store').upsert({ key, value, client_id, updated_at: new Date().toISOString() });
        if (error) throw error;
        return { key, value };
      },
      async delete(key) {
        const { error } = await supabase.from('kv_store').delete().eq('key', key);
        if (error) throw error;
        return { key, deleted: true };
      },
      async list(prefix = '') {
        const { data, error } = await supabase.from('kv_store').select('key').like('key', `${prefix}%`);
        if (error) throw error;
        return { keys: (data || []).map((r) => r.key) };
      },
    };
  } else if (!window.storage) {
    window.storage = {
      async get(key) {
        const value = localStorage.getItem(key);
        return value === null ? null : { key, value };
      },
      async set(key, value) {
        localStorage.setItem(key, value);
        return { key, value };
      },
      async delete(key) {
        localStorage.removeItem(key);
        return { key, deleted: true };
      },
      async list(prefix = '') {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
        return { keys };
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/* Autenticação global + níveis de acesso (admin / operador / visualizador) */
/* ------------------------------------------------------------------ */
const ROLE_LABELS = { admin: 'Admin', operador: 'Operador', visualizador: 'Visualizador' };
const AuthContext = React.createContext({ role: 'admin', email: null, signOut: () => {} });
function useAuth() { return React.useContext(AuthContext); }

function LoginScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Conta criada! Um administrador precisa liberar seu nível de acesso antes que você possa usar o sistema plenamente.');
      }
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg">
      <img src="/maj-emblem.png" alt="" aria-hidden="true" className="login-watermark"
        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div className="login-content">
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col items-center gap-3 mb-4">
            <BrandLogo boxSize={56} size={28} />
            <h1 className="font-display text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>Centro de Controle de Manutenção</h1>
          </div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Senha</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          {error && <p className="text-xs mb-3" style={{ color: 'var(--status-danger)' }}>{error}</p>}
          {info && <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>{info}</p>}
          <button type="submit" disabled={loading} className="w-full py-2 rounded-lg text-sm font-medium mb-3"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
            className="w-full text-xs" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {mode === 'login' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function BrandLogo({ size = 18, boxSize = 36, rounded = true }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={rounded ? 'rounded-lg flex items-center justify-center flex-shrink-0' : 'flex items-center justify-center flex-shrink-0'}
        style={{ width: boxSize, height: boxSize, background: 'var(--accent)' }}>
        <ShieldAlert size={size} style={{ color: 'var(--accent-contrast)' }} />
      </div>
    );
  }
  return (
    <img src="/maj-logo-icon.png" alt="MAJ Soluções"
      style={{ height: boxSize, width: 'auto', maxWidth: boxSize * 3.5, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setFailed(true)} />
  );
}

function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState('visualizador');
  const [memberships, setMemberships] = useState(null); // null = ainda carregando

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!error && data) setRole(data.role);
    })();
    (async () => {
      const { data, error } = await supabase.from('memberships').select('client_id, role').eq('user_id', session.user.id);
      setMemberships(!error && data ? data : []);
    })();
  }, [session]);

  if (!supabase) {
    return <AuthContext.Provider value={{ role: 'admin', email: null, memberships: [], isOwner: true, signOut: () => {} }}>{children}</AuthContext.Provider>;
  }

  if (session === undefined || (session && memberships === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <AuthContext.Provider value={{ role, email: session.user.email, memberships, isOwner: role === 'admin', signOut: () => supabase.auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const CLIENTS_KEY = 'pci-clientes-v1';
const LEGACY_KEY = 'pci-sistema-dados-v1';
const LAST_CLIENT_KEY = 'pci-ultimo-cliente-v1';
function clientDataKey(id) { return `pci-dados-cliente-${id}`; }

/* ------------------------------------------------------------------ */
/* Importação de base de dispositivos — múltiplas marcas de painel     */
/* ------------------------------------------------------------------ */

const IMPORT_BRANDS = [
  {
    value: 'hochiki',
    label: 'Hochiki / VES',
    models: [
      { value: 'generico', label: 'Não especificar / outro modelo', shortLabel: '', loops: null },
      { value: 'firenet-plus', label: 'FireNET Plus (Hochiki) / Elite RS (VES) — 1 ou 2 laços', shortLabel: 'FireNET Plus / Elite RS', loops: null },
      { value: 'latitude', label: 'FireNET L@titude (Hochiki) / L@titude (VES) — 2 a 16 laços', shortLabel: 'FireNET L@titude / L@titude', loops: null },
      { value: 'firenet', label: 'FireNET (Hochiki, descontinuado — sem equivalente VES) — 2 ou 4 laços', shortLabel: 'FireNET (descontinuado)', loops: null },
    ],
  },
  {
    value: 'notifier',
    label: 'Notifier (Honeywell)',
    models: [
      { value: 'NFS-320', label: 'NFS-320', shortLabel: 'NFS-320', loops: 1 },
      { value: 'NFS2-640', label: 'NFS2-640', shortLabel: 'NFS2-640', loops: 2 },
      { value: 'NFS2-3030', label: 'NFS2-3030', shortLabel: 'NFS2-3030', loops: 10 },
    ],
  },
];
function brandInfo(brandValue) { return IMPORT_BRANDS.find((b) => b.value === brandValue) || IMPORT_BRANDS[0]; }
function modelInfo(brandValue, modelValue) {
  const b = brandInfo(brandValue);
  return b.models.find((m) => m.value === modelValue) || b.models[0];
}

function guessDeviceTypeFromCode(code) {
  const c = (code || '').toUpperCase();
  if (c.includes('PULL') || c.includes('AMS')) return 'acionador';
  if (c.startsWith('ATJ') || c.startsWith('ATG') || c.includes('TERMICO') || c.includes('CALOR')) return 'calor';
  if (c.startsWith('ALK') || c.startsWith('ALO') || c.startsWith('ALN') || c.startsWith('ALG') || c === 'DIMM') return 'fumaca';
  if (c.startsWith('R2M')) return 'rele';
  if (c === 'SOM-AI' || c.startsWith('SOM')) return 'saida';
  if (c === 'CZM' || c.startsWith('FRCME')) return 'entrada';
  return 'entrada';
}

/* Mapeamento calibrado com os "Type Code Label" reais observados em exports do VeriFire
   Tools (relatórios de Módulos e Detectores). Correspondência exata primeiro; quando o
   código não é reconhecido, cai para uma busca por palavra-chave. */
const NOTIFIER_TYPE_MAP = {
  // Módulos
  'MONITOR': 'entrada',
  'RELAY': 'rele',
  'MAN RELEASE': 'acionador',
  'MANUAL RELEASE': 'acionador',
  'BELL CIRCUIT': 'saida',
  'RELEASE CKT': 'saida',
  'RELEASE CIRCUIT': 'saida',
  'FORM C RESET': 'rele',
  'TRACK SUPERV': 'entrada',
  'TRACKING SUPERVISORY': 'entrada',
  'RF SUPERVSRY': 'entrada',
  'RF SUPERVISORY': 'entrada',
  'POWER MONITR': 'entrada',
  'POWER MONITOR': 'entrada',
  'ISOLATOR': 'rele',
  'NAC CIRCUIT': 'saida',
  'SOUNDER CIRCUIT': 'saida',
  'DOOR HOLDER': 'saida',
  'AUX POWER': 'saida',
  'AUXILIARY POWER': 'saida',
  // Detectores
  'PHOTO': 'fumaca',
  'PHOTOELECTRIC': 'fumaca',
  'ION': 'fumaca',
  'IONIZATION': 'fumaca',
  'MULTI': 'fumaca',
  'MULTI-CRITERIA': 'fumaca',
  'DUCT': 'fumaca',
  'HEAT': 'calor',
  'FIXED TEMP': 'calor',
  'ROR': 'calor',
  'THERMAL': 'calor',
  'PULL STATION': 'acionador',
  'MANUAL STATION': 'acionador',
  'MANUAL PULL': 'acionador',
};

function guessDeviceTypeFromNotifierCode(code) {
  const key = (code || '').trim().toUpperCase();
  if (NOTIFIER_TYPE_MAP[key]) return NOTIFIER_TYPE_MAP[key];
  if (key.includes('RELEASE') || key.includes('PULL') || key.includes('MANUAL')) return 'acionador';
  if (key.includes('RELAY') || key.includes('FORM C') || key.includes('ISOLAT')) return 'rele';
  if (key.includes('BELL') || key.includes('NAC') || key.includes('SOUNDER') || key.includes('DOOR') || key.includes('AUX') || key.includes('CIRCUIT')) return 'saida';
  if (key.includes('PHOTO') || key.includes('ION') || key.includes('SMOKE') || key.includes('DUCT') || key.includes('MULTI')) return 'fumaca';
  if (key.includes('HEAT') || key.includes('THERMAL') || key.includes('TEMP') || key.includes('ROR')) return 'calor';
  if (key.includes('MONITOR') || key.includes('SUPERV') || key.includes('INPUT')) return 'entrada';
  return 'entrada';
}

function guessDeviceType(brand, code) {
  return brand === 'notifier' ? guessDeviceTypeFromNotifierCode(code) : guessDeviceTypeFromCode(code);
}

/* Modelo real do módulo Notifier, a partir da coluna "FlashScan Type" do report.
   hasSub indica se o endereço tem sub-endereços (ex.: 056.01/056.02) — nesse caso, o
   MINI/DUAL MONITOR é fisicamente um módulo de dupla entrada (FDM-1); sem sub-endereço,
   é um módulo de entrada única (FMM-101). */
function resolveNotifierModel(flashScanType, hasSub) {
  const f = (flashScanType || '').trim().toUpperCase();
  if (!f) return '';
  if (f === 'MONITOR') return 'FMM-1';
  if (f === 'RELAY') return 'FRM-1';
  if (f === 'CONTROL') return 'FCM-1';
  if (f === 'RELEASE') return 'FCM-1REL';
  if (f === 'MANUAL STATION') return 'Acionador Manual NGB';
  if (f.includes('MONITOR') && (f.includes('MINI') || f.includes('DUAL'))) {
    return hasSub ? 'FDM-1' : 'FMM-101';
  }
  // PS MON (Power Monitor) refere-se a fontes auxiliares — ainda sem um código de
  // modelo específico definido; por ora mostra o próprio FlashScan Type do report.
  return flashScanType;
}

/* ---- Hochiki / VES: relatório "Device Labels" em .csv ---- */

function parseDeviceLabelsCsv(text) {
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  let currentTitle = null;
  let inTable = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { inTable = false; continue; }
    if (/^-+$/.test(line)) continue;
    if (line.startsWith('"')) {
      const cells = (line.match(/"([^"]*)"/g) || []).map((c) => c.slice(1, -1));
      if (cells.length === 5 && cells[0] === 'Address') { inTable = true; continue; }
      if (inTable && cells.length === 5) {
        rows.push({ address: cells[0], node: cells[1], loop: cells[2], type: cells[3], label: cells[4], title: currentTitle });
        continue;
      }
      continue;
    }
    if (!inTable) currentTitle = line;
  }
  if (rows.length === 0) throw new Error('Nenhuma linha de dispositivo foi encontrada nesse arquivo.');
  return rows;
}

/* ---- Hochiki / VES: relatório do Loop Explorer 1 (.pdf) ----
   O LP1 exporta um PDF com layout de tabela sem linhas de grade: cada "célula" é
   posicionada por coordenadas, e o texto de células longas (ex.: "Setting" com dois
   valores D/N, ou a descrição do local) quebra em linhas visuais que não seguem a
   ordem de leitura simples. Por isso, em vez de interpretar linha por linha, lemos
   todas as palavras com suas coordenadas (x,y), localizamos os endereços (coluna da
   esquerda) e agrupamos as demais palavras numa "banda" vertical ao redor de cada
   endereço, atribuindo cada palavra à coluna correta pela posição horizontal. */

async function extractPdfWords(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const items = [];
  let cumY = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      const text = (item.str || '').trim();
      if (!text) return;
      items.push({
        y: cumY + (viewport.height - item.transform[5]),
        x: item.transform[4],
        text,
      });
    });
    cumY += viewport.height + 1000;
  }
  return items;
}

const LP1_NAME_X0 = 100;
const LP1_ADDR_RE = /^\d{3}\.\d{2}$/;
const LP1_BAND_CAP = 16;

function parseLp1Report(words) {
  const sorted = [...words].sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // Reconstrói linhas de texto simples (só pra localizar os cabeçalhos "Panel X" e "X - Loop N (...)")
  const lines = [];
  let curY = null, curToks = [];
  for (const w of sorted) {
    if (curY === null || Math.abs(w.y - curY) > 3) {
      if (curToks.length) lines.push({ y: curY, toks: curToks });
      curToks = [w];
      curY = w.y;
    } else {
      curToks.push(w);
    }
  }
  if (curToks.length) lines.push({ y: curY, toks: curToks });

  const panelLines = [];
  const loopLines = [];
  for (const { y, toks } of lines) {
    toks.sort((a, b) => a.x - b.x);
    const txt = toks.map((t) => t.text).join(' ');
    const mPanel = txt.match(/^Panel\s+([A-Z0-9][A-Z0-9 \-/]*)$/);
    if (mPanel) panelLines.push({ y, name: mPanel[1].trim() });
    const mLoop = txt.match(/-\s*Loop\s+(\d+)\s*\(/i);
    if (mLoop) loopLines.push({ y, n: parseInt(mLoop[1], 10) });
  }

  function contextForY(y) {
    let panel = null;
    for (const p of panelLines) { if (p.y <= y) panel = p.name; else break; }
    let loop = null;
    for (const l of loopLines) { if (l.y <= y) loop = l.n; else break; }
    return { panel, loop };
  }

  const addrWords = sorted.filter((w) => w.x < LP1_NAME_X0 && LP1_ADDR_RE.test(w.text));
  if (addrWords.length === 0) {
    throw new Error('Não encontrei endereços de dispositivos nesse PDF. Verifique se é um relatório do Loop Explorer 1 (LP1).');
  }

  const bands = addrWords.map((w, i) => {
    const yPrev = i > 0 ? addrWords[i - 1].y : w.y - 1000;
    const yNext = i < addrWords.length - 1 ? addrWords[i + 1].y : w.y + 1000;
    const lo = Math.max((yPrev + w.y) / 2, w.y - LP1_BAND_CAP);
    const hi = Math.min((w.y + yNext) / 2, w.y + LP1_BAND_CAP);
    return { lo, hi, address: w.text, y: w.y };
  });
  const bandLos = bands.map((b) => b.lo);

  function findBandIndex(y) {
    let lo = 0, hi = bandLos.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (bandLos[mid] <= y) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }

  const byBand = Array.from({ length: bands.length }, () => []);
  for (const w of sorted) {
    const idx = findBandIndex(w.y);
    if (idx < 0) continue;
    const band = bands[idx];
    if (w.y >= band.lo && w.y < band.hi) byBand[idx].push(w);
  }

  // Palavras "técnicas" das colunas que ficam entre Nome e Texto (Zona, Flags, Ação,
  // Setting D/N e os Delays) — usadas só para saber onde o Texto realmente começa, já
  // que não usamos o conteúdo dessas colunas no app.
  const LP1_TYPE_KEYWORD_RE = /\b(Sensor|Common|Input|Output)\b/;
  const LP1_ACTION_WORDS = new Set(['Fire', 'Trouble', 'Supervisory', 'Al', 'Temporal', 'Continuous']);
  // Combinações de Flags realmente usadas neste tipo de relatório (M=Alarme Geral,
  // P=Pré-alarme, D=Modo Dia, N=Modo Noite, E=Emergência, S=Silenciável, R=Resetável,
  // L=Latching, O=Saída com atraso, F=Falha, A=Saída de Pré-alarme, B=Bypass, H=Calor).
  // Usamos uma lista fechada (em vez de qualquer combinação de letras) porque algumas
  // dessas letras coincidem com o início de textos reais do relatório, como "AM"
  // (Acionador Manual) ou "HALL".
  const LP1_KNOWN_FLAGS = new Set(['L', 'S', 'LP', 'LB', 'ML', 'MS', 'MLP', 'MLPB', 'LH', 'MLB', 'MP', 'MLH']);
  function extractLp1Label(tail) {
    const tokens = tail.split(/\s+/).filter(Boolean);
    let idx = 0;
    // Zona (número curto)
    while (idx < tokens.length && /^\d{1,3}$/.test(tokens[idx])) idx++;
    // Flags — só reconhece os combos realmente usados neste relatório (ver lista acima).
    if (idx < tokens.length && LP1_KNOWN_FLAGS.has(tokens[idx])) idx++;
    // Ação (pode ser "Fire", ou duas palavras como "Supervisory Al")
    while (idx < tokens.length && LP1_ACTION_WORDS.has(tokens[idx])) idx++;
    // Setting dia/noite — formatos "D2,50"/"N2,50" (com vírgula) ou "D150"/"N150" (sem
    // vírgula, usado por alguns modelos como ATG-EA). Só checa nas duas posições logo
    // após a Ação (nunca mais adiante), pra não arriscar cortar um código de local que
    // comece com D/N seguido de números (ex.: "N04" de uma coluna).
    if (idx < tokens.length && /^D\d+([.,]\d+)?$/.test(tokens[idx])) idx++;
    if (idx < tokens.length && /^N\d+([.,]\d+)?$/.test(tokens[idx])) idx++;
    // Delays — números soltos ("00") ou decimais ("0,00", usado por saídas/NAC). Limitado
    // a no máximo os dois campos de delay (1º e 2º), pra nunca arriscar comer texto real.
    if (idx < tokens.length && /^\d+([.,]\d+)?$/.test(tokens[idx])) idx++;
    if (idx < tokens.length && /^\d+([.,]\d+)?$/.test(tokens[idx])) idx++;
    return tokens.slice(idx).join(' ').trim();
  }

  const rows = [];
  bands.forEach((band, i) => {
    // Monta o texto da linha (exceto o endereço) ordenando os itens da esquerda pra
    // direita (por x) — não pela posição estimada de cada palavra dentro de um item, já
    // que o pdfjs pode juntar várias colunas num único bloco de texto. Itens de uma mesma
    // coluna que quebraram em duas linhas visuais (ex.: "Setting" D acima / N abaixo, ou
    // o Texto que estoura pra uma segunda linha) compartilham x parecido e ficam juntos.
    const inBand = byBand[i]
      .filter((w) => w.text !== band.address)
      .sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const rowText = inBand.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();

    const typeMatch = rowText.match(LP1_TYPE_KEYWORD_RE);
    const name = (typeMatch ? rowText.slice(0, typeMatch.index) : '').trim();
    const tail = typeMatch ? rowText.slice(typeMatch.index + typeMatch[0].length) : '';
    const label = extractLp1Label(tail);

    const { panel, loop } = contextForY(band.y);
    if (!panel || !loop || !name) return;
    rows.push({ address: band.address, node: panel, loop: `LP ${loop}`, type: name, label, title: panel });
  });

  if (rows.length === 0) throw new Error('Não consegui extrair dispositivos desse relatório LP1. Confira se o PDF não está protegido ou escaneado como imagem.');
  return rows;
}

/* ---- Notifier (Honeywell): relatórios do VeriFire Tools em .xls/.xlsx/.csv ---- */

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

function parseCsvToRows(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    .filter((l) => l.length > 0)
    .map(parseCsvLine);
}

/** Lê um arquivo .xls/.xlsx (via SheetJS) ou .csv e devolve um array de arrays (linhas x colunas). */
function readFileAsRows(file) {
  return new Promise((resolve, reject) => {
    const isExcel = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler esse arquivo.'));
    if (isExcel) {
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
          resolve(rows);
        } catch (e) { reject(new Error('Não consegui interpretar esse arquivo Excel.')); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => {
        try { resolve(parseCsvToRows(String(reader.result))); }
        catch (e) { reject(e); }
      };
      reader.readAsText(file, 'utf-8');
    }
  });
}

function findColValue(rowObj, ...needles) {
  const entry = Object.entries(rowObj).find(([k]) => {
    const up = k.toUpperCase();
    return needles.every((n) => up.includes(n));
  });
  return entry ? entry[1] : '';
}

/** Interpreta uma planilha exportada do VeriFire Tools (aba de Módulos ou Detectores). */
function parseNotifierSheet(rowsRaw) {
  const rows = (rowsRaw || []).filter((r) => (r || []).some((c) => String(c ?? '').trim() !== ''));
  if (rows.length < 4) throw new Error('Não reconheci esse arquivo como um export do VeriFire Tools da Notifier.');

  let nodeLabel = '', nodeModel = '', nodeAddress = '0';
  for (const r of rows) {
    const cell = String(r[0] || '');
    const m = cell.match(/NodeDetails:\s*\(Address:\s*([^,]+),\s*Type:\s*([^,]+),[^)]*Label:\s*([^)]+)\)/i);
    if (m) { nodeAddress = m[1].trim(); nodeModel = m[2].trim(); nodeLabel = m[3].trim(); break; }
  }

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map((c) => String(c ?? '').replace(/\n/g, ' ').trim().toUpperCase()).join('|');
    if (joined.includes('DEVICE') && joined.includes('ADDR')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Não encontrei a tabela de dispositivos nesse arquivo (cabeçalho "Device ADDR" ausente).');

  const headers = rows[headerIdx].map((c) => String(c ?? '').replace(/\n/g, ' ').trim());
  const dataRows = rows.slice(headerIdx + 1).filter((r) => String(r[0] ?? '').trim() !== '');
  const objRows = dataRows.map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] !== undefined ? String(r[i]).trim() : ''; });
    return o;
  });

  const headerSet = headers.map((h) => h.toUpperCase());
  const reportKind = headerSet.some((h) => h.includes('MODULE') && h.includes('TYPE'))
    ? 'modules'
    : headerSet.some((h) => h.includes('DETECTOR')) ? 'detectors' : 'desconhecido';

  return { nodeLabel, nodeModel, nodeAddress, headers, rows: objRows, reportKind };
}

/** Converte uma planilha Notifier já interpretada para o formato genérico de linhas usado por buildImportEntities. */
function notifierSheetToGenericRows(parsedSheet, loopLabel) {
  return parsedSheet.rows.map((r) => {
    const address = findColValue(r, 'DEVICE', 'ADDR') || findColValue(r, 'ADDR');
    const installed = (findColValue(r, 'INSTL') || '').trim().toLowerCase();
    const typeCodeLabel = findColValue(r, 'TYPE', 'CODE') || findColValue(r, 'MODULE', 'TYPE') || findColValue(r, 'DETECTOR', 'TYPE');
    const flashScanType = findColValue(r, 'FLASHSCAN', 'TYPE');
    const customLabel = findColValue(r, 'CUSTOM', 'LABEL');
    const extendedLabel = findColValue(r, 'EXTENDED', 'LABEL');
    const label = [customLabel, extendedLabel].filter(Boolean).join(' ').trim();
    return {
      address,
      node: 'painel',
      loop: loopLabel,
      type: typeCodeLabel,
      flashScanType,
      label: label || address,
      title: parsedSheet.nodeLabel || 'Painel Notifier',
      installed: installed !== 'false',
    };
    // endereços com INSTL=False são posições vazias no laço (sem dispositivo físico) —
    // descartadas abaixo junto com linhas sem código de tipo.
  }).filter((r) => r.address && r.installed && r.type);
}

/* ---- Agrupamento genérico (comum a todas as marcas) ---- */

function buildImportEntities(rows, typeMap, brand, opts) {
  const { existingPanel = null, existingLoops = [], panelModel = '' } = opts || {};
  const panelsByNode = new Map();
  const loopsByKey = new Map();
  const deviceGroups = new Map();

  // Alguns módulos MINI/DUAL MONITOR da Notifier (ex.: acionadores duplos) aparecem no
  // report como DOIS endereços inteiros separados com a mesma etiqueta de local, em vez
  // de um endereço com sub-endereço (ex.: 25 e 27, ambos "CABINE PRIMER"). Pré-contamos
  // essas repetições por laço para tratar isso como módulo duplo (FDM-1) também.
  const miniDualLabelCounts = new Map();
  if (brand === 'notifier') {
    for (const r of rows) {
      const f = (r.flashScanType || '').trim().toUpperCase();
      if (f.includes('MONITOR') && (f.includes('MINI') || f.includes('DUAL'))) {
        const key = `${r.node}|${r.loop}|${(r.label || '').trim().toLowerCase()}`;
        miniDualLabelCounts.set(key, (miniDualLabelCounts.get(key) || 0) + 1);
      }
    }
  }

  for (const r of rows) {
    if (!panelsByNode.has(r.node)) {
      const cleanTitle = (r.title || '').replace(/^\d+\s+/, '').trim();
      panelsByNode.set(r.node, {
        key: r.node,
        name: cleanTitle || `Painel ${r.node}`,
        model: panelModel || '',
        existingId: existingPanel ? existingPanel.id : null,
      });
    }
    const loopKey = `${r.node}|${r.loop}`;
    if (!loopsByKey.has(loopKey)) {
      const loopNiceName = String(r.loop).replace(/^LP\s*(\d+)$/i, 'Laço $1');
      const matchExisting = existingLoops.find((l) => (l.name || '').trim().toLowerCase() === loopNiceName.trim().toLowerCase());
      loopsByKey.set(loopKey, { key: loopKey, node: r.node, name: loopNiceName, existingId: matchExisting ? matchExisting.id : null });
    }
    const [baseStr, subStr] = String(r.address).split('.');
    const groupKey = `${loopKey}|${baseStr}`;
    if (!deviceGroups.has(groupKey)) deviceGroups.set(groupKey, []);
    const labelKey = `${r.node}|${r.loop}|${(r.label || '').trim().toLowerCase()}`;
    const pairedByLabel = (miniDualLabelCounts.get(labelKey) || 0) > 1;
    deviceGroups.get(groupKey).push({ sub: subStr || '00', type: r.type, flashScanType: r.flashScanType, label: r.label, baseStr, loopKey, pairedByLabel });
  }

  const typeCounts = {};
  for (const r of rows) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;

  const devices = [];
  for (const items of deviceGroups.values()) {
    const base = items.find((i) => i.sub === '00') || items[0];
    const subs = items.filter((i) => i.sub !== '00');
    const hasSub = subs.length > 0;
    if (subs.length === 0) {
      const isDual = hasSub || base.pairedByLabel;
      const modelo = brand === 'notifier' ? resolveNotifierModel(base.flashScanType, isDual) : base.type;
      devices.push({ loopKey: base.loopKey, address: base.baseStr, type: typeMap[base.type] || 'entrada', modelo, label: base.label });
    } else {
      for (const s of subs) {
        const label = s.label && s.label !== base.label
          ? (base.label ? `${base.label} — ${s.label}` : s.label)
          : (base.label || s.label);
        const modelo = brand === 'notifier' ? resolveNotifierModel(s.flashScanType, true) : s.type;
        // Se o código foi mapeado como "entrada" genérico e o relatório mostra 2 sub-endereços de
        // verdade (ex.: DIMM, FDM-1), já marca como Entrada Duplo sozinho. Se o técnico escolheu outro
        // tipo manualmente pra esse código (saída, relé etc.), respeita a escolha dele.
        const chosenType = typeMap[s.type] || 'entrada';
        const finalType = chosenType === 'entrada' ? 'entrada_duplo' : chosenType;
        devices.push({ loopKey: s.loopKey, address: `${s.baseStr}.${s.sub}`, type: finalType, modelo, label, subEndereco: s.sub });
      }
    }
  }

  return {
    panels: [...panelsByNode.values()],
    loops: [...loopsByKey.values()],
    devices,
    typeCounts,
  };
}

/* Compara os dispositivos lidos do arquivo com o que já existe no banco (mesmo laço + mesmo
 * endereço = mesmo dispositivo físico). Usada pela tela de revisão antes de gravar, pra nunca
 * duplicar um dispositivo já cadastrado e pra avisar quando algo cadastrado não apareceu no
 * arquivo novo (possível remoção do painel). */
function computeImportReview(entities, data) {
  const loopIdByKey = {};
  entities.loops.forEach((l) => { loopIdByKey[l.key] = l.existingId || null; });

  const novos = [];
  const atualizados = [];
  const seenAddressesByLoop = new Map();

  entities.devices.forEach((d) => {
    const loopId = loopIdByKey[d.loopKey];
    if (loopId) {
      if (!seenAddressesByLoop.has(loopId)) seenAddressesByLoop.set(loopId, new Set());
      seenAddressesByLoop.get(loopId).add(d.address);
    }
    const existing = loopId ? (data.devices || []).find((ed) => ed.loopId === loopId && ed.address === d.address) : null;
    if (existing) atualizados.push({ ...d, existingId: existing.id });
    else novos.push(d);
  });

  const naoEncontrados = [];
  entities.loops.forEach((l) => {
    if (!l.existingId) return; // laço novo — não tem o que comparar
    const seen = seenAddressesByLoop.get(l.existingId) || new Set();
    (data.devices || []).filter((ed) => ed.loopId === l.existingId && !seen.has(ed.address)).forEach((ed) => {
      const linkedCount = (data.indicador || []).filter((r) => r.deviceId === ed.id).length;
      naoEncontrados.push({ ...ed, linkedCount });
    });
  });

  return { novos, atualizados, naoEncontrados };
}

const DEVICE_TYPES = [
  { value: 'fumaca', label: 'Detector de fumaça', icon: Cloud },
  { value: 'calor', label: 'Detector de calor', icon: Thermometer },
  { value: 'acionador', label: 'Acionador manual', icon: Hand },
  { value: 'saida', label: 'Módulo de saída', icon: LogOut },
  { value: 'entrada', label: 'Módulo de entrada', icon: LogIn },
  { value: 'entrada_duplo', label: 'Módulo de Entrada Duplo', icon: LogIn },
  { value: 'rele', label: 'Módulo de relé', icon: ToggleLeft },
];
const DEVICE_TYPE_MAP = Object.fromEntries(DEVICE_TYPES.map((t) => [t.value, t]));

const INTERVAL_OPTIONS = [
  { value: '1', label: 'Mensal' },
  { value: '2', label: 'Bimestral' },
  { value: '3', label: 'Trimestral' },
  { value: '6', label: 'Semestral' },
  { value: '12', label: 'Anual' },
];

const OPERATIONAL_STATUS_OPTIONS = [
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Reprovado', label: 'Reprovado' },
  { value: 'Não avaliado', label: 'Não avaliado' },
];
const APPEARANCE_OPTIONS = [
  { value: 'Ótimo', label: 'Ótimo' },
  { value: 'Bom', label: 'Bom' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Precisa Trocar', label: 'Precisa Trocar' },
];
const COMM_OPTIONS = [
  { value: 'Conforme', label: 'Conforme' },
  { value: 'Não conforme', label: 'Não conforme' },
];

const INDICATOR_STATUS_OPTIONS = ['Resolvido', 'Andamento', 'Aguardando'];
function indicatorStatusColor(status) {
  if (status === 'Resolvido') return 'var(--status-ok)';
  if (status === 'Andamento' || status === 'Intermitente') return 'var(--status-warn)';
  if (status === 'Aguardando') return 'var(--status-danger)';
  return 'var(--text-secondary)';
}

const NAV_ITEMS = [
  { key: 'atendimentos', label: 'Atendimentos (novo)', icon: ClipboardList },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'sdai', label: 'Sistemas de Detecção e Alarme', icon: Cpu },
  { key: 'combate', label: 'Sistemas de Combate', icon: Flame },
  { key: 'report', label: 'Inspeções', icon: ClipboardList },
  { key: 'indicador', label: 'Indicador', icon: Activity },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

// Admin vê tudo. Operador (técnico) e Visualizador (cliente) têm menu restrito —
// mesma lista no mobile e no desktop.
const NAV_KEYS_BY_ROLE = {
  admin: ['atendimentos', 'dashboard', 'sdai', 'combate', 'report', 'indicador', 'settings'],
  operador: ['dashboard', 'atendimentos', 'sdai', 'combate', 'report', 'indicador'],
  visualizador: ['dashboard', 'sdai', 'combate', 'report', 'indicador'],
};
function navItemsForRole(role) {
  const keys = NAV_KEYS_BY_ROLE[role] || NAV_KEYS_BY_ROLE.visualizador;
  return NAV_ITEMS.filter((i) => keys.includes(i.key));
}
// Os 4 destinos mais usados ficam fixos na barra inferior do mobile (padrão "app", tipo CifraClub);
// o resto (dentro do que o role pode ver) fica na aba "Mais".
function mobilePrimaryKeysForRole(role) {
  if (role === 'visualizador') return ['dashboard', 'indicador', 'sdai', 'report'];
  return ['atendimentos', 'dashboard', 'sdai', 'indicador'];
}
// Views internas que pertencem ao item de menu "Sistemas de Detecção e Alarme"
// (painéis/laço/dispositivo continua com a navegação própria por baixo, isso só decide
// quando o item do menu principal fica destacado e pra onde ele leva ao ser clicado).
const SDAI_VIEWS = ['panels', 'panelDetail', 'complementares'];

const emptyData = () => ({
  panels: [], loops: [], nacs: [], devices: [], pumpDevices: [], gasDetectors: [],
  bateriasPainel: [], fontesAuxiliares: [], combateConjuntos: [], combateSubitens: [], combateComponentes: [],
  combateBaterias: [], combateCilindros: [],
  maintenanceLog: [], inspectionLog: [], modelPhotos: {}, indicador: [], rvt: [],
});

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function addMonthsToDate(dateStr, months) {
  if (!dateStr || !months) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + Number(months));
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function computeStatus(nextDate) {
  if (!nextDate) return { key: 'none', label: 'Sem data programada', color: 'var(--status-none)' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = nextDate.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  const diffDays = Math.round((next - today) / 86400000);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { key: 'overdue', label: `Vencido há ${n} dia${n === 1 ? '' : 's'}`, color: 'var(--status-danger)' };
  }
  if (diffDays === 0) return { key: 'soon', label: 'Vence hoje', color: 'var(--status-warn)' };
  if (diffDays <= 30) return { key: 'soon', label: `Vence em ${diffDays} dia${diffDays === 1 ? '' : 's'}`, color: 'var(--status-warn)' };
  return { key: 'ok', label: 'Em dia', color: 'var(--status-ok)' };
}

function statusRank(key) {
  return { overdue: 0, soon: 1, none: 2, ok: 3 }[key] ?? 4;
}

function worstStatus(statuses) {
  if (statuses.length === 0) return computeStatus('');
  return [...statuses].sort((a, b) => statusRank(a.key) - statusRank(b.key))[0];
}

function labelFor(options, value) {
  const found = options.find((o) => o.value === value);
  return found ? found.label : '—';
}

function operStatusColor(v) {
  if (v === 'Aprovado') return 'var(--status-ok)';
  if (v === 'Não avaliado') return 'var(--status-warn)';
  if (v === 'Reprovado') return 'var(--status-danger)';
  return 'var(--status-none)';
}
function appearanceColor(v) {
  if (v === 'Ótimo' || v === 'Bom') return 'var(--status-ok)';
  if (v === 'Regular') return 'var(--status-warn)';
  if (v === 'Precisa Trocar') return 'var(--status-danger)';
  return 'var(--status-none)';
}
function commColor(v) {
  if (v === 'Conforme') return 'var(--status-ok)';
  if (v === 'Não conforme') return 'var(--status-danger)';
  return 'var(--status-none)';
}

function modelKey(m) { return (m || '').trim().toLowerCase(); }

function photoForModelo(data, modelo) {
  if (!modelo) return null;
  return data.modelPhotos?.[modelKey(modelo)]?.photo || null;
}

/* Resize + compress an uploaded image file into a small base64 JPEG */
function compressImageFile(file, maxDim = 480, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

/* Upload de múltiplas fotos (com atalho de câmera no celular), comprimindo cada uma. */
function MultiPhotoUpload({ photos, onChange, label = 'Fotos' }) {
  const [busy, setBusy] = useState(false);
  async function handleChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImageFile(f, 900, 0.7)));
      onChange([...(photos || []), ...compressed]);
    } catch (err) { console.error(err); }
    finally { setBusy(false); e.target.value = ''; }
  }
  function removeAt(idx) {
    onChange((photos || []).filter((_, i) => i !== idx));
  }
  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {(photos || []).map((p, i) => (
          <div key={i} className="relative flex-shrink-0">
            <img src={p} alt="" className="w-20 h-20 rounded-md object-cover" style={{ border: '1px solid var(--border)' }} />
            <button type="button" onClick={() => removeAt(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'var(--status-danger)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <X size={11} />
            </button>
          </div>
        ))}
        <label className="w-20 h-20 rounded-md flex flex-col items-center justify-center gap-1 cursor-pointer flex-shrink-0"
          style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border)' }}>
          <ImagePlus size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-[10px] text-center px-1" style={{ color: 'var(--text-secondary)' }}>{busy ? '...' : 'Adicionar'}</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleChange} disabled={busy} />
        </label>
      </div>
    </div>
  );
}

/* ---- Multi-tenant helpers (clients list + legacy single-tenant migration) ---- */

async function loadAndMigrateClients() {
  let list = [];
  try {
    const res = await window.storage.get(CLIENTS_KEY, false);
    if (res && res.value) list = JSON.parse(res.value);
  } catch (e) { /* nenhum cliente ainda */ }

  if (list.length === 0) {
    try {
      const legacy = await window.storage.get(LEGACY_KEY, false);
      if (legacy && legacy.value) {
        const legacyData = JSON.parse(legacy.value);
        const hasContent = (legacyData.panels || []).length || (legacyData.pumpDevices || []).length || (legacyData.gasDetectors || []).length;
        if (hasContent) {
          const id = uid();
          list = [{ id, name: 'Cliente 1', address: '', contact: '', branding: {}, user: null }];
          await window.storage.set(clientDataKey(id), JSON.stringify({ ...emptyData(), ...legacyData, modelPhotos: legacyData.modelPhotos || {} }), false);
          await window.storage.set(CLIENTS_KEY, JSON.stringify(list), false);
          try { await window.storage.delete(LEGACY_KEY, false); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* sem dados legados */ }
  }
  return list;
}

async function loadLastClientId() {
  try {
    const res = await window.storage.get(LAST_CLIENT_KEY, false);
    return res && res.value ? res.value : null;
  } catch (e) { return null; }
}
function saveLastClientId(id) {
  (async () => { try { await window.storage.set(LAST_CLIENT_KEY, id, false); } catch (e) { /* ignore */ } })();
}
function clearLastClientId() {
  (async () => { try { await window.storage.delete(LAST_CLIENT_KEY, false); } catch (e) { /* ignore */ } })();
}

function allTrackableItems(data) {
  const items = [];
  data.devices.forEach((d) => {
    const loop = data.loops.find((l) => l.id === d.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    items.push({
      id: d.id, category: 'devices', panelId: panel ? panel.id : null,
      title: DEVICE_TYPE_MAP[d.type]?.label || 'Dispositivo',
      address: d.address, modelo: d.modelo || '',
      meta: `${panel ? panel.name : '—'} · ${loop ? loop.name : '—'}${d.description ? ' · ' + d.description : ''}`,
      nextMaintenance: d.nextMaintenance, lastMaintenance: d.lastMaintenance,
      operationalStatus: d.operationalStatus || '', appearance: d.appearance || '',
      localComm: d.localComm || '', networkComm: d.networkComm || '',
      lastInspection: d.lastInspection || '', nextInspection: d.nextInspection || '',
      icon: DEVICE_TYPE_MAP[d.type]?.icon || Cpu,
      photo: photoForModelo(data, d.modelo),
      type: d.type, categoriaFuncional: d.categoriaFuncional || '',
    });
  });
  data.nacs.forEach((n) => {
    const panel = data.panels.find((p) => p.id === n.panelId);
    items.push({
      id: n.id, category: 'nacs', panelId: panel ? panel.id : null, title: n.name, address: null, modelo: '',
      meta: `${panel ? panel.name : '—'} · Circuito de saída${n.description ? ' · ' + n.description : ''}`,
      nextMaintenance: n.nextMaintenance, lastMaintenance: n.lastMaintenance,
      operationalStatus: n.operationalStatus || '', appearance: n.appearance || '',
      localComm: n.localComm || '', networkComm: n.networkComm || '',
      lastInspection: n.lastInspection || '', nextInspection: n.nextInspection || '',
      icon: Bell, photo: null,
    });
  });
  data.gasDetectors.forEach((g) => {
    items.push({
      id: g.id, category: 'gasDetectors', panelId: null, title: g.name, address: null, modelo: g.modelo || '',
      meta: g.location || 'Detector de gás fixo',
      nextMaintenance: g.nextMaintenance, lastMaintenance: g.lastMaintenance,
      operationalStatus: g.operationalStatus || '', appearance: g.appearance || '',
      localComm: g.localComm || '', networkComm: g.networkComm || '',
      lastInspection: g.lastInspection || '', nextInspection: g.nextInspection || '',
      icon: Wind, photo: photoForModelo(data, g.modelo),
    });
  });
  return items;
}

/** Baterias de Painel e Fontes Auxiliares (Dispositivos Complementares Tipo 2) — somam no
    bloco SDAI do Painel Geral, já que são parte do sistema de detecção (baterias dos painéis). */
function complementaresTrackableItems(data) {
  const items = [];
  (data.bateriasPainel || []).forEach((b) => {
    const panel = data.panels.find((p) => p.id === b.panelId);
    items.push({
      id: b.id, category: 'bateriaPainel', panelId: b.panelId || null,
      title: `Baterias — ${panel ? panel.name : 'Painel'}`, address: null, modelo: '',
      meta: 'Dispositivos Complementares',
      nextMaintenance: b.proximaInspecao, lastMaintenance: b.dataInspecao,
      nextInspection: b.proximaInspecao, lastInspection: b.dataInspecao,
      icon: Zap, photo: null,
    });
  });
  (data.fontesAuxiliares || []).forEach((f) => {
    items.push({
      id: f.id, category: 'fonteAuxiliar', panelId: null,
      title: f.nome || 'Fonte Auxiliar', address: null, modelo: '',
      meta: 'Dispositivos Complementares',
      nextMaintenance: f.proximaInspecao, lastMaintenance: f.dataInspecao,
      nextInspection: f.proximaInspecao, lastInspection: f.dataInspecao,
      icon: Zap, photo: null,
    });
  });
  return items;
}

/** Todo o universo de Combate a Incêndio (SPCI) — bloco separado do SDAI no Painel Geral,
    mesma lógica de separação já aplicada em formulário/Indicador/Visita. */
function combateTrackableItems(data) {
  const items = [];
  (data.combateSubitens || []).forEach((s) => {
    const conjunto = (data.combateConjuntos || []).find((c) => c.id === s.conjuntoId);
    if (!conjunto) return;
    const info = conjuntoSubitemInfo(conjunto.tipo, s.categoria);
    items.push({
      id: s.id, category: 'combateSubitem', panelId: conjunto.panelId || null,
      title: `${info?.label || s.categoria} — ${conjunto.etiqueta}`, address: null, modelo: '',
      meta: COMBATE_CONJUNTO_TIPOS[conjunto.tipo]?.label || conjunto.tipo,
      nextMaintenance: s.proximaInspecao, lastMaintenance: s.dataInspecao,
      nextInspection: s.proximaInspecao, lastInspection: s.dataInspecao,
      icon: Flame, photo: null,
    });
  });
  (data.combateComponentes || []).forEach((c) => {
    const info = COMBATE_COMPONENTE_TIPO_MAP[c.tipo];
    items.push({
      id: c.id, category: 'combateComponente', panelId: null,
      title: c.etiqueta || info?.label || 'Componente', address: null, modelo: '',
      meta: info?.label || 'Componente',
      nextMaintenance: c.proximaInspecao, lastMaintenance: c.dataInspecao,
      nextInspection: c.proximaInspecao, lastInspection: c.dataInspecao,
      icon: Flame, photo: null,
    });
  });
  (data.combateCilindros || []).forEach((c) => {
    const bateria = (data.combateBaterias || []).find((b) => b.id === c.bateriaId);
    items.push({
      id: c.id, category: 'combateCilindro', panelId: bateria?.panelId || null,
      title: `Cilindro ${c.identificacao}${bateria ? ' — ' + bateria.etiqueta : ''}`, address: null, modelo: '',
      meta: 'Bateria de Cilindros',
      nextMaintenance: c.proximaInspecao, lastMaintenance: c.dataInspecao,
      nextInspection: c.proximaInspecao, lastInspection: c.dataInspecao,
      icon: Flame, photo: null,
    });
  });
  return items;
}

function getItemPanelName(data, category, itemId) {
  if (category === 'devices') {
    const dItem = data.devices.find((x) => x.id === itemId);
    if (!dItem) return null;
    const loop = data.loops.find((l) => l.id === dItem.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    return panel ? panel.name : null;
  }
  if (category === 'nacs') {
    const n = data.nacs.find((x) => x.id === itemId);
    if (!n) return null;
    const panel = data.panels.find((p) => p.id === n.panelId);
    return panel ? panel.name : null;
  }
  return null;
}

function getItemLabelAndContext(data, category, itemId) {
  if (category === 'devices') {
    const dItem = data.devices.find((x) => x.id === itemId);
    if (!dItem) return { label: 'Dispositivo removido', context: '' };
    const loop = data.loops.find((l) => l.id === dItem.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    const typeLabel = DEVICE_TYPE_MAP[dItem.type]?.label || 'Dispositivo';
    return { label: `${typeLabel} · End. ${dItem.address}`, context: `${panel ? panel.name : '—'} · ${loop ? loop.name : '—'}` };
  }
  if (category === 'nacs') {
    const n = data.nacs.find((x) => x.id === itemId);
    if (!n) return { label: 'Circuito removido', context: '' };
    const panel = data.panels.find((p) => p.id === n.panelId);
    return { label: n.name, context: panel ? panel.name : '—' };
  }
  if (category === 'pumpDevices') {
    const p = data.pumpDevices.find((x) => x.id === itemId);
    if (!p) return { label: 'Dispositivo removido', context: 'Casa de Bombas' };
    return { label: p.name, context: `Casa de Bombas${p.type ? ' · ' + p.type : ''}` };
  }
  if (category === 'gasDetectors') {
    const g = data.gasDetectors.find((x) => x.id === itemId);
    if (!g) return { label: 'Detector removido', context: '' };
    return { label: g.name, context: g.location || 'Detector de gás fixo' };
  }
  return { label: '—', context: '' };
}

/* ------------------------------------------------------------------ */
/* Small presentational atoms                                         */
/* ------------------------------------------------------------------ */

function Led({ color, pulse }) {
  return <span className="led" data-pulse={pulse ? 'true' : 'false'} style={{ background: color, color }} />;
}

function StatusPill({ status }) {
  return (
    <span className="status-pill" style={{ color: status.color, borderColor: status.color }}>
      {status.label}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm mb-4 last:mb-0">
      <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {hint && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{hint}</span>}
    </label>
  );
}

const inputCls = 'field-input w-full rounded-md px-3 py-2 text-sm';
const dropdownItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px',
  fontSize: 13, textAlign: 'left', color: 'var(--text-primary)', background: 'transparent',
  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
};

function Button({ variant = 'secondary', className = '', children, ...props }) {
  const cls = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger' }[variant];
  return (
    <button className={`btn ${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

function IconButton({ title, onClick, danger, children }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`btn-icon ${danger ? 'btn-icon-danger' : ''}`}>
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-raised)' }}>
        <Icon size={22} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <div>
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
      {actionLabel && (
        <Button variant="primary" onClick={onAction} className="mt-2">
          <Plus size={16} /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop-in"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl overflow-y-auto modal-panel-in`}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <IconButton title="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* Sticky action row used by every form — keeps Save/Cancel reachable without
   scrolling all the way down, even on short mobile viewports. */
function FormActions({ children }) {
  return (
    <div className="flex justify-end gap-2 flex-wrap pt-3 mt-2 sticky bottom-0" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm}><Trash2 size={15} /> Excluir</Button>
      </div>
    </Modal>
  );
}

/* Generic card for any trackable equipment (device, NAC, pump item, gas detector) */
function TrackableCard({ icon: Icon, photo, address, title, meta, status, onInspect, onMaintain, onEdit, onDelete, selectable, selected, onToggleSelect, indicadorCount, warning }) {
  return (
    <div className="rounded-lg p-3.5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: selected ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
      <div className="flex items-start gap-3">
        {selectable ? (
          <label className="pt-1.5 cursor-pointer" title={selected ? 'Remover da seleção' : 'Selecionar'}>
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
          </label>
        ) : (
          <div className="pt-1"><Led color={status.color} pulse={status.key === 'overdue'} /></div>
        )}
        {photo && <img src={photo} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {address && <span className="mono-chip">{address}</span>}
            {!photo && Icon && <Icon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
            <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{title}</span>
          </div>
          {meta && <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{meta}</div>}
          <div className="text-xs mt-1.5 mono" style={{ color: 'var(--text-secondary)' }}>
            Última manutenção: {formatDateBR(status && status.lastMaintenance)}
          </div>
          <div className="text-xs mt-0.5 mono" style={{ color: 'var(--text-secondary)' }}>
            Última inspeção: {formatDateBR(status && status.lastInspection)}
          </div>
          {!!indicadorCount && (
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <Activity size={11} /> {indicadorCount} registro{indicadorCount === 1 ? '' : 's'} no Indicador
            </div>
          )}
          {status && status.operationalStatus === 'Reprovado' && (
            <div className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
              <AlertTriangle size={11} /> Não operante
            </div>
          )}
          {warning && (
            <div className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--status-warning, #d97706)' }}>
              <AlertTriangle size={11} /> {warning}
            </div>
          )}
        </div>
        <StatusPill status={status} />
      </div>
      {!selectable && (
        <div className="flex items-center justify-end gap-1 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          {onInspect && <IconButton title="Registrar inspeção" onClick={onInspect}><ClipboardCheck size={15} /></IconButton>}
          {onMaintain && <IconButton title="Registrar manutenção" onClick={onMaintain}><Wrench size={15} /></IconButton>}
          {onEdit && <IconButton title="Editar" onClick={onEdit}><Pencil size={15} /></IconButton>}
          {onDelete && <IconButton title="Excluir" danger onClick={onDelete}><Trash2 size={15} /></IconButton>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

function MaintenanceScheduleFields({ values, setValues }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Última manutenção">
          <input type="date" className={inputCls} value={values.lastMaintenance || ''}
            onChange={(e) => setValues((v) => ({ ...v, lastMaintenance: e.target.value }))} />
        </Field>
        <Field label="Próxima manutenção">
          <input type="date" className={inputCls} value={values.nextMaintenance || ''}
            onChange={(e) => setValues((v) => ({ ...v, nextMaintenance: e.target.value }))} />
        </Field>
      </div>
      <Field label="Periodicidade" hint="Usada para calcular a próxima data automaticamente ao registrar uma manutenção.">
        <select className={inputCls} value={values.intervalMonths || ''}
          onChange={(e) => setValues((v) => ({ ...v, intervalMonths: e.target.value }))}>
          <option value="">Não definida</option>
          {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    </>
  );
}

function PanelForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || { name: '', location: '', model: '', installDate: '', notes: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }}>
      <Field label="Identificação do painel *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Painel Central — Térreo" required /></Field>
      <Field label="Localização"><input className={inputCls} value={v.location}
        onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Ex.: Sala de segurança, Bloco A" /></Field>
      <Field label="Marca / Modelo"><input className={inputCls} value={v.model}
        onChange={(e) => setV({ ...v, model: e.target.value })} placeholder="Ex.: Intelbras / Notifier..." /></Field>
      <Field label="Data de instalação"><input type="date" className={inputCls} value={v.installDate}
        onChange={(e) => setV({ ...v, installDate: e.target.value })} /></Field>
      <Field label="Observações"><textarea rows={3} className={inputCls} value={v.notes}
        onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar painel</Button>
      </FormActions>
    </form>
  );
}

function LoopForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || { name: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }}>
      <Field label="Nome / número do laço *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Laço 1" required /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar laço</Button>
      </FormActions>
    </form>
  );
}

function NacForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || { name: '', description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }}>
      <Field label="Nome / número do circuito (NAC) *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: NAC 1 — Sirenes 1º pavimento" required /></Field>
      <Field label="Descrição"><input className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Dispositivos conectados: sirenes, strobos..." /></Field>
      <MaintenanceScheduleFields values={v} setValues={setV} />
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar circuito</Button>
      </FormActions>
    </form>
  );
}

/** Campos de Categoria funcional + Papel do sinal, reaproveitados para entrada simples e para
    cada sub-endereço da entrada duplo. */
function CategoriaFuncionalFields({ categoriaFuncional, papelSinal, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Categoria funcional">
        <select className={inputCls} value={categoriaFuncional || ''}
          onChange={(e) => onChange({ categoriaFuncional: e.target.value, papelSinal: '' })}>
          <option value="">Selecione...</option>
          {FUNCTIONAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      {CATEGORIAS_COM_PAPEL_SINAL.includes(categoriaFuncional) && (
        <Field label="Papel do sinal">
          <select className={inputCls} value={papelSinal || ''}
            onChange={(e) => onChange({ categoriaFuncional, papelSinal: e.target.value })}>
            <option value="">Selecione...</option>
            {PAPEL_SINAL_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}

function DeviceForm({ initial, isCreate, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || {
    address: '', type: 'fumaca', modelo: '', description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '',
    categoriaFuncional: '', papelSinal: '',
  });
  // Só usado ao CRIAR um Módulo de Entrada Duplo: gera 2 dispositivos (endereço.01 e endereço.02) de uma vez.
  const [dupla, setDupla] = useState({
    sub1: { categoriaFuncional: '', papelSinal: '' },
    sub2: { categoriaFuncional: '', papelSinal: '' },
  });

  const isEntradaSimples = v.type === 'entrada';
  const isEntradaDuploCreate = v.type === 'entrada_duplo' && isCreate;
  const isEntradaDuploEdit = v.type === 'entrada_duplo' && !isCreate;

  function handleSubmit(e) {
    e.preventDefault();
    if (!v.address.trim()) return;
    if (isEntradaDuploCreate) {
      const base = v.address.trim();
      const devices = [dupla.sub1, dupla.sub2].map((s, idx) => ({
        ...v, address: `${base}.0${idx + 1}`, subEndereco: `0${idx + 1}`,
        categoriaFuncional: s.categoriaFuncional, papelSinal: s.papelSinal,
      }));
      onSubmit(devices);
    } else {
      onSubmit(v);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={isEntradaDuploCreate ? 'Endereço base *' : 'Endereço *'}
          hint={isEntradaDuploCreate ? 'Os 2 sub-endereços serão gerados automaticamente (ex.: 60 → 60.01 e 60.02).' : undefined}>
          <input autoFocus className={`${inputCls} mono`} value={v.address}
            onChange={(e) => setV({ ...v, address: e.target.value })}
            placeholder={isEntradaDuploCreate ? '060' : '001'} required />
        </Field>
        <Field label="Tipo de dispositivo *">
          <select className={inputCls} value={v.type}
            onChange={(e) => setV({ ...v, type: e.target.value, categoriaFuncional: '', papelSinal: '' })}>
            {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      {isEntradaSimples && (
        <CategoriaFuncionalFields categoriaFuncional={v.categoriaFuncional} papelSinal={v.papelSinal}
          onChange={({ categoriaFuncional, papelSinal }) => setV({ ...v, categoriaFuncional, papelSinal })} />
      )}

      {isEntradaDuploEdit && (
        <CategoriaFuncionalFields categoriaFuncional={v.categoriaFuncional} papelSinal={v.papelSinal}
          onChange={({ categoriaFuncional, papelSinal }) => setV({ ...v, categoriaFuncional, papelSinal })} />
      )}

      {isEntradaDuploCreate && ['sub1', 'sub2'].map((key, idx) => (
        <div key={key} className="p-3 rounded-lg mb-3" style={{ border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Sub-endereço {v.address ? `${v.address}.0${idx + 1}` : `.0${idx + 1}`}
          </p>
          <CategoriaFuncionalFields categoriaFuncional={dupla[key].categoriaFuncional} papelSinal={dupla[key].papelSinal}
            onChange={(next) => setDupla({ ...dupla, [key]: next })} />
        </div>
      ))}

      <Field label="Modelo do equipamento" hint="Usado para agrupar uma mesma foto entre todos os dispositivos deste modelo.">
        <input className={inputCls} value={v.modelo || ''} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder="Ex.: ALO-V" />
      </Field>
      <Field label="Descrição / localização"><input className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Corredor 2º andar, próx. sala 204" /></Field>
      <MaintenanceScheduleFields values={v} setValues={setV} />
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar dispositivo{isEntradaDuploCreate ? 's' : ''}</Button>
      </FormActions>
    </form>
  );
}

const RVT_CATEGORY_OPTIONS = [
  { value: 'devices', label: 'Dispositivo do painel' },
  { value: 'nacs', label: 'Circuito de saída (NAC)' },
  { value: 'pumpDevices', label: 'Casa de Bombas' },
  { value: 'gasDetectors', label: 'Detector de Gás' },
  { value: 'outro', label: 'Outro / não listado' },
];

function IndicadorForm({ initial, data, areaSuggestions, onSubmit, onCancel }) {
  const initialCategoria = initial?.deviceId && initial?.categoria ? initial.categoria : (initial ? 'outro' : 'devices');
  const initialDevice = initialCategoria === 'devices' && initial?.deviceId ? data.devices.find((d) => d.id === initial.deviceId) : null;
  const initialLoop = initialDevice ? data.loops.find((l) => l.id === initialDevice.loopId) : null;

  const [categoria, setCategoria] = useState(initialCategoria);
  const [panelId, setPanelId] = useState(initialLoop?.panelId || '');
  const [loopId, setLoopId] = useState(initialDevice?.loopId || '');
  const [deviceId, setDeviceId] = useState(initialCategoria === 'devices' ? (initial?.deviceId || '') : '');
  const [simpleId, setSimpleId] = useState(initialCategoria !== 'devices' && initialCategoria !== 'outro' ? (initial?.deviceId || '') : '');
  const [deviceQuery, setDeviceQuery] = useState('');

  const [v, setV] = useState(initial || {
    etiqueta: '', endereco: '', laco: '', equipamento: '', painel: '', area: '', falha: '', descritivo: '',
    status: 'Andamento', explanacao: '', dataDiagnostico: '', dataIntervencao1: '', dataIntervencao2: '',
    dataIntervencao3: '', dataIntervencao4: '', dataSolucao: '', solucao: '', fotos: [],
  });

  const panelLoops = data.loops.filter((l) => l.panelId === panelId);
  const loopDevices = data.devices.filter((d) => d.loopId === loopId).sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }));
  const deviceQ = deviceQuery.trim().toLowerCase();
  const filteredLoopDevices = deviceQ
    ? loopDevices.filter((d) => d.id === deviceId
        || `${d.address} ${DEVICE_TYPE_MAP[d.type]?.label || ''} ${d.modelo || ''} ${d.description || ''}`.toLowerCase().includes(deviceQ))
    : loopDevices;

  function handleCategoriaChange(val) {
    setCategoria(val);
    setPanelId(''); setLoopId(''); setDeviceId(''); setSimpleId(''); setDeviceQuery('');
  }

  function handleSelectDevice(id) {
    setDeviceId(id);
    const device = data.devices.find((d) => d.id === id);
    if (!device) return;
    const loop = data.loops.find((l) => l.id === device.loopId);
    const panel = data.panels.find((p) => p.id === loop?.panelId);
    const tipoLabel = DEVICE_TYPE_MAP[device.type]?.label || 'Dispositivo';
    setV((prev) => ({
      ...prev,
      etiqueta: device.description || `${tipoLabel} ${device.address}`,
      endereco: device.address, laco: loop?.name || '', painel: panel?.name || '',
      equipamento: tipoLabel + (device.modelo ? ` (${device.modelo})` : ''),
    }));
  }

  function handleSelectSimple(id) {
    setSimpleId(id);
    if (categoria === 'nacs') {
      const nac = data.nacs.find((n) => n.id === id);
      if (!nac) return;
      const panel = data.panels.find((p) => p.id === nac.panelId);
      setV((prev) => ({ ...prev, etiqueta: nac.name, endereco: '', laco: '', painel: panel?.name || '', equipamento: 'Circuito NAC' }));
    } else if (categoria === 'pumpDevices') {
      const it = data.pumpDevices.find((p) => p.id === id);
      if (!it) return;
      setV((prev) => ({ ...prev, etiqueta: it.name, endereco: '', laco: '', painel: '', equipamento: it.type || 'Casa de Bombas' }));
    } else if (categoria === 'gasDetectors') {
      const it = data.gasDetectors.find((g) => g.id === id);
      if (!it) return;
      setV((prev) => ({ ...prev, etiqueta: it.name, endereco: '', laco: '', painel: '', equipamento: 'Detector de Gás' }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!(v.etiqueta.trim() || v.falha.trim())) return;
    const deviceLink = categoria === 'devices' ? deviceId : (categoria !== 'outro' ? simpleId : '');
    onSubmit({ ...v, deviceId: deviceLink || '', categoria: deviceLink ? categoria : '' });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Vincular a dispositivo cadastrado?">
        <select className={inputCls} value={categoria} onChange={(e) => handleCategoriaChange(e.target.value)}>
          {RVT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      {categoria === 'devices' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <Field label="Painel">
            <select className={inputCls} value={panelId} onChange={(e) => { setPanelId(e.target.value); setLoopId(''); setDeviceId(''); setDeviceQuery(''); }}>
              <option value="">Selecione…</option>
              {data.panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Laço">
            <select className={inputCls} value={loopId} onChange={(e) => { setLoopId(e.target.value); setDeviceId(''); setDeviceQuery(''); }} disabled={!panelId}>
              <option value="">Selecione…</option>
              {panelLoops.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label={`Dispositivo (endereço)${loopId && loopDevices.length > 8 ? ` — ${filteredLoopDevices.length} de ${loopDevices.length}` : ''}`}>
            {loopId && loopDevices.length > 8 && (
              <div className="relative mb-1.5">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                <input className={`${inputCls} pl-8`} placeholder="Buscar por endereço, tipo ou descrição..."
                  value={deviceQuery} onChange={(e) => setDeviceQuery(e.target.value)} />
              </div>
            )}
            <select className={inputCls} value={deviceId} onChange={(e) => handleSelectDevice(e.target.value)} disabled={!loopId}>
              <option value="">Selecione…</option>
              {filteredLoopDevices.map((d) => (
                <option key={d.id} value={d.id}>{d.address} — {DEVICE_TYPE_MAP[d.type]?.label}{d.description ? ` (${d.description})` : ''}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {categoria === 'nacs' && (
        <Field label="Circuito (NAC)">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.nacs.map((n) => {
              const panel = data.panels.find((p) => p.id === n.panelId);
              return <option key={n.id} value={n.id}>{n.name}{panel ? ` — ${panel.name}` : ''}</option>;
            })}
          </select>
        </Field>
      )}
      {categoria === 'pumpDevices' && (
        <Field label="Equipamento da Casa de Bombas">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.pumpDevices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      {categoria === 'gasDetectors' && (
        <Field label="Detector de Gás">
          <select className={inputCls} value={simpleId} onChange={(e) => handleSelectSimple(e.target.value)}>
            <option value="">Selecione…</option>
            {data.gasDetectors.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      )}

      <Field label="Etiqueta / Localização *"><input className={inputCls} value={v.etiqueta}
        onChange={(e) => setV({ ...v, etiqueta: e.target.value })} placeholder="Ex.: SECURITY OFFICE CORREDOR SL REUNIÃO" required /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Endereço"><input className={`${inputCls} mono`} value={v.endereco}
          onChange={(e) => setV({ ...v, endereco: e.target.value })} placeholder="017" /></Field>
        <Field label="Laço"><input className={inputCls} value={v.laco}
          onChange={(e) => setV({ ...v, laco: e.target.value })} placeholder="1" /></Field>
        <Field label="Painel"><input className={inputCls} value={v.painel}
          onChange={(e) => setV({ ...v, painel: e.target.value })} placeholder="1" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Equipamento"><input className={inputCls} value={v.equipamento}
          onChange={(e) => setV({ ...v, equipamento: e.target.value })} placeholder="Ex.: Sensor de fumaça" /></Field>
        <Field label="Área">
          <input className={inputCls} list="indicador-area-list" value={v.area}
            onChange={(e) => setV({ ...v, area: e.target.value })} placeholder="Ex.: BODY" />
          <datalist id="indicador-area-list">{areaSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
      </div>
      <Field label="Falha"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Ex.: Dispositivo Desconectado" /></Field>
      <Field label="Descritivo"><textarea rows={2} className={inputCls} value={v.descritivo}
        onChange={(e) => setV({ ...v, descritivo: e.target.value })} /></Field>
      <Field label="Status">
        <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
          <option value="Aguardando">Aguardando</option>
          <option value="Andamento">Andamento</option>
          <option value="Resolvido">Resolvido</option>
        </select>
      </Field>
      <Field label="Data"><input type="date" className={inputCls} value={v.dataDiagnostico}
        onChange={(e) => setV({ ...v, dataDiagnostico: e.target.value })} /></Field>
      <div className="mb-4">
        <MultiPhotoUpload photos={v.fotos} onChange={(fotos) => setV({ ...v, fotos })} />
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar registro</Button>
      </FormActions>
    </form>
  );
}

function BulkInspectionForm({ count, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: '', appearance: '', localComm: '', networkComm: '',
    lastInspection: todayISO(), nextInspection: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Este registro será aplicado aos <strong>{count} dispositivos selecionados</strong>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inputCls} value={v.operationalStatus} onChange={(e) => setV({ ...v, operationalStatus: e.target.value })}>
            <option value="">Não avaliado</option>
            {OPERATIONAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Aparência / visual">
          <select className={inputCls} value={v.appearance} onChange={(e) => setV({ ...v, appearance: e.target.value })}>
            <option value="">Não avaliado</option>
            {APPEARANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação local">
          <select className={inputCls} value={v.localComm} onChange={(e) => setV({ ...v, localComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação em rede">
          <select className={inputCls} value={v.networkComm} onChange={(e) => setV({ ...v, networkComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Última inspeção"><input type="date" className={inputCls} value={v.lastInspection}
          onChange={(e) => setV({ ...v, lastInspection: e.target.value })} /></Field>
        <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.nextInspection}
          onChange={(e) => setV({ ...v, nextInspection: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar em {count} dispositivo(s)</Button>
      </FormActions>
    </form>
  );
}

function resolveIndicadorFields(data, category, item) {
  if (category === 'devices') {
    const loop = data.loops.find((l) => l.id === item.loopId);
    const panel = data.panels.find((p) => p.id === loop?.panelId);
    const tipoLabel = DEVICE_TYPE_MAP[item.type]?.label || 'Dispositivo';
    return {
      etiqueta: item.description || `${tipoLabel} ${item.address}`,
      endereco: item.address, laco: loop?.name || '', painel: panel?.name || '',
      equipamento: tipoLabel + (item.modelo ? ` (${item.modelo})` : ''), area: '',
    };
  }
  if (category === 'nacs') {
    const panel = data.panels.find((p) => p.id === item.panelId);
    return { etiqueta: item.name, endereco: '', laco: '', painel: panel?.name || '', equipamento: 'Circuito NAC', area: '' };
  }
  if (category === 'pumpDevices') {
    return { etiqueta: item.name, endereco: '', laco: '', painel: '', equipamento: item.type || 'Casa de Bombas', area: '' };
  }
  if (category === 'gasDetectors') {
    return { etiqueta: item.name, endereco: '', laco: '', painel: '', equipamento: 'Detector de Gás', area: '' };
  }
  return { etiqueta: item.name || '', endereco: '', laco: '', painel: '', equipamento: '', area: '' };
}

function BulkMaintenanceForm({ count, onSubmit, onCancel }) {
  const [v, setV] = useState({ date: todayISO(), technician: '', description: '', tipo: 'preventiva', intervalMonths: '', nextDate: '' });
  function handleIntervalChange(months) {
    setV((prev) => ({ ...prev, intervalMonths: months, nextDate: addMonthsToDate(prev.date, months) || prev.nextDate }));
  }
  function handleDateChange(date) {
    setV((prev) => ({ ...prev, date, nextDate: prev.intervalMonths ? addMonthsToDate(date, prev.intervalMonths) : prev.nextDate }));
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Este registro será aplicado aos <strong>{count} dispositivos selecionados</strong>, com a mesma data, técnico e observações.
      </p>
      <Field label="Tipo de manutenção">
        <select className={inputCls} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
          <option value="preventiva">Preventiva</option>
          <option value="corretiva">Corretiva</option>
        </select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Data da manutenção *"><input type="date" className={inputCls} value={v.date} required
          onChange={(e) => handleDateChange(e.target.value)} /></Field>
        <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
          onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      </div>
      <Field label="Observações / serviço realizado"><textarea rows={3} className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Limpeza preventiva, troca de bateria..." /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Periodicidade">
          <select className={inputCls} value={v.intervalMonths} onChange={(e) => handleIntervalChange(e.target.value)}>
            <option value="">Definir manualmente</option>
            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Próxima manutenção"><input type="date" className={inputCls} value={v.nextDate}
          onChange={(e) => setV({ ...v, nextDate: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar em {count} dispositivo(s)</Button>
      </FormActions>
    </form>
  );
}

function MaintenanceForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    date: todayISO(), technician: '', description: '', tipo: 'preventiva',
    intervalMonths: item.intervalMonths || '', nextDate: item.nextMaintenance || '',
    falha: '', status: 'Resolvido', explanacao: '', solucao: '',
  });
  function handleIntervalChange(months) {
    setV((prev) => ({ ...prev, intervalMonths: months, nextDate: addMonthsToDate(prev.date, months) || prev.nextDate }));
  }
  function handleDateChange(date) {
    setV((prev) => ({ ...prev, date, nextDate: prev.intervalMonths ? addMonthsToDate(date, prev.intervalMonths) : prev.nextDate }));
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <Field label="Tipo de manutenção">
        <select className={inputCls} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
          <option value="preventiva">Preventiva</option>
          <option value="corretiva">Corretiva</option>
        </select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Data da manutenção *"><input type="date" className={inputCls} value={v.date} required
          onChange={(e) => handleDateChange(e.target.value)} /></Field>
        <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
          onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      </div>
      <Field label="Observações / serviço realizado"><textarea rows={3} className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Teste funcional, limpeza, troca de bateria..." /></Field>
      <Field label="Falha encontrada (opcional)"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Deixe em branco se não houve problema" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Status">
          <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            {INDICATOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Periodicidade">
          <select className={inputCls} value={v.intervalMonths} onChange={(e) => handleIntervalChange(e.target.value)}>
            <option value="">Definir manualmente</option>
            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Próxima manutenção"><input type="date" className={inputCls} value={v.nextDate}
        onChange={(e) => setV({ ...v, nextDate: e.target.value })} /></Field>
      <Field label="Explanação (opcional)"><textarea rows={2} className={inputCls} value={v.explanacao}
        onChange={(e) => setV({ ...v, explanacao: e.target.value })} /></Field>
      <Field label="Solução (opcional)"><textarea rows={2} className={inputCls} value={v.solucao}
        onChange={(e) => setV({ ...v, solucao: e.target.value })} /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar</Button>
      </FormActions>
    </form>
  );
}

function InspectionForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: item.operationalStatus || '',
    appearance: item.appearance || '',
    localComm: item.localComm || '',
    networkComm: item.networkComm || '',
    lastInspection: item.lastInspection || todayISO(),
    nextInspection: item.nextInspection || '',
    technician: '', observacoes: '', falha: '',
  });
  const metodo = getMetodoTeste(item);
  const categoriaLabel = FUNCTIONAL_CATEGORY_MAP[item.categoriaFuncional] || '';
  const papelLabel = PAPEL_SINAL_MAP[item.papelSinal] || '';
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      {(categoriaLabel || metodo) && (
        <div className="mb-3 p-2 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {categoriaLabel && <div>Categoria: <strong style={{ color: 'var(--text-primary)' }}>{categoriaLabel}</strong>{papelLabel && ` · Papel do sinal: ${papelLabel}`}</div>}
          {metodo && <div>Método de teste: <strong style={{ color: 'var(--text-primary)' }}>{metodo}</strong></div>}
        </div>
      )}
      <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
        onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Resultado do teste">
          <select className={inputCls} value={v.operationalStatus} onChange={(e) => setV({ ...v, operationalStatus: e.target.value })}>
            <option value="">Não avaliado</option>
            {OPERATIONAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Aparência / visual">
          <select className={inputCls} value={v.appearance} onChange={(e) => setV({ ...v, appearance: e.target.value })}>
            <option value="">Não avaliado</option>
            {APPEARANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação local">
          <select className={inputCls} value={v.localComm} onChange={(e) => setV({ ...v, localComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Comunicação em rede">
          <select className={inputCls} value={v.networkComm} onChange={(e) => setV({ ...v, networkComm: e.target.value })}>
            <option value="">Não avaliado</option>
            {COMM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Última inspeção"><input type="date" className={inputCls} value={v.lastInspection}
          onChange={(e) => setV({ ...v, lastInspection: e.target.value })} /></Field>
        <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.nextInspection}
          onChange={(e) => setV({ ...v, nextInspection: e.target.value })} /></Field>
      </div>
      <Field label="Observações (opcional)"><input className={inputCls} value={v.observacoes}
        onChange={(e) => setV({ ...v, observacoes: e.target.value })} placeholder="Observações gerais da inspeção" /></Field>
      <Field label="Falha (opcional)"><input className={inputCls} value={v.falha}
        onChange={(e) => setV({ ...v, falha: e.target.value })} placeholder="Deixe em branco se não houve problema — gera corretiva automática" /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Salvar inspeção</Button>
      </FormActions>
    </form>
  );
}

function ClientForm({ initial, onSubmit, onCancel, embedded }) {
  const [v, setV] = useState(initial ? { name: initial.name, address: initial.address || '', contact: initial.contact || '' } : { name: '', address: '', contact: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }} className={embedded ? 'max-w-lg' : ''}>
      <Field label="Nome do cliente *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Condomínio Alfa" required /></Field>
      <Field label="Endereço"><input className={inputCls} value={v.address}
        onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
      <Field label="Contato"><input className={inputCls} value={v.contact}
        onChange={(e) => setV({ ...v, contact: e.target.value })} placeholder="Telefone ou e-mail" /></Field>
      <FormActions>
        {!embedded && <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>}
        <Button variant="primary" type="submit">{embedded ? 'Salvar alterações' : 'Salvar cliente'}</Button>
      </FormActions>
    </form>
  );
}

function UserForm({ client, onSave, onRemove }) {
  const existing = client.user;
  const [v, setV] = useState(existing || { fullName: '', email: '', phone: '', username: '', password: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.fullName.trim() && v.username.trim() && v.password.trim()) onSave(v); }} className="max-w-lg flex flex-col">
      <Field label="Nome completo *"><input autoFocus className={inputCls} value={v.fullName}
        onChange={(e) => setV({ ...v, fullName: e.target.value })} required /></Field>
      <Field label="E-mail"><input type="email" className={inputCls} value={v.email}
        onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label="Telefone"><input className={inputCls} value={v.phone}
        onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Usuário (login) *"><input className={inputCls} value={v.username}
          onChange={(e) => setV({ ...v, username: e.target.value })} required /></Field>
        <Field label="Senha *"><input type="password" className={inputCls} value={v.password}
          onChange={(e) => setV({ ...v, password: e.target.value })} required /></Field>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Este acesso fica salvo apenas neste navegador e serve para identificar quem usa o sistema deste cliente —
        não é uma autenticação segura de servidor.
      </p>
      <div className="flex items-center justify-between gap-2">
        {existing ? <Button variant="danger" type="button" onClick={onRemove}><Trash2 size={14} /> Remover usuário</Button> : <span />}
        <Button variant="primary" type="submit">{existing ? 'Atualizar usuário' : 'Criar usuário'}</Button>
      </div>
    </form>
  );
}

function ImageUploadRow({ label, image, onUpload, onRemove, imgClassName }) {
  const [busy, setBusy] = useState(false);
  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { onUpload(await compressImageFile(file, 480, 0.75)); }
    catch (err) { console.error(err); }
    finally { setBusy(false); e.target.value = ''; }
  }
  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {image
          ? <img src={image} alt="" className={imgClassName} />
          : <div className={imgClassName} style={{ background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={18} style={{ color: 'var(--text-secondary)' }} /></div>}
        <label className="btn btn-secondary cursor-pointer">
          <Upload size={14} /> {busy ? 'Processando...' : 'Enviar imagem'}
          <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={busy} />
        </label>
        {image && <button type="button" onClick={onRemove} className="text-xs" style={{ color: 'var(--status-danger)' }}>Remover</button>}
      </div>
    </div>
  );
}

function BrandingForm({ client, onSave }) {
  const [logo, setLogo] = useState(client.branding?.logoData || null);
  const [coverColor, setCoverColor] = useState(client.branding?.coverColor || '#2A2F32');
  const [coverImage, setCoverImage] = useState(client.branding?.coverImageData || null);
  const [bgColor, setBgColor] = useState(client.branding?.bgColor || '#14171A');

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <ImageUploadRow label="Logo do cliente" image={logo} onUpload={setLogo} onRemove={() => setLogo(null)}
        imgClassName="w-16 h-16 rounded-lg object-cover" />

      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Cor da capa (cartão do cliente)</p>
        <div className="flex items-center gap-3">
          <input type="color" value={coverColor} onChange={(e) => setCoverColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)' }} />
          <span className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>{coverColor}</span>
        </div>
      </div>

      <ImageUploadRow label="Imagem de capa (opcional, substitui a cor)" image={coverImage} onUpload={setCoverImage} onRemove={() => setCoverImage(null)}
        imgClassName="w-24 h-12 rounded-lg object-cover" />

      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Cor de fundo do sistema</p>
        <div className="flex items-center gap-3">
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)' }} />
          <span className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>{bgColor}</span>
        </div>
      </div>

      <div>
        <Button variant="primary" onClick={() => onSave({ logoData: logo, coverColor, coverImageData: coverImage, bgColor })}>Salvar marca</Button>
      </div>
    </div>
  );
}

function ModelLibraryManager({ data, onSave, onRemove }) {
  const usageMap = {};
  function track(modelo) {
    if (!modelo) return;
    const key = modelKey(modelo);
    if (!usageMap[key]) usageMap[key] = { label: modelo, count: 0 };
    usageMap[key].count += 1;
  }
  data.devices.forEach((d) => track(d.modelo));
  data.pumpDevices.forEach((p) => track(p.modelo));
  data.gasDetectors.forEach((g) => track(g.modelo));
  Object.entries(data.modelPhotos || {}).forEach(([key, entry]) => { if (!usageMap[key]) usageMap[key] = { label: entry.label, count: 0 }; });

  const rows = Object.entries(usageMap).map(([key, info]) => ({ key, label: info.label, count: info.count, photo: data.modelPhotos?.[key]?.photo || null }));
  rows.sort((a, b) => a.label.localeCompare(b.label));

  const [newModel, setNewModel] = useState('');

  async function handleUpload(key, label, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onSave(key, label, await compressImageFile(file, 400, 0.75)); }
    catch (err) { console.error(err); }
    finally { e.target.value = ''; }
  }

  function handleAddModel(e) {
    e.preventDefault();
    if (!newModel.trim()) return;
    onSave(modelKey(newModel), newModel.trim(), null);
    setNewModel('');
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Associe uma foto a cada modelo de equipamento. A foto vale para todos os dispositivos que usam esse modelo —
        por exemplo, uma única foto para todos os detectores "ALO-V".
      </p>
      <form onSubmit={handleAddModel} className="flex gap-2 flex-wrap">
        <input className={inputCls} placeholder="Nome do modelo (ex.: ALO-V)" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
        <Button variant="secondary" type="submit"><Plus size={15} /> Registrar</Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={ImagePlus} title="Nenhum modelo encontrado" description="Cadastre dispositivos preenchendo o campo de modelo, ou registre um modelo manualmente acima." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.key} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {row.photo
                ? <img src={row.photo} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-raised)' }}><ImagePlus size={18} style={{ color: 'var(--text-secondary)' }} /></div>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.count} dispositivo{row.count === 1 ? '' : 's'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="btn btn-secondary cursor-pointer" style={{ padding: '4px 10px', fontSize: '12px' }}>
                    <Upload size={12} /> Foto
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(row.key, row.label, e)} />
                  </label>
                  {row.photo && <button type="button" onClick={() => onRemove(row.key)} className="text-xs" style={{ color: 'var(--status-danger)' }}>Remover foto</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Client selection / authentication                                  */
/* ------------------------------------------------------------------ */

function LoginGate({ client, onSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (username === client.user.username && password === client.user.password) onSuccess();
    else setError('Usuário ou senha incorretos.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <PageStyles />
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col items-center gap-2 mb-3">
          {client.branding?.logoData
            ? <img src={client.branding.logoData} alt="" className="w-14 h-14 rounded-lg object-cover" />
            : <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-raised)' }}><KeyRound size={20} style={{ color: 'var(--text-secondary)' }} /></div>}
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{client.name}</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Entre com o usuário deste cliente</p>
        </div>
        <Field label="Usuário"><input className={inputCls} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required /></Field>
        <Field label="Senha"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {error && <p className="text-xs mb-3" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        <Button variant="primary" type="submit" className="mt-1">Entrar</Button>
        <button type="button" onClick={onBack} className="text-xs mt-3 text-center" style={{ color: 'var(--text-secondary)' }}>â† Trocar cliente</button>
      </form>
    </div>
  );
}

function ClientCard({ client, onSelect, onEdit, onDelete }) {
  const logo = client.branding?.logoData;
  const cover = client.branding?.coverImageData;
  const coverColor = client.branding?.coverColor || 'var(--surface-raised)';
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={onSelect} className="text-left flex-1 flex flex-col">
        <div className="w-full aspect-[4/3] flex items-center justify-center p-4"
          style={{ background: logo ? '#FFFFFF' : (cover ? `url(${cover}) center/cover` : coverColor) }}>
          {logo
            ? <img src={logo} alt="" className="max-w-full max-h-full object-contain" />
            : !cover && <Building2 size={32} style={{ color: 'var(--text-secondary)' }} />}
        </div>
        <div className="p-3.5">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
          {client.address && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{client.address}</p>}
        </div>
      </button>
      <div className="flex items-center justify-between gap-1 px-3.5 pb-3">
        {client.user ? <span className="mono-chip">usuário configurado</span> : <span />}
        {(onEdit || onDelete) && (
          <div className="flex gap-1">
            {onEdit && <IconButton title="Editar cliente" onClick={onEdit}><Pencil size={14} /></IconButton>}
            {onDelete && <IconButton title="Excluir cliente" danger onClick={onDelete}><Trash2 size={14} /></IconButton>}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientSelector({ clients, canManage, onSelect, onCreate, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <PageStyles />
      <img src="/maj-watermark.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '300px', maxWidth: '38vw', opacity: 0.045, zIndex: 0,
          imageRendering: '-webkit-optimize-contrast',
        }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6 relative" style={{ zIndex: 1, minHeight: '100vh' }}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
          <BrandLogo boxSize={40} size={20} />
          <div>
            <h1 className="font-display font-semibold text-lg sm:text-2xl" style={{ color: 'var(--text-primary)' }}>Centro de Controle de Manutenção</h1>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>Selecione um cliente para continuar</p>
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setModal({ mode: 'create' })}><Plus size={16} /> Novo cliente</Button>
          </div>
        )}

        {clients.length === 0 ? (
          canManage ? (
            <EmptyState icon={Building2} title="Nenhum cliente cadastrado"
              description="Cadastre o primeiro cliente para começar a controlar as manutenções do sistema de PCI."
              actionLabel="Cadastrar cliente" onAction={() => setModal({ mode: 'create' })} />
          ) : (
            <EmptyState icon={Building2} title="Nenhum cliente vinculado à sua conta"
              description="Peça ao administrador para vincular seu usuário a um cliente." />
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} onSelect={() => onSelect(c.id)}
                onEdit={canManage ? () => setModal({ mode: 'edit', client: c }) : undefined}
                onDelete={canManage ? () => setConfirm(c) : undefined} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-8 text-center">
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Desenvolvido por M.A.J Eletro Eletrônica LTDA — CNPJ: 45.893.915/0001-01<br />
            Sistema de uso exclusivo e restrito a usuários autorizados.
          </p>
        </div>
      </div>

      {modal && canManage && (
        <Modal title={modal.mode === 'create' ? 'Novo cliente' : 'Editar cliente'} onClose={() => setModal(null)}>
          <ClientForm initial={modal.client} onSubmit={(v) => {
            if (modal.mode === 'create') onCreate(v); else onUpdate(modal.client.id, v);
            setModal(null);
          }} onCancel={() => setModal(null)} />
          {modal.mode === 'edit' && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>ID do cliente (use para vincular operadores no Supabase)</p>
              <div className="flex items-center gap-2">
                <code className="text-xs px-2 py-1 rounded-md flex-1 truncate" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)' }}>{modal.client.id}</code>
                <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(modal.client.id)}>Copiar</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {confirm && canManage && (
        <ConfirmModal title="Excluir cliente"
          message={`Excluir "${confirm.name}"? Todos os painéis, dispositivos e o histórico deste cliente serão removidos permanentemente.`}
          onConfirm={() => { onDelete(confirm.id); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace (per-client application)                                 */
/* ------------------------------------------------------------------ */

function Workspace({ client, onUpdateClient, onSwitchClient }) {
  const { role, memberships, isOwner, signOut } = useAuth();
  const [previewRole, setPreviewRole] = useState(null);
  // Cargo efetivo: dono da plataforma sempre admin; senao usa o cargo
  // especifico desse cliente (memberships) quando existir, senao cai pro cargo global (profiles).
  const membershipRole = (memberships || []).find((m) => m.client_id === client.id)?.role;
  const effectiveRole = isOwner ? 'admin' : (membershipRole || role);
  const navRole = isOwner && previewRole ? previewRole : effectiveRole;
  const roleNavItems = navItemsForRole(navRole);
  const mobilePrimaryKeys = mobilePrimaryKeysForRole(navRole);
  const mobilePrimaryNavItems = roleNavItems.filter((i) => mobilePrimaryKeys.includes(i.key));
  const mobileMoreNavItems = roleNavItems.filter((i) => !mobilePrimaryKeys.includes(i.key));
  const canEdit = effectiveRole !== 'visualizador';
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  const [view, setView] = useState('dashboard');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [panelId, setPanelId] = useState(null);
  const [panelTab, setPanelTab] = useState('loops');
  const [expandedLoops, setExpandedLoops] = useState({});
  const [panelSearch, setPanelSearch] = useState('');
  const [reportFilters, setReportFilters] = useState({ search: '', panelId: 'all' });
  const [settingsTab, setSettingsTab] = useState('cliente');
  const [indicadorTab, setIndicadorTab] = useState('sdai');

  const [modal, setModal] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    (async () => {
      try {
      const loaded = await loadClientData(client.id);
      setData(loaded);
      } catch (e) {
        setData(emptyData());
      } finally {
        setLoaded(true);
      }
    })();
  }, [client.id]);
  
    useEffect(() => {
    const titulos = {
      atendimentos: "Atendimentos",
      dashboard: "Dashboard",
      panels: "Sistemas de Detecção e Alarme",
      panelDetail: "Sistemas de Detecção e Alarme",
      complementares: "Dispositivos Complementares",
      combate: "Sistemas de Combate",
      report: "Inspeções",
      indicador: "Indicador",
      settings: "Configurações",
    };

    const nomeBase = "Centro de Controle de Manutenção";
    const nomeTela = titulos[view] || "";

    document.title = nomeTela ? `${nomeTela} - ${nomeBase}` : nomeBase;
  }, [view]);

  async function persist(next) {
    try {
      await saveClientData(client.id, next);
      setSaveError(false);
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
  }

  function importCsvEntities(entities, removeIds = []) {
    let createdPanelIds = [];
    let createdLoopIds = [];
    let createdDeviceIds = [];
    let updatedDeviceCount = 0;
    let removedDeviceCount = 0;
    updateData((prev) => {
      const panelIdByKey = {};
      const newPanels = [];
      entities.panels.forEach((p) => {
        if (p.existingId) {
          panelIdByKey[p.key] = p.existingId;
        } else {
          const id = uid();
          panelIdByKey[p.key] = id;
          newPanels.push({ id, name: p.name, location: '', model: p.model || '', installDate: '', notes: '' });
        }
      });
      const loopIdByKey = {};
      const newLoops = [];
      entities.loops.forEach((l) => {
        if (l.existingId) {
          loopIdByKey[l.key] = l.existingId;
        } else {
          const id = uid();
          loopIdByKey[l.key] = id;
          newLoops.push({ id, panelId: panelIdByKey[l.node], name: l.name });
        }
      });

      // Trava anti-duplicata: mesmo laço + mesmo endereço = mesmo dispositivo físico.
      // Se já existe, atualiza os dados descritivos mantendo o ID (histórico preservado).
      // Só cria dispositivo novo quando não há match.
      const removeSet = new Set(removeIds);
      const updatesById = new Map();
      const newDevices = [];
      entities.devices.forEach((d) => {
        const loopId = loopIdByKey[d.loopKey];
        const existing = prev.devices.find((ed) => ed.loopId === loopId && ed.address === d.address);
        if (existing) {
          updatesById.set(existing.id, { type: d.type, modelo: d.modelo, description: d.label, subEndereco: d.subEndereco || '' });
        } else {
          const id = uid();
          createdDeviceIds.push(id);
          newDevices.push({
            id, loopId, address: d.address, type: d.type, modelo: d.modelo,
            description: d.label, subEndereco: d.subEndereco || '',
            categoriaFuncional: '', papelSinal: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '',
          });
        }
      });
      updatedDeviceCount = updatesById.size;
      removedDeviceCount = removeSet.size;

      const survivingDevices = prev.devices
        .filter((ed) => !removeSet.has(ed.id))
        .map((ed) => (updatesById.has(ed.id) ? { ...ed, ...updatesById.get(ed.id) } : ed));

      createdPanelIds = newPanels.map((p) => p.id);
      createdLoopIds = newLoops.map((l) => l.id);
      return {
        ...prev,
        panels: [...prev.panels, ...newPanels],
        loops: [...prev.loops, ...newLoops],
        devices: [...survivingDevices, ...newDevices],
      };
    });
    setLastImport({
      panelIds: createdPanelIds,
      loopIds: createdLoopIds,
      deviceIds: createdDeviceIds,
      summary: `${createdPanelIds.length} painel(éis) novo(s), ${createdLoopIds.length} laço(s) novo(s), ${createdDeviceIds.length} dispositivo(s) novo(s), ${updatedDeviceCount} atualizado(s) e ${removedDeviceCount} removido(s)`,
    });
  }

  function undoLastImport() {
    if (!lastImport) return;
    updateData((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => !lastImport.deviceIds.includes(d.id)),
      loops: prev.loops.filter((l) => !lastImport.loopIds.includes(l.id)),
      panels: prev.panels.filter((p) => !lastImport.panelIds.includes(p.id)),
    }));
    setLastImport(null);
  }

  function submitBateriaPainel(panelId, values) {
    updateData((prev) => {
      const proximaInspecao = values.dataInspecao ? addMonthsToDate(values.dataInspecao, 12) : '';
      const existing = (prev.bateriasPainel || []).find((b) => b.panelId === panelId);
      const next = { ...(existing || { id: uid(), panelId }), ...values, proximaInspecao };
      const list = existing
        ? (prev.bateriasPainel || []).map((b) => (b.panelId === panelId ? next : b))
        : [...(prev.bateriasPainel || []), next];
      return { ...prev, bateriasPainel: list };
    });
    closeModal();
  }

  function submitFonteAuxiliar(mode, initial, values) {
    updateData((prev) => {
      const proximaInspecao = values.dataInspecao ? addMonthsToDate(values.dataInspecao, 12) : '';
      if (mode === 'create') {
        return { ...prev, fontesAuxiliares: [...(prev.fontesAuxiliares || []), { id: uid(), ...values, proximaInspecao }] };
      }
      return {
        ...prev,
        fontesAuxiliares: (prev.fontesAuxiliares || []).map((f) => (f.id === initial.id ? { ...f, ...values, proximaInspecao } : f)),
      };
    });
  }

  function deleteFonteAuxiliar(id) {
    updateData((prev) => ({ ...prev, fontesAuxiliares: (prev.fontesAuxiliares || []).filter((f) => f.id !== id) }));
    setConfirmState(null);
  }

  function submitConjunto(mode, initial, values) {
    updateData((prev) => {
      if (mode === 'create') {
        const conjuntoId = uid();
        const tipoInfo = COMBATE_CONJUNTO_TIPOS[values.tipo];
        const novosSubitens = (tipoInfo?.subItens || []).map((s) => ({
          id: uid(), conjuntoId, categoria: s.categoria,
          tecnico: '', dataInspecao: '', resultadoTeste: '', valorMedido: '', observacoes: '', falha: '', proximaInspecao: '', fotos: [],
          dataRetestLaboratorial: '', proximaRetestLaboratorial: '',
        }));
        return {
          ...prev,
          combateConjuntos: [...(prev.combateConjuntos || []), { id: conjuntoId, tipo: values.tipo, agente: values.agente || '', panelId: values.panelId, etiqueta: values.etiqueta }],
          combateSubitens: [...(prev.combateSubitens || []), ...novosSubitens],
        };
      }
      return {
        ...prev,
        combateConjuntos: (prev.combateConjuntos || []).map((c) => (c.id === initial.id ? { ...c, etiqueta: values.etiqueta, panelId: values.panelId } : c)),
      };
    });
  }

  function deleteConjunto(id) {
    updateData((prev) => ({
      ...prev,
      combateConjuntos: (prev.combateConjuntos || []).filter((c) => c.id !== id),
      combateSubitens: (prev.combateSubitens || []).filter((s) => s.conjuntoId !== id),
    }));
    setConfirmState(null);
  }

  function submitSubitemInspecao(subitemId, values) {
    updateData((prev) => ({
      ...prev,
      combateSubitens: (prev.combateSubitens || []).map((s) => (s.id === subitemId ? { ...s, ...values } : s)),
    }));
  }

  function submitComponente(mode, initial, values) {
    updateData((prev) => {
      if (mode === 'create') {
        return { ...prev, combateComponentes: [...(prev.combateComponentes || []), { id: uid(), ...values }] };
      }
      return { ...prev, combateComponentes: (prev.combateComponentes || []).map((c) => (c.id === initial.id ? { ...c, ...values } : c)) };
    });
  }

  function deleteComponente(id) {
    updateData((prev) => ({ ...prev, combateComponentes: (prev.combateComponentes || []).filter((c) => c.id !== id) }));
    setConfirmState(null);
  }

  function submitBateriaCilindros(mode, initial, values) {
    updateData((prev) => {
      if (mode === 'create') {
        return { ...prev, combateBaterias: [...(prev.combateBaterias || []), { id: uid(), ...values }] };
      }
      return { ...prev, combateBaterias: (prev.combateBaterias || []).map((b) => (b.id === initial.id ? { ...b, ...values } : b)) };
    });
  }

  function deleteBateriaCilindros(id) {
    updateData((prev) => ({
      ...prev,
      combateBaterias: (prev.combateBaterias || []).filter((b) => b.id !== id),
      combateCilindros: (prev.combateCilindros || []).filter((c) => c.bateriaId !== id),
    }));
    setConfirmState(null);
  }

  function submitCilindro(mode, initial, bateriaId, values) {
    const proximaRetestLaboratorial = values.dataRetestLaboratorial
      ? addMonthsToDate(values.dataRetestLaboratorial, COMBATE_RETEST_LABORATORIAL_MESES) : '';
    const payload = { ...values, proximaRetestLaboratorial };
    updateData((prev) => {
      if (mode === 'create') {
        return { ...prev, combateCilindros: [...(prev.combateCilindros || []), { id: uid(), bateriaId, ...payload }] };
      }
      return { ...prev, combateCilindros: (prev.combateCilindros || []).map((c) => (c.id === initial.id ? { ...c, ...payload } : c)) };
    });
  }

  function deleteCilindro(id) {
    updateData((prev) => ({ ...prev, combateCilindros: (prev.combateCilindros || []).filter((c) => c.id !== id) }));
    setConfirmState(null);
  }

  function submitCalibracaoDevice(deviceId, values) {
    updateData((prev) => ({
      ...prev,
      devices: prev.devices.map((d) => (d.id === deviceId ? { ...d, ...values } : d)),
    }));
    closeModal();
  }

  function submitEtiquetaComplementar(deviceId, etiquetaComplementar) {
    updateData((prev) => ({
      ...prev,
      devices: prev.devices.map((d) => (d.id === deviceId ? { ...d, etiquetaComplementar } : d)),
    }));
  }

  function updateData(mutator) {
    setData((prev) => {
      const next = mutator(prev);
      persist(next);
      return next;
    });
  }

  function closeModal() { setModal(null); }

  function submitPanel(values) {
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, panels: [...prev.panels, { id: uid(), ...values }] }));
    else updateData((prev) => ({ ...prev, panels: prev.panels.map((p) => (p.id === modal.initial.id ? { ...p, ...values } : p)) }));
    closeModal();
  }
  function deletePanelCascade(id) {
    updateData((prev) => {
      const loopIds = prev.loops.filter((l) => l.panelId === id).map((l) => l.id);
      return {
        ...prev,
        panels: prev.panels.filter((p) => p.id !== id),
        loops: prev.loops.filter((l) => l.panelId !== id),
        nacs: prev.nacs.filter((n) => n.panelId !== id),
        devices: prev.devices.filter((d) => !loopIds.includes(d.loopId)),
      };
    });
    setConfirmState(null);
    if (view === 'panelDetail' && panelId === id) setView('panels');
  }

  function deletePanelsBulk(ids) {
    updateData((prev) => {
      const loopIds = prev.loops.filter((l) => ids.includes(l.panelId)).map((l) => l.id);
      return {
        ...prev,
        panels: prev.panels.filter((p) => !ids.includes(p.id)),
        loops: prev.loops.filter((l) => !ids.includes(l.panelId)),
        nacs: prev.nacs.filter((n) => !ids.includes(n.panelId)),
        devices: prev.devices.filter((d) => !loopIds.includes(d.loopId)),
      };
    });
    setConfirmState(null);
    if (view === 'panelDetail' && ids.includes(panelId)) setView('panels');
  }

  function submitLoop(values) {
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, loops: [...prev.loops, { id: uid(), panelId: modal.context.panelId, ...values }] }));
    else updateData((prev) => ({ ...prev, loops: prev.loops.map((l) => (l.id === modal.initial.id ? { ...l, ...values } : l)) }));
    closeModal();
  }
  function deleteLoopCascade(id) {
    updateData((prev) => ({ ...prev, loops: prev.loops.filter((l) => l.id !== id), devices: prev.devices.filter((d) => d.loopId !== id) }));
    setConfirmState(null);
  }

  function submitNac(values) {
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, nacs: [...prev.nacs, { id: uid(), panelId: modal.context.panelId, ...values }] }));
    else updateData((prev) => ({ ...prev, nacs: prev.nacs.map((n) => (n.id === modal.initial.id ? { ...n, ...values } : n)) }));
    closeModal();
  }
  function deleteNac(id) {
    updateData((prev) => ({ ...prev, nacs: prev.nacs.filter((n) => n.id !== id) }));
    setConfirmState(null);
  }

  function submitDevice(values) {
    if (modal.mode === 'create') {
      const arr = Array.isArray(values) ? values : [values];
      updateData((prev) => ({
        ...prev,
        devices: [...prev.devices, ...arr.map((v) => ({ id: uid(), loopId: modal.context.loopId, ...v }))],
      }));
    } else {
      updateData((prev) => ({ ...prev, devices: prev.devices.map((d) => (d.id === modal.initial.id ? { ...d, ...values } : d)) }));
    }
    closeModal();
  }
  function deleteDevice(id) {
    updateData((prev) => ({ ...prev, devices: prev.devices.filter((d) => d.id !== id) }));
    setConfirmState(null);
  }

  function submitIndicador(values) {
    if (modal.mode === 'edit' && modal.initial && modal.initial.origemNovo) {
      const initialId = modal.initial.id;
      (async () => {
        try {
          if (initialId.startsWith('novo-at-')) {
            await updateAtendimento(initialId.replace('novo-at-', ''), {
              falha: values.falha, status: (values.status || 'Aguardando').toLowerCase(),
              descritivo: values.descritivo, fotos: values.fotos,
            });
          } else if (initialId.startsWith('novo-insp-')) {
            await updateInspecao(initialId.replace('novo-insp-', ''), {
              falha: values.falha, observacoes: values.descritivo,
            });
          }
          const reloaded = await loadClientData(client.id);
          setData(reloaded);
        } catch (err) {
          console.error(err);
        }
      })();
      closeModal();
      return;
    }
    const usaModeloNovo = ['devices', 'nacs', 'gasDetectors'].includes(values.categoria) && values.deviceId;
    if (usaModeloNovo && modal.mode === 'create') {
      (async () => {
        try {
          const visitaNova = await createVisita({ clienteId: client.id, dataVisita: values.dataDiagnostico || undefined });
          await createAtendimento({
            dispositivoId: values.deviceId, falha: values.falha, status: (values.status || 'Aguardando').toLowerCase(),
            descritivo: values.descritivo || '', fotos: values.fotos || [], rvtId: visitaNova.id,
          });
          const reloaded = await loadClientData(client.id);
          setData(reloaded);
        } catch (err) {
          console.error(err);
        }
      })();
      closeModal();
      return;
    }
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, indicador: [...(prev.indicador || []), { id: uid(), ...values }] }));
    else updateData((prev) => ({ ...prev, indicador: (prev.indicador || []).map((r) => (r.id === modal.initial.id ? { ...r, ...values } : r)) }));
    closeModal();
  }
  function deleteIndicador(id) {
    const registroAtual = (data.indicador || []).find((r) => r.id === id);
    if (registroAtual && registroAtual.origemNovo) {
      (async () => {
        try {
          if (id.startsWith('novo-at-')) await deleteAtendimento(id.replace('novo-at-', ''));
          else if (id.startsWith('novo-insp-')) await deleteInspecao(id.replace('novo-insp-', ''));
          const reloaded = await loadClientData(client.id);
          setData(reloaded);
        } catch (err) {
          console.error(err);
        }
      })();
      setConfirmState(null);
      return;
    }
    updateData((prev) => {
      const registro = (prev.indicador || []).find((r) => r.id === id);
      // exclusão em cascata: se esse registro veio de um RVT, apaga o RVT e o histórico junto
      const origemRvt = registro?.origemRvt;
      return {
        ...prev,
        indicador: (prev.indicador || []).filter((r) => r.id !== id),
        rvt: origemRvt ? (prev.rvt || []).filter((r) => r.id !== origemRvt) : prev.rvt,
        maintenanceLog: origemRvt ? (prev.maintenanceLog || []).filter((l) => l.origemRvt !== origemRvt) : prev.maintenanceLog,
        inspectionLog: origemRvt ? (prev.inspectionLog || []).filter((l) => l.origemRvt !== origemRvt) : prev.inspectionLog,
      };
    });
    setConfirmState(null);
  }

  function deleteIndicadorBulk(ids) {
    updateData((prev) => ({ ...prev, indicador: (prev.indicador || []).filter((r) => !ids.includes(r.id)) }));
    setConfirmState(null);
  }
  function deleteIndicadorByStatus(status) {
    updateData((prev) => ({ ...prev, indicador: (prev.indicador || []).filter((r) => r.status !== status) }));
    setConfirmState(null);
  }
  function deleteIndicadorAll() {
    updateData((prev) => ({ ...prev, indicador: [] }));
    setConfirmState(null);
  }

  async function handleImportIndicador(file) {
    try {
      const records = await parseIndicadorXlsx(file);
      updateData((prev) => ({ ...prev, indicador: [...(prev.indicador || []), ...records] }));
      return { ok: true, count: records.length };
    } catch (err) {
      return { ok: false, error: err.message || 'Não foi possível importar essa planilha.' };
    }
  }

  function linkIndicadorToDevices() {
    let matched = 0;
    let total = 0;
    updateData((prev) => {
      const list = prev.indicador || [];
      total = list.length;
      const linked = list.map((r) => {
        const deviceId = matchIndicadorRecordToDevice(r, prev);
        if (deviceId) {
          matched += 1;
          return { ...r, deviceId, categoria: 'devices' };
        }
        if (r.deviceId) {
          // já estava vinculado manualmente (RVT, manutenção/inspeção direta ou seletor do Indicador) — preserva
          matched += 1;
          return r;
        }
        return { ...r, deviceId: '' };
      });
      return { ...prev, indicador: linked };
    });
    return { matched, total, unmatched: total - matched };
  }
  function submitMaintenance(values) {
    const { category, id } = modal.context;

    if (['devices', 'nacs', 'gasDetectors'].includes(category)) {
      (async () => {
        try {
          const visitaNova = await createVisita({ clienteId: client.id, dataVisita: values.date });
          await createAtendimento({
            dispositivoId: id, falha: values.falha, status: (values.status || 'Resolvido').toLowerCase(),
            descritivo: values.description || '', tecnico: values.technician || '', fotos: [], rvtId: visitaNova.id,
          });
          const reloaded = await loadClientData(client.id);
          setData(reloaded);
        } catch (err) {
          console.error(err);
        }
      })();
      closeModal();
      return;
    }
    const fields = resolveIndicadorFields(data, category, modal.item);
    const falhaTexto = (values.falha || '').trim() || 'Realizado sem apontamentos';
    const statusFinal = values.status || 'Resolvido';
    const rvtId = uid();
    const novoIndicador = {
      id: uid(), tipo: 'manutencao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: values.description || '', status: statusFinal,
      explanacao: values.explanacao || '', dataDiagnostico: values.date,
      dataIntervencao1: values.date, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: statusFinal === 'Resolvido' ? values.date : '',
      solucao: values.solucao || '', fotos: [], origemRvt: rvtId,
    };
    const novoRvt = {
      id: rvtId, data: values.date, tecnico: values.technician,
      itens: [{
        id: uid(), deviceId: id, categoria: category,
        etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
        equipamento: fields.equipamento, area: fields.area,
        falha: falhaTexto, descritivo: values.description || '', status: statusFinal,
        explanacao: values.explanacao || '', dataIntervencao: values.date,
        solucao: values.solucao || '', fotos: [],
      }],
    };
    updateData((prev) => {
      const list = prev[category];
      const logEntry = { id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '', tipo: values.tipo || 'preventiva', origemRvt: rvtId };
      return {
        ...prev,
        [category]: list.map((it) => (it.id === id
          ? { ...it, lastMaintenance: values.date, nextMaintenance: values.nextDate || '', intervalMonths: values.intervalMonths || it.intervalMonths }
          : it)),
        maintenanceLog: [logEntry, ...prev.maintenanceLog],
        indicador: [novoIndicador, ...(prev.indicador || [])],
        rvt: [novoRvt, ...(prev.rvt || [])],
      };
    });
    closeModal();
  }

  function submitBulkMaintenance(values) {
    const { category, ids } = modal.context;
    updateData((prev) => {
      const list = prev[category];
      const logEntries = ids.map((id) => ({ id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '', tipo: values.tipo || 'preventiva' }));
      return {
        ...prev,
        [category]: list.map((it) => (ids.includes(it.id)
          ? { ...it, lastMaintenance: values.date, nextMaintenance: values.nextDate || '', intervalMonths: values.intervalMonths || it.intervalMonths }
          : it)),
        maintenanceLog: [...logEntries, ...prev.maintenanceLog],
      };
    });
    closeModal();
  }

  function deleteDevicesBulk(ids) {
    updateData((prev) => ({ ...prev, devices: prev.devices.filter((d) => !ids.includes(d.id)) }));
    setConfirmState(null);
  }

  function submitBulkInspection(values) {
    const { category, ids } = modal.context;
    updateData((prev) => {
      const logEntries = ids.map((id) => ({ id: uid(), category, itemId: id, date: values.lastInspection || todayISO(), operationalStatus: values.operationalStatus || '' }));
      return {
        ...prev,
        [category]: prev[category].map((it) => (ids.includes(it.id) ? { ...it, ...values } : it)),
        inspectionLog: [...logEntries, ...(prev.inspectionLog || [])],
      };
    });
    closeModal();
  }
  function submitInspection(values) {
    const { category, id } = modal.context;

    if (['devices', 'nacs', 'gasDetectors'].includes(category)) {
      (async () => {
        try {
          const dataInspecaoNova = values.lastInspection || todayISO();
          const visitaNova = await createVisita({ clienteId: client.id, dataVisita: dataInspecaoNova, tecnico: values.technician || '' });
          await createInspecao({
            dispositivoId: id, tecnico: values.technician || '',
            resultadoTeste: values.operationalStatus || '', aparencia: values.appearance || '',
            comunicacaoLocal: values.localComm || '', comunicacaoRede: values.networkComm || '',
            observacoes: values.observacoes || '', falha: values.falha || '', metodo: getMetodoTeste(modal.item), dataInspecao: dataInspecaoNova,
            proximaInspecao: values.nextInspection || '', fotos: [], rvtId: visitaNova.id,
          });
          const reloaded = await loadClientData(client.id);
          setData(reloaded);
        } catch (err) {
          console.error(err);
        }
      })();
      closeModal();
      return;
    }
    const fields = resolveIndicadorFields(data, category, modal.item);
    const falhaTexto = (values.falha || '').trim() || 'Realizado sem apontamentos';
    const dataInspecao = values.lastInspection || todayISO();
    const resumo = [values.operationalStatus, values.appearance, values.localComm, values.networkComm].filter(Boolean).join(' · ');
    const rvtId = uid();
    const novoIndicador = {
      id: uid(), tipo: 'inspecao', deviceId: id, categoria: category,
      etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
      equipamento: fields.equipamento, area: fields.area,
      falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
      explanacao: '', dataDiagnostico: dataInspecao,
      dataIntervencao1: dataInspecao, dataIntervencao2: '', dataIntervencao3: '', dataIntervencao4: '',
      dataSolucao: dataInspecao, solucao: '', fotos: [], origemRvt: rvtId,
    };
    const novoRvt = {
      id: rvtId, data: dataInspecao, tecnico: values.technician || '',
      itens: [{
        id: uid(), deviceId: id, categoria: category,
        etiqueta: fields.etiqueta, endereco: fields.endereco, laco: fields.laco, painel: fields.painel,
        equipamento: fields.equipamento, area: fields.area,
        falha: falhaTexto, descritivo: resumo, status: 'Resolvido',
        explanacao: '', dataIntervencao: dataInspecao, solucao: '', fotos: [],
      }],
    };
    updateData((prev) => {
      const logEntry = { id: uid(), category, itemId: id, date: dataInspecao, operationalStatus: values.operationalStatus || '', origemRvt: rvtId };
      return {
        ...prev,
        [category]: prev[category].map((it) => (it.id === id ? { ...it, ...values } : it)),
        inspectionLog: [logEntry, ...(prev.inspectionLog || [])],
        indicador: [novoIndicador, ...(prev.indicador || [])],
        rvt: [novoRvt, ...(prev.rvt || [])],
      };
    });
    closeModal();
  }

  function saveModelPhoto(key, label, photoDataUrl) {
    updateData((prev) => {
      const existing = prev.modelPhotos?.[key];
      return { ...prev, modelPhotos: { ...prev.modelPhotos, [key]: { label, photo: (photoDataUrl !== null && photoDataUrl !== undefined) ? photoDataUrl : (existing?.photo || null) } } };
    });
  }
  function removeModelPhoto(key) {
    updateData((prev) => {
      const next = { ...prev.modelPhotos };
      if (next[key]) next[key] = { ...next[key], photo: null };
      return { ...prev, modelPhotos: next };
    });
  }

  function openMaintainModal(category, item, label) { setModal({ type: 'maintenance', context: { category, id: item.id, label }, item }); }
  function openInspectModal(category, item, label) { setModal({ type: 'inspection', context: { category, id: item.id, label }, item }); }
  function openBulkMaintainModal(category, ids) { setModal({ type: 'bulkMaintenance', context: { category, ids } }); }
  function openBulkInspectModal(category, ids) { setModal({ type: 'bulkInspection', context: { category, ids } }); }

  if (!loaded || !data) {
    return (
      <div className="min-h-screen font-body" style={{ background: 'var(--bg)' }}>
        <PageStyles />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  const items = [...allTrackableItems(data), ...complementaresTrackableItems(data)];
  const counts = { overdue: 0, soon: 0, ok: 0, none: 0 };
    items.forEach((it) => { counts[computeStatus(it.nextInspection).key]++; });
  const attentionItems = items
        .filter((it) => ['overdue', 'soon'].includes(computeStatus(it.nextInspection).key))
    .sort((a, b) => (a.nextMaintenance || '').localeCompare(b.nextMaintenance || ''));

  const combateItems = combateTrackableItems(data);
  const combateCounts = { overdue: 0, soon: 0, ok: 0, none: 0 };
    combateItems.forEach((it) => { combateCounts[computeStatus(it.nextInspection).key]++; });
  const combateAttentionItems = combateItems
        .filter((it) => ['overdue', 'soon'].includes(computeStatus(it.nextInspection).key))
    .sort((a, b) => (a.nextMaintenance || '').localeCompare(b.nextMaintenance || ''));

  const rootStyle = { background: 'var(--bg)' };
  if (client.branding?.bgColor) rootStyle['--bg'] = client.branding.bgColor;

  return (
    <div className="min-h-screen font-body" style={rootStyle}>
      <PageStyles />

      <header className="sticky top-0 z-30 no-print" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {client.branding?.logoData
                ? <img src={client.branding.logoData} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                : <BrandLogo boxSize={32} size={17} />}
              <div className="min-w-0">
                <h1 className="font-display font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{client.name}</h1>
                <p className="text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>Centro de Controle de Manutenção</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {role === 'admin' && (
                <button type="button" onClick={() => setPreviewRole((r) => (r === null ? 'operador' : r === 'operador' ? 'visualizador' : null))}
                  className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)', border: '1px solid var(--accent)', background: previewRole ? 'rgba(139,47,47,0.12)' : 'transparent' }}
                  title="Simula o menu de outro role, sem mudar sua permissão real">
                  Prévia: {previewRole ? ROLE_LABELS[previewRole] : 'Admin (eu)'}
                </button>
              )}
              <span className="text-xs px-2 py-1 rounded-md mono hidden sm:inline-block" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {ROLE_LABELS[role] || role}
              </span>
              {saveError && (
                <span className="text-xs px-2 py-1 rounded-md fade-in-up" style={{ color: 'var(--status-danger)', border: '1px solid var(--status-danger)' }}>
                  {role === 'visualizador' ? 'Somente leitura' : 'Falha ao salvar'}
                </span>
              )}
              <IconButton title="Trocar cliente" onClick={onSwitchClient}><Building2 size={16} /></IconButton>
              {signOut && <IconButton title="Sair da conta" onClick={signOut}><LogOut size={16} /></IconButton>}
            </div>
          </div>
          <nav className="hidden sm:flex gap-1 mt-4 -mb-3 overflow-x-auto">
            {roleNavItems.map((item) => (
              <button key={item.key} className="nav-tab" data-active={item.key === 'sdai' ? SDAI_VIEWS.includes(view) : view === item.key}
                onClick={() => { setView(item.key === 'sdai' ? 'panels' : item.key); setPanelId(null); }}>
                <item.icon size={15} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {mobileMoreOpen && (
        <>
          <div className="sm:hidden no-print" onClick={() => setMobileMoreOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }} />
          <div className="sm:hidden no-print" style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
            background: 'var(--surface)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
            maxHeight: '75vh', overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '10px auto' }} />
            <p className="px-4 pb-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>Mais opções</p>
            {mobileMoreNavItems.map((item) => {
              const active = item.key === 'sdai' ? SDAI_VIEWS.includes(view) : view === item.key;
              return (
                <button key={item.key} onClick={() => { setView(item.key === 'sdai' ? 'panels' : item.key); setPanelId(null); setMobileMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left"
                  style={{
                    background: active ? 'var(--surface-raised)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderTop: '1px solid var(--border)', fontWeight: active ? 600 : 400,
                  }}>
                  <item.icon size={18} /> {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <nav className="sm:hidden no-print flex" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        boxShadow: '0 30px 0 0 var(--surface)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {mobilePrimaryNavItems.map((item) => {
          const active = !mobileMoreOpen && (item.key === 'sdai' ? SDAI_VIEWS.includes(view) : view === item.key);
          return (
            <button key={item.key} onClick={() => { setView(item.key === 'sdai' ? 'panels' : item.key); setPanelId(null); setMobileMoreOpen(false); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
              style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <item.icon size={20} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, textAlign: 'center', lineHeight: 1.1 }}>
                {item.key === 'atendimentos' ? 'Atendimentos' : item.label}
              </span>
            </button>
          );
        })}
        <button onClick={() => setMobileMoreOpen((v) => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
          style={{ color: mobileMoreOpen ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <MoreHorizontal size={20} />
          <span style={{ fontSize: 10, fontWeight: mobileMoreOpen ? 600 : 400 }}>Mais</span>
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-20">
        {view === 'dashboard' && (
          <Dashboard data={data} counts={counts} attentionItems={attentionItems} clientId={client.id}
            combateCounts={combateCounts} combateAttentionItems={combateAttentionItems} canEdit={canEdit}
            onMaintain={(it) => openMaintainModal(it.category, it, it.title)}
            onInspect={(it) => openInspectModal(it.category, it, it.title)}
            onGoPanels={() => setView('panels')} />
        )}
        {view === 'atendimentos' && (
          <AtendimentosNovo data={data} client={client} clientId={client.id} canEdit={canEdit}
            onRefresh={async () => setData(await loadClientData(client.id))} />
        )}

        {SDAI_VIEWS.includes(view) && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
              <button className="nav-tab" data-active={view === 'panels' || view === 'panelDetail'} onClick={() => setView('panels')}>Painéis</button>
              <button className="nav-tab" data-active={view === 'complementares'} onClick={() => setView('complementares')}>Dispositivos Complementares</button>
            </div>

            {view === 'panels' && (
              <PanelsList data={data} search={panelSearch} setSearch={setPanelSearch} canEdit={canEdit}
                onOpenPanel={(id) => { setPanelId(id); setPanelTab('loops'); setView('panelDetail'); }}
                onCreate={() => setModal({ type: 'panel', mode: 'create', initial: null })}
                onImport={role === 'admin' ? () => { setSettingsTab('importar'); setView('settings'); } : undefined}
                onBulkDeletePanels={(ids) => setConfirmState({ title: 'Excluir painéis selecionados', message: `Excluir ${ids.length} painel(éis) selecionado(s)? Todos os laços, circuitos e dispositivos vinculados também serão removidos. Essa ação não pode ser desfeita.`, onConfirm: () => deletePanelsBulk(ids) })} />
            )}

            {view === 'panelDetail' && panelId && (
              <PanelDetail
                data={data} panelId={panelId} tab={panelTab} setTab={setPanelTab} canEdit={canEdit}
                expandedLoops={expandedLoops} setExpandedLoops={setExpandedLoops}
                onBack={() => setView('panels')}
                onEditPanel={(p) => setModal({ type: 'panel', mode: 'edit', initial: p })}
                onDeletePanel={(p) => setConfirmState({ title: 'Excluir painel', message: `Excluir "${p.name}"? Todos os laços, circuitos e dispositivos vinculados também serão removidos.`, onConfirm: () => deletePanelCascade(p.id) })}
                onCreateLoop={(pid) => {
                  const n = data.loops.filter((l) => l.panelId === pid).length + 1;
                  setModal({ type: 'loop', mode: 'create', initial: { name: `Laço ${n}` }, context: { panelId: pid } });
                }}
                onEditLoop={(l) => setModal({ type: 'loop', mode: 'edit', initial: l })}
                onDeleteLoop={(l) => setConfirmState({ title: 'Excluir laço', message: `Excluir "${l.name}"? Todos os dispositivos deste laço também serão removidos.`, onConfirm: () => deleteLoopCascade(l.id) })}
                onCreateNac={(pid) => {
                  const n = data.nacs.filter((x) => x.panelId === pid).length + 1;
                  setModal({ type: 'nac', mode: 'create', initial: { name: `NAC ${n}`, description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '' }, context: { panelId: pid } });
                }}
                onEditNac={(n) => setModal({ type: 'nac', mode: 'edit', initial: n })}
                onDeleteNac={(n) => setConfirmState({ title: 'Excluir circuito', message: `Excluir "${n.name}"?`, onConfirm: () => deleteNac(n.id) })}
                onCreateDevice={(loopId) => {
                  const existing = data.devices.filter((d) => d.loopId === loopId).map((d) => parseInt(d.address, 10)).filter((num) => !isNaN(num));
                  const nextAddr = existing.length ? Math.max(...existing) + 1 : 1;
                  setModal({
                    type: 'device', mode: 'create',
                    initial: { address: String(nextAddr).padStart(3, '0'), type: 'fumaca', modelo: '', description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '' },
                    context: { loopId },
                  });
                }}
                onEditDevice={(d) => setModal({ type: 'device', mode: 'edit', initial: d })}
                onDeleteDevice={(d) => setConfirmState({ title: 'Excluir dispositivo', message: `Excluir dispositivo endereço ${d.address}?`, onConfirm: () => deleteDevice(d.id) })}
                onMaintainDevice={(d) => openMaintainModal('devices', d, `Dispositivo ${d.address}`)}
                onInspectDevice={(d) => openInspectModal('devices', d, `Dispositivo ${d.address}`)}
                onMaintainNac={(n) => openMaintainModal('nacs', n, n.name)}
                onInspectNac={(n) => openInspectModal('nacs', n, n.name)}
                onBulkMaintainDevices={(ids) => openBulkMaintainModal('devices', ids)}
                onBulkInspectDevices={(ids) => openBulkInspectModal('devices', ids)}
                onBulkDeleteDevices={(ids) => setConfirmState({ title: 'Excluir dispositivos selecionados', message: `Excluir ${ids.length} dispositivo(s) selecionado(s)? Essa ação não pode ser desfeita.`, onConfirm: () => deleteDevicesBulk(ids) })}
              />
            )}

            {view === 'complementares' && (
              <ComplementaresView data={data} canEdit={canEdit}
                onSubmitBateriaPainel={submitBateriaPainel}
                onSubmitFonteAuxiliar={submitFonteAuxiliar}
                onDeleteFonteAuxiliar={(id) => setConfirmState({ title: 'Excluir fonte auxiliar', message: 'Excluir esta fonte auxiliar? Essa ação não pode ser desfeita.', onConfirm: () => deleteFonteAuxiliar(id) })}
                onSubmitCalibracao={submitCalibracaoDevice}
                onSubmitEtiqueta={submitEtiquetaComplementar}
                onInspectDevice={openInspectModal} />
            )}
          </div>
        )}

        {view === 'combate' && (
          <CombateIncendioView data={data} canEdit={canEdit} clientId={client.id}
            onSubmitConjunto={submitConjunto}
            onDeleteConjunto={(id) => setConfirmState({ title: 'Excluir', message: 'Excluir este item e todos os sub-itens do checklist dele? Essa ação não pode ser desfeita.', onConfirm: () => deleteConjunto(id) })}
            onSubmitSubitem={submitSubitemInspecao}
            onSubmitComponente={submitComponente}
            onDeleteComponente={(id) => setConfirmState({ title: 'Excluir componente', message: 'Excluir este componente? Essa ação não pode ser desfeita.', onConfirm: () => deleteComponente(id) })}
            onSubmitBateria={submitBateriaCilindros}
            onDeleteBateria={(id) => setConfirmState({ title: 'Excluir bateria de cilindros', message: 'Excluir esta bateria e todos os cilindros cadastrados nela? Essa ação não pode ser desfeita.', onConfirm: () => deleteBateriaCilindros(id) })}
            onSubmitCilindro={submitCilindro}
            onDeleteCilindro={(id) => setConfirmState({ title: 'Excluir cilindro', message: 'Excluir este cilindro? Essa ação não pode ser desfeita.', onConfirm: () => deleteCilindro(id) })} />
        )}

        {view === 'report' && (
          <ReportView data={data} client={client} filters={reportFilters} setFilters={setReportFilters} />
        )}

        {view === 'indicador' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
              <button className="nav-tab" data-active={indicadorTab === 'sdai'} onClick={() => setIndicadorTab('sdai')}>SDAI</button>
              <button className="nav-tab" data-active={indicadorTab === 'spci'} onClick={() => setIndicadorTab('spci')}>SPCI (Sistemas de Combate)</button>
            </div>
            {indicadorTab === 'sdai' && (
              <div key="sdai" className="fade-in-up">
                <IndicadorView data={data} canEdit={canEdit} client={client}
                  onCreate={() => setModal({ type: 'indicador', mode: 'create', initial: null })}
                  onEdit={(r) => setModal({ type: 'indicador', mode: 'edit', initial: r })}
                  onDelete={(r) => setConfirmState({ title: 'Excluir registro', message: `Excluir o registro "${r.etiqueta || r.falha}"?`, onConfirm: () => deleteIndicador(r.id) })}
                  onImportFile={handleImportIndicador} onLinkDevices={linkIndicadorToDevices}
                  onBulkDelete={(ids) => setConfirmState({ title: 'Excluir registros selecionados', message: `Excluir ${ids.length} registro(s) selecionado(s) do Indicador? Essa ação não pode ser desfeita.`, onConfirm: () => deleteIndicadorBulk(ids) })}
                  onDeleteByStatus={(status, count) => setConfirmState({ title: 'Excluir por status', message: `Excluir ${count} registro(s) com status "${status}"? Essa ação não pode ser desfeita.`, onConfirm: () => deleteIndicadorByStatus(status) })}
                  onDeleteAll={(count) => setConfirmState({ title: 'Excluir todos os registros', message: `Excluir todos os ${count} registro(s) do Indicador deste cliente? Essa ação não pode ser desfeita.`, onConfirm: () => deleteIndicadorAll() })} />
              </div>
            )}
            {indicadorTab === 'spci' && (
              <div key="spci" className="fade-in-up">
                <CombateHistoricoView clientId={client.id} />
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <SettingsView client={client} data={data} tab={settingsTab} setTab={setSettingsTab}
            onUpdateClient={onUpdateClient} onSaveModelPhoto={saveModelPhoto} onRemoveModelPhoto={removeModelPhoto}
            onImportCsv={importCsvEntities} lastImport={lastImport} onUndoImport={undoLastImport} />
        )}
      </main>

      {modal?.type === 'panel' && (
        <Modal title={modal.mode === 'create' ? 'Novo painel' : 'Editar painel'} onClose={closeModal}>
          <PanelForm initial={modal.initial} onSubmit={submitPanel} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'loop' && (
        <Modal title={modal.mode === 'create' ? 'Novo laço' : 'Editar laço'} onClose={closeModal}>
          <LoopForm initial={modal.initial} onSubmit={submitLoop} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'nac' && (
        <Modal title={modal.mode === 'create' ? 'Novo circuito de saída (NAC)' : 'Editar circuito (NAC)'} onClose={closeModal} wide>
          <NacForm initial={modal.initial} onSubmit={submitNac} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'device' && (
        <Modal title={modal.mode === 'create' ? 'Novo dispositivo' : 'Editar dispositivo'} onClose={closeModal} wide>
          <DeviceForm initial={modal.initial} isCreate={modal.mode === 'create'} onSubmit={submitDevice} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'indicador' && (
        <Modal title={modal.mode === 'create' ? 'Novo registro do Indicador' : 'Editar registro'} onClose={closeModal} wide>
          <IndicadorForm initial={modal.initial} data={data} areaSuggestions={[...new Set((data.indicador || []).map((r) => r.area).filter(Boolean))].sort()}
            onSubmit={submitIndicador} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'maintenance' && (
        <Modal title={`Registrar manutenção — ${modal.context.label}`} onClose={closeModal} wide>
          <MaintenanceForm item={modal.item} onSubmit={submitMaintenance} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'bulkMaintenance' && (
        <Modal title={`Registrar manutenção em lote (${modal.context.ids.length} dispositivos)`} onClose={closeModal} wide>
          <BulkMaintenanceForm count={modal.context.ids.length} onSubmit={submitBulkMaintenance} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'inspection' && (
        <Modal title={`Registrar inspeção — ${modal.context.label}`} onClose={closeModal} wide>
          <InspectionForm item={modal.item} onSubmit={submitInspection} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'bulkInspection' && (
        <Modal title={`Registrar inspeção em lote (${modal.context.ids.length} dispositivos)`} onClose={closeModal} wide>
          <BulkInspectionForm count={modal.context.ids.length} onSubmit={submitBulkInspection} onCancel={closeModal} />
        </Modal>
      )}
      {confirmState && (
        <ConfirmModal title={confirmState.title} message={confirmState.message}
          onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-raised)' }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <div className="font-display text-xl font-semibold mono" style={{ color: 'var(--text-primary)' }}>{value}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      </div>
    </div>
  );
}

const CHART_PALETTE = ['#8B2F2F', '#C97D3A', '#4F8A6D', '#3C6E9C', '#9C5FA8', '#B08D57', '#5B7CA6', '#A24D6E'];

/** Gráfico de barras horizontais simples, em SVG/HTML puro (sem dependências externas). */
function SimpleBarChart({ data, emptyLabel = 'Sem dados para exibir.' }) {
  if (!data || data.length === 0) {
    return <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs w-36 truncate text-right flex-shrink-0" style={{ color: 'var(--text-secondary)' }} title={d.label}>{d.label}</span>
          <div className="flex-1 rounded-md" style={{ background: 'var(--surface-raised)' }}>
            <div className="h-5 rounded-md flex items-center justify-end px-1.5 min-w-[22px]"
              style={{ width: `${Math.max((d.value / max) * 100, 3)}%`, background: d.color || 'var(--accent)' }}>
              <span className="text-xs font-medium mono" style={{ color: '#fff' }}>{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gráfico de pizza/rosca simples, em SVG puro, com legenda ao lado. */
function SimplePieChart({ data, size = 168, emptyLabel = 'Sem dados para exibir.' }) {
  const total = (data || []).reduce((s, d) => s + d.value, 0);
  if (!data || data.length === 0 || total === 0) {
    return <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>{emptyLabel}</p>;
  }
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-raised)" strokeWidth="26" />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circumference;
            const seg = (
              <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={d.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth="26" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += dash;
            return seg;
          })}
        </g>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-[140px]">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color || CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
            <span className="mono font-medium flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{d.value} ({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {subtitle && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Baixa uma lista de pares [rótulo, valor] como CSV (separador ; para abrir bem no Excel BR). */
function exportChartCsv(filename, header, rows) {
  const escapeCell = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(escapeCell).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function countBy(list, keyFn, fallbackLabel) {
  const counts = new Map();
  list.forEach((item) => {
    const key = keyFn(item) || fallbackLabel;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function sortDesc(arr) { return [...arr].sort((a, b) => b.value - a.value); }

const MONTH_LABELS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Conta itens com campo `date` (YYYY-MM-DD) nos últimos N meses, agrupados por mês. */
function countByMonth(list, months = 12) {
  const now = new Date();
  const buckets = [];
  const indexByKey = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    indexByKey[key] = buckets.length;
    buckets.push({ label: `${MONTH_LABELS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, value: 0 });
  }
  list.forEach((item) => {
    if (!item.date) return;
    const key = item.date.slice(0, 7);
    if (key in indexByKey) buckets[indexByKey[key]].value += 1;
  });
  return buckets;
}

/** Skeleton do Dashboard — mostrado enquanto os dados do cliente carregam do Supabase, no lugar do spinner genérico. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="skeleton" style={{ width: 140, height: 22 }} />
        <div className="skeleton" style={{ width: 200, height: 14 }} />
      </div>
      <div className="flex gap-2">
        <div className="skeleton" style={{ width: 70, height: 30, borderRadius: '8px 8px 0 0' }} />
        <div className="skeleton" style={{ width: 190, height: 30, borderRadius: '8px 8px 0 0' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="skeleton w-9 h-9 flex-shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="skeleton" style={{ width: '60%', height: 18 }} />
              <div className="skeleton" style={{ width: '85%', height: 11 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ width: '50%', height: 14 }} />
            <div className="skeleton" style={{ width: '100%', height: 140 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ data, counts, attentionItems, combateCounts, combateAttentionItems, canEdit, onMaintain, onInspect, onGoPanels, clientId }) {
  const [painelTab, setPainelTab] = useState('sdai');
  const [dashFiltroInicio, setDashFiltroInicio] = useState('');
  const [dashFiltroFim, setDashFiltroFim] = useState('');
  const [dashFiltroTipo, setDashFiltroTipo] = useState('all');
  const total = counts.overdue + counts.soon + counts.ok + counts.none;
  const combateTotal = combateCounts.overdue + combateCounts.soon + combateCounts.ok + combateCounts.none;
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const [combateHistorico, setCombateHistorico] = useState([]);
  useEffect(() => {
    let ativo = true;
    listCombateHistorico(clientId).then((rows) => { if (ativo) setCombateHistorico(rows); }).catch((err) => console.error(err));
    return () => { ativo = false; };
  }, [clientId]);

  const temAlgumDado = data.panels.length > 0 || data.pumpDevices.length > 0 || data.gasDetectors.length > 0
    || (data.combateConjuntos || []).length > 0 || (data.combateComponentes || []).length > 0 || (data.combateBaterias || []).length > 0;
  if (!temAlgumDado) {
    return (
      <EmptyState icon={Cpu} title="Nenhum equipamento cadastrado ainda"
        description="Comece cadastrando o primeiro painel de detecção e alarme de incêndio, ou o primeiro item de Sistemas de Combate."
        actionLabel={canEdit ? 'Cadastrar primeiro painel' : undefined} onAction={canEdit ? onGoPanels : undefined} />
    );
  }

  const indicador = data.indicador || [];
  const dentroDoPeriodo = (r) => {
    const d = r.dataDiagnostico || '';
    if (dashFiltroInicio && d < dashFiltroInicio) return false;
    if (dashFiltroFim && d > dashFiltroFim) return false;
    return true;
  };
  const ehCorretivaReal = (r) => r.tipo === 'manutencao' && r.falha && r.falha !== 'Realizado sem apontamentos';
  const filtrado = indicador.filter(dentroDoPeriodo).filter((r) => {
    if (dashFiltroTipo === 'all') return true;
    if (dashFiltroTipo === 'corretiva') return ehCorretivaReal(r);
    if (dashFiltroTipo === 'preventiva') return r.tipo === 'manutencao' && !ehCorretivaReal(r);
    if (dashFiltroTipo === 'inspecao') return r.tipo === 'inspecao';
    return true;
  });
  const corretivas = filtrado.filter(ehCorretivaReal);

  // itens de visita (SDAI) no mesmo período, usados tanto pro Resumo de Visitas quanto
  // pra trazer as corretivas "sem cadastro" (Manutenção de Itens não cadastrados) pros
  // contadores normais de Status/Falhas, junto com as corretivas de dispositivo cadastrado.
  const itensVisitaPeriodo = (data.rvt || []).flatMap((v) => (v.itens || [])
    .map((it) => ({ ...it, dataItem: it.dataIntervencao || v.data })))
    .filter((it) => {
      if (dashFiltroInicio && it.dataItem < dashFiltroInicio) return false;
      if (dashFiltroFim && it.dataItem > dashFiltroFim) return false;
      return true;
    });
  const semCadastroCorretivaItems = itensVisitaPeriodo.filter((it) =>
    it.tipo === 'outro' && it.atividade === 'manutencao_nao_cadastrada' && (it.atividadeDados || {}).tipoManutencao === 'corretiva');

  const corretivaCounts = { Aguardando: 0, Andamento: 0, Resolvido: 0 };
  corretivas.forEach((r) => { if (corretivaCounts[r.status] !== undefined) corretivaCounts[r.status] += 1; });
  semCadastroCorretivaItems.forEach((it) => {
    const statusRaw = (it.atividadeDados || {}).status || 'aguardando';
    const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
    if (corretivaCounts[status] !== undefined) corretivaCounts[status] += 1;
  });
  const inspecaoAguardando = counts.overdue;

  const corretivaStatusData = [
    { label: 'Aguardando', value: corretivaCounts.Aguardando, color: 'var(--status-danger)' },
    { label: 'Andamento', value: corretivaCounts.Andamento, color: 'var(--status-warn)' },
    { label: 'Resolvido', value: corretivaCounts.Resolvido, color: 'var(--status-ok)' },
  ].filter((d) => d.value > 0);

  const areaData = sortDesc(countBy(filtrado, (r) => r.area, 'Sem área')).slice(0, 10);
  const falhaComSemCadastro = [
    ...corretivas,
    ...semCadastroCorretivaItems.map((it) => ({ falha: it.descricao || (it.atividadeDados || {}).nomeItem || 'Sem falha' })),
  ];
  const falhaData = sortDesc(countBy(falhaComSemCadastro, (r) => r.falha, 'Sem falha')).slice(0, 10);

  // ---- Resumo de Visitas: o que mais é feito nas visitas (Manutenção/Inspeção/Atividades) ----
  let resumoPreventivaCadastrada = 0, resumoPreventivaSemCadastro = 0;
  let resumoCorretivaCadastrada = 0, resumoCorretivaSemCadastro = 0;
  let resumoInspecao = 0, resumoReuniao = 0, resumoPreparacao = 0, resumoDiagnostico = 0, resumoSeguranca = 0, resumoSemCategoria = 0;
  itensVisitaPeriodo.forEach((it) => {
    if (it.tipo === 'manutencao') {
      if (it.falha) resumoCorretivaCadastrada += 1; else resumoPreventivaCadastrada += 1;
    } else if (it.tipo === 'inspecao') {
      resumoInspecao += 1;
    } else if (it.tipo === 'outro') {
      if (it.atividade === 'reuniao') resumoReuniao += 1;
      else if (it.atividade === 'preparacao') resumoPreparacao += 1;
      else if (it.atividade === 'diagnostico') resumoDiagnostico += 1;
      else if (it.atividade === 'seguranca_trabalho') resumoSeguranca += 1;
      else if (it.atividade === 'manutencao_nao_cadastrada') {
        if ((it.atividadeDados || {}).tipoManutencao === 'preventiva') resumoPreventivaSemCadastro += 1;
        else resumoCorretivaSemCadastro += 1;
      } else resumoSemCategoria += 1;
    }
  });
  const resumoSemCadastroTotal = resumoPreventivaSemCadastro + resumoCorretivaSemCadastro;
  const resumoVisitasData = [
    { label: 'Manutenção Preventiva', value: resumoPreventivaCadastrada + resumoPreventivaSemCadastro, color: 'var(--status-ok)' },
    { label: 'Manutenção Corretiva', value: resumoCorretivaCadastrada + resumoCorretivaSemCadastro, color: 'var(--status-danger)' },
    { label: 'Inspeção', value: resumoInspecao, color: 'var(--status-warn)' },
    { label: 'Reunião', value: resumoReuniao, color: CHART_PALETTE[4] },
    { label: 'Preparação', value: resumoPreparacao, color: CHART_PALETTE[5] },
    { label: 'Diagnóstico', value: resumoDiagnostico, color: CHART_PALETTE[6] },
    { label: 'Segurança do Trabalho', value: resumoSeguranca, color: CHART_PALETTE[7] },
    { label: 'Outro (sem categoria)', value: resumoSemCategoria, color: 'var(--text-secondary)' },
  ].filter((d) => d.value > 0);

  const combateFiltrado = combateHistorico.filter((r) => {
    const d = r.data_inspecao || '';
    if (dashFiltroInicio && d < dashFiltroInicio) return false;
    if (dashFiltroFim && d > dashFiltroFim) return false;
    return true;
  });
  const combateReprovados = combateFiltrado.filter((r) => r.resultado === 'Reprovado');
  const combateAprovados = combateFiltrado.filter((r) => r.resultado === 'Aprovado');
  const combateResultadoData = [
    { label: 'Aprovado', value: combateAprovados.length, color: 'var(--status-ok)' },
    { label: 'Reprovado', value: combateReprovados.length, color: 'var(--status-danger)' },
    { label: 'Não avaliado', value: combateFiltrado.length - combateAprovados.length - combateReprovados.length, color: 'var(--status-none)' },
  ].filter((d) => d.value > 0);
  const combateCategoriaData = sortDesc(countBy(combateFiltrado, (r) => r.categoria_label, 'Sem categoria')).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
        <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{todayLabel}</p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <button className="nav-tab" data-active={painelTab === 'sdai'} onClick={() => setPainelTab('sdai')}>SDAI</button>
        <button className="nav-tab" data-active={painelTab === 'spci'} onClick={() => setPainelTab('spci')}>SPCI (Sistemas de Combate)</button>
      </div>

      {painelTab === 'sdai' && (
        <div key="sdai" className="flex flex-col gap-6 fade-in-up">
          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Prazos de inspeção</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vencidos" value={counts.overdue} color="var(--status-danger)" icon={AlertTriangle} />
              <StatCard label="A vencer (30 dias)" value={counts.soon} color="var(--status-warn)" icon={Clock} />
              <StatCard label="Em dia" value={counts.ok} color="var(--status-ok)" icon={CheckCircle2} />
              <StatCard label="Total monitorado" value={total} color="var(--text-secondary)" icon={LayoutDashboard} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Falhas e inspeções (Indicador)</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>De</label>
                  <input type="date" className="block rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={dashFiltroInicio} onChange={(e) => setDashFiltroInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Até</label>
                  <input type="date" className="block rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={dashFiltroFim} onChange={(e) => setDashFiltroFim(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                  <select className="block rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={dashFiltroTipo} onChange={(e) => setDashFiltroTipo(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                    <option value="inspecao">Inspeção</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Corretivas — Aguardando" value={corretivaCounts.Aguardando} color="var(--status-danger)" icon={AlertTriangle} />
              <StatCard label="Corretivas — Andamento" value={corretivaCounts.Andamento} color="var(--status-warn)" icon={Clock} />
              <StatCard label="Corretivas — Resolvido" value={corretivaCounts.Resolvido} color="var(--status-ok)" icon={CheckCircle2} />
              <StatCard label="Inspeção — Aguardando" value={inspecaoAguardando} color="var(--status-danger)" icon={Activity} />
            </div>

            {filtrado.length === 0 ? (
              <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum registro no período/filtro selecionado.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <ChartCard title="Status das corretivas"><SimplePieChart data={corretivaStatusData} /></ChartCard>
                <ChartCard title="Registros por área" subtitle="Onde mais aparecem"><SimpleBarChart data={areaData} /></ChartCard>
                <ChartCard title="Falhas mais comuns" subtitle="Top 10 tipos de falha"><SimpleBarChart data={falhaData} /></ChartCard>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Resumo de Visitas</h3>
            <ChartCard title="O que mais fazemos nas visitas" subtitle="Manutenção, inspeção e atividades (Reunião, Preparação, Diagnóstico, Segurança do Trabalho)">
              <SimplePieChart data={resumoVisitasData} emptyLabel="Nenhuma visita no período/filtro selecionado." />
              {resumoSemCadastroTotal > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Inclui {resumoSemCadastroTotal} manutenção(ões) em item(ns) não cadastrado(s) no sistema.
                </p>
              )}
            </ChartCard>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Itens que precisam de atenção</h3>
            {attentionItems.length === 0 ? (
              <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--status-ok)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum item vencido ou próximo do vencimento. Tudo em dia.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {attentionItems.slice(0, 12).map((it) => {
                  const actionable = ['devices', 'nacs', 'gasDetectors'].includes(it.category);
                  return (
                    <TrackableCard key={`${it.category}-${it.id}`} icon={it.icon} photo={it.photo} address={it.address} title={it.title} meta={it.meta}
                      status={{ ...computeStatus(it.nextInspection), lastMaintenance: it.lastMaintenance, lastInspection: it.lastInspection, operationalStatus: it.operationalStatus }}
                      warning={(it.type === 'entrada' || it.type === 'entrada_duplo') && !it.categoriaFuncional ? 'Categoria funcional não definida' : undefined}
                      onMaintain={canEdit && actionable ? () => onMaintain(it) : undefined} onInspect={canEdit && actionable ? () => onInspect(it) : undefined} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {painelTab === 'spci' && (
        <div key="spci" className="flex flex-col gap-6 fade-in-up">
          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Prazos de inspeção</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vencidos" value={combateCounts.overdue} color="var(--status-danger)" icon={AlertTriangle} />
              <StatCard label="A vencer (30 dias)" value={combateCounts.soon} color="var(--status-warn)" icon={Clock} />
              <StatCard label="Em dia" value={combateCounts.ok} color="var(--status-ok)" icon={CheckCircle2} />
              <StatCard label="Total monitorado" value={combateTotal} color="var(--text-secondary)" icon={Flame} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Falhas e inspeções (Indicador)</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>De</label>
                  <input type="date" className="block rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={dashFiltroInicio} onChange={(e) => setDashFiltroInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Até</label>
                  <input type="date" className="block rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    value={dashFiltroFim} onChange={(e) => setDashFiltroFim(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Registros no período" value={combateFiltrado.length} color="var(--text-secondary)" icon={Activity} />
              <StatCard label="Aprovados" value={combateAprovados.length} color="var(--status-ok)" icon={CheckCircle2} />
              <StatCard label="Reprovados" value={combateReprovados.length} color="var(--status-danger)" icon={AlertTriangle} />
              <StatCard label="Vencidos (prazo)" value={combateCounts.overdue} color="var(--status-danger)" icon={Clock} />
            </div>

            {combateFiltrado.length === 0 ? (
              <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum registro no período selecionado.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <ChartCard title="Resultado das vistorias"><SimplePieChart data={combateResultadoData} /></ChartCard>
                <ChartCard title="Registros por categoria" subtitle="Onde mais aparecem"><SimpleBarChart data={combateCategoriaData} /></ChartCard>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Itens que precisam de atenção</h3>
            {combateAttentionItems.length === 0 ? (
              <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--status-ok)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum item vencido ou próximo do vencimento. Tudo em dia.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {combateAttentionItems.slice(0, 12).map((it) => (
                  <TrackableCard key={`${it.category}-${it.id}`} icon={it.icon} photo={it.photo} address={it.address} title={it.title} meta={it.meta}
                    status={{ ...computeStatus(it.nextInspection), lastMaintenance: it.lastMaintenance, lastInspection: it.lastInspection, operationalStatus: it.operationalStatus }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelsList({ data, search, setSearch, canEdit, onOpenPanel, onCreate, onImport, onBulkDeletePanels }) {
  const filtered = data.panels.filter((p) => (p.name + ' ' + (p.location || '')).toLowerCase().includes(search.toLowerCase()));
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Painéis</h2>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            {data.panels.length > 0 && (
              selectMode ? (
                <Button variant="secondary" onClick={exitSelectMode}><X size={15} /> Cancelar seleção</Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectMode(true)}><ClipboardList size={15} /> Selecionar múltiplos</Button>
              )
            )}
            {onImport && <Button variant="secondary" onClick={onImport}><Upload size={15} /> Importar</Button>}
            <Button variant="primary" onClick={onCreate}><Plus size={16} /> Novo painel</Button>
          </div>
        )}
      </div>
          {selectedIds.length > 0 && (
            <div className="fade-in-up">
              <Button variant="danger" onClick={() => { onBulkDeletePanels(selectedIds); exitSelectMode(); }}>
                <Trash2 size={15} /> Excluir selecionados
              </Button>
            </div>
          )}

      {data.panels.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input className={`${inputCls} pl-9`} placeholder="Buscar painel por nome ou localização..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {data.panels.length === 0 ? (
        <EmptyState icon={Cpu} title="Nenhum painel cadastrado"
          description="Cadastre o painel de detecção e alarme de incêndio. Em seguida você poderá adicionar laços (loops), circuitos de saída (NACs) e os dispositivos endereçáveis."
          actionLabel={canEdit ? 'Cadastrar painel' : undefined} onAction={canEdit ? onCreate : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((panel) => {
            const loops = data.loops.filter((l) => l.panelId === panel.id);
            const nacs = data.nacs.filter((n) => n.panelId === panel.id);
            const deviceCount = data.devices.filter((d) => loops.some((l) => l.id === d.loopId)).length;
            const statuses = [
                            ...data.devices.filter((d) => loops.some((l) => l.id === d.loopId)).map((d) => computeStatus(d.nextInspection)),
                            ...nacs.map((n) => computeStatus(n.nextInspection)),
            ];
            const status = worstStatus(statuses);
            const isSelected = selectedIds.includes(panel.id);
            const cls = `text-left rounded-xl p-4 flex flex-col gap-2 transition ${selectMode ? 'cursor-pointer' : 'hover:brightness-110'}`;
            const cardStyle = { background: 'var(--surface)', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)' };
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectMode && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(panel.id)}
                        className="w-4 h-4 cursor-pointer flex-shrink-0" style={{ accentColor: 'var(--accent)' }} />
                    )}
                    <Cpu size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{panel.name}</span>
                  </div>
                  <Led color={status.color} pulse={status.key === 'overdue'} />
                </div>
                {panel.location && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{panel.location}</p>}
                <div className="flex gap-3 text-xs mono mt-1" style={{ color: 'var(--text-secondary)' }}>
                  <span>{loops.length} laço{loops.length === 1 ? '' : 's'}</span>
                  <span>{nacs.length} NAC{nacs.length === 1 ? '' : 's'}</span>
                  <span>{deviceCount} dispositivo{deviceCount === 1 ? '' : 's'}</span>
                </div>
              </>
            );
            return selectMode ? (
              <label key={panel.id} className={cls} style={cardStyle}>{content}</label>
            ) : (
              <button key={panel.id} onClick={() => onOpenPanel(panel.id)} className={cls} style={cardStyle}>{content}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dispositivos Complementares                                        */
/* ------------------------------------------------------------------ */

const COMPLEMENTAR_TABS = [
  { key: 'beam', label: 'Detector Linear (Beam)' },
  { key: 'chama', label: 'Detector de Chama' },
  { key: 'gas', label: 'Detector de Gás' },
  { key: 'termo', label: 'Termovelocimétrico' },
  { key: 'baterias_painel', label: 'Baterias de Painel' },
  { key: 'fontes_auxiliares', label: 'Fontes Auxiliares' },
];

function complementarGroupFor(categoriaFuncional) {
  if (categoriaFuncional === 'detector_linear') return 'beam';
  if (categoriaFuncional === 'detector_chama') return 'chama';
  if (['detector_gas_hc', 'detector_gas_co2', 'detector_gas_outro'].includes(categoriaFuncional)) return 'gas';
  if (categoriaFuncional === 'termovelocimetrico') return 'termo';
  return null;
}

function pairKeyComplementar(d) {
  return `${d.loopId}::${(d.address || '').split('.')[0]}`;
}

function buildComplementarGroups(devices) {
  const map = new Map();
  devices.forEach((d) => {
    const key = pairKeyComplementar(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  });
  return [...map.values()].map((itens) => ({
    key: pairKeyComplementar(itens[0]),
    etiqueta: itens[0].etiquetaComplementar || itens[0].description || '',
    baseAddress: (itens[0].address || '').split('.')[0],
    itens: [...itens].sort((a, b) => (a.papelSinal || '').localeCompare(b.papelSinal || '')),
  }));
}

function papelSinalLabel(papel) {
  if (papel === 'falha') return 'Falha';
  if (papel === 'alarme') return 'Alarme';
  return papel || 'Sinal';
}

function ComplementaresView({
  data, canEdit, onSubmitBateriaPainel, onSubmitFonteAuxiliar, onDeleteFonteAuxiliar,
  onSubmitCalibracao, onSubmitEtiqueta, onInspectDevice,
}) {
  const [tab, setTab] = useState('beam');
  const grupo1Devices = (data.devices || []).filter((d) => complementarGroupFor(d.categoriaFuncional) === tab);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Dispositivos Complementares</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Itens sem endereço próprio no laço — dependem de um módulo de entrada, ou são equipamentos auxiliares (baterias, fontes).
        </p>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {COMPLEMENTAR_TABS.map((t) => (
          <button key={t.key} className="nav-tab" data-active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {['beam', 'chama', 'gas', 'termo'].includes(tab) && (
        <div key={tab} className="fade-in-up">
          <ComplementarGrupo1List data={data} devices={grupo1Devices} canEdit={canEdit} showCalibracao={tab === 'gas'}
            onInspectDevice={onInspectDevice} onSubmitCalibracao={onSubmitCalibracao} onSubmitEtiqueta={onSubmitEtiqueta} />
        </div>
      )}
      {tab === 'baterias_painel' && (
        <div key="baterias_painel" className="fade-in-up">
          <BateriasPainelList data={data} canEdit={canEdit} onSubmit={onSubmitBateriaPainel} />
        </div>
      )}
      {tab === 'fontes_auxiliares' && (
        <div key="fontes_auxiliares" className="fade-in-up">
          <FontesAuxiliaresList data={data} canEdit={canEdit} onSubmit={onSubmitFonteAuxiliar} onDelete={onDeleteFonteAuxiliar} />
        </div>
      )}
    </div>
  );
}

function ComplementarGrupo1List({ data, devices, canEdit, showCalibracao, onInspectDevice, onSubmitCalibracao, onSubmitEtiqueta }) {
  const [editingKey, setEditingKey] = useState(null);
  const [etiquetaDraft, setEtiquetaDraft] = useState('');
  const [calibForm, setCalibForm] = useState(null);

  if (devices.length === 0) {
    return <EmptyState icon={Zap} title="Nenhum dispositivo nessa categoria"
      description="Defina a categoria funcional no cadastro do módulo de entrada (aba Painéis) pra ele aparecer aqui." />;
  }

  const grupos = buildComplementarGroups(devices);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {grupos.map((grupo) => {
        const primeiro = grupo.itens[0];
        const loop = data.loops.find((l) => l.id === primeiro.loopId);
        const panel = loop && data.panels.find((p) => p.id === loop.panelId);
        return (
          <div key={grupo.key} className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono-chip">{grupo.baseAddress}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{[loop?.name, panel?.name].filter(Boolean).join(' · ')}</span>
            </div>
            {editingKey === grupo.key ? (
              <div className="flex gap-2 flex-wrap">
                <input className={inputCls} value={etiquetaDraft} onChange={(e) => setEtiquetaDraft(e.target.value)}
                  placeholder="Etiqueta / localização" autoFocus />
                <Button variant="primary" onClick={() => {
                  grupo.itens.forEach((d) => onSubmitEtiqueta(d.id, etiquetaDraft));
                  setEditingKey(null);
                }}>Salvar</Button>
                <Button variant="secondary" onClick={() => setEditingKey(null)}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{grupo.etiqueta || 'Sem etiqueta'}</span>
                {canEdit && <IconButton title="Editar etiqueta" onClick={() => { setEditingKey(grupo.key); setEtiquetaDraft(grupo.etiqueta); }}><Pencil size={14} /></IconButton>}
              </div>
            )}
            <div className="flex flex-col gap-2 mt-1">
              {grupo.itens.map((d) => {
                const overdueCalib = showCalibracao && d.proximaCalibracao && d.proximaCalibracao < todayISO();
                return (
                  <div key={d.id} className="rounded-md p-2 flex flex-col gap-1.5" style={{ border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {papelSinalLabel(d.papelSinal)} <span className="mono-chip" style={{ marginLeft: 4 }}>{d.address}</span>
                      </span>
                    </div>
                    {showCalibracao && (
                      calibForm?.deviceId === d.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Field label="Data de calibração"><input type="date" className={inputCls} value={calibForm.dataCalibracao}
                            onChange={(e) => setCalibForm({ ...calibForm, dataCalibracao: e.target.value })} /></Field>
                          <Field label="Próxima calibração"><input type="date" className={inputCls} value={calibForm.proximaCalibracao}
                            onChange={(e) => setCalibForm({ ...calibForm, proximaCalibracao: e.target.value })} /></Field>
                          <div className="col-span-2 flex gap-2">
                            <Button variant="primary" onClick={() => { onSubmitCalibracao(d.id, { dataCalibracao: calibForm.dataCalibracao, proximaCalibracao: calibForm.proximaCalibracao }); setCalibForm(null); }}>
                              Salvar calibração
                            </Button>
                            <Button variant="secondary" onClick={() => setCalibForm(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs flex items-center justify-between gap-2" style={{ color: overdueCalib ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                          <span>
                            {d.dataCalibracao ? `Calibrado em ${formatDateBR(d.dataCalibracao)}` : 'Sem calibração registrada'}
                            {d.proximaCalibracao && ` · Próxima: ${formatDateBR(d.proximaCalibracao)}`}
                            {overdueCalib && ' · VENCIDA'}
                          </span>
                          {canEdit && <button type="button" className="text-xs underline flex-shrink-0"
                            onClick={() => setCalibForm({ deviceId: d.id, dataCalibracao: d.dataCalibracao || '', proximaCalibracao: d.proximaCalibracao || '' })}>
                            editar
                          </button>}
                        </div>
                      )
                    )}
                    {canEdit && (
                      <Button variant="secondary" onClick={() => onInspectDevice('devices', d, `${grupo.etiqueta || grupo.baseAddress} — ${papelSinalLabel(d.papelSinal)}`)}>
                        <ClipboardCheck size={15} /> Registrar inspeção
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BateriaForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState({
    tecnico: initial?.tecnico || '', dataInspecao: initial?.dataInspecao || todayISO(),
    bateria1Tensao: initial?.bateria1Tensao ?? '', bateria1Data: initial?.bateria1Data || '',
    bateria2Tensao: initial?.bateria2Tensao ?? '', bateria2Data: initial?.bateria2Data || '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="flex flex-col gap-1 mt-2">
      <Field label="Técnico"><input className={inputCls} value={v.tecnico} onChange={(e) => setV({ ...v, tecnico: e.target.value })} /></Field>
      <Field label="Data da inspeção"><input type="date" className={inputCls} value={v.dataInspecao} onChange={(e) => setV({ ...v, dataInspecao: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Bateria 1 — Tensão (V)"><input type="number" step="0.1" className={inputCls} value={v.bateria1Tensao} onChange={(e) => setV({ ...v, bateria1Tensao: e.target.value })} /></Field>
        <Field label="Bateria 1 — Data fabr./validade"><input type="date" className={inputCls} value={v.bateria1Data} onChange={(e) => setV({ ...v, bateria1Data: e.target.value })} /></Field>
        <Field label="Bateria 2 — Tensão (V)"><input type="number" step="0.1" className={inputCls} value={v.bateria2Tensao} onChange={(e) => setV({ ...v, bateria2Tensao: e.target.value })} /></Field>
        <Field label="Bateria 2 — Data fabr./validade"><input type="date" className={inputCls} value={v.bateria2Data} onChange={(e) => setV({ ...v, bateria2Data: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </FormActions>
    </form>
  );
}

function BateriasPainelList({ data, canEdit, onSubmit }) {
  const [editingPanelId, setEditingPanelId] = useState(null);

  if ((data.panels || []).length === 0) {
    return <EmptyState icon={Zap} title="Nenhum painel cadastrado" description="Cadastre um painel na aba Painéis pra ele aparecer aqui." />;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {data.panels.map((p) => {
        const bateria = (data.bateriasPainel || []).find((b) => b.panelId === p.id);
        const semBateria = !bateria || !bateria.dataInspecao;
        const vencida = !semBateria && [bateria.bateria1Data, bateria.bateria2Data].some((dt) => dt && addMonthsToDate(dt, 24) < todayISO());
        return (
          <div key={p.id} className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Baterias — {p.name}</span>
            {semBateria && (
              <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
                <AlertTriangle size={11} /> Painel sem Bateria
              </div>
            )}
            {vencida && (
              <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
                <AlertTriangle size={11} /> Bateria vencida (mais de 2 anos)
              </div>
            )}
            {!semBateria && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Última inspeção: {formatDateBR(bateria.dataInspecao)}<br />
                Bateria 1: {bateria.bateria1Tensao !== '' ? `${bateria.bateria1Tensao}V` : '—'} ({formatDateBR(bateria.bateria1Data)}) ·
                Bateria 2: {bateria.bateria2Tensao !== '' ? `${bateria.bateria2Tensao}V` : '—'} ({formatDateBR(bateria.bateria2Data)})
              </div>
            )}
            {editingPanelId === p.id ? (
              <BateriaForm initial={bateria} onSubmit={(values) => { onSubmit(p.id, values); setEditingPanelId(null); }} onCancel={() => setEditingPanelId(null)} />
            ) : (
              canEdit && <Button variant="secondary" onClick={() => setEditingPanelId(p.id)}><ClipboardCheck size={15} /> Registrar inspeção de bateria</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FonteAuxiliarForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState({
    nome: initial?.nome || '', tensaoSaidas: initial?.tensaoSaidas ?? '',
    tecnico: initial?.tecnico || '', dataInspecao: initial?.dataInspecao || todayISO(),
    bateria1Tensao: initial?.bateria1Tensao ?? '', bateria1Data: initial?.bateria1Data || '',
    bateria2Tensao: initial?.bateria2Tensao ?? '', bateria2Data: initial?.bateria2Data || '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.nome.trim()) onSubmit(v); }}>
      <Field label="Identificação *"><input autoFocus className={inputCls} value={v.nome}
        onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Ex.: Fonte auxiliar — Casa de Bombas" required /></Field>
      <Field label="Tensão nominal das saídas (V)"><input type="number" step="0.1" className={inputCls} value={v.tensaoSaidas}
        onChange={(e) => setV({ ...v, tensaoSaidas: e.target.value })} /></Field>
      <Field label="Técnico"><input className={inputCls} value={v.tecnico} onChange={(e) => setV({ ...v, tecnico: e.target.value })} /></Field>
      <Field label="Data da inspeção"><input type="date" className={inputCls} value={v.dataInspecao} onChange={(e) => setV({ ...v, dataInspecao: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Bateria 1 — Tensão (V)"><input type="number" step="0.1" className={inputCls} value={v.bateria1Tensao} onChange={(e) => setV({ ...v, bateria1Tensao: e.target.value })} /></Field>
        <Field label="Bateria 1 — Data fabr./validade"><input type="date" className={inputCls} value={v.bateria1Data} onChange={(e) => setV({ ...v, bateria1Data: e.target.value })} /></Field>
        <Field label="Bateria 2 — Tensão (V)"><input type="number" step="0.1" className={inputCls} value={v.bateria2Tensao} onChange={(e) => setV({ ...v, bateria2Tensao: e.target.value })} /></Field>
        <Field label="Bateria 2 — Data fabr./validade"><input type="date" className={inputCls} value={v.bateria2Data} onChange={(e) => setV({ ...v, bateria2Data: e.target.value })} /></Field>
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar fonte auxiliar</Button>
      </FormActions>
    </form>
  );
}

function FontesAuxiliaresList({ data, canEdit, onSubmit, onDelete }) {
  const [modalState, setModalState] = useState(null);
  const list = data.fontesAuxiliares || [];

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div>
          <Button variant="primary" onClick={() => setModalState({ mode: 'create', initial: null })}><Plus size={16} /> Nova fonte auxiliar</Button>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState icon={Zap} title="Nenhuma fonte auxiliar cadastrada" description="Cadastre a primeira fonte auxiliar."
          actionLabel={canEdit ? 'Nova fonte auxiliar' : undefined} onAction={canEdit ? () => setModalState({ mode: 'create', initial: null }) : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((f) => {
            const vencida = [f.bateria1Data, f.bateria2Data].some((dt) => dt && addMonthsToDate(dt, 24) < todayISO());
            const semInspecao = !f.dataInspecao;
            return (
              <div key={f.id} className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{f.nome}</span>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <IconButton title="Editar" onClick={() => setModalState({ mode: 'edit', initial: f })}><Pencil size={14} /></IconButton>
                      <IconButton title="Excluir" danger onClick={() => onDelete(f.id)}><Trash2 size={14} /></IconButton>
                    </div>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tensão nas saídas: {f.tensaoSaidas !== '' ? `${f.tensaoSaidas}V` : '—'}</div>
                {semInspecao && <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={11} /> Sem inspeção registrada</div>}
                {!semInspecao && vencida && <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}><AlertTriangle size={11} /> Bateria vencida (mais de 2 anos)</div>}
                {!semInspecao && (
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Última inspeção: {formatDateBR(f.dataInspecao)}<br />
                    Bateria 1: {f.bateria1Tensao !== '' ? `${f.bateria1Tensao}V` : '—'} ({formatDateBR(f.bateria1Data)}) ·
                    Bateria 2: {f.bateria2Tensao !== '' ? `${f.bateria2Tensao}V` : '—'} ({formatDateBR(f.bateria2Data)})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modalState && (
        <Modal title={modalState.mode === 'create' ? 'Nova fonte auxiliar' : 'Editar fonte auxiliar'} onClose={() => setModalState(null)}>
          <FonteAuxiliarForm initial={modalState.initial}
            onSubmit={(values) => { onSubmit(modalState.mode, modalState.initial, values); setModalState(null); }}
            onCancel={() => setModalState(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Combate a Incêndio                                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Combate a Incêndio                                                 */
/* ------------------------------------------------------------------ */

function moduleDeviceOptions(data, moduloTipo) {
  const wantedTypes = moduloTipo === 'saida' ? ['saida', 'rele'] : ['entrada', 'entrada_duplo'];
  return (data.devices || []).filter((d) => wantedTypes.includes(d.type)).map((d) => {
    const loop = data.loops.find((l) => l.id === d.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    return {
      id: d.id, panelId: panel?.id || '', panelName: panel?.name || '',
      label: `${d.description || DEVICE_TYPE_MAP[d.type]?.label || 'Dispositivo'} — End. ${d.address}${panel ? ' · ' + panel.name : ''}`,
    };
  });
}

/** Seletor de vínculo com módulo do painel: painel (cascata) → busca → lista filtrada.
    Usado sempre que precisamos linkar algo a um dispositivo já cadastrado em Painéis. */
function DeviceLinkPicker({ options, value, onChange }) {
  const [painelFiltro, setPainelFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const panelOptions = [...new Map(options.filter((o) => o.panelId).map((o) => [o.panelId, o.panelName])).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const q = busca.trim().toLowerCase();
  const filtered = options.filter((o) => (!painelFiltro || o.panelId === painelFiltro) && (!q || o.label.toLowerCase().includes(q)));
  const selected = options.find((o) => o.id === value);

  return (
    <div>
      {selected && (
        <div className="mb-2 p-2 rounded-lg text-xs flex items-center justify-between gap-2" style={{ border: '1px solid var(--accent)', color: 'var(--text-primary)' }}>
          <span className="truncate">{selected.label}</span>
          <button type="button" onClick={() => onChange('')} className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>remover</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <select className={inputCls} value={painelFiltro} onChange={(e) => setPainelFiltro(e.target.value)}>
          <option value="">Todos os painéis</option>
          {panelOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Buscar dispositivo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {filtered.length === 0 && <div className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhum dispositivo encontrado.</div>}
        {filtered.map((o) => (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className="w-full text-left px-3 py-2 text-xs"
            style={{ background: value === o.id ? 'var(--surface-raised)' : 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConjuntoForm({ initial, tipo, agente, panelOptions, onSubmit, onCancel }) {
  const [v, setV] = useState({ etiqueta: initial?.etiqueta || '', panelId: initial?.panelId || '' });
  const tipoInfo = COMBATE_CONJUNTO_TIPOS[tipo];
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.etiqueta.trim()) onSubmit({ tipo, agente, etiqueta: v.etiqueta.trim(), panelId: v.panelId }); }}>
      <div className="mb-3 p-2 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
        Ao salvar, os {tipoInfo?.subItens.length} sub-itens de checklist de <strong style={{ color: 'var(--text-primary)' }}>{tipoInfo?.label}</strong> já nascem prontos, cada um com seu método travado.
      </div>
      <Field label="Identificação *"><input autoFocus className={inputCls} value={v.etiqueta}
        onChange={(e) => setV({ ...v, etiqueta: e.target.value })} placeholder="Ex.: Casa de Bombas 1, Hidrante Corredor 2º andar, VGA Setor A" required /></Field>
      <Field label="Painel vinculado (opcional)">
        <select className={inputCls} value={v.panelId} onChange={(e) => setV({ ...v, panelId: e.target.value })}>
          <option value="">Sem painel específico</option>
          {panelOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </FormActions>
    </form>
  );
}

function SubitemEditForm({ subitem, info, isLge, onSave, onCancel }) {
  const [v, setV] = useState({
    tecnico: subitem.tecnico || '', dataInspecao: subitem.dataInspecao || todayISO(),
    resultadoTeste: subitem.resultadoTeste || '', valorMedido: subitem.valorMedido ?? '',
    observacoes: subitem.observacoes || '', falha: subitem.falha || '', proximaInspecao: subitem.proximaInspecao || '',
    dataRetestLaboratorial: subitem.dataRetestLaboratorial || '', proximaRetestLaboratorial: subitem.proximaRetestLaboratorial || '',
  });
  return (
    <div className="mt-2 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
      <Field label="Técnico"><input className={inputCls} value={v.tecnico} onChange={(e) => setV({ ...v, tecnico: e.target.value })} /></Field>
      <Field label="Data da inspeção"><input type="date" className={inputCls} value={v.dataInspecao} onChange={(e) => setV({ ...v, dataInspecao: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Resultado do teste">
          <select className={inputCls} value={v.resultadoTeste} onChange={(e) => setV({ ...v, resultadoTeste: e.target.value })}>
            <option value="">Não avaliado</option>
            <option>Aprovado</option><option>Reprovado</option>
          </select>
        </Field>
        <Field label={`Valor medido${info?.unidade ? ` (${info.unidade})` : ''}`}>
          <input className={inputCls} value={v.valorMedido} onChange={(e) => setV({ ...v, valorMedido: e.target.value })} />
        </Field>
      </div>
      <Field label="Observações"><textarea className={`${inputCls} min-h-[60px]`} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></Field>
      <Field label="Falha (opcional)"><textarea className={`${inputCls} min-h-[50px]`} value={v.falha} onChange={(e) => setV({ ...v, falha: e.target.value })} /></Field>
      <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.proximaInspecao} onChange={(e) => setV({ ...v, proximaInspecao: e.target.value })} /></Field>
      {isLge && (
        <div className="mt-1 p-2 rounded-lg" style={{ border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Item de teste laboratorial (terceirizado)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data do último retest"><input type="date" className={inputCls} value={v.dataRetestLaboratorial}
              onChange={(e) => setV({ ...v, dataRetestLaboratorial: e.target.value })} /></Field>
            <Field label="Próximo retest"><input type="date" className={inputCls} value={v.proximaRetestLaboratorial}
              onChange={(e) => setV({ ...v, proximaRetestLaboratorial: e.target.value })} /></Field>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap mt-2">
        <Button variant="primary" onClick={() => onSave(v)}>Salvar</Button>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function ConjuntoCard({ conjunto, subitens, panelOptions, canEdit, onEditConjunto, onDeleteConjunto, onSubmitSubitem }) {
  const [expanded, setExpanded] = useState(false);
  const [editingSubitemId, setEditingSubitemId] = useState(null);
  const tipoInfo = COMBATE_CONJUNTO_TIPOS[conjunto.tipo];
  const panel = panelOptions.find((p) => p.id === conjunto.panelId);
  const nSemInspecao = subitens.filter((s) => !s.dataInspecao).length;

  return (
    <div className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center justify-between gap-2 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="min-w-0">
          <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{conjunto.etiqueta}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tipoInfo?.label}{panel ? ` · ${panel.name}` : ''} · {subitens.length} sub-item(ns)</div>
        </div>
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {nSemInspecao > 0 && (
        <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
          <AlertTriangle size={11} /> {nSemInspecao} sub-item(ns) sem inspeção registrada
        </div>
      )}
      {canEdit && (
        <div className="flex gap-1">
          <IconButton title="Editar" onClick={() => onEditConjunto(conjunto)}><Pencil size={14} /></IconButton>
          <IconButton title="Excluir" danger onClick={() => onDeleteConjunto(conjunto.id)}><Trash2 size={14} /></IconButton>
        </div>
      )}
      {expanded && (
        <div className="flex flex-col gap-2 mt-1 pt-2 fade-in-up" style={{ borderTop: '1px solid var(--border)' }}>
          {subitens.map((s) => {
            const info = conjuntoSubitemInfo(conjunto.tipo, s.categoria);
            const isLgeTanque = conjunto.tipo === 'lge' && s.categoria === 'tanque_lge';
            const retestVencido = isLgeTanque && s.proximaRetestLaboratorial && s.proximaRetestLaboratorial < todayISO();
            return (
              <div key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{info?.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{info?.metodo} · {info?.periodicidade}</div>
                    {!s.dataInspecao ? (
                      <div className="text-xs" style={{ color: 'var(--status-danger)' }}>Sem inspeção registrada</div>
                    ) : (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Última inspeção: {formatDateBR(s.dataInspecao)} · {s.resultadoTeste || 'Não avaliado'}
                        {s.valorMedido !== '' && ` · ${s.valorMedido}${info?.unidade ? ' ' + info.unidade : ''}`}
                      </div>
                    )}
                    {isLgeTanque && (
                      <div className="text-xs flex items-center gap-1" style={{ color: retestVencido ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                        {retestVencido && <AlertTriangle size={11} />}
                        {s.dataRetestLaboratorial ? `Retest lab.: ${formatDateBR(s.dataRetestLaboratorial)}` : 'Sem retest laboratorial'}
                        {s.proximaRetestLaboratorial && ` · Próximo: ${formatDateBR(s.proximaRetestLaboratorial)}`}
                      </div>
                    )}
                  </div>
                  {canEdit && editingSubitemId !== s.id && (
                    <button type="button" onClick={() => setEditingSubitemId(s.id)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', fontSize: 11, fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}>
                      Registrar inspeção
                    </button>
                  )}
                </div>
                {editingSubitemId === s.id && (
                  <div className="fade-in-up">
                    <SubitemEditForm subitem={s} info={info} isLge={isLgeTanque}
                      onSave={(values) => { onSubmitSubitem(s.id, values); setEditingSubitemId(null); }}
                      onCancel={() => setEditingSubitemId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConjuntosList({ data, canEdit, tipo, agente, onSubmitConjunto, onDeleteConjunto, onSubmitSubitem }) {
  const [modalState, setModalState] = useState(null);
  const panelOptions = data.panels || [];
  const conjuntos = (data.combateConjuntos || []).filter((c) => c.tipo === tipo && (tipo !== 'sistema_gas' || c.agente === agente));
  const tipoInfo = COMBATE_CONJUNTO_TIPOS[tipo];

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div><Button variant="primary" onClick={() => setModalState({ mode: 'create', initial: null })}><Plus size={16} /> Novo {tipoInfo?.label}</Button></div>
      )}
      {conjuntos.length === 0 ? (
        <EmptyState icon={Flame} title={`Nenhum ${tipoInfo?.label} cadastrado`} description="Cadastre pra gerar o checklist de inspeção automaticamente."
          actionLabel={canEdit ? `Novo ${tipoInfo?.label}` : undefined} onAction={canEdit ? () => setModalState({ mode: 'create', initial: null }) : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {conjuntos.map((c) => (
            <ConjuntoCard key={c.id} conjunto={c} subitens={(data.combateSubitens || []).filter((s) => s.conjuntoId === c.id)}
              panelOptions={panelOptions} canEdit={canEdit}
              onEditConjunto={(conj) => setModalState({ mode: 'edit', initial: conj })}
              onDeleteConjunto={onDeleteConjunto} onSubmitSubitem={onSubmitSubitem} />
          ))}
        </div>
      )}
      {modalState && (
        <Modal title={modalState.mode === 'create' ? `Novo ${tipoInfo?.label}` : `Editar ${tipoInfo?.label}`} onClose={() => setModalState(null)}>
          <ConjuntoForm initial={modalState.initial} tipo={tipo} agente={agente} panelOptions={panelOptions}
            onSubmit={(values) => { onSubmitConjunto(modalState.mode, modalState.initial, values); setModalState(null); }}
            onCancel={() => setModalState(null)} />
        </Modal>
      )}
    </div>
  );
}

function ComponenteForm({ initial, data, onSubmit, onCancel }) {
  const [v, setV] = useState({
    tipo: initial?.tipo || '', etiqueta: initial?.etiqueta || '', conjuntoId: initial?.conjuntoId || '', dispositivoId: initial?.dispositivoId || '',
    tecnico: initial?.tecnico || '', dataInspecao: initial?.dataInspecao || todayISO(), resultadoTeste: initial?.resultadoTeste || '',
    valorMedido: initial?.valorMedido ?? '', observacoes: initial?.observacoes || '', falha: initial?.falha || '', proximaInspecao: initial?.proximaInspecao || '',
  });
  const tipoInfo = COMBATE_COMPONENTE_TIPO_MAP[v.tipo];
  const deviceOptions = tipoInfo ? moduleDeviceOptions(data, tipoInfo.moduloTipo) : [];
  const conjuntoOptions = data.combateConjuntos || [];

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.tipo) onSubmit(v); }}>
      <Field label="Tipo de componente *">
        <select className={inputCls} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value, dispositivoId: '' })} required>
          <option value="">Selecione...</option>
          {COMBATE_COMPONENTE_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      {tipoInfo && (
        <div className="mb-3 p-2 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <div>Método: <strong style={{ color: 'var(--text-primary)' }}>{tipoInfo.metodo}</strong></div>
          <div>Periodicidade: <strong style={{ color: 'var(--text-primary)' }}>{tipoInfo.periodicidade}</strong></div>
        </div>
      )}
      <Field label="Identificação / etiqueta"><input className={inputCls} value={v.etiqueta}
        onChange={(e) => setV({ ...v, etiqueta: e.target.value })} placeholder="Ex.: Fluxostato 2º andar" /></Field>
      <Field label="Pertence a (opcional)">
        <select className={inputCls} value={v.conjuntoId} onChange={(e) => setV({ ...v, conjuntoId: e.target.value })}>
          <option value="">Sem vínculo</option>
          {conjuntoOptions.map((c) => <option key={c.id} value={c.id}>{c.etiqueta} ({COMBATE_CONJUNTO_TIPOS[c.tipo]?.label})</option>)}
        </select>
      </Field>
      <Field label={`Módulo do painel (${tipoInfo?.moduloTipo === 'saida' ? 'Saída/Relé' : 'Entrada'}, opcional)`}>
        {tipoInfo ? (
          <DeviceLinkPicker options={deviceOptions} value={v.dispositivoId} onChange={(id) => setV({ ...v, dispositivoId: id })} />
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Selecione o tipo de componente primeiro.</p>
        )}
      </Field>
      <Field label="Técnico"><input className={inputCls} value={v.tecnico} onChange={(e) => setV({ ...v, tecnico: e.target.value })} /></Field>
      <Field label="Data da inspeção"><input type="date" className={inputCls} value={v.dataInspecao} onChange={(e) => setV({ ...v, dataInspecao: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Resultado do teste">
          <select className={inputCls} value={v.resultadoTeste} onChange={(e) => setV({ ...v, resultadoTeste: e.target.value })}>
            <option value="">Não avaliado</option>
            <option>Aprovado</option><option>Reprovado</option>
          </select>
        </Field>
        <Field label={`Valor medido${tipoInfo?.unidade ? ` (${tipoInfo.unidade})` : ''}`}>
          <input className={inputCls} value={v.valorMedido} onChange={(e) => setV({ ...v, valorMedido: e.target.value })} />
        </Field>
      </div>
      <Field label="Observações"><textarea className={`${inputCls} min-h-[60px]`} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></Field>
      <Field label="Falha (opcional)"><textarea className={`${inputCls} min-h-[50px]`} value={v.falha} onChange={(e) => setV({ ...v, falha: e.target.value })} /></Field>
      <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.proximaInspecao} onChange={(e) => setV({ ...v, proximaInspecao: e.target.value })} /></Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </FormActions>
    </form>
  );
}

function ComponentesList({ data, canEdit, onSubmit, onDelete }) {
  const [modalState, setModalState] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const list = (data.combateComponentes || []).filter((c) => !filtroTipo || c.tipo === filtroTipo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <button type="button" onClick={() => setFiltroTipo('')} className="nav-tab" data-active={filtroTipo === ''}>Todos</button>
          {COMBATE_COMPONENTE_TIPOS.map((t) => (
            <button key={t.value} type="button" onClick={() => setFiltroTipo(t.value)} className="nav-tab" data-active={filtroTipo === t.value}>{t.label}</button>
          ))}
        </div>
        {canEdit && <Button variant="primary" onClick={() => setModalState({ mode: 'create', initial: null })}><Plus size={16} /> Novo componente</Button>}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Zap} title="Nenhum componente cadastrado" description="Fluxostatos, pressostatos, solenoides e chaves supervisoras entram aqui, quantos precisar."
          actionLabel={canEdit ? 'Novo componente' : undefined} onAction={canEdit ? () => setModalState({ mode: 'create', initial: null }) : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((c) => {
            const tipoInfo = COMBATE_COMPONENTE_TIPO_MAP[c.tipo];
            const conjunto = (data.combateConjuntos || []).find((cj) => cj.id === c.conjuntoId);
            const device = (data.devices || []).find((d) => d.id === c.dispositivoId);
            const semInspecao = !c.dataInspecao;
            return (
              <div key={c.id} className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.etiqueta || tipoInfo?.label}</span>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <IconButton title="Editar" onClick={() => setModalState({ mode: 'edit', initial: c })}><Pencil size={14} /></IconButton>
                      <IconButton title="Excluir" danger onClick={() => onDelete(c.id)}><Trash2 size={14} /></IconButton>
                    </div>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {tipoInfo?.label}{conjunto ? ` · Pertence a: ${conjunto.etiqueta}` : ''}{device ? ` · Módulo: ${device.address}` : ''}
                </div>
                {semInspecao ? (
                  <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
                    <AlertTriangle size={11} /> Sem inspeção registrada
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Última inspeção: {formatDateBR(c.dataInspecao)} · {c.resultadoTeste || 'Não avaliado'}
                    {c.valorMedido !== '' && ` · ${c.valorMedido}${tipoInfo?.unidade ? ' ' + tipoInfo.unidade : ''}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modalState && (
        <Modal title={modalState.mode === 'create' ? 'Novo componente' : 'Editar componente'} onClose={() => setModalState(null)}>
          <ComponenteForm initial={modalState.initial} data={data}
            onSubmit={(values) => { onSubmit(modalState.mode, modalState.initial, values); setModalState(null); }}
            onCancel={() => setModalState(null)} />
        </Modal>
      )}
    </div>
  );
}

function BateriaCilindrosForm({ initial, panelOptions, onSubmit, onCancel }) {
  const [v, setV] = useState({ etiqueta: initial?.etiqueta || '', panelId: initial?.panelId || '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.etiqueta.trim()) onSubmit(v); }}>
      <Field label="Identificação *"><input autoFocus className={inputCls} value={v.etiqueta}
        onChange={(e) => setV({ ...v, etiqueta: e.target.value })} placeholder="Ex.: Bateria CO2 - Sala Eletrica" required /></Field>
      <Field label="Painel vinculado (opcional)">
        <select className={inputCls} value={v.panelId} onChange={(e) => setV({ ...v, panelId: e.target.value })}>
          <option value="">Sem painel específico</option>
          {panelOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </FormActions>
    </form>
  );
}

function CilindroForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState({
    identificacao: initial?.identificacao || '', tecnico: initial?.tecnico || '', dataInspecao: initial?.dataInspecao || todayISO(),
    resultadoValvula: initial?.resultadoValvula || '', resultadoManometro: initial?.resultadoManometro || '',
    resultadoCorpo: initial?.resultadoCorpo || '', resultadoEtiqueta: initial?.resultadoEtiqueta || '',
    observacoes: initial?.observacoes || '', falha: initial?.falha || '', proximaInspecao: initial?.proximaInspecao || '',
    dataRetestLaboratorial: initial?.dataRetestLaboratorial || '',
  });
  const resultadoKeyMap = { valvula: 'resultadoValvula', manometro: 'resultadoManometro', corpo: 'resultadoCorpo', etiqueta: 'resultadoEtiqueta' };
  const proximaRetestPreview = v.dataRetestLaboratorial ? addMonthsToDate(v.dataRetestLaboratorial, COMBATE_RETEST_LABORATORIAL_MESES) : '';

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.identificacao.trim()) onSubmit(v); }}>
      <Field label="Identificação do cilindro *"><input autoFocus className={inputCls} value={v.identificacao}
        onChange={(e) => setV({ ...v, identificacao: e.target.value })} placeholder="Ex.: Cilindro 1" required /></Field>
      <Field label="Técnico"><input className={inputCls} value={v.tecnico} onChange={(e) => setV({ ...v, tecnico: e.target.value })} /></Field>
      <Field label="Data da inspeção"><input type="date" className={inputCls} value={v.dataInspecao} onChange={(e) => setV({ ...v, dataInspecao: e.target.value })} /></Field>
      <div className="mb-3 p-2 rounded-lg" style={{ border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Checklist do cilindro</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMBATE_CILINDRO_ITENS.map((item) => (
            <Field key={item.key} label={item.label}>
              <select className={inputCls} value={v[resultadoKeyMap[item.key]]}
                onChange={(e) => setV({ ...v, [resultadoKeyMap[item.key]]: e.target.value })}>
                <option value="">Não avaliado</option>
                <option>Aprovado</option><option>Reprovado</option>
              </select>
            </Field>
          ))}
        </div>
      </div>
      <Field label="Observações"><textarea className={`${inputCls} min-h-[60px]`} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></Field>
      <Field label="Falha (opcional)"><textarea className={`${inputCls} min-h-[50px]`} value={v.falha} onChange={(e) => setV({ ...v, falha: e.target.value })} /></Field>
      <Field label="Próxima inspeção"><input type="date" className={inputCls} value={v.proximaInspecao} onChange={(e) => setV({ ...v, proximaInspecao: e.target.value })} /></Field>
      <div className="mt-1 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Retest laboratorial (terceirizado)</p>
        <Field label="Data do retest">
          <input type="date" className={inputCls} value={v.dataRetestLaboratorial} onChange={(e) => setV({ ...v, dataRetestLaboratorial: e.target.value })} />
        </Field>
        {proximaRetestPreview && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Próximo retest (automático, +5 anos): <strong style={{ color: 'var(--text-primary)' }}>{formatDateBR(proximaRetestPreview)}</strong></p>
        )}
      </div>
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </FormActions>
    </form>
  );
}

function BateriaCard({ bateria, cilindros, panelOptions, canEdit, onEditBateria, onDeleteBateria, onSubmitCilindro, onDeleteCilindro }) {
  const [expanded, setExpanded] = useState(false);
  const [modalState, setModalState] = useState(null);
  const panel = panelOptions.find((p) => p.id === bateria.panelId);
  const nSemInspecao = cilindros.filter((c) => !c.dataInspecao).length;
  const nRetestVencido = cilindros.filter((c) => c.proximaRetestLaboratorial && c.proximaRetestLaboratorial < todayISO()).length;

  return (
    <div className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center justify-between gap-2 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="min-w-0">
          <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{bateria.etiqueta}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{panel ? panel.name + ' · ' : ''}{cilindros.length} cilindro(s)</div>
        </div>
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {nSemInspecao > 0 && (
        <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
          <AlertTriangle size={11} /> {nSemInspecao} cilindro(s) sem inspeção
        </div>
      )}
      {nRetestVencido > 0 && (
        <div className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
          <AlertTriangle size={11} /> {nRetestVencido} cilindro(s) com retest laboratorial vencido
        </div>
      )}
      {canEdit && (
        <div className="flex gap-1 flex-wrap">
          <IconButton title="Editar" onClick={() => onEditBateria(bateria)}><Pencil size={14} /></IconButton>
          <IconButton title="Excluir" danger onClick={() => onDeleteBateria(bateria.id)}><Trash2 size={14} /></IconButton>
          <Button variant="secondary" onClick={() => setModalState({ mode: 'create', initial: null })}><Plus size={15} /> Adicionar cilindro</Button>
        </div>
      )}
      {expanded && (
        <div className="flex flex-col gap-2 mt-1 pt-2 fade-in-up" style={{ borderTop: '1px solid var(--border)' }}>
          {cilindros.length === 0 && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhum cilindro cadastrado nessa bateria ainda.</p>}
          {cilindros.map((c) => {
            const retestVencido = c.proximaRetestLaboratorial && c.proximaRetestLaboratorial < todayISO();
            return (
              <div key={c.id} className="flex items-start justify-between gap-2 p-2 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.identificacao}</div>
                  {!c.dataInspecao ? (
                    <div className="text-xs" style={{ color: 'var(--status-danger)' }}>Sem inspeção registrada</div>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateBR(c.dataInspecao)} · Válvula: {c.resultadoValvula || '—'} · Manômetro: {c.resultadoManometro || '—'} · Corpo: {c.resultadoCorpo || '—'} · Etiqueta: {c.resultadoEtiqueta || '—'}
                    </div>
                  )}
                  <div className="text-xs flex items-center gap-1" style={{ color: retestVencido ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                    {retestVencido && <AlertTriangle size={11} />}
                    {c.dataRetestLaboratorial ? `Retest lab.: ${formatDateBR(c.dataRetestLaboratorial)} · Próximo: ${formatDateBR(c.proximaRetestLaboratorial)}` : 'Sem retest laboratorial'}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <IconButton title="Editar" onClick={() => setModalState({ mode: 'edit', initial: c })}><Pencil size={14} /></IconButton>
                    <IconButton title="Excluir" danger onClick={() => onDeleteCilindro(c.id)}><Trash2 size={14} /></IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modalState && (
        <Modal title={modalState.mode === 'create' ? 'Novo cilindro' : 'Editar cilindro'} onClose={() => setModalState(null)}>
          <CilindroForm initial={modalState.initial}
            onSubmit={(values) => { onSubmitCilindro(modalState.mode, modalState.initial, bateria.id, values); setModalState(null); }}
            onCancel={() => setModalState(null)} />
        </Modal>
      )}
    </div>
  );
}

function BateriasCilindrosList({ data, canEdit, agente, onSubmitBateria, onDeleteBateria, onSubmitCilindro, onDeleteCilindro }) {
  const [modalState, setModalState] = useState(null);
  const panelOptions = data.panels || [];
  const baterias = (data.combateBaterias || []).filter((b) => b.agente === agente);

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div><Button variant="primary" onClick={() => setModalState({ mode: 'create', initial: null })}><Plus size={16} /> Nova bateria de cilindros</Button></div>
      )}
      {baterias.length === 0 ? (
        <EmptyState icon={Flame} title="Nenhuma bateria cadastrada" description="Cadastre a bateria e depois adicione os cilindros um a um."
          actionLabel={canEdit ? 'Nova bateria de cilindros' : undefined} onAction={canEdit ? () => setModalState({ mode: 'create', initial: null }) : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {baterias.map((b) => (
            <BateriaCard key={b.id} bateria={b} cilindros={(data.combateCilindros || []).filter((c) => c.bateriaId === b.id)}
              panelOptions={panelOptions} canEdit={canEdit}
              onEditBateria={(bat) => setModalState({ mode: 'edit', initial: bat })}
              onDeleteBateria={onDeleteBateria} onSubmitCilindro={onSubmitCilindro} onDeleteCilindro={onDeleteCilindro} />
          ))}
        </div>
      )}
      {modalState && (
        <Modal title={modalState.mode === 'create' ? 'Nova bateria de cilindros' : 'Editar bateria de cilindros'} onClose={() => setModalState(null)}>
          <BateriaCilindrosForm initial={modalState.initial} panelOptions={panelOptions}
            onSubmit={(values) => { onSubmitBateria(modalState.mode, modalState.initial, { ...values, agente }); setModalState(null); }}
            onCancel={() => setModalState(null)} />
        </Modal>
      )}
    </div>
  );
}

function CombateHistoricoView({ clientId }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    listCombateHistorico(clientId).then((rows) => { if (ativo) { setHistorico(rows); setLoading(false); } })
      .catch((err) => { console.error(err); if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [clientId]);

  const tipoLabels = { subitem: 'Conjunto', componente: 'Componente', cilindro: 'Cilindro' };
  const filtrado = historico.filter((r) => {
    if (filtroTecnico && !(r.tecnico || '').toLowerCase().includes(filtroTecnico.toLowerCase())) return false;
    if (filtroTipo && r.tipo_item !== filtroTipo) return false;
    if (filtroDataDe && r.data_inspecao < filtroDataDe) return false;
    if (filtroDataAte && r.data_inspecao > filtroDataAte) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Histórico de vistorias registradas em Sistemas de Combate — cada linha é 1 registro, mesmo que o item tenha sido vistoriado várias vezes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input className={inputCls} placeholder="Buscar técnico..." value={filtroTecnico} onChange={(e) => setFiltroTecnico(e.target.value)} />
        <select className={inputCls} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="subitem">Conjunto</option>
          <option value="componente">Componente</option>
          <option value="cilindro">Cilindro</option>
        </select>
        <input type="date" className={inputCls} value={filtroDataDe} onChange={(e) => setFiltroDataDe(e.target.value)} />
        <input type="date" className={inputCls} value={filtroDataAte} onChange={(e) => setFiltroDataAte(e.target.value)} />
      </div>
      {loading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: '40%', height: 13 }} />
              <div className="skeleton" style={{ width: '65%', height: 11 }} />
            </div>
          ))}
        </div>
      )}
      {!loading && filtrado.length === 0 && (
        <EmptyState icon={Activity} title="Nenhum registro no histórico" description="Vistorias registradas pela sub-aba 'Visita (Sistemas de Combate)' em Atendimentos aparecem aqui." />
      )}
      <div className="flex flex-col gap-2">
        {filtrado.map((r) => (
          <div key={r.id} className="rounded-lg p-3 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.categoria_label}{r.contexto_label ? ` — ${r.contexto_label}` : ''}</span>
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{tipoLabels[r.tipo_item] || r.tipo_item}</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDateBR(r.data_inspecao)} · {r.tecnico || 'sem técnico'} · <strong style={{ color: r.resultado === 'Reprovado' ? 'var(--status-danger)' : 'var(--text-primary)' }}>{r.resultado || 'Não avaliado'}</strong>
            </div>
            {r.falha && <div className="text-xs" style={{ color: 'var(--status-danger)' }}>Falha: {r.falha}</div>}
            {r.observacoes && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.observacoes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CombateIncendioView({
  data, canEdit, clientId, onSubmitConjunto, onDeleteConjunto, onSubmitSubitem, onSubmitComponente, onDeleteComponente,
  onSubmitBateria, onDeleteBateria, onSubmitCilindro, onDeleteCilindro,
}) {
  const [grupo, setGrupo] = useState('agua');
  const [aguaTipo, setAguaTipo] = useState('casa_bombas');
  const [gasAgente, setGasAgente] = useState('co2');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Sistemas de Combate</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Conjuntos (checklist fixo, item a item) e Componentes (fluxostatos, pressostatos, solenoides — cadastro livre, linkáveis a um módulo do painel).
        </p>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <button className="nav-tab" data-active={grupo === 'agua'} onClick={() => setGrupo('agua')}>Água</button>
        <button className="nav-tab" data-active={grupo === 'gas'} onClick={() => setGrupo('gas')}>Agentes Gasosos</button>
        <button className="nav-tab" data-active={grupo === 'componentes'} onClick={() => setGrupo('componentes')}>Componentes</button>
      </div>

      {grupo === 'agua' && (
        <div key="agua" className="flex flex-col gap-4 fade-in-up">
          <div className="flex gap-1 flex-wrap">
            {COMBATE_AGUA_TIPOS.map((t) => (
              <button key={t} type="button" onClick={() => setAguaTipo(t)} className="nav-tab" data-active={aguaTipo === t}>
                {COMBATE_CONJUNTO_TIPOS[t]?.label}
              </button>
            ))}
          </div>
          <ConjuntosList key={aguaTipo} data={data} canEdit={canEdit} tipo={aguaTipo} agente={null}
            onSubmitConjunto={onSubmitConjunto} onDeleteConjunto={onDeleteConjunto} onSubmitSubitem={onSubmitSubitem} />
        </div>
      )}

      {grupo === 'gas' && (
        <div key="gas" className="flex flex-col gap-4 fade-in-up">
          <div className="flex gap-1 flex-wrap">
            {COMBATE_GAS_AGENTES.map((a) => (
              <button key={a.value} type="button" onClick={() => setGasAgente(a.value)} className="nav-tab" data-active={gasAgente === a.value}>{a.label}</button>
            ))}
          </div>
          <div key={gasAgente} className="flex flex-col gap-4 fade-in-up">
            <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Sistema</h3>
            <ConjuntosList data={data} canEdit={canEdit} tipo="sistema_gas" agente={gasAgente}
              onSubmitConjunto={onSubmitConjunto} onDeleteConjunto={onDeleteConjunto} onSubmitSubitem={onSubmitSubitem} />
            <h3 className="font-medium text-sm mt-2" style={{ color: 'var(--text-primary)' }}>Bateria de Cilindros</h3>
            <BateriasCilindrosList data={data} canEdit={canEdit} agente={gasAgente}
              onSubmitBateria={onSubmitBateria} onDeleteBateria={onDeleteBateria}
              onSubmitCilindro={onSubmitCilindro} onDeleteCilindro={onDeleteCilindro} />
          </div>
        </div>
      )}

      {grupo === 'componentes' && (
        <div key="componentes" className="fade-in-up">
          <ComponentesList data={data} canEdit={canEdit} onSubmit={onSubmitComponente} onDelete={onDeleteComponente} />
        </div>
      )}
    </div>
  );
}

function PanelDetail({
  data, panelId, tab, setTab, canEdit, expandedLoops, setExpandedLoops, onBack, onEditPanel, onDeletePanel,
  onCreateLoop, onEditLoop, onDeleteLoop, onCreateNac, onEditNac, onDeleteNac,
  onCreateDevice, onEditDevice, onDeleteDevice, onMaintainDevice, onInspectDevice, onMaintainNac, onInspectNac,
  onBulkMaintainDevices, onBulkInspectDevices, onBulkDeleteDevices,
}) {
  const panel = data.panels.find((p) => p.id === panelId);
  const [deviceSearch, setDeviceSearch] = useState('');
  function selectByType(ids) {
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  }
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }
  if (!panel) return null;
  const loops = data.loops.filter((l) => l.panelId === panelId);
  const nacs = data.nacs.filter((n) => n.panelId === panelId);

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm w-fit" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={15} /> Painéis
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{panel.name}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{[panel.location, panel.model].filter(Boolean).join(' · ') || 'Sem informações adicionais'}</p>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <IconButton title="Editar painel" onClick={() => onEditPanel(panel)}><Pencil size={16} /></IconButton>
            <IconButton title="Excluir painel" danger onClick={() => onDeletePanel(panel)}><Trash2 size={16} /></IconButton>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        <button className="nav-tab" data-active={tab === 'loops'} onClick={() => setTab('loops')}>Laços ({loops.length})</button>
        <button className="nav-tab" data-active={tab === 'nacs'} onClick={() => setTab('nacs')}>Circuitos de saída — NAC ({nacs.length})</button>
      </div>

      {tab === 'loops' && (
        <div key="loops" className="flex flex-col gap-3 fade-in-up">
          {canEdit && (
            <div className="flex justify-end gap-2 flex-wrap">
              {selectMode ? (
                <Button variant="secondary" onClick={exitSelectMode}><X size={15} /> Cancelar seleção</Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectMode(true)}><ClipboardList size={15} /> Selecionar múltiplos</Button>
              )}
              <Button variant="primary" onClick={() => onCreateLoop(panelId)}><Plus size={15} /> Novo laço</Button>
            </div>
          )}
          {selectMode && (
            <div className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap fade-in-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {selectedIds.length === 0 ? 'Marque os dispositivos que quer atualizar de uma vez.' : `${selectedIds.length} dispositivo(s) selecionado(s)`}
              </p>
              {selectedIds.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="danger" onClick={() => { onBulkDeleteDevices(selectedIds); exitSelectMode(); }}><Trash2 size={15} /> Excluir</Button>
                </div>
              )}
            </div>
          )}
          {loops.length === 0 ? (
            <EmptyState icon={Cpu} title="Nenhum laço cadastrado" description="Adicione um laço para começar a cadastrar detectores, acionadores e módulos endereçáveis."
              actionLabel={canEdit ? 'Adicionar laço' : undefined} onAction={canEdit ? () => onCreateLoop(panelId) : undefined} />
          ) : (
            <>
              {loops.some((l) => data.devices.some((d) => d.loopId === l.id)) && (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input className={`${inputCls} pl-9`} placeholder="Buscar dispositivo por endereço, modelo ou local..."
                    value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} />
                </div>
              )}
              {loops.map((loop) => {
                const q = deviceSearch.trim().toLowerCase();
                const allDevices = data.devices.filter((d) => d.loopId === loop.id).sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }));
                const devices = q
                  ? allDevices.filter((d) => `${d.address} ${d.modelo || ''} ${d.description || ''}`.toLowerCase().includes(q))
                  : allDevices;
                if (q && devices.length === 0) return null;
                                const status = worstStatus(allDevices.map((d) => computeStatus(d.nextInspection)));
                const expanded = (q || selectMode) ? true : !!expandedLoops[loop.id];
                return (
                  <div key={loop.id} className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 p-3.5">
                      <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setExpandedLoops((prev) => ({ ...prev, [loop.id]: !prev[loop.id] }))}>
                        {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />}
                        <Led color={status.color} pulse={status.key === 'overdue'} />
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{loop.name}</span>
                        <span className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>
                          {q ? `${devices.length} de ${allDevices.length}` : allDevices.length} dispositivo{allDevices.length === 1 ? '' : 's'}
                        </span>
                      </button>
                      {canEdit && (
                        <>
                          <IconButton title="Novo dispositivo" onClick={() => onCreateDevice(loop.id)}><Plus size={15} /></IconButton>
                          <IconButton title="Editar laço" onClick={() => onEditLoop(loop)}><Pencil size={15} /></IconButton>
                          <IconButton title="Excluir laço" danger onClick={() => onDeleteLoop(loop)}><Trash2 size={15} /></IconButton>
                        </>
                      )}
                    </div>
                    {expanded && (
                      <div className="px-3.5 pb-3.5 flex flex-col gap-2 fade-in-up">
                        {selectMode && devices.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Marcar todos:</span>
                            <button type="button" onClick={() => selectByType(devices.map((d) => d.id))}
                              className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                              Laço inteiro ({devices.length})
                            </button>
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
                        {devices.length === 0 ? (
                          <p className="text-xs py-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                            {q ? 'Nenhum dispositivo corresponde à busca.' : 'Nenhum dispositivo neste laço ainda.'}
                          </p>
                        ) : devices.map((d) => (
                          <TrackableCard key={d.id} icon={DEVICE_TYPE_MAP[d.type]?.icon} photo={photoForModelo(data, d.modelo)} address={d.address}
                            title={(DEVICE_TYPE_MAP[d.type]?.label || 'Dispositivo') + (d.modelo ? ` · ${d.modelo}` : '')} meta={d.description}
                            status={{ ...computeStatus(d.nextInspection), lastMaintenance: d.lastMaintenance, lastInspection: d.lastInspection, operationalStatus: d.operationalStatus }}
                            indicadorCount={(data.indicador || []).filter((r) => r.deviceId === d.id).length}
                            warning={(d.type === 'entrada' || d.type === 'entrada_duplo') && !d.categoriaFuncional ? 'Categoria funcional não definida' : undefined}
                            selectable={canEdit && selectMode} selected={selectedIds.includes(d.id)} onToggleSelect={() => toggleSelect(d.id)}
                            onEdit={canEdit ? () => onEditDevice(d) : undefined} onDelete={canEdit ? () => onDeleteDevice(d) : undefined} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === 'nacs' && (
        <div key="nacs" className="flex flex-col gap-3 fade-in-up">
          {canEdit && (
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => onCreateNac(panelId)}><Plus size={15} /> Novo circuito</Button>
            </div>
          )}
          {nacs.length === 0 ? (
            <EmptyState icon={Bell} title="Nenhum circuito de saída cadastrado" description="Cadastre os circuitos (NACs) que alimentam sirenes, strobos e demais dispositivos de notificação."
              actionLabel={canEdit ? 'Adicionar circuito' : undefined} onAction={canEdit ? () => onCreateNac(panelId) : undefined} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {nacs.map((n) => (
                <TrackableCard key={n.id} icon={Bell} address={null} title={n.name} meta={n.description}
                  status={{ ...computeStatus(n.nextInspection), lastMaintenance: n.lastMaintenance, lastInspection: n.lastInspection, operationalStatus: n.operationalStatus }}
                  onEdit={canEdit ? () => onEditNac(n) : undefined} onDelete={canEdit ? () => onDeleteNac(n) : undefined} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function RvtFieldLabel({ children }) {
  return <p className="text-[9px] uppercase font-semibold mb-0.5" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{children}</p>;
}

function IndicadorPrintView({ entries, client, onBack }) {
  const countFalha = entries.filter((r) => (r.tipo || 'falha') === 'falha').length;
  const countManutencao = entries.filter((r) => r.tipo === 'manutencao').length;
  const countInspecao = entries.filter((r) => r.tipo === 'inspecao').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <Button variant="secondary" onClick={onBack}><ArrowLeft size={15} /> Voltar</Button>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Imprimir / Salvar PDF</Button>
      </div>

      <div className="print-area rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="rvt-brand-band">
          <div className="flex items-center gap-3 flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="rvt-wordmark">
              <div className="rvt-wordmark-icon"><ShieldAlert size={16} style={{ color: '#fff' }} /></div>
              <div className="rvt-wordmark-text">
                <div className="maj">M.A.J</div>
                <div className="sol">Soluções</div>
              </div>
            </div>
            <div className="rvt-divider-v" />
            <div className="flex items-center gap-3">
              {client?.branding?.logoData
                ? <img src={client.branding.logoData} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.4)' }} />
                : null}
              <div>
                <p className="font-display font-semibold text-base" style={{ color: '#fff' }}>{client?.name || ''}</p>
                {client?.address && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{client.address}</p>}
              </div>
            </div>
          </div>
          <div className="text-right" style={{ position: 'relative', zIndex: 1 }}>
            <p className="font-display font-semibold text-base" style={{ color: '#fff', letterSpacing: '0.04em' }}>RELATÓRIO DO INDICADOR</p>
            <p className="text-xs mono" style={{ color: 'rgba(255,255,255,0.75)' }}>Indicador · {formatDateBR(todayISO())}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Total de registros</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{entries.length}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Falhas</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--status-danger)' }}>{countFalha}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Manutenções</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{countManutencao}</p>
          </div>
          <div className="rvt-summary-card rounded-lg p-3" style={{ background: 'var(--surface-raised)' }}>
            <RvtFieldLabel>Inspeções</RvtFieldLabel>
            <p className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{countInspecao}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {entries.map((r, i) => (
            <div key={r.id} className="rvt-item-card rounded-lg p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', breakInside: 'avoid' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mono"
                    style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.etiqueta || 'Item'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ color: r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)', border: `1px solid ${r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)'}` }}>
                    {r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ color: indicatorStatusColor(r.status), border: `1px solid ${indicatorStatusColor(r.status)}` }}>
                    {r.status || 'Sem status'}
                  </span>
                </div>
              </div>

              {(r.endereco || r.laco || r.painel || r.equipamento) && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {r.endereco && <span className="mono-chip">END {r.endereco}</span>}
                  {r.laco && <span className="mono-chip">{r.laco}</span>}
                  {r.painel && <span>{r.painel}</span>}
                  {r.equipamento && <span>· {r.equipamento}</span>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <RvtFieldLabel>Falha</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{r.falha || '—'}</p>
                </div>
                {r.dataDiagnostico && (
                  <div>
                    <RvtFieldLabel>Data diagnóstico</RvtFieldLabel>
                    <p className="text-xs mono" style={{ color: 'var(--text-primary)' }}>{formatDateBR(r.dataDiagnostico)}</p>
                  </div>
                )}
              </div>

              {r.descritivo && (
                <div className="mb-2">
                  <RvtFieldLabel>Descritivo</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.descritivo}</p>
                </div>
              )}
              {r.explanacao && (
                <div className="mb-2">
                  <RvtFieldLabel>Explanação</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.explanacao}</p>
                </div>
              )}
              {r.solucao && (
                <div className="mb-2 rounded-md p-2" style={{ background: 'rgba(79,138,109,0.08)' }}>
                  <RvtFieldLabel>Solução aplicada</RvtFieldLabel>
                  <p className="text-xs" style={{ color: 'var(--status-ok)' }}>{r.solucao}</p>
                </div>
              )}

              {r.fotos && r.fotos.length > 0 && (
                <div className="mt-3">
                  <RvtFieldLabel>Registro fotográfico</RvtFieldLabel>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                    {r.fotos.map((f, fi) => (
                      <img key={fi} src={f} alt="" className="w-full aspect-square rounded-md object-cover" style={{ border: '1px solid var(--border)' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="rvt-footer-band">
          <div className="rvt-footer-icon"><ShieldAlert size={9} style={{ color: 'var(--accent)' }} /></div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Documento gerado pelo Centro de Controle de Manutenção — M.A.J Eletro Eletrônica LTDA · CNPJ: 45.893.915/0001-01
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}

function IndicadorView({ data, canEdit, client, onCreate, onEdit, onDelete, onImportFile, onLinkDevices, onBulkDelete, onDeleteByStatus, onDeleteAll }) {
  const list = data.indicador || [];
  // indicador-print-area: classe usada pra liberar essa tela na impressão (ver CSS @media print)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState('all');
  const [panelFilter, setPanelFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [linkMsg, setLinkMsg] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusToDelete, setStatusToDelete] = useState(INDICATOR_STATUS_OPTIONS[0]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const areaOptions = [...new Set(list.map((r) => r.area).filter(Boolean))].sort();
  const panelOptions = [...new Set(list.map((r) => deviceContext(r)?.panelName).filter(Boolean))].sort();
  const activeFilterCount = [statusFilter, areaFilter, panelFilter, linkFilter].filter((f) => f !== 'all').length;

  function deviceContext(r) {
    if (!r.deviceId) return null;
    const cat = r.categoria || 'devices';
    if (cat === 'devices') {
      const device = data.devices.find((d) => d.id === r.deviceId);
      if (!device) return null;
      const loop = data.loops.find((l) => l.id === device.loopId);
      const panel = loop && data.panels.find((p) => p.id === loop.panelId);
      return {
        title: (DEVICE_TYPE_MAP[device.type]?.label || 'Dispositivo') + (device.modelo ? ` · ${device.modelo}` : ''),
        address: device.address, sub: [loop?.name, panel?.name].filter(Boolean).join(' · '), panelName: panel?.name || '',
      };
    }
    if (cat === 'nacs') {
      const nac = data.nacs.find((n) => n.id === r.deviceId);
      if (!nac) return null;
      const panel = data.panels.find((p) => p.id === nac.panelId);
      return { title: nac.name, address: null, sub: ['Circuito NAC', panel?.name].filter(Boolean).join(' · '), panelName: panel?.name || '' };
    }
    if (cat === 'pumpDevices') {
      const it = data.pumpDevices.find((p) => p.id === r.deviceId);
      if (!it) return null;
      return { title: it.name, address: null, sub: it.type || 'Casa de Bombas', panelName: '' };
    }
    if (cat === 'gasDetectors') {
      const it = data.gasDetectors.find((g) => g.id === r.deviceId);
      if (!it) return null;
      return { title: it.name, address: null, sub: 'Detector de Gás', panelName: '' };
    }
    return null;
  }

  const filtered = list.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (areaFilter !== 'all' && r.area !== areaFilter) return false;
    if (panelFilter !== 'all' && deviceContext(r)?.panelName !== panelFilter) return false;
    if (linkFilter === 'linked' && !r.deviceId) return false;
    if (linkFilter === 'unlinked' && r.deviceId) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.etiqueta} ${r.endereco} ${r.equipamento} ${r.area} ${r.falha} ${r.descritivo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.dataDiagnostico || '').localeCompare(a.dataDiagnostico || ''));

  const linkedCount = list.filter((r) => r.deviceId).length;
  const [printMode, setPrintMode] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportIndicadorXlsx() {
    setExporting(true);
    try {
    const VINHO = 'FF8B2F2F';
    const VINHO_ESCURO = 'FF5F1F1F';
    const CINZA_BORDA = 'FFD7DADC';
    const CINZA_CLARO = 'FFF2F3F4';
    const BRANCO = 'FFFFFFFF';
    const CINZA_TEXTO = 'FF55605C';
    const AZUL = 'FF3B82F6';
    const LARANJA = 'FFF59E0B';
    const VERMELHO = 'FFC0392B';
    const VERDE_KPI = 'FF27AE60';
    const AMARELO_KPI = 'FFF1C40F';
    const VERDE_CLARO = 'FFD5F0DD';
    const VERDE_TEXTO = 'FF1E7A3D';
    const VERMELHO_CLARO = 'FFFBDADA';
    const VERMELHO_TEXTO = 'FFA93226';
    const AMARELO_CLARO = 'FFFDF3CF';
    const AMARELO_TEXTO = 'FF9C7A0A';

    const HEADERS = ['Data', 'Tipo', 'Local', 'Endereço', 'Laço', 'Painel', 'Equipamento', 'Área', 'Falha', 'Status', 'Solução', 'Data Solução'];
    const COL_WIDTHS = [12, 12, 26, 10, 8, 14, 22, 14, 30, 14, 32, 12];
    const RODAPE_TEXTO = 'Documento gerado pelo Centro de Controle de Manutenção — M.A.J Eletro Eletrônica LTDA · CNPJ: 45.893.915/0001-01';

    let logoBase64 = null;
    try {
      const res = await fetch('/logo-maj.png');
      if (res.ok) {
        const buf = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        logoBase64 = btoa(binary);
      }
    } catch { /* segue sem logo */ }

    async function renderChartImage(config, w, h) {
      w = w || 680; h = h || 440;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.position = 'fixed';
      canvas.style.left = '-9999px';
      canvas.style.top = '-9999px';
      document.body.appendChild(canvas);
      config.options = config.options || {};
      config.options.animation = false;
      config.options.responsive = false;
      let base64 = '';
      try {
        const chart = new Chart(canvas.getContext('2d'), config);
        await new Promise((r) => setTimeout(r, 50));
        const dataUrl = canvas.toDataURL('image/png');
        base64 = dataUrl.split(',')[1] || '';
        chart.destroy();
      } catch (e) {
        console.error('Erro ao gerar imagem do gráfico:', e);
      } finally {
        canvas.remove();
      }
      return base64;
    }

    const wb = new ExcelJS.Workbook();

    function desenhaBanner(ws, titulo) {
      ws.mergeCells('A1:B3');
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO } };
      ws.mergeCells('C1:L3');
      const banner = ws.getCell('C1');
      banner.value = `M.A.J Soluções — ${titulo}`;
      banner.font = { bold: true, size: 15, color: { argb: BRANCO } };
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO } };
      banner.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 24; ws.getRow(2).height = 24; ws.getRow(3).height = 24;

      if (logoBase64) {
        const imgId = wb.addImage({ base64: logoBase64, extension: 'png' });
        const colAw = (ws.getColumn(1).width || 10) * 7;
        const colBw = (ws.getColumn(2).width || 10) * 7;
        const largura = colAw + colBw;
        const altura = 24 * 3 * (4 / 3);
        const margem = 10;
        let alvoAltura = altura - margem * 2;
        let alvoLargura = alvoAltura * (486 / 331);
        if (alvoLargura > largura - margem * 2) {
          alvoLargura = largura - margem * 2;
          alvoAltura = alvoLargura * (331 / 486);
        }
        const offX = Math.max(0, (largura - alvoLargura) / 2);
        const offY = Math.max(0, (altura - alvoAltura) / 2);
        ws.addImage(imgId, {
          tl: { col: offX / colAw, row: offY / 24 },
          ext: { width: alvoLargura, height: alvoAltura },
        });
      }

      ws.mergeCells('A4:L4');
      const clienteCell = ws.getCell('A4');
      clienteCell.value = `${client?.name || ''}${client?.address ? ' — ' + client.address : ''}`;
      clienteCell.font = { bold: true, size: 11 };
      ws.getRow(4).height = 20;
    }

    function escreveRodape(ws, linha) {
      ws.mergeCells(`A${linha}:L${linha}`);
      const cell = ws.getCell(`A${linha}`);
      cell.value = RODAPE_TEXTO;
      cell.font = { size: 7.5, italic: true, color: { argb: CINZA_TEXTO } };
      ws.getRow(linha).height = 16;
    }

    function corStatus(status) {
      if (status === 'Resolvido') return { fill: VERDE_CLARO, font: VERDE_TEXTO };
      if (status === 'Andamento') return { fill: VERMELHO_CLARO, font: VERMELHO_TEXTO };
      if (status === 'Aguardando') return { fill: AMARELO_CLARO, font: AMARELO_TEXTO };
      return null;
    }

    function escreveTabela(ws, linhas, headerRow) {
      headerRow = headerRow || 6;
      HEADERS.forEach((h, i) => {
        const cell = ws.getCell(headerRow, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: BRANCO } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VINHO_ESCURO } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      ws.getRow(headerRow).height = 20;
      ws.views = [{ state: 'frozen', ySplit: headerRow }];

      let r = headerRow + 1;
      linhas.forEach((row) => {
        const valores = [
          formatDateBR(row.dataDiagnostico),
          row.tipo === 'inspecao' ? 'Inspeção' : row.tipo === 'manutencao' ? 'Manutenção' : 'Falha',
          row.etiqueta || '', row.endereco || '', row.laco || '', row.painel || '',
          row.equipamento || '', row.area || '', row.falha || '', row.status || '',
          row.solucao || '', formatDateBR(row.dataSolucao),
        ];
        valores.forEach((v, c) => {
          const cell = ws.getCell(r, c + 1);
          cell.value = v;
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: CINZA_BORDA } }, bottom: { style: 'thin', color: { argb: CINZA_BORDA } },
            left: { style: 'thin', color: { argb: CINZA_BORDA } }, right: { style: 'thin', color: { argb: CINZA_BORDA } },
          };
        });
        const corSt = corStatus(row.status);
        if (corSt) {
          const statusCell = ws.getCell(r, 10);
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSt.fill } };
          statusCell.font = { bold: true, color: { argb: corSt.font } };
        }
        ws.getRow(r).height = 30;
        r += 1;
      });
      if (linhas.length) {
        ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: r - 1, column: 12 } };
      }
      return r;
    }

    function criaAbaDados(nome, linhas, tituloExtra) {
      tituloExtra = tituloExtra || '';
      const ws = wb.addWorksheet(nome);
      ws.views = [{ showGridLines: false }];
      COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      desenhaBanner(ws, `Relatório do Indicador${tituloExtra}`);
      ws.getRow(5).height = 6;
      const ultima = escreveTabela(ws, linhas);
      escreveRodape(ws, ultima + 2);
      return ws;
    }

    const registros = filtered;
    const falhas = registros.filter((r) => (r.tipo || 'falha') === 'falha');
    const manutencoes = registros.filter((r) => r.tipo === 'manutencao');
    const inspecoes = registros.filter((r) => r.tipo === 'inspecao');
    const total = registros.length;

    const hoje = new Date();
    function contaNoMes(lista, offsetMeses) {
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - offsetMeses, 1);
      return lista.filter((r) => {
        if (!r.dataDiagnostico) return false;
        const d = new Date(r.dataDiagnostico + 'T00:00:00');
        return d.getFullYear() === alvo.getFullYear() && d.getMonth() === alvo.getMonth();
      }).length;
    }
    function deltaTexto(lista) {
      const atual = contaNoMes(lista, 0);
      const anterior = contaNoMes(lista, 1);
      const diff = atual - anterior;
      if (diff > 0) return `↑ +${diff} vs mês anterior`;
      if (diff < 0) return `↓ ${diff} vs mês anterior`;
      return '= igual ao mês anterior';
    }
    const todosRegistros = data.indicador || [];
    const todasFalhas = todosRegistros.filter((r) => (r.tipo || 'falha') === 'falha');
    const todasManut = todosRegistros.filter((r) => r.tipo === 'manutencao');
    const todasInsp = todosRegistros.filter((r) => r.tipo === 'inspecao');

    const kpis = [
      { label: 'TOTAL DE REGISTROS', valor: total, cor: VINHO, aba: 'Dados', delta: deltaTexto(todosRegistros) },
      { label: 'FALHAS', valor: falhas.length, cor: VERMELHO, aba: 'Falhas', delta: deltaTexto(todasFalhas) },
      { label: 'MANUTENÇÕES', valor: manutencoes.length, cor: LARANJA, aba: 'Manutenções', delta: deltaTexto(todasManut) },
      { label: 'INSPEÇÕES', valor: inspecoes.length, cor: AZUL, aba: 'Inspeções', delta: deltaTexto(todasInsp) },
    ];

    const statusFalhasCounts = { Resolvido: 0, Andamento: 0, Aguardando: 0 };
    falhas.forEach((r) => { if (statusFalhasCounts[r.status] !== undefined) statusFalhasCounts[r.status] += 1; });

    const resumo = wb.addWorksheet('Resumo');
    resumo.views = [{ showGridLines: false }];
    for (let i = 1; i <= 12; i++) resumo.getColumn(i).width = 13;
    desenhaBanner(resumo, 'Relatório do Indicador');

    resumo.mergeCells('A5:L5');
    resumo.getCell('A5').value = `Gerado em: ${formatDateBR(todayISO())}`;
    resumo.getCell('A5').font = { size: 9, italic: true, color: { argb: CINZA_TEXTO } };
    resumo.getRow(5).height = 16;
    resumo.getRow(6).height = 8;

    const kpiRow = 7;
    kpis.forEach((k, i) => {
      const c0 = i * 3 + 1;
      const c1 = c0 + 2;
      resumo.mergeCells(kpiRow, c0, kpiRow + 1, c1);
      const cell = resumo.getCell(kpiRow, c0);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CLARO } };
      cell.border = { top: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.value = `${k.valor}\n${k.label}\n${k.delta}`;
      cell.font = { size: 9, bold: true, color: { argb: k.cor } };

      resumo.mergeCells(kpiRow + 2, c0, kpiRow + 2, c1);
      const linkCell = resumo.getCell(kpiRow + 2, c0);
      linkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.cor } };
      linkCell.border = { bottom: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      linkCell.alignment = { horizontal: 'center', vertical: 'middle' };
      linkCell.value = { text: '▸ Ver lista completa', hyperlink: `#'${k.aba}'!A1` };
      linkCell.font = { size: 8.5, bold: true, color: { argb: BRANCO }, underline: true };
    });
    resumo.getRow(kpiRow).height = 24;
    resumo.getRow(kpiRow + 1).height = 24;
    resumo.getRow(kpiRow + 2).height = 16;
    resumo.getRow(kpiRow + 3).height = 10;

    const statusTituloRow = kpiRow + 4;
    resumo.mergeCells(`A${statusTituloRow}:L${statusTituloRow}`);
    resumo.getCell(`A${statusTituloRow}`).value = 'SITUAÇÃO DAS FALHAS';
    resumo.getCell(`A${statusTituloRow}`).font = { size: 10, bold: true, color: { argb: VINHO_ESCURO } };
    resumo.getRow(statusTituloRow).height = 18;

    const statusKpis = [
      { label: 'RESOLVIDO', valor: statusFalhasCounts.Resolvido, cor: VERDE_KPI },
      { label: 'EM ANDAMENTO', valor: statusFalhasCounts.Andamento, cor: VERMELHO },
      { label: 'AGUARDANDO', valor: statusFalhasCounts.Aguardando, cor: AMARELO_KPI },
    ];
    const statusKpiRow = statusTituloRow + 1;
    statusKpis.forEach((k, i) => {
      const c0 = i * 4 + 1;
      const c1 = c0 + 3;
      resumo.mergeCells(statusKpiRow, c0, statusKpiRow + 1, c1);
      const cell = resumo.getCell(statusKpiRow, c0);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CLARO } };
      cell.border = { top: { style: 'medium', color: { argb: k.cor } }, bottom: { style: 'medium', color: { argb: k.cor } }, left: { style: 'medium', color: { argb: k.cor } }, right: { style: 'medium', color: { argb: k.cor } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.value = `${k.valor}\n${k.label}`;
      cell.font = { size: 10, bold: true, color: { argb: k.cor } };
    });
    resumo.getRow(statusKpiRow).height = 24;
    resumo.getRow(statusKpiRow + 1).height = 24;
    resumo.getRow(statusKpiRow + 2).height = 10;

    const corHex = (argb) => '#' + argb.slice(2);
    const tipoPieImg = await renderChartImage({
      type: 'pie',
      data: {
        labels: ['Falha', 'Manutenção', 'Inspeção'],
        datasets: [{ data: [falhas.length, manutencoes.length, inspecoes.length], backgroundColor: [corHex(VERMELHO), corHex(LARANJA), corHex(AZUL)] }],
      },
      options: {
        responsive: false,
        plugins: {
          title: { display: true, text: 'Registros por Tipo', font: { size: 20, weight: 'bold' } },
          legend: { position: 'right', labels: { font: { size: 14 } } },
        },
      },
    });
    const statusPieImg = await renderChartImage({
      type: 'pie',
      data: {
        labels: ['Resolvido', 'Andamento', 'Aguardando'],
        datasets: [{ data: [statusFalhasCounts.Resolvido, statusFalhasCounts.Andamento, statusFalhasCounts.Aguardando], backgroundColor: [corHex(VERDE_KPI), corHex(VERMELHO), corHex(AMARELO_KPI)] }],
      },
      options: {
        responsive: false,
        plugins: {
          title: { display: true, text: 'Situação das Falhas', font: { size: 20, weight: 'bold' } },
          legend: { position: 'right', labels: { font: { size: 14 } } },
        },
      },
    });

    const chartRow = statusKpiRow + 3;
    if (tipoPieImg) {
      const tipoPieId = wb.addImage({ base64: tipoPieImg, extension: 'png' });
      resumo.addImage(tipoPieId, { tl: { col: 0, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    }
    if (statusPieImg) {
      const statusPieId = wb.addImage({ base64: statusPieImg, extension: 'png' });
      resumo.addImage(statusPieId, { tl: { col: 7, row: chartRow - 1 }, ext: { width: 420, height: 270 } });
    }

    const notaRow = chartRow + 16;
    resumo.mergeCells(`A${notaRow}:L${notaRow}`);
    resumo.getCell(`A${notaRow}`).value = 'Clique num cartão acima pra ver a lista daquele tipo. Gráfico de tendência mensal na aba "Tendência".';
    resumo.getCell(`A${notaRow}`).font = { size: 9, italic: true, color: { argb: CINZA_TEXTO } };
    escreveRodape(resumo, notaRow + 2);

    const tendencia = wb.addWorksheet('Tendência');
    tendencia.views = [{ showGridLines: false }];
    for (let i = 1; i <= 12; i++) tendencia.getColumn(i).width = 13;
    desenhaBanner(tendencia, 'Relatório do Indicador — Tendência');
    tendencia.getRow(5).height = 10;

    const mesCounts = {};
    registros.forEach((r) => {
      if (!r.dataDiagnostico) return;
      const mes = r.dataDiagnostico.slice(5, 7) + '/' + r.dataDiagnostico.slice(0, 4);
      mesCounts[mes] = (mesCounts[mes] || 0) + 1;
    });
    const mesesOrdenados = Object.keys(mesCounts).sort((a, b) => {
      const [ma, aa] = a.split('/'); const [mb, ab] = b.split('/');
      return aa === ab ? ma - mb : aa - ab;
    });
    const lineImg = await renderChartImage({
      type: 'line',
      data: {
        labels: mesesOrdenados,
        datasets: [{ label: 'Registros', data: mesesOrdenados.map((m) => mesCounts[m]), borderColor: corHex(VINHO), backgroundColor: corHex(VINHO), tension: 0.2, borderWidth: 3 }],
      },
      options: {
        responsive: false,
        plugins: { title: { display: true, text: 'Registros por Mês', font: { size: 22, weight: 'bold' } }, legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }, 1000, 560);
    if (lineImg) {
      const lineId = wb.addImage({ base64: lineImg, extension: 'png' });
      tendencia.addImage(lineId, { tl: { col: 0, row: 5 }, ext: { width: 900, height: 500 } });
    }

    criaAbaDados('Dados', registros);
    criaAbaDados('Falhas', falhas, ' — Falhas');
    criaAbaDados('Manutenções', manutencoes, ' — Manutenções');
    criaAbaDados('Inspeções', inspecoes, ' — Inspeções');

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicador_${client?.name ? client.name.replace(/\s+/g, '_') + '_' : ''}${todayISO()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (printMode) return <IndicadorPrintView entries={filtered} client={client} onBack={() => setPrintMode(false)} />;

  const statusToDeleteCount = list.filter((r) => r.status === statusToDelete).length;

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds([]); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const res = await onImportFile(file);
    setImporting(false);
    setImportMsg(res.ok ? { ok: true, text: `${res.count} registro(s) importado(s).` } : { ok: false, text: res.error });
    e.target.value = '';
  }

  function handleLink() {
    const res = onLinkDevices();
    setLinkMsg(`${res.matched} de ${res.total} registro(s) vinculado(s) a um dispositivo importado. ${res.unmatched} sem correspondência (painel/laço/endereço não encontrados entre os dispositivos já importados).`);
  }

  return (
    <div className="flex flex-col gap-4 print-area">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Indicador</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Histórico de diagnóstico e falhas identificadas no sistema.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {list.length > 0 && (
              selectMode ? (
                <Button variant="secondary" onClick={exitSelectMode}><X size={15} /> Cancelar seleção</Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectMode(true)}><ClipboardList size={15} /> Selecionar múltiplos</Button>
              )
            )}
            <div style={{ position: 'relative' }}>
              <Button variant="secondary" onClick={() => setMoreMenuOpen((v) => !v)}>⋮ Mais ações</Button>
              {moreMenuOpen && (
                <>
                  <div onClick={() => setMoreMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                  <div className="fade-in-up" style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, minWidth: 230, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', overflow: 'hidden',
                  }}>
                    {list.length > 0 && (
                      <>
                        <button type="button" onClick={async () => { await exportIndicadorXlsx(); setMoreMenuOpen(false); }} disabled={exporting}
                          style={{ ...dropdownItemStyle, ...(exporting ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                          <FileText size={15} /> {exporting ? 'Gerando planilha...' : 'Exportar Excel'}
                        </button>
                        <button type="button" onClick={() => { setPrintMode(true); setMoreMenuOpen(false); }} style={dropdownItemStyle}>
                          <Printer size={15} /> Imprimir / Salvar PDF
                        </button>
                        <button type="button" onClick={() => { handleLink(); setMoreMenuOpen(false); }} style={dropdownItemStyle}>
                          <Cpu size={15} /> Vincular aos dispositivos
                        </button>
                      </>
                    )}
                    <label style={{ ...dropdownItemStyle, borderBottom: 'none', ...(importing ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                      <Upload size={15} /> {importing ? 'Importando…' : 'Importar planilha (.xlsx)'}
                      <input type="file" accept=".xlsx,.xls" onChange={(e) => { handleFile(e); setMoreMenuOpen(false); }} className="hidden" disabled={importing} />
                    </label>
                  </div>
                </>
              )}
            </div>
            <Button variant="primary" onClick={onCreate}><Plus size={16} /> Novo registro</Button>
          </div>
        )}
      </div>

      {importMsg && (
        <p className="text-xs" style={{ color: importMsg.ok ? 'var(--status-ok)' : 'var(--status-danger)' }}>{importMsg.text}</p>
      )}
      {linkMsg && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{linkMsg}</p>}

      {selectMode && (
        <div className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap fade-in-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {selectedIds.length === 0 ? 'Marque os registros que quer excluir de uma vez.' : `${selectedIds.length} registro(s) selecionado(s)`}
          </p>
          {selectedIds.length > 0 && (
            <Button variant="danger" onClick={() => { onBulkDelete(selectedIds); exitSelectMode(); }}><Trash2 size={15} /> Excluir selecionados</Button>
          )}
        </div>
      )}

      {canEdit && list.length > 0 && (
        <div className="rounded-lg p-3 flex flex-wrap items-center gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Excluir em massa:</span>
          <select className={inputCls} style={{ maxWidth: '200px', width: 'auto' }} value={statusToDelete} onChange={(e) => setStatusToDelete(e.target.value)}>
            {INDICATOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="danger" onClick={() => onDeleteByStatus(statusToDelete, statusToDeleteCount)} disabled={statusToDeleteCount === 0}>
            <Trash2 size={15} /> Excluir todos "{statusToDelete}" ({statusToDeleteCount})
          </Button>
          <span className="flex-1" />
          <Button variant="danger" onClick={() => onDeleteAll(list.length)}><Trash2 size={15} /> Apagar todos ({list.length})</Button>
        </div>
      )}

      {list.length > 0 && (
        <>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {linkedCount} de {list.length} registro(s) já vinculado(s) a um dispositivo do painel.
          </p>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input className={`${inputCls} pl-9`} placeholder="Buscar por etiqueta, endereço, falha..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button type="button" className="sm:hidden self-start" onClick={() => setFiltersOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13 }}>
              <ChevronDown size={14} style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <div className={`flex-col sm:flex-row gap-2 flex-wrap ${filtersOpen ? 'flex' : 'hidden sm:flex'}`}>
              <select className={inputCls} style={{ maxWidth: '220px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Todos os status</option>
                {INDICATOR_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className={inputCls} style={{ maxWidth: '220px' }} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="all">Todas as áreas</option>
                {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className={inputCls} style={{ maxWidth: '220px' }} value={panelFilter} onChange={(e) => setPanelFilter(e.target.value)}>
                <option value="all">Todos os painéis</option>
                {panelOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className={inputCls} style={{ maxWidth: '220px' }} value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)}>
                <option value="all">Vinculados e não vinculados</option>
                <option value="linked">Só vinculados a dispositivo</option>
                <option value="unlinked">Só sem vínculo</option>
              </select>
            </div>
          </div>
        </>
      )}

      {list.length === 0 ? (
        <EmptyState icon={Activity} title="Nenhum registro no indicador"
          description="Importe a planilha de histórico de diagnóstico ou cadastre o primeiro registro manualmente."
          actionLabel={canEdit ? 'Novo registro' : undefined} onAction={canEdit ? onCreate : undefined} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>Nenhum registro corresponde aos filtros.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{filtered.length} de {list.length} registro(s)</p>
          {filtered.map((r) => {
            const ctx = deviceContext(r);
            const isSelected = selectedIds.includes(r.id);
            return (
              <div key={r.id} className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: isSelected ? '1px solid var(--accent)' : ctx ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-start gap-2 min-w-0">
                    {selectMode && (
                      <label className="pt-1 cursor-pointer flex-shrink-0" title={isSelected ? 'Remover da seleção' : 'Selecionar'}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)}
                          className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                      </label>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.etiqueta || 'Sem etiqueta'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {ctx ? (
                          <>
                            {ctx.address && <span className="mono-chip">END {ctx.address}</span>}
                            <span className="font-medium">{ctx.title}</span>
                            {ctx.sub && <span>· {ctx.sub}</span>}
                          </>
                        ) : (
                          <>
                            {r.endereco && <span className="mono-chip">END {r.endereco}</span>}
                            {r.laco && <span className="mono-chip">Laço {r.laco}</span>}
                            {r.painel && <span className="mono-chip">Painel {r.painel}</span>}
                            {r.area && <span>{r.area}</span>}
                          </>
                        )}
                        {r.equipamento && <span>· {r.equipamento}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ctx && <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>Vinculado</span>}
                    <span className="text-xs px-2 py-1 rounded-md" style={{
                      color: r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)',
                      border: `1px solid ${r.tipo === 'inspecao' ? '#3B82F6' : r.tipo === 'manutencao' ? '#F59E0B' : 'var(--status-danger)'}`,
                    }}>
                      {r.tipo === 'inspecao' ? 'Inspeção' : r.tipo === 'manutencao' ? 'Manutenção' : 'Falha'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-md" style={{ color: indicatorStatusColor(r.status), border: `1px solid ${indicatorStatusColor(r.status)}` }}>
                      {r.status || 'Sem status'}
                    </span>
                  </div>
                </div>
                {r.falha && <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.falha}</p>}
                {r.descritivo && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.descritivo}</p>}
                {r.explanacao && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><strong>Explanação:</strong> {r.explanacao}</p>}
                {r.solucao && <p className="text-xs" style={{ color: 'var(--status-ok)' }}><strong>Solução:</strong> {r.solucao}</p>}
                {r.fotos && r.fotos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.fotos.map((f, i) => (
                      <img key={i} src={f} alt="" className="w-14 h-14 rounded-md object-cover" style={{ border: '1px solid var(--border)' }} />
                    ))}
                  </div>
                )}
                {(r.dataDiagnostico || r.dataSolucao) && (
                  <div className="flex flex-wrap gap-3 text-xs mono" style={{ color: 'var(--text-secondary)' }}>
                    {r.dataDiagnostico && <span>Diagnóstico: {formatDateBR(r.dataDiagnostico)}</span>}
                    {r.dataSolucao && <span>Solução: {formatDateBR(r.dataSolucao)}</span>}
                  </div>
                )}
                {canEdit && !selectMode && (
                  <div className="flex items-center justify-end gap-1 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <IconButton title="Editar" onClick={() => onEdit(r)}><Pencil size={15} /></IconButton>
                    <IconButton title="Excluir" danger onClick={() => onDelete(r)}><Trash2 size={15} /></IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function compareAddress(a, b) {
  const pa = (a || '').split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = (b || '').split(/[^\d]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function buildSDAIReportItems(data) {
  const enderecaveis = (data.devices || []).map((d) => {
    const loop = data.loops.find((l) => l.id === d.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    return {
      id: d.id, address: d.address, tipo: DEVICE_TYPE_MAP[d.type]?.label || d.type,
      localizacao: [panel?.name, loop?.name, d.description].filter(Boolean).join(' · ') || '—',
            panelId: panel?.id || null, groupLabel: panel?.name || 'Sem painel',
      loopId: loop?.id || null, loopName: loop?.name || null,
      extra: [
        { label: 'Status', value: d.operationalStatus, color: operStatusColor(d.operationalStatus) },
        { label: 'Aparência', value: d.appearance, color: appearanceColor(d.appearance) },
        { label: 'Com. local', value: d.localComm, color: commColor(d.localComm) },
        { label: 'Com. rede', value: d.networkComm, color: commColor(d.networkComm) },
        { label: 'Última insp.', value: formatDateBR(d.lastInspection) },
        { label: 'Próxima insp.', value: formatDateBR(d.nextInspection) },
      ],
      search: `${d.address} ${DEVICE_TYPE_MAP[d.type]?.label || ''} ${d.description || ''} ${panel?.name || ''} ${loop?.name || ''}`.toLowerCase(),
    };
  });

  const nacs = (data.nacs || []).map((n) => {
    const panel = data.panels.find((p) => p.id === n.panelId);
    return {
      id: n.id, address: null, tipo: 'Circuito NAC',
      localizacao: [panel?.name, n.name, n.description].filter(Boolean).join(' · ') || '—',
      panelId: panel?.id || null, groupLabel: panel?.name || 'Sem painel',
      extra: [
        { label: 'Status', value: n.operationalStatus, color: operStatusColor(n.operationalStatus) },
        { label: 'Aparência', value: n.appearance, color: appearanceColor(n.appearance) },
        { label: 'Com. local', value: n.localComm, color: commColor(n.localComm) },
        { label: 'Com. rede', value: n.networkComm, color: commColor(n.networkComm) },
        { label: 'Última insp.', value: formatDateBR(n.lastInspection) },
        { label: 'Próxima insp.', value: formatDateBR(n.nextInspection) },
      ],
      search: `${n.name} ${n.description || ''} ${panel?.name || ''}`.toLowerCase(),
    };
  });

  const complementaresTipo1 = (data.devices || []).filter((d) => complementarGroupFor(d.categoriaFuncional)).map((d) => {
    const loop = data.loops.find((l) => l.id === d.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    const catLabel = FUNCTIONAL_CATEGORY_MAP[d.categoriaFuncional] || d.categoriaFuncional;
    return {
      id: `${d.id}-comp`, address: d.address, tipo: catLabel,
      localizacao: [panel?.name, loop?.name, d.etiquetaComplementar || d.description].filter(Boolean).join(' · ') || '—',
            panelId: panel?.id || null, groupLabel: panel?.name || 'Sem painel',
      loopId: loop?.id || null, loopName: loop?.name || null,
      extra: [
        { label: 'Status', value: d.operationalStatus, color: operStatusColor(d.operationalStatus) },
        { label: 'Aparência', value: d.appearance, color: appearanceColor(d.appearance) },
        { label: 'Com. local', value: d.localComm, color: commColor(d.localComm) },
        { label: 'Com. rede', value: d.networkComm, color: commColor(d.networkComm) },
        { label: 'Última insp.', value: formatDateBR(d.lastInspection) },
        { label: 'Próxima insp.', value: formatDateBR(d.nextInspection) },
      ],
      search: `${d.address} ${catLabel} ${d.etiquetaComplementar || ''} ${panel?.name || ''}`.toLowerCase(),
    };
  });
  const baterias = (data.bateriasPainel || []).map((b) => {
    const panel = data.panels.find((p) => p.id === b.panelId);
    return {
      id: b.id, address: null, tipo: 'Bateria de Painel', localizacao: panel?.name || '—',
      panelId: panel?.id || null, groupLabel: panel?.name || 'Sem painel',
      extra: [
        { label: 'Status', value: b.dataInspecao ? 'Registrado' : '', color: b.dataInspecao ? 'var(--status-ok)' : 'var(--status-none)' },
        { label: 'Aparência', value: '' }, { label: 'Com. local', value: '' }, { label: 'Com. rede', value: '' },
        { label: 'Última insp.', value: formatDateBR(b.dataInspecao) },
        { label: 'Próxima insp.', value: formatDateBR(b.proximaInspecao) },
      ],
      search: `bateria painel ${panel?.name || ''}`.toLowerCase(),
    };
  });
  const fontes = (data.fontesAuxiliares || []).map((f) => ({
    id: f.id, address: null, tipo: 'Fonte Auxiliar', localizacao: f.nome || '—',
    panelId: null, groupLabel: 'Sem painel',
    extra: [
      { label: 'Status', value: f.dataInspecao ? 'Registrado' : '', color: f.dataInspecao ? 'var(--status-ok)' : 'var(--status-none)' },
      { label: 'Aparência', value: '' }, { label: 'Com. local', value: '' }, { label: 'Com. rede', value: '' },
      { label: 'Última insp.', value: formatDateBR(f.dataInspecao) },
      { label: 'Próxima insp.', value: formatDateBR(f.proximaInspecao) },
    ],
    search: `fonte auxiliar ${f.nome || ''}`.toLowerCase(),
  }));

  return { enderecaveis, nacs, complementares: [...complementaresTipo1, ...baterias, ...fontes] };
}

function buildSPCIReportItems(data) {
  const subitensPorConjunto = (tipos) => (data.combateSubitens || []).filter((s) => {
    const conjunto = (data.combateConjuntos || []).find((c) => c.id === s.conjuntoId);
    return conjunto && tipos.includes(conjunto.tipo);
  }).map((s) => {
    const conjunto = (data.combateConjuntos || []).find((c) => c.id === s.conjuntoId);
    const info = conjuntoSubitemInfo(conjunto.tipo, s.categoria);
    const agenteLabel = conjunto.tipo === 'sistema_gas' ? (COMBATE_GAS_AGENTES.find((a) => a.value === conjunto.agente)?.label || '') : '';
    const groupLabel = conjunto.tipo === 'sistema_gas' ? 'Sistema' : (COMBATE_CONJUNTO_TIPOS[conjunto.tipo]?.label || conjunto.tipo);
    return {
      id: s.id, address: null, tipo: info?.label || s.categoria,
      localizacao: [agenteLabel, conjunto.etiqueta].filter(Boolean).join(' · '),
      groupLabel,
      extra: [
        { label: 'Resultado', value: s.resultadoTeste, color: operStatusColor(s.resultadoTeste) },
        { label: 'Última', value: formatDateBR(s.dataInspecao) },
        { label: 'Próxima', value: formatDateBR(s.proximaInspecao) },
      ],
      search: `${info?.label || ''} ${conjunto.etiqueta} ${agenteLabel}`.toLowerCase(),
    };
  });

  const agua = subitensPorConjunto(COMBATE_AGUA_TIPOS);
  const gasSistema = subitensPorConjunto(['sistema_gas']);
  const cilindros = (data.combateCilindros || []).map((c) => {
    const bateria = (data.combateBaterias || []).find((b) => b.id === c.bateriaId);
    const agenteLabel = COMBATE_GAS_AGENTES.find((a) => a.value === bateria?.agente)?.label || '';
    const resultados = [c.resultadoValvula, c.resultadoManometro, c.resultadoCorpo, c.resultadoEtiqueta];
    const resultado = resultados.includes('Reprovado') ? 'Reprovado' : (resultados.every((r) => r === 'Aprovado') ? 'Aprovado' : 'Não avaliado');
    return {
      id: c.id, address: null, tipo: 'Cilindro', localizacao: [agenteLabel, bateria?.etiqueta].filter(Boolean).join(' · '),
      groupLabel: 'Bateria de Cilindros',
      extra: [
        { label: 'Resultado', value: resultado, color: operStatusColor(resultado) },
        { label: 'Última', value: formatDateBR(c.dataInspecao) },
        { label: 'Próxima', value: formatDateBR(c.proximaInspecao) },
      ],
      search: `cilindro ${c.identificacao || ''} ${agenteLabel} ${bateria?.etiqueta || ''}`.toLowerCase(),
    };
  });

  const componentes = (data.combateComponentes || []).map((c) => {
    const info = COMBATE_COMPONENTE_TIPO_MAP[c.tipo];
    return {
      id: c.id, address: null, tipo: info?.label || c.tipo, localizacao: c.etiqueta || '—',
      groupLabel: info?.label || c.tipo,
      extra: [
        { label: 'Resultado', value: c.resultadoTeste, color: operStatusColor(c.resultadoTeste) },
        { label: 'Última', value: formatDateBR(c.dataInspecao) },
        { label: 'Próxima', value: formatDateBR(c.proximaInspecao) },
      ],
      search: `${info?.label || ''} ${c.etiqueta || ''}`.toLowerCase(),
    };
  });

  return { agua, gas: [...gasSistema, ...cilindros], componentes };
}

function ItemsTableAndCards({ columnHeaders, items }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  function toggle(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return (
    <>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Identificação</th>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Localização</th>
              {columnHeaders.map((h) => <th key={h} className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {it.address && <span className="mono-chip">{it.address}</span>}
                    <span style={{ color: 'var(--text-primary)' }}>{it.tipo}</span>
                  </div>
                </td>
                <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{it.localizacao}</td>
                {it.extra.map((ex, i) => (
                  <td key={i} className="py-2 pr-3" style={{ color: ex.color || 'var(--text-secondary)' }}>{ex.value || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden flex flex-col gap-2">
        {items.map((it) => {
          const expanded = expandedIds.has(it.id);
          const mainExtra = it.extra[0];
          return (
            <div key={it.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
              <button type="button" onClick={() => toggle(it.id)} className="w-full flex items-center justify-between gap-2 p-2.5" style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: 12 }}>{expanded ? '▾' : '▸'}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{it.address ? `${it.address} · ` : ''}{it.tipo}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{it.localizacao}</div>
                  </div>
                </div>
                {mainExtra && (
                  <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ border: `1px solid ${mainExtra.color || 'var(--border)'}`, color: mainExtra.color || 'var(--text-secondary)' }}>
                    {mainExtra.value || '—'}
                  </span>
                )}
              </button>
              {expanded && (
                <div className="px-2.5 pb-2.5 grid grid-cols-2 gap-1 text-xs fade-in-up" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, color: 'var(--text-secondary)' }}>
                  {it.extra.slice(1).map((ex, i) => <div key={i}>{ex.label}: <strong style={{ color: 'var(--text-primary)' }}>{ex.value || '—'}</strong></div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Grupo colapsável (por painel no SDAI, por tipo no SPCI) — some da tela quando
    fechado, mas sempre aparece na impressão (via CSS, não deixa de renderizar). */
function ReportGroup({ groupLabel, items, columnHeaders, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const temLaco = items.some((it) => it.loopName);
  let conteudo;
  if (!temLaco) {
    const ordenados = [...items].sort((a, b) => compareAddress(a.address, b.address));
    conteudo = <ItemsTableAndCards columnHeaders={columnHeaders} items={ordenados} />;
  } else {
    const loopMap = new Map();
    items.forEach((it) => {
      const key = it.loopName || 'Sem laço';
      if (!loopMap.has(key)) loopMap.set(key, []);
      loopMap.get(key).push(it);
    });
    const loopNames = [...loopMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    conteudo = loopNames.map((loopName) => {
      const loopItems = [...loopMap.get(loopName)].sort((a, b) => compareAddress(a.address, b.address));
      return (
        <div key={loopName} className="mb-2">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{loopName} — {loopItems.length} item(ns)</p>
          <ItemsTableAndCards columnHeaders={columnHeaders} items={loopItems} />
        </div>
      );
    });
  }
  return (
    <div className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 p-2.5 no-print"
        style={{ background: 'var(--surface-raised)', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
        <span className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{open ? '▾' : '▸'}</span> {groupLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{items.length} item(ns)</span>
      </button>
      <p className="hidden text-xs font-medium p-2.5" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        {groupLabel} — {items.length} item(ns)
      </p>
      <div className={`report-group-body p-2.5 ${open ? '' : 'collapsed'}`}>
        {conteudo}
      </div>
    </div>
  );
}

function ReportSection({ title, columnHeaders, items, groupBy }) {
  if (items.length === 0) return null;

  if (!groupBy) {
    return (
      <div className="mb-7">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{items.length} item(ns)</p>
        </div>
        <ItemsTableAndCards columnHeaders={columnHeaders} items={items} />
      </div>
    );
  }

  const groups = new Map();
  items.forEach((it) => {
    const key = it.groupLabel || 'Outros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  const soUmGrupo = groups.size <= 1;

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{items.length} item(ns)</p>
      </div>
      {[...groups.entries()].map(([groupLabel, groupItems]) => (
        <ReportGroup key={groupLabel} groupLabel={groupLabel} items={groupItems} columnHeaders={columnHeaders} defaultOpen={soUmGrupo} />
      ))}
    </div>
  );
}

function ReportView({ data, client, filters, setFilters }) {
  const [reportTab, setReportTab] = useState('sdai');
  const sdaiSets = buildSDAIReportItems(data);
  const spciSets = buildSPCIReportItems(data);
  const q = (filters.search || '').trim().toLowerCase();
  const applySearch = (items) => (q ? items.filter((it) => it.search.includes(q)) : items);
  const applyPanel = (items) => (filters.panelId !== 'all' ? items.filter((it) => it.panelId === filters.panelId) : items);
    const applyTipo = (items) => (filters.tipo && filters.tipo !== 'all' ? items.filter((it) => it.tipo === filters.tipo) : items);

    const sdaiFiltered = {
    enderecaveis: applyTipo(applyPanel(applySearch(sdaiSets.enderecaveis))),
    nacs: applyTipo(applyPanel(applySearch(sdaiSets.nacs))),
    complementares: applyTipo(applyPanel(applySearch(sdaiSets.complementares))),
  };
  const spciFiltered = {
    agua: applyTipo(applySearch(spciSets.agua)), gas: applyTipo(applySearch(spciSets.gas)), componentes: applyTipo(applySearch(spciSets.componentes)),
  };

  const sdaiTotal = sdaiSets.enderecaveis.length + sdaiSets.nacs.length + sdaiSets.complementares.length;
  const sdaiTodos = [...sdaiSets.enderecaveis, ...sdaiSets.nacs, ...sdaiSets.complementares];
  const sdaiNaoOperante = sdaiTodos.filter((it) => it.extra[0]?.value === 'Reprovado').length;
  const sdaiNecessitaTroca = sdaiTodos.filter((it) => it.extra[1]?.value === 'Precisa Trocar').length;
  const corretivasPendentesIds = new Set(
    (data.indicador || [])
      .filter((r) => r.tipo === 'manutencao' && r.falha && r.falha !== 'Realizado sem apontamentos' && r.status !== 'Resolvido')
      .map((r) => r.deviceId).filter(Boolean)
  );

  const spciTotal = spciSets.agua.length + spciSets.gas.length + spciSets.componentes.length;
  const spciTodos = [...spciSets.agua, ...spciSets.gas, ...spciSets.componentes];
  const spciReprovados = spciTodos.filter((it) => it.extra[0]?.value === 'Reprovado').length;
  const spciSemInspecao = spciTodos.filter((it) => !it.extra[0]?.value).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Relatório de Inspeções</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status de Inspeções de todos dispositivos auditáveis.</p>
        </div>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Imprimir / Salvar PDF</Button>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto no-print" style={{ borderColor: 'var(--border)' }}>
        <button className="nav-tab" data-active={reportTab === 'sdai'} onClick={() => setReportTab('sdai')}>SDAI</button>
        <button className="nav-tab" data-active={reportTab === 'spci'} onClick={() => setReportTab('spci')}>SPCI (Sistemas de Combate)</button>
      </div>

      {reportTab === 'sdai' ? (
        <div key="sdai" className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print fade-in-up">
          <StatCard label="Total monitorado" value={sdaiTotal} color="var(--text-secondary)" icon={ClipboardList} />
          <StatCard label="Não operantes" value={sdaiNaoOperante} color="var(--status-danger)" icon={AlertTriangle} />
          <StatCard label="Necessitam troca" value={sdaiNecessitaTroca} color="var(--status-warn)" icon={AlertTriangle} />
          <StatCard label="Com corretiva pendente" value={corretivasPendentesIds.size} color="var(--text-secondary)" icon={Activity} />
        </div>
      ) : (
        <div key="spci" className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print fade-in-up">
          <StatCard label="Total monitorado" value={spciTotal} color="var(--text-secondary)" icon={ClipboardList} />
          <StatCard label="Reprovados" value={spciReprovados} color="var(--status-danger)" icon={AlertTriangle} />
          <StatCard label="Sem inspeção registrada" value={spciSemInspecao} color="var(--status-warn)" icon={Clock} />
          <StatCard label="Itens exibidos" value={reportTab === 'sdai' ? sdaiTotal : spciTodos.length} color="var(--text-secondary)" icon={Search} />
        </div>
      )}

      <div className="flex gap-2 flex-wrap no-print">
        <div className="relative flex-1" style={{ minWidth: 220 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por identificação, localização ou tipo..."
            value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        {reportTab === 'sdai' && data.panels.length > 0 && (
          <select className={inputCls} style={{ width: 'auto' }} value={filters.panelId} onChange={(e) => setFilters({ ...filters, panelId: e.target.value })}>
            <option value="all">Todos os painéis</option>
            {data.panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
                {(() => {
          const todos = reportTab === 'sdai'
            ? [...sdaiSets.enderecaveis, ...sdaiSets.nacs, ...sdaiSets.complementares]
            : [...spciSets.agua, ...spciSets.gas, ...spciSets.componentes];
          const tipos = [...new Set(todos.map((it) => it.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
          if (tipos.length === 0) return null;
          return (
            <select className={inputCls} style={{ width: 'auto' }} value={filters.tipo || 'all'} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}>
              <option value="all">Todos os tipos</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          );
        })()}
      </div>

      <div className="print-area rounded-xl p-4 sm:p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-4 pb-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {client.branding?.logoData
              ? <img src={client.branding.logoData} alt="" className="w-11 h-11 rounded-lg object-cover" />
              : <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-raised)' }}><Building2 size={18} style={{ color: 'var(--text-secondary)' }} /></div>}
            <div>
              <p className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
              {client.address && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{client.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Relatório de Inspeções — {reportTab === 'sdai' ? 'SDAI' : 'SPCI (Sistemas de Combate)'}</p>
            <p className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>Gerado em {formatDateBR(todayISO())}</p>
          </div>
        </div>

        {reportTab === 'sdai' ? (
          sdaiTotal === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Nenhum item cadastrado ainda.</p>
          ) : (
            <>
              <ReportSection title="Dispositivos Endereçáveis" groupBy columnHeaders={['Status', 'Aparência', 'Com. local', 'Com. rede', 'Última insp.', 'Próxima insp.']} items={sdaiFiltered.enderecaveis} />
              <ReportSection title="Circuitos de Saída (NAC)" groupBy columnHeaders={['Status', 'Aparência', 'Com. local', 'Com. rede', 'Última insp.', 'Próxima insp.']} items={sdaiFiltered.nacs} />
              <ReportSection title="Dispositivos Complementares" groupBy columnHeaders={['Status', 'Aparência', 'Com. local', 'Com. rede', 'Última insp.', 'Próxima insp.']} items={sdaiFiltered.complementares} />
            </>
          )
        ) : (
          spciTotal === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Nenhum item cadastrado ainda.</p>
          ) : (
            <>
              <ReportSection title="Água" groupBy columnHeaders={['Resultado', 'Última', 'Próxima']} items={spciFiltered.agua} />
              <ReportSection title="Agentes Gasosos" groupBy columnHeaders={['Resultado', 'Última', 'Próxima']} items={spciFiltered.gas} />
              <ReportSection title="Componentes" groupBy columnHeaders={['Resultado', 'Última', 'Próxima']} items={spciFiltered.componentes} />
            </>
          )
        )}
      </div>
    </div>
  );
}

function SettingsView({ client, data, tab, setTab, onUpdateClient, onSaveModelPhoto, onRemoveModelPhoto, onImportCsv, lastImport, onUndoImport }) {
  const TABS = [
    { key: 'cliente', label: 'Cliente', icon: Building2 },
    { key: 'marca', label: 'Marca', icon: Palette },
    { key: 'usuario', label: 'Usuário', icon: UserCog },
    { key: 'modelos', label: 'Modelos', icon: ImagePlus },
    { key: 'operadores', label: 'Operadores', icon: Users },
    { key: 'importar', label: 'Importar', icon: Upload },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Configurações</h2>
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.key} className="nav-tab" data-active={tab === t.key} onClick={() => setTab(t.key)}><t.icon size={15} /> {t.label}</button>
        ))}
      </div>
      <div key={tab} className="fade-in-up">
        {tab === 'cliente' && <ClientForm initial={client} onSubmit={(v) => onUpdateClient(v)} onCancel={() => {}} embedded />}
        {tab === 'marca' && <BrandingForm client={client} onSave={(branding) => onUpdateClient({ branding })} />}
        {tab === 'usuario' && <UserForm client={client} onSave={(user) => onUpdateClient({ user })} onRemove={() => onUpdateClient({ user: null })} />}
        {tab === 'modelos' && <ModelLibraryManager data={data} onSave={onSaveModelPhoto} onRemove={onRemoveModelPhoto} />}
        {tab === 'operadores' && <MembersManager clientId={client.id} />}
        {tab === 'importar' && <ImportCsvView onImport={onImportCsv} data={data} lastImport={lastImport} onUndoImport={onUndoImport} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Importação de base de dados (CSV de painel)                        */
/* ------------------------------------------------------------------ */

/* Exporta a base atual de dispositivos (todos os painéis/laços do cliente) em CSV,
   pronta para abrir no Excel (separador ; e BOM para acentuação). */
/* ------------------------------------------------------------------ */
/* Indicador: histórico de diagnóstico e falhas (planilha "Indicador SDAI") */
/* ------------------------------------------------------------------ */

function normalizeHeader(h) {
  return String(h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function findIndicadorCol(row, includes, excludes = []) {
  const entry = Object.entries(row).find(([k]) => {
    const nk = normalizeHeader(k);
    return includes.every((n) => nk.includes(n)) && !excludes.some((n) => nk.includes(n));
  });
  return entry ? entry[1] : '';
}

function excelValueToISODate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const off = val.getTimezoneOffset();
    const local = new Date(val.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s || /^nat$/i.test(s)) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  return '';
}

/** Lê a planilha "Indicador" (histórico de diagnóstico/falhas) e devolve os registros
    já no formato usado pelo app, tolerando pequenas variações de cabeçalho (acentos,
    espaços extras) já que casa por conteúdo normalizado, não pelo texto exato. */
async function parseIndicadorXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find((n) => /indicador/i.test(n)) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const records = rows.map((row) => ({
    id: uid(),
    deviceId: '',
    categoria: '',
    fotos: [],
    etiqueta: String(findIndicadorCol(row, ['ETIQUETA']) || '').trim(),
    endereco: String(findIndicadorCol(row, ['ENDERECO']) || '').trim(),
    laco: String(findIndicadorCol(row, ['LACO']) || '').trim(),
    equipamento: String(findIndicadorCol(row, ['EQUIPAMENTO']) || '').trim(),
    painel: String(findIndicadorCol(row, ['PAINEL']) || '').trim(),
    area: String(findIndicadorCol(row, ['AREA']) || '').trim(),
    falha: String(findIndicadorCol(row, ['FALHA']) || '').trim(),
    descritivo: String(findIndicadorCol(row, ['DESCRITIVO']) || '').trim(),
    status: String(findIndicadorCol(row, ['STATUS']) || '').trim(),
    explanacao: String(findIndicadorCol(row, ['EXPLANA']) || '').trim(),
    dataDiagnostico: excelValueToISODate(findIndicadorCol(row, ['DIAGNOSTICO'])),
    dataIntervencao1: excelValueToISODate(findIndicadorCol(row, ['INTERVEN', '1'])),
    dataIntervencao2: excelValueToISODate(findIndicadorCol(row, ['INTERVEN', '2'])),
    dataIntervencao3: excelValueToISODate(findIndicadorCol(row, ['INTERVEN', '3'])),
    dataIntervencao4: excelValueToISODate(findIndicadorCol(row, ['INTERVEN', '4'])),
    dataSolucao: excelValueToISODate(findIndicadorCol(row, ['DATA', 'SOLU'])),
    solucao: String(findIndicadorCol(row, ['SOLU'], ['DATA']) || '').trim(),
  })).filter((r) => r.etiqueta || r.falha || r.descritivo);

  if (records.length === 0) {
    throw new Error('Nenhum registro foi encontrado nessa planilha. Verifique se é o arquivo do Indicador.');
  }
  return records;
}

/* Vincula registros do Indicador aos dispositivos reais do painel, cruzando pela coluna
   "PAINEL - ND" (que corresponde ao Network Address de cada painel no report do Loop
   Explorer), pelo laço e pelo endereço. Mapeamento tirado diretamente do report LP1 da
   Nissan (Panel X / Network Address N) — específico deste sistema; painéis fora dessa
   lista (ex.: 7 = AUTOLEARN/PWT, ou "Notifier") não têm correspondência aqui e ficam sem
   vínculo, já que pertencem a outro relatório/sistema. */
const INDICADOR_PANEL_NETWORK_MAP = {
  '1': 'SECURITY OFFICE', '2': 'PAINT', '3': 'TRIM', '4': 'PLASTIC',
  '5': 'BODY', '6': 'POWER TRAIN', '8': 'CENTRAL COP',
};

function normalizeAddressBase(addr) {
  const m = String(addr || '').match(/(\d+)/);
  return m ? String(parseInt(m[1], 10)) : '';
}

function normalizeLoopNumber(v) {
  const m = String(v ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function matchIndicadorRecordToDevice(record, data) {
  const panelName = INDICADOR_PANEL_NETWORK_MAP[String(record.painel || '').trim()];
  if (!panelName) return null;
  const panel = data.panels.find((p) => p.name.trim().toUpperCase() === panelName);
  if (!panel) return null;
  const addrBase = normalizeAddressBase(record.endereco);
  if (!addrBase) return null;
  const loopNum = normalizeLoopNumber(record.laco);
  const panelLoops = data.loops.filter((l) => l.panelId === panel.id);
  const candidateLoops = loopNum !== null
    ? panelLoops.filter((l) => normalizeLoopNumber(l.name) === loopNum)
    : panelLoops;
  const loopsToSearch = candidateLoops.length ? candidateLoops : panelLoops;
  for (const loop of loopsToSearch) {
    const device = data.devices.find((d) => d.loopId === loop.id && normalizeAddressBase(d.address) === addrBase);
    if (device) return device.id;
  }
  return null;
}

function exportDevicesCsv(data) {
  const header = ['Painel', 'Modelo do Painel', 'Laço', 'Endereço', 'Categoria', 'Modelo do Dispositivo', 'Descrição', 'Última Manutenção', 'Próxima Manutenção'];
  const rows = data.devices.map((d) => {
    const loop = data.loops.find((l) => l.id === d.loopId);
    const panel = loop && data.panels.find((p) => p.id === loop.panelId);
    return [
      panel?.name || '', panel?.model || '', loop?.name || '', d.address,
      DEVICE_TYPE_MAP[d.type]?.label || d.type || '', d.modelo || '', d.description || '',
      formatDateBR(d.lastMaintenance), formatDateBR(d.nextMaintenance),
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2], undefined, { numeric: true }) || a[3].localeCompare(b[3], undefined, { numeric: true }));

  const escapeCell = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(escapeCell).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dispositivos-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ImportCsvView({ onImport, data, lastImport, onUndoImport }) {
  const [brand, setBrand] = useState('hochiki');
  const [model, setModel] = useState(brandInfo('hochiki').models[0].value);
  const [hochikiFormat, setHochikiFormat] = useState('lp2');
  const [targetMode, setTargetMode] = useState('new');
  const [targetPanelId, setTargetPanelId] = useState('');
  const [loopChoice, setLoopChoice] = useState(1);

  const [rows, setRows] = useState(null);
  const [entities, setEntities] = useState(null);
  const [typeMap, setTypeMap] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [fileNames, setFileNames] = useState({});
  const [notifierSheets, setNotifierSheets] = useState({ modules: null, detectors: null });
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [removeIds, setRemoveIds] = useState(new Set());
  const [openLoopGroups, setOpenLoopGroups] = useState(new Set());
  const [parsingFile, setParsingFile] = useState(false);

  const review = entities ? computeImportReview(entities, data) : null;

  function toggleRemoveId(id) {
    setRemoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleLoopGroup(loopId) {
    setOpenLoopGroups((prev) => {
      const next = new Set(prev);
      if (next.has(loopId)) next.delete(loopId); else next.add(loopId);
      return next;
    });
  }

  const currentModel = modelInfo(brand, model);
  const existingPanel = targetMode === 'existing' ? (data.panels || []).find((p) => p.id === targetPanelId) : null;
  const existingLoops = existingPanel ? (data.loops || []).filter((l) => l.panelId === existingPanel.id) : [];

  function targetOpts() {
    return { existingPanel, existingLoops, panelModel: currentModel.shortLabel || '' };
  }

  function recomputeFromRows(nextRows, nextTypeMap) {
    try {
      setEntities(buildImportEntities(nextRows, nextTypeMap, brand, targetOpts()));
      setError('');
    } catch (err) {
      setError(err.message || 'Não foi possível processar esses dados.');
      setEntities(null);
    }
    setReviewOpen(false);
    setRemoveIds(new Set());
    setOpenLoopGroups(new Set());
  }

  function seedTypeMapAndBuild(nextRows) {
    const seeded = {};
    const seen = {};
    nextRows.forEach((r) => { seen[r.type] = true; });
    Object.keys(seen).forEach((code) => { seeded[code] = guessDeviceType(brand, code); });
    setRows(nextRows);
    setTypeMap(seeded);
    try {
      setEntities(buildImportEntities(nextRows, seeded, brand, targetOpts()));
      setError('');
    } catch (err) {
      setError(err.message || 'Não foi possível processar esses dados.');
      setEntities(null);
    }
    setReviewOpen(false);
    setRemoveIds(new Set());
    setOpenLoopGroups(new Set());
  }

  function handleBrandChange(value) {
    setBrand(value);
    setModel(brandInfo(value).models[0].value);
    setHochikiFormat('lp2');
    setLoopChoice(1);
    setRows(null); setEntities(null); setTypeMap({}); setError(''); setDone(false);
    setFileNames({}); setNotifierSheets({ modules: null, detectors: null });
  }

  function handleModelChange(value) {
    setModel(value);
    setLoopChoice(1);
    setRows(null); setEntities(null); setError(''); setDone(false);
    setFileNames({}); setNotifierSheets({ modules: null, detectors: null });
  }

  function handleHochikiFormatChange(value) {
    setHochikiFormat(value);
    setRows(null); setEntities(null); setTypeMap({}); setError(''); setDone(false);
    setFileNames({});
  }

  function handleHochikiFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNames({ hochiki: file.name });
    setError(''); setDone(false);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsedRows = parseDeviceLabelsCsv(String(reader.result));
        seedTypeMapAndBuild(parsedRows);
      } catch (err) {
        setError(err.message || 'Não foi possível ler esse arquivo.');
        setRows(null); setEntities(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleHochikiLp1File(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNames({ hochikiLp1: file.name });
    setError(''); setDone(false);
    setParsingFile(true);
    try {
      const words = await extractPdfWords(file);
      const parsedRows = parseLp1Report(words);
      seedTypeMapAndBuild(parsedRows);
    } catch (err) {
      setError(err.message || 'Não foi possível ler esse arquivo PDF.');
      setRows(null); setEntities(null);
    } finally {
      setParsingFile(false);
    }
  }

  async function handleNotifierFile(slot, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setDone(false);
    setFileNames((prev) => ({ ...prev, [slot]: file.name }));
    setParsingFile(true);
    try {
      const rawRows = await readFileAsRows(file);
      const parsedSheet = parseNotifierSheet(rawRows);
      const nextSheets = { ...notifierSheets, [slot]: parsedSheet };
      setNotifierSheets(nextSheets);
      const loopLabel = `LP ${loopChoice}`;
      const combined = [
        ...(nextSheets.modules ? notifierSheetToGenericRows(nextSheets.modules, loopLabel) : []),
        ...(nextSheets.detectors ? notifierSheetToGenericRows(nextSheets.detectors, loopLabel) : []),
      ];
      seedTypeMapAndBuild(combined);
    } catch (err) {
      setError(err.message || 'Não foi possível ler esse arquivo.');
    } finally {
      setParsingFile(false);
    }
  }

  function handleLoopChoiceChange(value) {
    setLoopChoice(value);
    const loopLabel = `LP ${value}`;
    const combined = [
      ...(notifierSheets.modules ? notifierSheetToGenericRows(notifierSheets.modules, loopLabel) : []),
      ...(notifierSheets.detectors ? notifierSheetToGenericRows(notifierSheets.detectors, loopLabel) : []),
    ];
    if (combined.length) seedTypeMapAndBuild(combined);
  }

  function updateTypeMap(code, value) {
    const next = { ...typeMap, [code]: value };
    setTypeMap(next);
    if (rows) recomputeFromRows(rows, next);
  }

  function handleTargetModeChange(value) {
    setTargetMode(value);
    if (value === 'new') setTargetPanelId('');
    if (rows) recomputeFromRows(rows, typeMap);
  }

  function handleTargetPanelChange(id) {
    setTargetPanelId(id);
    if (rows) {
      // recompute usando o novo painel selecionado diretamente (o state ainda não atualizou no closure)
      try {
        const chosenPanel = (data.panels || []).find((p) => p.id === id);
        const chosenLoops = chosenPanel ? (data.loops || []).filter((l) => l.panelId === chosenPanel.id) : [];
        setEntities(buildImportEntities(rows, typeMap, brand, { existingPanel: chosenPanel, existingLoops: chosenLoops, panelModel: currentModel.shortLabel || '' }));
        setError('');
      } catch (err) {
        setError(err.message || 'Não foi possível processar esses dados.');
      }
      setReviewOpen(false);
      setRemoveIds(new Set());
    }
  }

  function handleConfirm() {
    onImport(entities, Array.from(removeIds));
    setDone(true);
    setReviewOpen(false);
    setRemoveIds(new Set());
    setOpenLoopGroups(new Set());
    setRows(null);
    setEntities(null);
    setNotifierSheets({ modules: null, detectors: null });
    setFileNames({});
    setConfirmUndo(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Base de dispositivos atual</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {data.devices.length} dispositivo(s) cadastrado(s) neste cliente.
          </p>
        </div>
        <Button variant="secondary" onClick={() => exportDevicesCsv(data)} disabled={data.devices.length === 0}>
          <Upload size={15} style={{ transform: 'rotate(180deg)' }} /> Exportar base (.csv)
        </Button>
      </div>

      {lastImport && (
        <div className="rounded-lg p-3.5 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Última importação</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lastImport.summary}</p>
          </div>
          {confirmUndo ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => setConfirmUndo(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { onUndoImport(); setConfirmUndo(false); }}>Confirmar, desfazer</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmUndo(true)}><Trash2 size={15} /> Desfazer última importação</Button>
          )}
        </div>
      )}

      <div className="rounded-lg p-3.5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Importar base de dispositivos</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Envie o relatório exportado do painel. O sistema identifica automaticamente painéis, laços e dispositivos, de acordo com a marca e o modelo selecionados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Marca do painel">
            <select value={brand} onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {IMPORT_BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Modelo do painel">
            <select value={model} onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {brandInfo(brand).models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Painel de destino">
            <select value={targetMode} onChange={(e) => handleTargetModeChange(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="new">Criar novo painel</option>
              <option value="existing">Usar painel já cadastrado</option>
            </select>
          </Field>
          {targetMode === 'existing' && (
            <Field label="Selecione o painel">
              <select value={targetPanelId} onChange={(e) => handleTargetPanelChange(e.target.value)}
                className="w-full px-2.5 py-2 rounded-md text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Selecione…</option>
                {(data.panels || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {currentModel.loops > 1 && (
          <Field label="Laço correspondente a este arquivo" hint="A Notifier não indica o laço no relatório — informe a qual laço esses dispositivos pertencem.">
            <select value={loopChoice} onChange={(e) => handleLoopChoiceChange(Number(e.target.value))}
              className="w-full px-2.5 py-2 rounded-md text-sm sm:w-48" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {Array.from({ length: currentModel.loops }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Laço {n}</option>
              ))}
            </select>
          </Field>
        )}

        {brand === 'hochiki' ? (
          <div className="flex flex-col gap-2">
            <Field label="Formato do relatório" hint="O Loop Explorer 2 exporta .csv; o Loop Explorer 1 (mais antigo) exporta .pdf.">
              <select value={hochikiFormat} onChange={(e) => handleHochikiFormatChange(e.target.value)}
                className="w-full px-2.5 py-2 rounded-md text-sm sm:w-72" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="lp2">Loop Explorer 2 (.csv)</option>
                <option value="lp1">Loop Explorer 1 (.pdf)</option>
              </select>
            </Field>
            {hochikiFormat === 'lp2' ? (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-fit cursor-pointer"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <Upload size={15} /> Escolher arquivo .csv
                <input type="file" accept=".csv" onChange={handleHochikiFile} className="hidden" />
              </label>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-fit cursor-pointer"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <FileText size={15} /> Escolher arquivo .pdf
                <input type="file" accept=".pdf" onChange={handleHochikiLp1File} className="hidden" />
              </label>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              A Notifier separa detectores e módulos em relatórios distintos no VeriFire Tools. Envie um ou os dois, conforme disponível (.xls, .xlsx ou .csv).
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-fit cursor-pointer"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <FileSpreadsheet size={15} /> Relatório de módulos
                <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleNotifierFile('modules', e)} className="hidden" />
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-fit cursor-pointer"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <FileSpreadsheet size={15} /> Relatório de detectores
                <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleNotifierFile('detectors', e)} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {(fileNames.hochiki || fileNames.hochikiLp1 || fileNames.modules || fileNames.detectors) && (
          <div className="flex flex-col gap-0.5">
            {fileNames.hochiki && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Arquivo: {fileNames.hochiki}</p>}
            {fileNames.hochikiLp1 && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Arquivo: {fileNames.hochikiLp1}</p>}
            {fileNames.modules && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Módulos: {fileNames.modules}</p>}
            {fileNames.detectors && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Detectores: {fileNames.detectors}</p>}
          </div>
        )}
        {parsingFile && <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Loader2 size={13} className="animate-spin" /> Lendo arquivo...</p>}
        {error && <p className="text-xs" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        {done && <p className="text-xs" style={{ color: 'var(--status-ok)' }}>Importação concluída! Confira em "Painéis".</p>}
      </div>

      {entities && (
        <div className="flex flex-col gap-4 fade-in-up">
          <div className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Confirme a categoria de cada tipo de dispositivo</p>
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Identifiquei estes códigos no arquivo. Ajuste se alguma categoria não estiver certa.
            </p>
            {Object.keys(entities.typeCounts).map((code) => (
              <div key={code} className="flex items-center justify-between gap-2 rounded-md p-2" style={{ background: 'var(--surface-raised)' }}>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{code}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{entities.typeCounts[code]} ocorrência(s)</p>
                </div>
                <select value={typeMap[code] || 'entrada'} onChange={(e) => updateTypeMap(code, e.target.value)}
                  className="px-2 py-1 rounded-md text-xs flex-shrink-0" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-3.5 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Resumo antes de importar</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {entities.panels.length} painel(éis) novo(s) · {entities.loops.length} laço(s) · {entities.devices.length} dispositivo(s)
            </p>
            {targetMode === 'existing' && existingPanel && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Os dispositivos serão adicionados ao painel <strong>{existingPanel.name}</strong>. Laços com nome igual a um já existente serão reaproveitados; os demais serão criados.
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Dispositivos com o mesmo laço e endereço de um já cadastrado são <strong>atualizados</strong>, não duplicados — o histórico (visitas, inspeções, indicador) é preservado.
            </p>
            {!reviewOpen && (
              <Button variant="primary" onClick={() => setReviewOpen(true)} disabled={targetMode === 'existing' && !existingPanel}>
                <Upload size={15} /> Revisar importação
              </Button>
            )}
          </div>

          {reviewOpen && review && (
            <div className="rounded-lg p-3.5 flex flex-col gap-3 fade-in-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Revisar antes de gravar</p>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md p-2" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Novos</p>
                  <p className="text-lg font-medium" style={{ color: 'var(--status-ok)' }}>{review.novos.length}</p>
                </div>
                <div className="rounded-md p-2" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Atualizados</p>
                  <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{review.atualizados.length}</p>
                </div>
                <div className="rounded-md p-2" style={{ background: 'var(--surface-raised)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Não encontrados</p>
                  <p className="text-lg font-medium" style={{ color: 'var(--status-warn)' }}>{review.naoEncontrados.length}</p>
                </div>
              </div>

              {review.atualizados.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Mesmo laço e endereço já cadastrados nesse painel — os dados serão sincronizados, mantendo o histórico vinculado.
                </p>
              )}

              {review.naoEncontrados.length > 0 && (
                <div className="rounded-md p-2 flex flex-col gap-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--status-warn)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Estavam cadastrados neste painel mas não vieram nesse arquivo. Marque os que devem ser removidos — os demais continuam ativos.
                  </p>
                  {Object.entries(
                    review.naoEncontrados.reduce((acc, d) => {
                      (acc[d.loopId] = acc[d.loopId] || []).push(d);
                      return acc;
                    }, {})
                  ).map(([loopId, itens]) => {
                    const loopName = (data.loops || []).find((l) => l.id === loopId)?.name || 'Laço';
                    const isOpen = openLoopGroups.has(loopId);
                    const markedCount = itens.filter((d) => removeIds.has(d.id)).length;
                    return (
                      <div key={loopId} style={{ borderTop: '1px solid var(--border)' }}>
                        <button type="button" onClick={() => toggleLoopGroup(loopId)}
                          className="w-full flex items-center justify-between gap-2 py-2 text-left">
                          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            {loopName} <span style={{ color: 'var(--text-secondary)' }}>({itens.length})</span>
                          </span>
                          {markedCount > 0 && (
                            <span className="text-xs" style={{ color: 'var(--status-warn)' }}>{markedCount} marcado(s) pra remover</span>
                          )}
                        </button>
                        {isOpen && (
                          <div className="flex flex-col gap-1 pb-2 pl-1 fade-in-up">
                            {itens.map((d) => (
                              <label key={d.id} className="flex items-center gap-2 py-1 text-sm">
                                <input type="checkbox" checked={removeIds.has(d.id)} onChange={() => toggleRemoveId(d.id)} />
                                <span style={{ color: 'var(--text-primary)' }}>
                                  Endereço {d.address} · {DEVICE_TYPE_MAP[d.type]?.label || d.type} — {d.description || 'sem etiqueta'}{' '}
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    ({d.linkedCount > 0 ? `${d.linkedCount} registro(s) vinculado(s)` : 'sem histórico'})
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Atenção: o botão "Desfazer última importação" só reverte dispositivos <strong>novos</strong>. Atualizações e remoções feitas aqui não são desfeitas automaticamente.
              </p>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setReviewOpen(false)}>Voltar</Button>
                <Button variant="primary" onClick={handleConfirm}>
                  <Upload size={15} /> Confirmar importação
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gerenciamento de operadores/visualizadores por cliente               */
/* ------------------------------------------------------------------ */

function MembersManager({ clientId }) {
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operador');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadMembers() {
    const { data: rows, error: err } = await supabase
      .from('memberships').select('id, user_id, role').eq('client_id', clientId);
    if (err) { setError('Não foi possível carregar os usuários deste cliente.'); return; }
    if (!rows || rows.length === 0) { setMembers([]); return; }
    const ids = rows.map((r) => r.user_id);
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', ids);
    const emailById = Object.fromEntries((profs || []).map((p) => [p.id, p.email]));
    setMembers(rows.map((r) => ({ ...r, email: emailById[r.user_id] || '(email não encontrado)' })));
  }

  useEffect(() => { loadMembers(); }, [clientId]);

  async function addMember(e) {
    e.preventDefault();
    setError(''); setInfo(''); setSaving(true);
    try {
      const { data: prof, error: findErr } = await supabase.from('profiles').select('id').eq('email', email.trim()).maybeSingle();
      if (findErr) throw findErr;
      if (!prof) {
        setError('Nenhum usuário encontrado com esse email. Peça para essa pessoa criar uma conta na tela de login do app primeiro, depois tente novamente.');
        return;
      }
      const { error: insErr } = await supabase.from('memberships').upsert(
        { user_id: prof.id, client_id: clientId, role }, { onConflict: 'user_id,client_id' }
      );
      if (insErr) throw insErr;
      setInfo('Usuário vinculado com sucesso.');
      setEmail('');
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Não foi possível vincular esse usuário.');
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(id, newRole) {
    await supabase.from('memberships').update({ role: newRole }).eq('id', id);
    loadMembers();
  }

  async function removeMember(id) {
    await supabase.from('memberships').delete().eq('id', id);
    loadMembers();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3.5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Vincular usuário a este cliente</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          A pessoa precisa primeiro ter criado uma conta na tela de login do app (com o email abaixo). Depois, vincule aqui e escolha o nível de acesso.
        </p>
        <form onSubmit={addMember} className="flex flex-col sm:flex-row gap-2">
          <input type="email" required placeholder="email@dapessoa.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="operador">Operador (pode editar)</option>
            <option value="visualizador">Visualizador (só leitura)</option>
            <option value="admin">Admin deste cliente</option>
          </select>
          <Button variant="primary" type="submit" disabled={saving}><UserPlus size={15} /> {saving ? 'Vinculando...' : 'Vincular'}</Button>
        </form>
        {error && <p className="text-xs" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        {info && <p className="text-xs" style={{ color: 'var(--accent)' }}>{info}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Usuários vinculados</p>
        {members === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: '45%', height: 13 }} />
                <div className="skeleton" style={{ width: 70, height: 22 }} />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhum usuário vinculado ainda.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.email}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}
                  className="px-2 py-1 rounded-md text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="operador">Operador</option>
                  <option value="visualizador">Visualizador</option>
                  <option value="admin">Admin</option>
                </select>
                <IconButton title="Remover vínculo" danger onClick={() => removeMember(m.id)}><Trash2 size={14} /></IconButton>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Global styles                                                      */
/* ------------------------------------------------------------------ */

function PageStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

      html, body { overflow-x: hidden; max-width: 100vw; background: var(--bg); min-height: 100dvh; }
      #root { overflow-x: hidden; min-height: 100dvh; }
      :root {
        --bg: #181414;
        --surface: #221D1D;
        --surface-raised: #2C2424;
        --border: #3E3232;
        --text-primary: #F1EDEA;
        --text-secondary: #A79999;
        --accent: #8B2F2F;
        --accent-contrast: #FFFFFF;
        --status-ok: #3FB950;
        --status-warn: #E8A33B;
        --status-danger: #E0483D;
        --status-none: #6B6161;
      }
      .font-display { font-family: 'Space Grotesk', sans-serif; }
      .font-body, body { font-family: 'IBM Plex Sans', sans-serif; }
      .mono { font-family: 'IBM Plex Mono', monospace; }
      .mono-chip {
        font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 2px 7px;
        border-radius: 4px; background: var(--surface-raised); color: var(--text-secondary);
        border: 1px solid var(--border); white-space: nowrap;
      }
      .led {
        display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
        box-shadow: 0 0 6px currentColor;
      }
      .led[data-pulse="true"] { animation: ledpulse 1.6s ease-in-out infinite; }
      @keyframes ledpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      @media (prefers-reduced-motion: reduce) { .led[data-pulse="true"] { animation: none; } }

      /* ---- Motion base: skeleton loading + entrada suave de painéis (usado em todos os módulos) ---- */
      @keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      .skeleton { background: var(--surface-raised); border-radius: 8px; animation: skeleton-pulse 1.4s ease-in-out infinite; }
      @keyframes fade-in-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .fade-in-up { animation: fade-in-up .2s ease-out backwards; }
      @keyframes modal-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modal-panel-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .modal-backdrop-in { animation: modal-backdrop-in .15s ease-out; }
      .modal-panel-in { animation: modal-panel-in .18s cubic-bezier(0.16, 1, 0.3, 1); }
      @media (prefers-reduced-motion: reduce) {
        .skeleton { animation: none; opacity: 0.7; }
        .fade-in-up { animation: none; }
        .modal-backdrop-in, .modal-panel-in { animation: none; }
      }
      .status-pill {
        font-size: 11px; font-family: 'IBM Plex Mono', monospace; padding: 3px 8px;
        border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; flex-shrink: 0;
      }
      .field-input { background: var(--surface-raised); border: 1px solid var(--border); color: var(--text-primary); }
      .field-input::placeholder { color: #5B6266; }
      .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(139,47,47,0.25); outline: none; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 8px; min-height: 40px;
        transition: all .15s ease; white-space: nowrap; cursor: pointer;
      }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn-primary { background: var(--accent); color: var(--accent-contrast); }
      .btn-primary:hover { filter: brightness(1.08); }
      .btn-secondary { background: var(--surface-raised); color: var(--text-primary); border: 1px solid var(--border); }
      .btn-secondary:hover { background: var(--border); }
      .btn-danger { background: transparent; color: var(--status-danger); border: 1px solid var(--status-danger); }
      .btn-danger:hover { background: rgba(240,71,61,0.1); }
      .btn-icon {
        display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px;
        border-radius: 8px; color: var(--text-secondary); transition: all .15s ease; cursor: pointer; flex-shrink: 0;
      }
      .btn-icon:hover { background: var(--surface-raised); color: var(--text-primary); }
      .btn-icon-danger:hover { background: rgba(240,71,61,0.12); color: var(--status-danger); }
      .grid-2-mobile-safe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      @media (max-width: 640px) {
        .btn-icon { width: 44px; height: 44px; }
        .grid-2-mobile-safe { grid-template-columns: 1fr; }
      }
      .report-group-body.collapsed { display: none; }
      .nav-tab {
        font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 8px 8px 0 0;
        color: var(--text-secondary); white-space: nowrap; display: inline-flex; align-items: center;
        gap: 6px; transition: all .15s ease; cursor: pointer;
      }
      .nav-tab[data-active="true"] { background: var(--surface-raised); color: var(--text-primary); }
      .nav-tab:hover:not([data-active="true"]) { color: var(--text-primary); }
      :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
      input[type="color"] { padding: 2px; background: var(--surface-raised); }

      /* ---- Identidade de marca no RVT (cabeçalho, cards, rodapé) ---- */
      .rvt-brand-band {
        position: relative; background: var(--accent); color: var(--accent-contrast);
        padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;
        gap: 14px; flex-wrap: wrap; overflow: hidden;
      }
      .rvt-brand-band::after {
        content: ''; position: absolute; top: 0; right: 0; width: 110px; height: 100%;
        background: rgba(0,0,0,0.14); clip-path: polygon(45% 0, 100% 0, 100% 100%, 100% 100%);
      }
      .rvt-brand-band::before {
        content: ''; position: absolute; top: -20px; left: -20px; width: 80px; height: 80px;
        background: repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 14px);
      }
      .rvt-wordmark { display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
      .rvt-wordmark-icon {
        width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.55);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .rvt-wordmark-text .maj { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: 700; letter-spacing: 0.03em; line-height: 1; }
      .rvt-wordmark-text .sol { font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.75); }
      .rvt-divider-v { width: 1px; height: 30px; background: rgba(255,255,255,0.3); }
      .rvt-summary-card { border-top: 3px solid var(--accent); }
      .rvt-item-card { border-left: 4px solid var(--accent); }
      .rvt-footer-band {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        padding-top: 12px; border-top: 2px solid var(--accent);
      }
      .rvt-footer-icon {
        width: 15px; height: 15px; border-radius: 50%; border: 1px solid var(--accent);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }

      /* ---- Fundo da tela de login: emblema real como marca d'água no canto (mescla v1 + v6) ---- */
      .login-bg { position: relative; min-height: 100vh; background: var(--bg); overflow: hidden; }
      .login-bg::before {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse 900px 600px at 50% 40%, rgba(139,47,47,0.12), transparent 68%);
      }
      .login-watermark {
        position: absolute; width: 620px; height: auto; right: -120px; bottom: -110px;
        opacity: 0.14; pointer-events: none; user-select: none;
      }
      .login-content {
        position: relative; z-index: 1; min-height: 100vh;
        display: flex; align-items: center; justify-content: center; padding: 24px;
      }

      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print-area {
          position: absolute; left: 0; top: 0; width: 100%;
          --bg: #ffffff; --surface: #ffffff; --surface-raised: #f2f3f4; --border: #d7dadc;
          --text-primary: #15181a; --text-secondary: #55605c;
          background: #fff !important; border: none !important;
        }
        .print-area, .print-area * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .print-area img { break-inside: avoid; }
        .rvt-brand-band { break-inside: avoid; page-break-inside: avoid; }
        .rvt-summary-card { break-inside: avoid; }
        .rvt-item-card { break-inside: avoid; page-break-inside: avoid; }
        .rvt-footer-band { break-inside: avoid; page-break-inside: avoid; break-before: avoid; }
        .no-print { display: none !important; }
        .report-group-body.collapsed { display: block !important; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Root: multi-tenant client management                               */
/* ------------------------------------------------------------------ */

function Root() {
  const { isOwner, memberships, role } = useAuth();
  const [clients, setClients] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeClientId, setActiveClientId] = useState(null);
  const [showToolChecklist, setShowToolChecklist] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [authedClientId, setAuthedClientId] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await loadAndMigrateClients();
      setClients(list);
      const last = await loadLastClientId();
      if (last && list.some((c) => c.id === last)) setActiveClientId(last);
      setLoaded(true);
    })();
  }, []);
  

  // Um usuário que não é dono da plataforma só enxerga os clientes aos quais foi vinculado (memberships)
  const visibleClients = React.useMemo(() => {
    if (!clients) return clients;
    if (isOwner) return clients;
    const allowedIds = new Set((memberships || []).map((m) => m.client_id));
    return clients.filter((c) => allowedIds.has(c.id));
  }, [clients, isOwner, memberships]);

  function membershipRoleFor(clientId) {
    const m = (memberships || []).find((mm) => mm.client_id === clientId);
    return m ? m.role : null;
  }

  function persistClients(next) {
    (async () => { try { await window.storage.set(CLIENTS_KEY, JSON.stringify(next), false); } catch (e) { console.error(e); } })();
  }
  function updateClients(mutator) {
    setClients((prev) => { const next = mutator(prev); persistClients(next); return next; });
  }

  async function createClient(values) {
    const id = uid();
    const newClient = { id, name: values.name, address: values.address || '', contact: values.contact || '', branding: {}, user: null };
    updateClients((prev) => [...prev, newClient]);
    try { await window.storage.set(clientDataKey(id), JSON.stringify(emptyData()), false); } catch (e) { console.error(e); }
  }
  function updateClient(id, patch) {
    updateClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteClient(id) {
    updateClients((prev) => prev.filter((c) => c.id !== id));
    (async () => { try { await window.storage.delete(clientDataKey(id), false); } catch (e) { /* ignore */ } })();
    if (activeClientId === id) { setActiveClientId(null); setAuthedClientId(null); clearLastClientId(); }
  }

  function selectClient(id) {
    setActiveClientId(id);
    const c = clients.find((x) => x.id === id);
    // O antigo PIN por cliente só se aplica quando o Supabase não está configurado (modo local legado);
    // com Supabase, o login já foi validado antes de chegar aqui.
    if (supabase || !c || !c.user) { setAuthedClientId(id); saveLastClientId(id); }
  }
  function handleLoginSuccess() { setAuthedClientId(activeClientId); saveLastClientId(activeClientId); }
  function switchClient() { setActiveClientId(null); setAuthedClientId(null); clearLastClientId(); }

  if (!loaded || !clients || !visibleClients) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <PageStyles />
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  // Usuário vinculado a um único cliente entra direto nele, sem precisar escolher
  if (!isOwner && !activeClientId && visibleClients.length === 1) {
    setTimeout(() => selectClient(visibleClients[0].id), 0);
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

const isMajStaff = isOwner || role === 'admin' || role === 'operador';

  if (!activeClientId) {
    if (showToolChecklist) {
      return <ToolChecklistScreen clients={visibleClients} role={role} onBack={() => setShowToolChecklist(false)} />;
    }
    

    return (
      <div>
        {isMajStaff && (
          <div className="p-4 flex justify-end">
            <button onClick={() => setShowToolChecklist(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#8B2F2F' }}>
              Checklist de Ferramentas
            </button>
          </div>
        )}
        <ClientSelector clients={visibleClients} canManage={isOwner} onSelect={selectClient} onCreate={createClient} onUpdate={updateClient} onDelete={deleteClient} />
      </div>
    );
  }

  const activeClient = clients.find((c) => c.id === activeClientId);
  if (!activeClient) {
    setTimeout(() => setActiveClientId(null), 0);
    return null;
  }

  if (activeClient.user && authedClientId !== activeClientId) {
    return <LoginGate client={activeClient} onSuccess={handleLoginSuccess} onBack={switchClient} />;
  }

  return (
    <Workspace key={activeClient.id} client={activeClient}
      onUpdateClient={(patch) => updateClient(activeClient.id, patch)}
      onSwitchClient={switchClient} />
  );
}

/* ------------------------------------------------------------------ */
/* Error boundary: surfaces unexpected crashes instead of a frozen screen */
/* ------------------------------------------------------------------ */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Erro na aplicação:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#181414' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#221D1D', border: '1px solid #3E3232' }}>
            <p className="font-medium mb-2" style={{ color: '#F1EDEA' }}>Ocorreu um erro inesperado</p>
            <p className="text-sm mb-4" style={{ color: '#A79999', fontFamily: 'monospace' }}>
              {String((this.state.error && this.state.error.message) || this.state.error)}
            </p>
            <button onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#8B2F2F', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <PageStyles />
      <AuthGate>
        <Root />
      </AuthGate>
    </ErrorBoundary>
  );
}
