import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Cpu, Droplet, Wind, Clock, Plus, X, Pencil, Trash2,
  ChevronDown, ChevronRight, ArrowLeft, Cloud, Thermometer, Hand, LogOut,
  LogIn, ToggleLeft, Bell, CheckCircle2, AlertTriangle, Search, Wrench,
  Loader2, Inbox, ShieldAlert, ClipboardList, ClipboardCheck, Settings,
  ImagePlus, UserCog, Building2, KeyRound, Printer, Upload, Palette, Users, UserPlus,
  FileSpreadsheet, FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ------------------------------------------------------------------ */
/* Supabase (banco de dados + login de usuários)                      */
/* ------------------------------------------------------------------ */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
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
    <img src="/maj-logo-icon.png" alt="MAJ Soluções" style={{ width: boxSize, height: boxSize, objectFit: 'contain', flexShrink: 0 }}
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
        devices.push({ loopKey: s.loopKey, address: `${s.baseStr}.${s.sub}`, type: typeMap[s.type] || 'entrada', modelo, label });
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

const DEVICE_TYPES = [
  { value: 'fumaca', label: 'Detector de fumaça', icon: Cloud },
  { value: 'calor', label: 'Detector de calor', icon: Thermometer },
  { value: 'acionador', label: 'Acionador manual', icon: Hand },
  { value: 'saida', label: 'Módulo de saída', icon: LogOut },
  { value: 'entrada', label: 'Módulo de entrada', icon: LogIn },
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
  { value: 'operante', label: 'Operante' },
  { value: 'nao_operante', label: 'Não operante' },
  { value: 'em_manutencao', label: 'Em manutenção' },
];
const APPEARANCE_OPTIONS = [
  { value: 'otimo', label: 'Ótimo' },
  { value: 'bom', label: 'Bom' },
  { value: 'aceitavel', label: 'Aceitável' },
  { value: 'necessita_troca', label: 'Necessita troca' },
];
const COMM_OPTIONS = [
  { value: 'operante', label: 'Operante' },
  { value: 'nao_operante', label: 'Não operante' },
];

const PUMP_TYPE_SUGGESTIONS = [
  'Bomba principal elétrica', 'Bomba principal diesel', 'Bomba jockey',
  'Painel de controle da bomba', 'Válvula de governo', 'Manômetro',
  'Chave de fluxo', 'Reservatório de água', 'Quadro de transferência automática',
];

