import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Cpu, Droplet, Wind, Clock, Plus, X, Pencil, Trash2,
  ChevronDown, ChevronRight, ArrowLeft, Cloud, Thermometer, Hand, LogOut,
  LogIn, ToggleLeft, Bell, CheckCircle2, AlertTriangle, Search, Wrench,
  Loader2, Inbox, ShieldAlert, ClipboardList, ClipboardCheck, Settings,
  ImagePlus, UserCog, Building2, KeyRound, Printer, Upload, Palette, Users, UserPlus,
} from 'lucide-react';

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
        <h1 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Central de Manutenção PCI</h1>
        <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Senha</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        {error && <p className="text-xs mb-3" style={{ color: 'var(--status-danger)' }}>{error}</p>}
        {info && <p className="text-xs mb-3" style={{ color: 'var(--accent)' }}>{info}</p>}
        <button type="submit" disabled={loading} className="w-full py-2 rounded-lg text-sm font-medium mb-3"
          style={{ background: 'var(--accent)', color: '#14171A', border: 'none', cursor: 'pointer' }}>
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
function TrackableCard({ icon: Icon, photo, address, title, meta, status, onInspect, onMaintain, onEdit, onDelete }) {
  return (
    <div className="rounded-lg p-3.5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start gap-3">
        <div className="pt-1"><Led color={status.color} pulse={status.key === 'overdue'} /></div>
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
      <div className="flex items-center justify-end gap-1 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        {onInspect && <IconButton title="Registrar inspeção" onClick={onInspect}><ClipboardCheck size={15} /></IconButton>}
        {onMaintain && <IconButton title="Registrar manutenção" onClick={onMaintain}><Wrench size={15} /></IconButton>}
        {onEdit && <IconButton title="Editar" onClick={onEdit}><Pencil size={15} /></IconButton>}
        {onDelete && <IconButton title="Excluir" danger onClick={onDelete}><Trash2 size={15} /></IconButton>}
      </div>
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
  const cover = client.branding?.coverImageData;
  const coverColor = client.branding?.coverColor || 'var(--surface-raised)';
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={onSelect} className="text-left flex-1 flex flex-col">
        <div className="h-14 w-full" style={{ background: cover ? `url(${cover}) center/cover` : coverColor }} />
        <div className="p-3.5 flex items-center gap-3">
          {client.branding?.logoData
            ? <img src={client.branding.logoData} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-raised)' }}><Building2 size={18} style={{ color: 'var(--text-secondary)' }} /></div>}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
            {client.address && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{client.address}</p>}
          </div>
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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <PageStyles />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--accent-contrast)' }} />
          </div>
          <div>
            <h1 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Central de Manutenção PCI</h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Selecione um cliente para continuar</p>
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
          <div className="grid sm:grid-cols-2 gap-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} onSelect={() => onSelect(c.id)}
                onEdit={canManage ? () => setModal({ mode: 'edit', client: c }) : undefined}
                onDelete={canManage ? () => setConfirm(c) : undefined} />
            ))}
          </div>
        )}
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
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);

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
                : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}><ShieldAlert size={17} style={{ color: 'var(--accent-contrast)' }} /></div>}
              <div className="min-w-0">
                <h1 className="font-display font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{client.name}</h1>
                <p className="text-xs leading-tight" style={{ color: 'var(--text-secondary)' }}>Central de Manutenção PCI</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
          <Dashboard data={data} counts={counts} attentionItems={attentionItems}
            onMaintain={(it) => openMaintainModal(it.category, it, it.title)}
            onInspect={(it) => openInspectModal(it.category, it, it.title)}
            onGoPanels={() => setView('panels')} />
        )}

        {view === 'panels' && (
          <PanelsList data={data} search={panelSearch} setSearch={setPanelSearch}
            onOpenPanel={(id) => { setPanelId(id); setPanelTab('loops'); setView('panelDetail'); }}
            onCreate={() => setModal({ type: 'panel', mode: 'create', initial: null })} />
        )}

        {view === 'panelDetail' && panelId && (
          <PanelDetail
            data={data} panelId={panelId} tab={panelTab} setTab={setPanelTab}
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
          />
        )}

        {view === 'pumphouse' && (
          <SimpleListView
            title="Casa de Bombas" description="Bombas, válvulas, painéis de controle e demais equipamentos do sistema de bombeamento."
            icon={Droplet} data={data} category="pumpDevices"
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
            icon={Wind} data={data} category="gasDetectors"
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
            onUpdateClient={onUpdateClient} onSaveModelPhoto={saveModelPhoto} onRemoveModelPhoto={removeModelPhoto} />
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

function Dashboard({ data, counts, attentionItems, onMaintain, onInspect, onGoPanels }) {
  const total = counts.overdue + counts.soon + counts.ok + counts.none;
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  if (data.panels.length === 0 && data.pumpDevices.length === 0 && data.gasDetectors.length === 0) {
    return (
      <EmptyState icon={Cpu} title="Nenhum equipamento cadastrado ainda"
        description="Comece cadastrando o primeiro painel de detecção e alarme de incêndio. Depois você poderá adicionar laços, circuitos e dispositivos endereçáveis."
        actionLabel="Cadastrar primeiro painel" onAction={onGoPanels} />
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
                onMaintain={() => onMaintain(it)} onInspect={() => onInspect(it)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelsList({ data, search, setSearch, onOpenPanel, onCreate }) {
  const filtered = data.panels.filter((p) => (p.name + ' ' + (p.location || '')).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Painéis</h2>
        <Button variant="primary" onClick={onCreate}><Plus size={16} /> Novo painel</Button>
      </div>

      {data.panels.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input className={`${inputCls} pl-9`} placeholder="Buscar painel por nome ou localização..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {data.panels.length === 0 ? (
        <EmptyState icon={Cpu} title="Nenhum painel cadastrado"
          description="Cadastre o painel de detecção e alarme de incêndio. Em seguida você poderá adicionar laços (loops), circuitos de saída (NACs) e os dispositivos endereçáveis."
          actionLabel="Cadastrar painel" onAction={onCreate} />
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
            return (
              <button key={panel.id} onClick={() => onOpenPanel(panel.id)} className="text-left rounded-xl p-4 flex flex-col gap-2 hover:brightness-110 transition"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelDetail({
  data, panelId, tab, setTab, expandedLoops, setExpandedLoops, onBack, onEditPanel, onDeletePanel,
  onCreateLoop, onEditLoop, onDeleteLoop, onCreateNac, onEditNac, onDeleteNac,
  onCreateDevice, onEditDevice, onDeleteDevice, onMaintainDevice, onInspectDevice, onMaintainNac, onInspectNac,
}) {
  const panel = data.panels.find((p) => p.id === panelId);
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
        <div className="flex gap-1">
          <IconButton title="Editar painel" onClick={() => onEditPanel(panel)}><Pencil size={16} /></IconButton>
          <IconButton title="Excluir painel" danger onClick={() => onDeletePanel(panel)}><Trash2 size={16} /></IconButton>
        </div>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        <button className="nav-tab" data-active={tab === 'loops'} onClick={() => setTab('loops')}>Laços ({loops.length})</button>
        <button className="nav-tab" data-active={tab === 'nacs'} onClick={() => setTab('nacs')}>Circuitos de saída — NAC ({nacs.length})</button>
      </div>

      {tab === 'loops' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => onCreateLoop(panelId)}><Plus size={15} /> Novo laço</Button>
          </div>
          {loops.length === 0 ? (
            <EmptyState icon={Cpu} title="Nenhum laço cadastrado" description="Adicione um laço para começar a cadastrar detectores, acionadores e módulos endereçáveis."
              actionLabel="Adicionar laço" onAction={() => onCreateLoop(panelId)} />
          ) : (
            loops.map((loop) => {
              const devices = data.devices.filter((d) => d.loopId === loop.id).sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }));
              const status = worstStatus(devices.map((d) => computeStatus(d.nextMaintenance)));
              const expanded = !!expandedLoops[loop.id];
              return (
                <div key={loop.id} className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 p-3.5">
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setExpandedLoops((prev) => ({ ...prev, [loop.id]: !prev[loop.id] }))}>
                      {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />}
                      <Led color={status.color} pulse={status.key === 'overdue'} />
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{loop.name}</span>
                      <span className="text-xs mono" style={{ color: 'var(--text-secondary)' }}>{devices.length} dispositivo{devices.length === 1 ? '' : 's'}</span>
                    </button>
                    <IconButton title="Novo dispositivo" onClick={() => onCreateDevice(loop.id)}><Plus size={15} /></IconButton>
                    <IconButton title="Editar laço" onClick={() => onEditLoop(loop)}><Pencil size={15} /></IconButton>
                    <IconButton title="Excluir laço" danger onClick={() => onDeleteLoop(loop)}><Trash2 size={15} /></IconButton>
                  </div>
                  {expanded && (
                    <div className="px-3.5 pb-3.5 flex flex-col gap-2">
                      {devices.length === 0 ? (
                        <p className="text-xs py-3 text-center" style={{ color: 'var(--text-secondary)' }}>Nenhum dispositivo neste laço ainda.</p>
                      ) : devices.map((d) => (
                        <TrackableCard key={d.id} icon={DEVICE_TYPE_MAP[d.type]?.icon} photo={photoForModelo(data, d.modelo)} address={d.address}
                          title={DEVICE_TYPE_MAP[d.type]?.label} meta={d.description}
                          status={{ ...computeStatus(d.nextMaintenance), lastMaintenance: d.lastMaintenance, operationalStatus: d.operationalStatus }}
                          onInspect={() => onInspectDevice(d)} onMaintain={() => onMaintainDevice(d)} onEdit={() => onEditDevice(d)} onDelete={() => onDeleteDevice(d)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'nacs' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => onCreateNac(panelId)}><Plus size={15} /> Novo circuito</Button>
          </div>
          {nacs.length === 0 ? (
            <EmptyState icon={Bell} title="Nenhum circuito de saída cadastrado" description="Cadastre os circuitos (NACs) que alimentam sirenes, strobos e demais dispositivos de notificação."
              actionLabel="Adicionar circuito" onAction={() => onCreateNac(panelId)} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {nacs.map((n) => (
                <TrackableCard key={n.id} icon={Bell} address={null} title={n.name} meta={n.description}
                  status={{ ...computeStatus(n.nextMaintenance), lastMaintenance: n.lastMaintenance, operationalStatus: n.operationalStatus }}
                  onInspect={() => onInspectNac(n)} onMaintain={() => onMaintainNac(n)} onEdit={() => onEditNac(n)} onDelete={() => onDeleteNac(n)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleListView({ title, description, icon, data, category, onCreate, onEdit, onDelete, onMaintain, onInspect, renderMeta }) {
  const list = data[category];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        <Button variant="primary" onClick={onCreate}><Plus size={16} /> Adicionar</Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={icon} title="Nenhum item cadastrado" description="Adicione o primeiro equipamento para começar a acompanhar as manutenções." actionLabel="Adicionar" onAction={onCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((item) => (
            <TrackableCard key={item.id} icon={icon} photo={photoForModelo(data, item.modelo)} address={null} title={item.name} meta={renderMeta(item)}
              status={{ ...computeStatus(item.nextMaintenance), lastMaintenance: item.lastMaintenance, operationalStatus: item.operationalStatus }}
              onInspect={() => onInspect(item)} onMaintain={() => onMaintain(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
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

function SettingsView({ client, data, tab, setTab, onUpdateClient, onSaveModelPhoto, onRemoveModelPhoto }) {
  const TABS = [
    { key: 'cliente', label: 'Cliente', icon: Building2 },
    { key: 'marca', label: 'Marca', icon: Palette },
    { key: 'usuario', label: 'Usuário', icon: UserCog },
    { key: 'modelos', label: 'Modelos', icon: ImagePlus },
    { key: 'operadores', label: 'Operadores', icon: Users },
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
        --bg: #14171A;
        --surface: #1D2124;
        --surface-raised: #262B2E;
        --border: #33393D;
        --text-primary: #E9ECE7;
        --text-secondary: #8D9691;
        --accent: #F2B705;
        --accent-contrast: #14171A;
        --status-ok: #3FB950;
        --status-warn: #F2A93B;
        --status-danger: #F0473D;
        --status-none: #5B6266;
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
      .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(242,183,5,0.18); outline: none; }
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
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#14171A' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#1D2124', border: '1px solid #33393D' }}>
            <p className="font-medium mb-2" style={{ color: '#E9ECE7' }}>Ocorreu um erro inesperado</p>
            <p className="text-sm mb-4" style={{ color: '#8D9691', fontFamily: 'monospace' }}>
              {String((this.state.error && this.state.error.message) || this.state.error)}
            </p>
            <button onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#F2B705', color: '#14171A', border: 'none', cursor: 'pointer' }}>
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
      <AuthGate>
        <Root />
      </AuthGate>
    </ErrorBoundary>
  );
}