const GAS_TYPE_SUGGESTIONS = [
  'GLP', 'Gás Natural (GN)', 'Monóxido de carbono (CO)', 'Metano (CH4)', 'Amônia (NH3)',
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
  { key: 'panels', label: 'Painéis', icon: Cpu },
  { key: 'pumphouse', label: 'Casa de Bombas', icon: Droplet },
  { key: 'gas', label: 'Detectores de Gases', icon: Wind },
  { key: 'report', label: 'Relatório', icon: ClipboardList },
  { key: 'history', label: 'Histórico', icon: Clock },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

const emptyData = () => ({
  panels: [], loops: [], nacs: [], devices: [], pumpDevices: [], gasDetectors: [],
  maintenanceLog: [], modelPhotos: {},
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
  if (v === 'operante') return 'var(--status-ok)';
  if (v === 'em_manutencao') return 'var(--status-warn)';
  if (v === 'nao_operante') return 'var(--status-danger)';
  return 'var(--status-none)';
}
function appearanceColor(v) {
  if (v === 'otimo' || v === 'bom') return 'var(--status-ok)';
  if (v === 'aceitavel') return 'var(--status-warn)';
  if (v === 'necessita_troca') return 'var(--status-danger)';
  return 'var(--status-none)';
}
function commColor(v) {
  if (v === 'operante') return 'var(--status-ok)';
  if (v === 'nao_operante') return 'var(--status-danger)';
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
  data.pumpDevices.forEach((p) => {
    items.push({
      id: p.id, category: 'pumpDevices', panelId: null, title: p.name, address: null, modelo: p.modelo || '',
      meta: `Casa de Bombas${p.type ? ' · ' + p.type : ''}`,
      nextMaintenance: p.nextMaintenance, lastMaintenance: p.lastMaintenance,
      operationalStatus: p.operationalStatus || '', appearance: p.appearance || '',
      localComm: p.localComm || '', networkComm: p.networkComm || '',
      lastInspection: p.lastInspection || '', nextInspection: p.nextInspection || '',
      icon: Droplet, photo: photoForModelo(data, p.modelo),
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl overflow-y-auto`}
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
    <div className="flex justify-end gap-2 pt-3 mt-2 sticky bottom-0" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm}><Trash2 size={15} /> Excluir</Button>
      </div>
    </Modal>
  );
}

/* Generic card for any trackable equipment (device, NAC, pump item, gas detector) */
function TrackableCard({ icon: Icon, photo, address, title, meta, status, onInspect, onMaintain, onEdit, onDelete, selectable, selected, onToggleSelect }) {
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
          {status && status.operationalStatus === 'nao_operante' && (
            <div className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
              <AlertTriangle size={11} /> Não operante
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
      <div className="grid grid-cols-2 gap-3">
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

function DeviceForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || {
    address: '', type: 'fumaca', modelo: '', description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.address.trim()) onSubmit(v); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Endereço *"><input autoFocus className={`${inputCls} mono`} value={v.address}
          onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="001" required /></Field>
        <Field label="Tipo de dispositivo *">
          <select className={inputCls} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Modelo do equipamento" hint="Usado para agrupar uma mesma foto entre todos os dispositivos deste modelo.">
        <input className={inputCls} value={v.modelo || ''} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder="Ex.: ALO-V" />
      </Field>
      <Field label="Descrição / localização"><input className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Corredor 2º andar, próx. sala 204" /></Field>
      <MaintenanceScheduleFields values={v} setValues={setV} />
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar dispositivo</Button>
      </FormActions>
    </form>
  );
}

function PumpDeviceForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || {
    name: '', type: '', modelo: '', description: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }}>
      <Field label="Identificação *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Bomba principal 01" required /></Field>
      <Field label="Tipo de equipamento">
        <input className={inputCls} list="pump-type-list" value={v.type}
          onChange={(e) => setV({ ...v, type: e.target.value })} placeholder="Ex.: Bomba principal elétrica" />
        <datalist id="pump-type-list">{PUMP_TYPE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Modelo do equipamento" hint="Usado para agrupar uma mesma foto entre equipamentos do mesmo modelo.">
        <input className={inputCls} value={v.modelo || ''} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder="Ex.: Grundfos CR32" />
      </Field>
      <Field label="Observações / localização"><input className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <MaintenanceScheduleFields values={v} setValues={setV} />
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar dispositivo</Button>
      </FormActions>
    </form>
  );
}

function GasDetectorForm({ initial, onSubmit, onCancel }) {
  const [v, setV] = useState(initial || {
    name: '', gasType: '', modelo: '', location: '', lastMaintenance: '', nextMaintenance: '', intervalMonths: '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSubmit(v); }}>
      <Field label="Identificação *"><input autoFocus className={inputCls} value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Detector de gás — Cozinha" required /></Field>
      <Field label="Gás monitorado">
        <input className={inputCls} list="gas-type-list" value={v.gasType}
          onChange={(e) => setV({ ...v, gasType: e.target.value })} placeholder="Ex.: GLP" />
        <datalist id="gas-type-list">{GAS_TYPE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Modelo do equipamento" hint="Usado para agrupar uma mesma foto entre detectores do mesmo modelo.">
        <input className={inputCls} value={v.modelo || ''} onChange={(e) => setV({ ...v, modelo: e.target.value })} placeholder="Ex.: MSA Gas Guard" />
      </Field>
      <Field label="Localização"><input className={inputCls} value={v.location}
        onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Ex.: Casa de gás, área externa" /></Field>
      <MaintenanceScheduleFields values={v} setValues={setV} />
      <FormActions>
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">Salvar detector</Button>
      </FormActions>
    </form>
  );
}

function MaintenanceForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    date: todayISO(), technician: '', description: '',
    intervalMonths: item.intervalMonths || '', nextDate: item.nextMaintenance || '',
  });
  function handleIntervalChange(months) {
    setV((prev) => ({ ...prev, intervalMonths: months, nextDate: addMonthsToDate(prev.date, months) || prev.nextDate }));
  }
  function handleDateChange(date) {
    setV((prev) => ({ ...prev, date, nextDate: prev.intervalMonths ? addMonthsToDate(date, prev.intervalMonths) : prev.nextDate }));
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da manutenção *"><input type="date" className={inputCls} value={v.date} required
          onChange={(e) => handleDateChange(e.target.value)} /></Field>
        <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
          onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      </div>
      <Field label="Observações / serviço realizado"><textarea rows={3} className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Teste funcional, limpeza, troca de bateria..." /></Field>
      <div className="grid grid-cols-2 gap-3">
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
        <Button variant="primary" type="submit"><CheckCircle2 size={15} /> Registrar</Button>
      </FormActions>
    </form>
  );
}

function BulkMaintenanceForm({ count, onSubmit, onCancel }) {
  const [v, setV] = useState({ date: todayISO(), technician: '', description: '', intervalMonths: '', nextDate: '' });
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da manutenção *"><input type="date" className={inputCls} value={v.date} required
          onChange={(e) => handleDateChange(e.target.value)} /></Field>
        <Field label="Técnico responsável"><input className={inputCls} value={v.technician}
          onChange={(e) => setV({ ...v, technician: e.target.value })} placeholder="Nome do técnico" /></Field>
      </div>
      <Field label="Observações / serviço realizado"><textarea rows={3} className={inputCls} value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Limpeza preventiva, troca de bateria..." /></Field>
      <div className="grid grid-cols-2 gap-3">
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

function InspectionForm({ item, onSubmit, onCancel }) {
  const [v, setV] = useState({
    operationalStatus: item.operationalStatus || '',
    appearance: item.appearance || '',
    localComm: item.localComm || '',
    networkComm: item.networkComm || '',
    lastInspection: item.lastInspection || '',
    nextInspection: item.nextInspection || '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
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
      <form onSubmit={handleAddModel} className="flex gap-2">
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
        <button type="button" onClick={onBack} className="text-xs mt-3 text-center" style={{ color: 'var(--text-secondary)' }}>← Trocar cliente</button>
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
  const { role, signOut } = useAuth();
  const canEdit = role !== 'visualizador';
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  const [view, setView] = useState('dashboard');
  const [panelId, setPanelId] = useState(null);
  const [panelTab, setPanelTab] = useState('loops');
  const [expandedLoops, setExpandedLoops] = useState({});
  const [panelSearch, setPanelSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [reportFilters, setReportFilters] = useState({ category: 'all', panelId: 'all', status: 'all', search: '' });
  const [settingsTab, setSettingsTab] = useState('cliente');

  const [modal, setModal] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(clientDataKey(client.id), false);
        setData(res && res.value ? JSON.parse(res.value) : emptyData());
      } catch (e) {
        setData(emptyData());
      } finally {
        setLoaded(true);
      }
    })();
  }, [client.id]);

  async function persist(next) {
    try {
      const res = await window.storage.set(clientDataKey(client.id), JSON.stringify(next), false);
      if (!res) throw new Error('Falha ao salvar');
      setSaveError(false);
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
  }

  function importCsvEntities(entities) {
    let createdPanelIds = [];
    let createdLoopIds = [];
    let createdDeviceIds = [];
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
      const newDevices = entities.devices.map((d) => ({
        id: uid(),
        loopId: loopIdByKey[d.loopKey],
        address: d.address,
        type: d.type,
        modelo: d.modelo,
        description: d.label,
        lastMaintenance: '',
        nextMaintenance: '',
        intervalMonths: '',
      }));
      createdPanelIds = newPanels.map((p) => p.id);
      createdLoopIds = newLoops.map((l) => l.id);
      createdDeviceIds = newDevices.map((d) => d.id);
      return {
        ...prev,
        panels: [...prev.panels, ...newPanels],
        loops: [...prev.loops, ...newLoops],
        devices: [...prev.devices, ...newDevices],
      };
    });
    setLastImport({
      panelIds: createdPanelIds,
      loopIds: createdLoopIds,
      deviceIds: createdDeviceIds,
      summary: `${createdPanelIds.length} painel(éis) novo(s), ${createdLoopIds.length} laço(s) novo(s) e ${createdDeviceIds.length} dispositivo(s)`,
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
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, devices: [...prev.devices, { id: uid(), loopId: modal.context.loopId, ...values }] }));
    else updateData((prev) => ({ ...prev, devices: prev.devices.map((d) => (d.id === modal.initial.id ? { ...d, ...values } : d)) }));
    closeModal();
  }
  function deleteDevice(id) {
    updateData((prev) => ({ ...prev, devices: prev.devices.filter((d) => d.id !== id) }));
    setConfirmState(null);
  }

  function submitPumpDevice(values) {
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, pumpDevices: [...prev.pumpDevices, { id: uid(), ...values }] }));
    else updateData((prev) => ({ ...prev, pumpDevices: prev.pumpDevices.map((p) => (p.id === modal.initial.id ? { ...p, ...values } : p)) }));
    closeModal();
  }
  function deletePumpDevice(id) {
    updateData((prev) => ({ ...prev, pumpDevices: prev.pumpDevices.filter((p) => p.id !== id) }));
    setConfirmState(null);
  }

  function submitGasDetector(values) {
    if (modal.mode === 'create') updateData((prev) => ({ ...prev, gasDetectors: [...prev.gasDetectors, { id: uid(), ...values }] }));
    else updateData((prev) => ({ ...prev, gasDetectors: prev.gasDetectors.map((g) => (g.id === modal.initial.id ? { ...g, ...values } : g)) }));
    closeModal();
  }
  function deleteGasDetector(id) {
    updateData((prev) => ({ ...prev, gasDetectors: prev.gasDetectors.filter((g) => g.id !== id) }));
    setConfirmState(null);
  }

  function submitMaintenance(values) {
    const { category, id } = modal.context;
    updateData((prev) => {
      const list = prev[category];
      const logEntry = { id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '' };
      return {
        ...prev,
        [category]: list.map((it) => (it.id === id
          ? { ...it, lastMaintenance: values.date, nextMaintenance: values.nextDate || '', intervalMonths: values.intervalMonths || it.intervalMonths }
          : it)),
        maintenanceLog: [logEntry, ...prev.maintenanceLog],
      };
    });
    closeModal();
  }

  function submitBulkMaintenance(values) {
    const { category, ids } = modal.context;
    updateData((prev) => {
      const list = prev[category];
      const logEntries = ids.map((id) => ({ id: uid(), category, itemId: id, date: values.date, technician: values.technician, description: values.description, nextDate: values.nextDate || '' }));
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

  function submitInspection(values) {
    const { category, id } = modal.context;
    updateData((prev) => ({ ...prev, [category]: prev[category].map((it) => (it.id === id ? { ...it, ...values } : it)) }));
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

  if (!loaded || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <PageStyles />
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const items = allTrackableItems(data);
  const counts = { overdue: 0, soon: 0, ok: 0, none: 0 };
  items.forEach((it) => { counts[computeStatus(it.nextMaintenance).key]++; });
  const attentionItems = items
    .filter((it) => ['overdue', 'soon'].includes(computeStatus(it.nextMaintenance).key))
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
              <span className="text-xs px-2 py-1 rounded-md mono" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {ROLE_LABELS[role] || role}
              </span>
              {saveError && (
                <span className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--status-danger)', border: '1px solid var(--status-danger)' }}>
                  {role === 'visualizador' ? 'Somente leitura' : 'Falha ao salvar'}
                </span>
              )}
              <IconButton title="Trocar cliente" onClick={onSwitchClient}><LogOut size={16} /></IconButton>
              {signOut && <IconButton title="Sair da conta" onClick={signOut}><LogOut size={16} /></IconButton>}
            </div>
          </div>
          <nav className="flex gap-1 mt-4 -mb-3 overflow-x-auto">
            {NAV_ITEMS.filter((item) => item.key !== 'settings' || role === 'admin').map((item) => (
              <button key={item.key} className="nav-tab" data-active={view === item.key || (item.key === 'panels' && view === 'panelDetail')}
                onClick={() => { setView(item.key); setPanelId(null); }}>
                <item.icon size={15} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {view === 'dashboard' && (
          <Dashboard data={data} counts={counts} attentionItems={attentionItems} canEdit={canEdit}
            onMaintain={(it) => openMaintainModal(it.category, it, it.title)}
            onInspect={(it) => openInspectModal(it.category, it, it.title)}
            onGoPanels={() => setView('panels')} />
        )}

        {view === 'panels' && (
          <PanelsList data={data} search={panelSearch} setSearch={setPanelSearch} canEdit={canEdit}
            onOpenPanel={(id) => { setPanelId(id); setPanelTab('loops'); setView('panelDetail'); }}
            onCreate={() => setModal({ type: 'panel', mode: 'create', initial: null })}
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
            onBulkDeleteDevices={(ids) => setConfirmState({ title: 'Excluir dispositivos selecionados', message: `Excluir ${ids.length} dispositivo(s) selecionado(s)? Essa ação não pode ser desfeita.`, onConfirm: () => deleteDevicesBulk(ids) })}
          />
        )}

        {view === 'pumphouse' && (
          <SimpleListView
            title="Casa de Bombas" description="Bombas, válvulas, painéis de controle e demais equipamentos do sistema de bombeamento."
            icon={Droplet} data={data} category="pumpDevices" canEdit={canEdit}
            onCreate={() => setModal({ type: 'pump', mode: 'create', initial: null })}
            onEdit={(p) => setModal({ type: 'pump', mode: 'edit', initial: p })}
            onDelete={(p) => setConfirmState({ title: 'Excluir dispositivo', message: `Excluir "${p.name}"?`, onConfirm: () => deletePumpDevice(p.id) })}
            onMaintain={(p) => openMaintainModal('pumpDevices', p, p.name)}
            onInspect={(p) => openInspectModal('pumpDevices', p, p.name)}
            renderMeta={(p) => p.type || 'Equipamento da casa de bombas'} />
        )}

        {view === 'gas' && (
          <SimpleListView
            title="Detectores de Gases" description="Detectores fixos de gases inflamáveis ou tóxicos instalados na edificação."
            icon={Wind} data={data} category="gasDetectors" canEdit={canEdit}
            onCreate={() => setModal({ type: 'gas', mode: 'create', initial: null })}
            onEdit={(g) => setModal({ type: 'gas', mode: 'edit', initial: g })}
            onDelete={(g) => setConfirmState({ title: 'Excluir detector', message: `Excluir "${g.name}"?`, onConfirm: () => deleteGasDetector(g.id) })}
            onMaintain={(g) => openMaintainModal('gasDetectors', g, g.name)}
            onInspect={(g) => openInspectModal('gasDetectors', g, g.name)}
            renderMeta={(g) => [g.gasType, g.location].filter(Boolean).join(' · ') || 'Detector de gás fixo'} />
        )}

        {view === 'report' && (
          <ReportView data={data} client={client} filters={reportFilters} setFilters={setReportFilters} />
        )}

        {view === 'history' && (
          <HistoryView data={data} filter={historyFilter} setFilter={setHistoryFilter} />
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
          <DeviceForm initial={modal.initial} onSubmit={submitDevice} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'pump' && (
        <Modal title={modal.mode === 'create' ? 'Novo dispositivo — Casa de Bombas' : 'Editar dispositivo'} onClose={closeModal} wide>
          <PumpDeviceForm initial={modal.initial} onSubmit={submitPumpDevice} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'gas' && (
        <Modal title={modal.mode === 'create' ? 'Novo detector de gás' : 'Editar detector'} onClose={closeModal} wide>
          <GasDetectorForm initial={modal.initial} onSubmit={submitGasDetector} onCancel={closeModal} />
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

function Dashboard({ data, counts, attentionItems, canEdit, onMaintain, onInspect, onGoPanels }) {
  const total = counts.overdue + counts.soon + counts.ok + counts.none;
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  if (data.panels.length === 0 && data.pumpDevices.length === 0 && data.gasDetectors.length === 0) {
    return (
      <EmptyState icon={Cpu} title="Nenhum equipamento cadastrado ainda"
        description="Comece cadastrando o primeiro painel de detecção e alarme de incêndio. Depois você poderá adicionar laços, circuitos e dispositivos endereçáveis."
        actionLabel={canEdit ? 'Cadastrar primeiro painel' : undefined} onAction={canEdit ? onGoPanels : undefined} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>Painel Geral</h2>
        <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{todayLabel}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Vencidos" value={counts.overdue} color="var(--status-danger)" icon={AlertTriangle} />
        <StatCard label="A vencer (30 dias)" value={counts.soon} color="var(--status-warn)" icon={Clock} />
        <StatCard label="Em dia" value={counts.ok} color="var(--status-ok)" icon={CheckCircle2} />
        <StatCard label="Total monitorado" value={total} color="var(--text-secondary)" icon={LayoutDashboard} />
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
            {attentionItems.slice(0, 12).map((it) => (
              <TrackableCard key={`${it.category}-${it.id}`} icon={it.icon} photo={it.photo} address={it.address} title={it.title} meta={it.meta}
                status={{ ...computeStatus(it.nextMaintenance), lastMaintenance: it.lastMaintenance, operationalStatus: it.operationalStatus }}
                onMaintain={canEdit ? () => onMaintain(it) : undefined} onInspect={canEdit ? () => onInspect(it) : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelsList({ data, search, setSearch, canEdit, onOpenPanel, onCreate, onBulkDeletePanels }) {
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
          <div className="flex gap-2">
            {data.panels.length > 0 && (
              selectMode ? (
                <Button variant="secondary" onClick={exitSelectMode}><X size={15} /> Cancelar seleção</Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectMode(true)}><ClipboardList size={15} /> Selecionar múltiplos</Button>
              )
            )}
            <Button variant="primary" onClick={onCreate}><Plus size={16} /> Novo painel</Button>
          </div>
        )}
      </div>

      {selectMode && (
        <div className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {selectedIds.length === 0 ? 'Marque os painéis que quer excluir de uma vez.' : `${selectedIds.length} painel(éis) selecionado(s)`}
          </p>
          {selectedIds.length > 0 && (
            <Button variant="danger" onClick={() => { onBulkDeletePanels(selectedIds); exitSelectMode(); }}>
              <Trash2 size={15} /> Excluir selecionados
            </Button>
          )}
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
              ...data.devices.filter((d) => loops.some((l) => l.id === d.loopId)).map((d) => computeStatus(d.nextMaintenance)),
              ...nacs.map((n) => computeStatus(n.nextMaintenance)),
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

function PanelDetail({
  data, panelId, tab, setTab, canEdit, expandedLoops, setExpandedLoops, onBack, onEditPanel, onDeletePanel,
  onCreateLoop, onEditLoop, onDeleteLoop, onCreateNac, onEditNac, onDeleteNac,
  onCreateDevice, onEditDevice, onDeleteDevice, onMaintainDevice, onInspectDevice, onMaintainNac, onInspectNac,
  onBulkMaintainDevices, onBulkDeleteDevices,
}) {
  const panel = data.panels.find((p) => p.id === panelId);
  const [deviceSearch, setDeviceSearch] = useState('');
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
        <div className="flex flex-col gap-3">
          {canEdit && (
            <div className="flex justify-end gap-2">
              {selectMode ? (
                <Button variant="secondary" onClick={exitSelectMode}><X size={15} /> Cancelar seleção</Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectMode(true)}><ClipboardList size={15} /> Selecionar múltiplos</Button>
              )}
              <Button variant="primary" onClick={() => onCreateLoop(panelId)}><Plus size={15} /> Novo laço</Button>
            </div>
          )}
          {selectMode && (
            <div className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {selectedIds.length === 0 ? 'Marque os dispositivos que quer atualizar de uma vez.' : `${selectedIds.length} dispositivo(s) selecionado(s)`}
              </p>
              {selectedIds.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => { onBulkDeleteDevices(selectedIds); exitSelectMode(); }}><Trash2 size={15} /> Excluir</Button>
                  <Button variant="primary" onClick={() => { onBulkMaintainDevices(selectedIds); exitSelectMode(); }}><Wrench size={15} /> Registrar manutenção</Button>
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
                const status = worstStatus(allDevices.map((d) => computeStatus(d.nextMaintenance)));
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
                      <div className="px-3.5 pb-3.5 flex flex-col gap-2">
                        {devices.length === 0 ? (
                          <p className="text-xs py-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                            {q ? 'Nenhum dispositivo corresponde à busca.' : 'Nenhum dispositivo neste laço ainda.'}
                          </p>
                        ) : devices.map((d) => (
                          <TrackableCard key={d.id} icon={DEVICE_TYPE_MAP[d.type]?.icon} photo={photoForModelo(data, d.modelo)} address={d.address}
                            title={(DEVICE_TYPE_MAP[d.type]?.label || 'Dispositivo') + (d.modelo ? ` · ${d.modelo}` : '')} meta={d.description}
                            status={{ ...computeStatus(d.nextMaintenance), lastMaintenance: d.lastMaintenance, operationalStatus: d.operationalStatus }}
                            selectable={canEdit && selectMode} selected={selectedIds.includes(d.id)} onToggleSelect={() => toggleSelect(d.id)}
                            onInspect={canEdit ? () => onInspectDevice(d) : undefined} onMaintain={canEdit ? () => onMaintainDevice(d) : undefined}
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
        <div className="flex flex-col gap-3">
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
                  status={{ ...computeStatus(n.nextMaintenance), lastMaintenance: n.lastMaintenance, operationalStatus: n.operationalStatus }}
                  onInspect={canEdit ? () => onInspectNac(n) : undefined} onMaintain={canEdit ? () => onMaintainNac(n) : undefined}
                  onEdit={canEdit ? () => onEditNac(n) : undefined} onDelete={canEdit ? () => onDeleteNac(n) : undefined} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleListView({ title, description, icon, data, category, canEdit, onCreate, onEdit, onDelete, onMaintain, onInspect, renderMeta }) {
  const list = data[category];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        {canEdit && <Button variant="primary" onClick={onCreate}><Plus size={16} /> Adicionar</Button>}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={icon} title="Nenhum item cadastrado" description="Adicione o primeiro equipamento para começar a acompanhar as manutenções."
          actionLabel={canEdit ? 'Adicionar' : undefined} onAction={canEdit ? onCreate : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((item) => (
            <TrackableCard key={item.id} icon={icon} photo={photoForModelo(data, item.modelo)} address={null} title={item.name} meta={renderMeta(item)}
              status={{ ...computeStatus(item.nextMaintenance), lastMaintenance: item.lastMaintenance, operationalStatus: item.operationalStatus }}
              onInspect={canEdit ? () => onInspect(item) : undefined} onMaintain={canEdit ? () => onMaintain(item) : undefined}
              onEdit={canEdit ? () => onEdit(item) : undefined} onDelete={canEdit ? () => onDelete(item) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryView({ data, filter, setFilter }) {
  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'devices', label: 'Dispositivos' },
    { value: 'nacs', label: 'Circuitos (NAC)' },
    { value: 'pumpDevices', label: 'Casa de Bombas' },
    { value: 'gasDetectors', label: 'Detectores de gás' },
  ];
  const entries = data.maintenanceLog.filter((e) => filter === 'all' || e.category === filter);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Histórico de manutenções</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Registro de todas as manutenções realizadas, da mais recente para a mais antiga.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {filters.map((f) => (
          <button key={f.value} className="nav-tab" data-active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum registro encontrado" description="As manutenções registradas em dispositivos, circuitos e demais equipamentos aparecerão aqui." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const { label, context } = getItemLabelAndContext(data, entry.category, entry.itemId);
            return (
              <div key={entry.id} className="rounded-lg p-3.5 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  <span className="mono-chip">{formatDateBR(entry.date)}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{context}</div>
                {(entry.technician || entry.description) && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {entry.technician && <span>Técnico: {entry.technician}. </span>}
                    {entry.description}
                  </div>
                )}
                {entry.nextDate && <div className="text-xs mono mt-1" style={{ color: 'var(--text-secondary)' }}>Próxima manutenção: {formatDateBR(entry.nextDate)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportView({ data, client, filters, setFilters }) {
  const items = allTrackableItems(data);
  const panelOptions = data.panels.map((p) => ({ value: p.id, label: p.name }));

  const filtered = items.filter((it) => {
    if (filters.category !== 'all' && it.category !== filters.category) return false;
    if (filters.panelId !== 'all' && it.panelId !== filters.panelId) return false;
    if (filters.status !== 'all' && it.operationalStatus !== filters.status) return false;
    if (filters.search && !(`${it.title} ${it.meta} ${it.modelo || ''}`.toLowerCase().includes(filters.search.toLowerCase()))) return false;
    return true;
  });

  const summary = {
    naoOperante: items.filter((i) => i.operationalStatus === 'nao_operante').length,
    necessitaTroca: items.filter((i) => i.appearance === 'necessita_troca').length,
    total: items.length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Relatório de Manutenções Preventivas</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status de verificação de todos os dispositivos, circuitos e equipamentos.</p>
        </div>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Imprimir / Salvar PDF</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <StatCard label="Total monitorado" value={summary.total} color="var(--text-secondary)" icon={ClipboardList} />
        <StatCard label="Não operantes" value={summary.naoOperante} color="var(--status-danger)" icon={AlertTriangle} />
        <StatCard label="Necessitam troca" value={summary.necessitaTroca} color="var(--status-warn)" icon={AlertTriangle} />
        <StatCard label="Itens exibidos" value={filtered.length} color="var(--text-secondary)" icon={Search} />
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <select className={inputCls} style={{ width: 'auto' }} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="all">Todas as categorias</option>
          <option value="devices">Dispositivos endereçáveis</option>
          <option value="nacs">Circuitos (NAC)</option>
          <option value="pumpDevices">Casa de Bombas</option>
          <option value="gasDetectors">Detectores de gás</option>
        </select>
        {data.panels.length > 0 && (
          <select className={inputCls} style={{ width: 'auto' }} value={filters.panelId} onChange={(e) => setFilters({ ...filters, panelId: e.target.value })}>
            <option value="all">Todos os painéis</option>
            {panelOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        )}
        <select className={inputCls} style={{ width: 'auto' }} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="all">Todos os status</option>
          {OPERATIONAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={inputCls} style={{ width: 'auto', flex: '1 1 200px' }} placeholder="Buscar..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
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
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Relatório de Manutenções Preventivas</p>
            <p className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>Gerado em {formatDateBR(todayISO())}</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Nenhum item corresponde aos filtros selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Identificação', 'Localização', 'Status', 'Aparência', 'Com. local', 'Com. rede', 'Última insp.', 'Próxima insp.'].map((h) => (
                    <th key={h} className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={`${it.category}-${it.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {it.photo && <img src={it.photo} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                        {it.address && <span className="mono-chip">{it.address}</span>}
                        <span style={{ color: 'var(--text-primary)' }}>{it.title}{it.modelo ? ` · ${it.modelo}` : ''}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{it.meta}</td>
                    <td className="py-2 pr-3" style={{ color: operStatusColor(it.operationalStatus) }}>{labelFor(OPERATIONAL_STATUS_OPTIONS, it.operationalStatus)}</td>
                    <td className="py-2 pr-3" style={{ color: appearanceColor(it.appearance) }}>{labelFor(APPEARANCE_OPTIONS, it.appearance)}</td>
                    <td className="py-2 pr-3" style={{ color: commColor(it.localComm) }}>{labelFor(COMM_OPTIONS, it.localComm)}</td>
                    <td className="py-2 pr-3" style={{ color: commColor(it.networkComm) }}>{labelFor(COMM_OPTIONS, it.networkComm)}</td>
                    <td className="py-2 pr-3 mono" style={{ color: 'var(--text-secondary)' }}>{formatDateBR(it.lastInspection)}</td>
                    <td className="py-2 pr-3 mono" style={{ color: 'var(--text-secondary)' }}>{formatDateBR(it.nextInspection)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      {tab === 'cliente' && <ClientForm initial={client} onSubmit={(v) => onUpdateClient(v)} onCancel={() => {}} embedded />}
      {tab === 'marca' && <BrandingForm client={client} onSave={(branding) => onUpdateClient({ branding })} />}
      {tab === 'usuario' && <UserForm client={client} onSave={(user) => onUpdateClient({ user })} onRemove={() => onUpdateClient({ user: null })} />}
      {tab === 'modelos' && <ModelLibraryManager data={data} onSave={onSaveModelPhoto} onRemove={onRemoveModelPhoto} />}
      {tab === 'operadores' && <MembersManager clientId={client.id} />}
      {tab === 'importar' && <ImportCsvView onImport={onImportCsv} data={data} lastImport={lastImport} onUndoImport={onUndoImport} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Importação de base de dados (CSV de painel)                        */
/* ------------------------------------------------------------------ */

/* Exporta a base atual de dispositivos (todos os painéis/laços do cliente) em CSV,
   pronta para abrir no Excel (separador ; e BOM para acentuação). */
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
    try {
      const words = await extractPdfWords(file);
      const parsedRows = parseLp1Report(words);
      seedTypeMapAndBuild(parsedRows);
    } catch (err) {
      setError(err.message || 'Não foi possível ler esse arquivo PDF.');
      setRows(null); setEntities(null);
    }
  }

  async function handleNotifierFile(slot, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setDone(false);
    setFileNames((prev) => ({ ...prev, [slot]: file.name }));
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
    }
  }

  function handleConfirm() {
    onImport(entities);
    setDone(true);
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
            <div className="flex gap-2">
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
        {error && <p className="text-xs" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        {done && <p className="text-xs" style={{ color: 'var(--status-ok)' }}>Importação concluída! Confira em "Painéis".</p>}
      </div>

      {entities && (
        <>
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
              Isso vai <strong>adicionar</strong> novos registros à lista atual (não substitui o que já existe). Importar o mesmo arquivo duas vezes cria duplicados.
            </p>
            <Button variant="primary" onClick={handleConfirm} disabled={targetMode === 'existing' && !existingPanel}>
              <Upload size={15} /> Confirmar importação
            </Button>
          </div>
        </>
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
          <Button variant="primary" type="submit" disabled={saving}><UserPlus size={15} /> Vincular</Button>
        </form>
        {error && <p className="text-xs" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        {info && <p className="text-xs" style={{ color: 'var(--accent)' }}>{info}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Usuários vinculados</p>
        {members === null ? (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
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
        display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
        border-radius: 6px; color: var(--text-secondary); transition: all .15s ease; cursor: pointer; flex-shrink: 0;
      }
      .btn-icon:hover { background: var(--surface-raised); color: var(--text-primary); }
      .btn-icon-danger:hover { background: rgba(240,71,61,0.12); color: var(--status-danger); }
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
        .no-print { display: none !important; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Root: multi-tenant client management                               */
/* ------------------------------------------------------------------ */

function Root() {
  const { isOwner, memberships } = useAuth();
  const [clients, setClients] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeClientId, setActiveClientId] = useState(null);
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

  if (!activeClientId) {
    return <ClientSelector clients={visibleClients} canManage={isOwner} onSelect={selectClient} onCreate={createClient} onUpdate={updateClient} onDelete={deleteClient} />;
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
