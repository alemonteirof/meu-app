import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, MapPin, History, Upload, Lock, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ------------------------------------------------------------------ */
/* Supervisório FireNET: painel ao vivo, histórico e planta baixa.      */
/* Os dados chegam do gateway (Raspberry Pi no cliente) pela Edge        */
/* Function supervisorio-ingest; aqui só lemos (tabelas supervisorio_*,  */
/* RLS has_client_access) e ouvimos o Realtime. Comandos = fase 2.       */
/* ------------------------------------------------------------------ */

const COR = {
  FOGO: 'var(--status-danger)', FOGO_SAIU: 'var(--status-ok)', NORMAL: 'var(--status-ok)',
  FALHA: 'var(--status-warn)', FALHA_SAIU: 'var(--status-ok)', DESATIVACAO: '#5B7CA6',
  OFFLINE: 'var(--status-none)', ONLINE: 'var(--status-ok)', COMANDO: '#E0A3A3',
};
const corTipo = (tipo) => COR[tipo] || 'var(--text-secondary)';
const ROTULO = {
  FOGO: 'Fogo', FOGO_SAIU: 'Fogo saiu', NORMAL: 'Normal', FALHA: 'Falha', FALHA_SAIU: 'Falha saiu',
  DESATIVACAO: 'Desativação', SILENCIADO: 'Silenciado', SOM_ATIVO: 'Som ativo', ACESSO: 'Acesso',
  LEDS: 'LEDs', INICIO: 'Início', ONLINE: 'Online', OFFLINE: 'Offline', COMANDO: 'Comando',
};
// gateway manda sinal de vida a cada 30 s; sem notícia por 90 s = sem comunicação
const LIMITE_SILENCIO_MS = 90_000;

const cartao = { background: 'var(--surface)', border: '1px solid var(--border)' };
const chipMono = {
  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: '2px 7px', borderRadius: 4,
  background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
};

function Led({ cor, pulsa = false }) {
  return <span className="led" data-pulse={pulsa} style={{ color: cor, background: cor }} />;
}

function hora(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Tela do painel: "END=002.00 LACO=1 ..." identifica o dispositivo do evento que está na tela.
function dispositivoNaTela(tela) {
  const linhas = tela || [];
  const m = linhas.join(' ').match(/END=(\d+)\.\d+\s+LACO=(\d+)/);
  if (!m) return null;
  const cabecalho = linhas[2] || '';
  const tipo = /INCENDIO|ALARME|FOGO/i.test(cabecalho) ? 'FOGO' : /PROBLEMA|FALHA/i.test(cabecalho) ? 'FALHA'
    : /DESAT/i.test(cabecalho) ? 'DESATIVACAO' : null;
  return tipo ? { endereco: Number(m[1]), laco: Number(m[2]), tipo } : null;
}

const numeroDoLaco = (loop) => Number((loop?.name || '').match(/\d+/)?.[0] || NaN);

export default function SupervisorioScreen({ client, data, canEdit }) {
  const [aba, setAba] = useState('painel');
  const [gateways, setGateways] = useState([]);
  const [estados, setEstados] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      supabase.from('supervisorio_gateways').select('id, nome, painel_id, modo, versao, ultimo_contato').eq('cliente_id', client.id),
      supabase.from('supervisorio_estado').select('*').eq('cliente_id', client.id),
      supabase.from('supervisorio_eventos').select('*').eq('cliente_id', client.id)
        .order('data_hora', { ascending: false }).limit(500),
    ]).then(([g, s, e]) => {
      if (!ativo) return;
      setGateways(g.data || []); setEstados(s.data || []); setEventos(e.data || []);
      setCarregando(false);
    });

    const canal = supabase.channel(`supervisorio-${client.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisorio_estado', filter: `cliente_id=eq.${client.id}` },
        ({ new: linha }) => linha?.painel_id && setEstados((lista) => [linha, ...lista.filter((x) => x.painel_id !== linha.painel_id)]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supervisorio_eventos', filter: `cliente_id=eq.${client.id}` },
        ({ new: linha }) => setEventos((lista) => [linha, ...lista].slice(0, 500)))
      .subscribe();
    const relogio = setInterval(() => setAgora(Date.now()), 5000);
    return () => { ativo = false; supabase.removeChannel(canal); clearInterval(relogio); };
  }, [client.id]);

  const abas = [
    { key: 'painel', label: 'Painel ao vivo', icon: Activity },
    { key: 'planta', label: 'Planta', icon: MapPin },
    { key: 'historico', label: 'Histórico', icon: History },
  ];

  return (
    <div className="flex flex-col gap-4 fade-in-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold" style={{ fontSize: 22, color: 'var(--text-primary)' }}>Supervisório</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Estado ao vivo do painel principal, direto do gateway no cliente</p>
        </div>
        <nav className="flex flex-wrap gap-1 p-1 rounded-lg" style={cartao}>
          {abas.map((a) => (
            <button key={a.key} type="button" onClick={() => setAba(a.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm"
              style={{ background: aba === a.key ? 'var(--surface-raised)' : 'transparent', color: aba === a.key ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
              <a.icon size={15} /> {a.label}
            </button>
          ))}
        </nav>
      </div>

      {carregando ? <div className="skeleton" style={{ height: 240 }} />
        : gateways.length === 0 ? <SemGateway />
        : aba === 'painel' ? <PainelAoVivo gateways={gateways} estados={estados} eventos={eventos} data={data} agora={agora} />
        : aba === 'planta' ? <PlantaBaixa client={client} data={data} estados={estados} canEdit={canEdit} />
        : <Historico eventos={eventos} data={data} />}
    </div>
  );
}

function SemGateway() {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
      <WifiOff size={28} style={{ color: 'var(--text-secondary)' }} />
      <p className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Nenhum gateway instalado neste cliente</p>
      <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
        O supervisório mostra o painel ao vivo quando um gateway (Raspberry Pi) está ligado no painel principal do cliente.
        Depois de instalado e cadastrado, o estado aparece aqui sozinho.
      </p>
    </div>
  );
}

/* ---------------------------- Painel ao vivo ---------------------------- */

function PainelAoVivo({ gateways, estados, eventos, data, agora }) {
  return (
    <div className="flex flex-col gap-6">
      {gateways.map((gw) => {
        const estado = estados.find((s) => s.painel_id === gw.painel_id);
        const painel = data.panels.find((p) => p.id === gw.painel_id);
        const doPainel = eventos.filter((e) => e.painel_id === gw.painel_id);
        return <CartaoPainel key={gw.id} gw={gw} estado={estado} painel={painel} eventos={doPainel} agora={agora} />;
      })}
    </div>
  );
}

function CartaoPainel({ gw, estado, painel, eventos, agora }) {
  const ultimoContato = gw.ultimo_contato ? new Date(gw.ultimo_contato).getTime() : 0;
  const atualizado = estado ? new Date(estado.atualizado_em).getTime() : 0;
  const gatewayVivo = Math.max(ultimoContato, atualizado) > agora - LIMITE_SILENCIO_MS;
  const painelResponde = gatewayVivo && estado?.online;
  const alarmes = estado?.alarmes ?? 0;
  const ultimoFogo = eventos.find((e) => e.tipo === 'FOGO');

  return (
    <div className="flex flex-col gap-4">
      {!gatewayVivo && (
        <Aviso cor="var(--status-none)" titulo="Sem comunicação com o gateway"
          texto={`Último contato: ${gw.ultimo_contato ? hora(gw.ultimo_contato) : 'nunca'} · o estado abaixo pode estar desatualizado`} />
      )}
      {gatewayVivo && !painelResponde && (
        <Aviso cor="var(--status-warn)" titulo="O painel não está respondendo ao gateway" texto="Verificar o cabo serial entre o gateway e o painel" />
      )}
      {alarmes > 0 && (
        <Aviso cor="var(--status-danger)" pulsa titulo={`Alarme de incêndio — ${alarmes} ${alarmes === 1 ? 'zona' : 'zonas'}`}
          texto={ultimoFogo ? `${ultimoFogo.detalhe || ultimoFogo.texto} · desde ${hora(ultimoFogo.data_hora)}` : 'Ver o visor do painel'} />
      )}

      <div className="flex flex-wrap gap-4 items-start">
        <section className="flex flex-col gap-4" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <div className="rounded-xl p-4 flex flex-col gap-3" style={cartao}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>Visor do painel</h3>
              <span style={chipMono}>{painel?.name || gw.nome}</span>
            </div>
            <div className="mono" style={{
              background: '#C9DDB0', color: '#1D2A12', borderRadius: 6, padding: '14px 16px', fontSize: 15, lineHeight: 1.55,
              whiteSpace: 'pre', overflowX: 'auto', boxShadow: 'inset 0 0 0 3px #A9C08C', opacity: gatewayVivo ? 1 : 0.55,
            }}>
              {(estado?.tela?.length ? estado.tela : ['(sem leitura ainda)']).map((l, i) => <div key={i} style={{ minHeight: '1.55em' }}>{l}</div>)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5"><Led cor={estado?.silenciado ? 'var(--status-warn)' : 'var(--status-none)'} />{estado?.silenciado ? 'Silenciado' : 'Som normal'}</span>
              <span className="flex items-center gap-1.5 ml-3"><Led cor={estado?.acesso2 ? 'var(--status-warn)' : 'var(--status-none)'} />{estado?.acesso2 ? 'Nível de acesso 2 aberto' : 'Acesso 1'}</span>
              {estado?.leds && <span className="ml-auto" style={chipMono} title="Código dos LEDs do painel">LEDs {estado.leds}</span>}
            </div>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={cartao}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>Comandos</h3>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}><Lock size={13} /> Comandos à distância chegam na próxima fase</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {['Silenciar alarme', 'Re-sound', 'Silenciar buzzer', 'Teste de lâmpadas', 'Reset'].map((r) => (
                <button key={r} type="button" disabled className="rounded-lg text-sm font-semibold"
                  style={{ minHeight: 56, background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)', opacity: 0.6, cursor: 'not-allowed' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div className="grid grid-cols-3 gap-2">
            <Contador rotulo="FOGO" valor={estado?.alarmes} cor="var(--status-danger)" />
            <Contador rotulo="FALHAS" valor={estado?.falhas} cor="var(--status-warn)" />
            <Contador rotulo="DESATIV." valor={estado?.desativacoes} cor="#5B7CA6" />
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-2" style={cartao}>
            <h3 className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>Últimos eventos</h3>
            {eventos.filter((e) => e.tipo !== 'LEDS').slice(0, 8).map((e) => (
              <div key={e.id} className="flex gap-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <span style={{ marginTop: 4 }}><Led cor={corTipo(e.tipo)} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.texto}</p>
                  {e.detalhe && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{e.detalhe}</p>}
                </div>
                <span className="mono text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{hora(e.data_hora)}</span>
              </div>
            ))}
            {eventos.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum evento ainda.</p>}
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-2 text-sm" style={cartao}>
            <h3 className="font-display font-semibold mb-1" style={{ fontSize: 16, color: 'var(--text-primary)' }}>Gateway no cliente</h3>
            <Linha rotulo="Nome" valor={gw.nome} />
            <Linha rotulo="Conexão" valor={<span className="flex items-center gap-1.5">{gatewayVivo ? <Wifi size={14} style={{ color: 'var(--status-ok)' }} /> : <WifiOff size={14} style={{ color: 'var(--status-none)' }} />}{gatewayVivo ? 'Online' : 'Sem comunicação'}</span>} />
            <Linha rotulo="Último contato" valor={<span className="mono">{gw.ultimo_contato ? hora(gw.ultimo_contato) : '—'}</span>} />
            <Linha rotulo="Versão" valor={<span className="mono">{gw.versao || '—'}</span>} />
            <Linha rotulo="Modo" valor={gw.modo === 'leitura_comandos' ? 'Leitura + comandos' : 'Somente leitura'} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Aviso({ cor, titulo, texto, pulsa = false }) {
  return (
    <div role="alert" className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: `1px solid ${cor}`, background: 'var(--surface)' }}>
      <Led cor={cor} pulsa={pulsa} />
      <div className="min-w-0">
        <p className="font-display font-semibold" style={{ color: cor, fontSize: 16 }}>{titulo}</p>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{texto}</p>
      </div>
    </div>
  );
}

function Contador({ rotulo, valor, cor }) {
  return (
    <div className="rounded-xl p-3" style={{ ...cartao, borderTop: `3px solid ${cor}` }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{rotulo}</p>
      <p className="font-display font-bold" style={{ fontSize: 28, color: valor ? cor : 'var(--text-primary)' }}>{valor ?? '—'}</p>
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'var(--text-secondary)' }}>{rotulo}</span>
      <span style={{ color: 'var(--text-primary)' }}>{valor}</span>
    </div>
  );
}

/* ------------------------------- Histórico ------------------------------- */

function Historico({ eventos, data }) {
  const [tipo, setTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [mostrarLeds, setMostrarLeds] = useState(false);
  const tipos = useMemo(() => [...new Set(eventos.map((e) => e.tipo))].sort(), [eventos]);
  const filtrados = eventos.filter((e) =>
    (mostrarLeds || e.tipo !== 'LEDS') && (!tipo || e.tipo === tipo)
    && (!busca || `${e.texto} ${e.detalhe || ''}`.toLowerCase().includes(busca.toLowerCase())));
  const nomePainel = (id) => data.panels.find((p) => p.id === id)?.name || '—';
  const campo = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl p-3 flex flex-wrap items-end gap-3" style={cartao}>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-2.5 py-2 rounded-lg text-sm" style={campo}>
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t} value={t}>{ROTULO[t] || t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs flex-1" style={{ color: 'var(--text-secondary)', minWidth: 200 }}>Buscar
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Local, endereço ou texto"
            className="px-2.5 py-2 rounded-lg text-sm" style={campo} />
        </label>
        <label className="flex items-center gap-2 text-xs pb-2" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={mostrarLeds} onChange={(e) => setMostrarLeds(e.target.checked)} /> Mostrar mudanças de LED
        </label>
      </div>

      <div className="rounded-xl overflow-x-auto" style={cartao}>
        <table className="w-full text-sm" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-left text-xs uppercase" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              <th className="px-3.5 py-2.5 font-semibold">Data e hora</th>
              <th className="px-3.5 py-2.5 font-semibold">Tipo</th>
              <th className="px-3.5 py-2.5 font-semibold">Descrição</th>
              <th className="px-3.5 py-2.5 font-semibold">Painel</th>
              <th className="px-3.5 py-2.5 font-semibold">Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3.5 py-2.5 mono text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{hora(e.data_hora)}</td>
                <td className="px-3.5 py-2.5"><span style={{ ...chipMono, color: corTipo(e.tipo), display: 'inline-flex', alignItems: 'center', gap: 6 }}><Led cor={corTipo(e.tipo)} />{ROTULO[e.tipo] || e.tipo}</span></td>
                <td className="px-3.5 py-2.5">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{e.texto}</p>
                  {e.detalhe && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.detalhe}</p>}
                </td>
                <td className="px-3.5 py-2.5" style={{ color: 'var(--text-secondary)' }}>{nomePainel(e.painel_id)}</td>
                <td className="px-3.5 py-2.5" style={{ color: 'var(--text-secondary)' }}>{e.origem === 'ccm' ? 'CCM' : e.origem === 'gateway' ? 'Gateway' : 'Painel'}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-3.5 py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Nenhum evento.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Mostrando {filtrados.length} dos últimos {eventos.length} eventos</p>
    </div>
  );
}

/* ------------------------------ Planta baixa ------------------------------ */

const EXTENSAO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function PlantaBaixa({ client, data, estados, canEdit }) {
  const [plantas, setPlantas] = useState([]);
  const [plantaId, setPlantaId] = useState(null);
  const [url, setUrl] = useState(null);
  const [posicoes, setPosicoes] = useState([]);
  const [posicionando, setPosicionando] = useState(null); // id do dispositivo esperando um clique na planta
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState('');
  const arquivoRef = useRef(null);

  const carregarPlantas = async () => {
    const { data: rows } = await supabase.from('supervisorio_plantas').select('*').eq('cliente_id', client.id).order('ordem');
    setPlantas(rows || []);
    setPlantaId((atual) => atual && rows?.some((p) => p.id === atual) ? atual : rows?.[0]?.id || null);
  };
  useEffect(() => { carregarPlantas(); }, [client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const planta = plantas.find((p) => p.id === plantaId);
  useEffect(() => {
    setUrl(null); setPosicoes([]);
    if (!planta) return;
    let ativo = true;
    supabase.storage.from('fotos').createSignedUrl(planta.imagem_path, 60 * 60 * 24)
      .then(({ data: d }) => ativo && setUrl(d?.signedUrl || null));
    supabase.from('supervisorio_posicoes').select('*').eq('planta_id', planta.id)
      .then(({ data: rows }) => ativo && setPosicoes(rows || []));
    return () => { ativo = false; };
  }, [planta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // estado de cada dispositivo: só sabemos o do evento que está no visor do painel agora
  const doVisor = useMemo(() => {
    const mapa = new Map();
    estados.forEach((s) => {
      const d = dispositivoNaTela(s.tela);
      if (!d) return;
      const loop = data.loops.find((l) => l.panelId === s.painel_id && numeroDoLaco(l) === d.laco);
      const disp = loop && data.devices.find((x) => x.loopId === loop.id && Number(x.address) === d.endereco);
      if (disp) mapa.set(disp.id, d.tipo);
    });
    return mapa;
  }, [estados, data]);

  const dispositivos = data.devices.filter((d) => !d.moduloPaiId);
  const semPosicao = dispositivos.filter((d) => !posicoes.some((p) => p.dispositivo_id === d.id));

  async function enviarPlanta(arquivo) {
    setErro('');
    if (!EXTENSAO[arquivo.type]) { setErro('Envie uma imagem PNG, JPG ou WEBP da planta.'); return; }
    const caminho = `${client.id}/plantas/${crypto.randomUUID()}.${EXTENSAO[arquivo.type]}`;
    const { error } = await supabase.storage.from('fotos').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) { setErro('Não foi possível enviar a imagem.'); return; }
    const dim = await new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok({ largura: img.naturalWidth, altura: img.naturalHeight });
      img.onerror = () => ok({});
      img.src = URL.createObjectURL(arquivo);
    });
    const nome = window.prompt('Nome desta planta (ex.: Prédio administrativo — Térreo)', arquivo.name.replace(/\.\w+$/, '')) || arquivo.name;
    const { data: nova, error: e2 } = await supabase.from('supervisorio_plantas')
      .insert({ cliente_id: client.id, nome, imagem_path: caminho, ordem: plantas.length, ...dim }).select().single();
    if (e2) { setErro('Imagem enviada, mas não foi possível cadastrar a planta.'); return; }
    await carregarPlantas();
    setPlantaId(nova.id);
  }

  async function clicarNaPlanta(ev) {
    if (!posicionando || !planta) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const linha = {
      planta_id: planta.id, dispositivo_id: posicionando, cliente_id: client.id,
      x_pct: Math.round(((ev.clientX - r.left) / r.width) * 100000) / 1000,
      y_pct: Math.round(((ev.clientY - r.top) / r.height) * 100000) / 1000,
    };
    const { error } = await supabase.from('supervisorio_posicoes').upsert(linha);
    if (error) { setErro('Não foi possível salvar a posição.'); return; }
    setPosicoes((lista) => [...lista.filter((p) => p.dispositivo_id !== posicionando), linha]);
    setPosicionando(null);
  }

  async function removerPosicao(dispositivoId) {
    await supabase.from('supervisorio_posicoes').delete().eq('planta_id', planta.id).eq('dispositivo_id', dispositivoId);
    setPosicoes((lista) => lista.filter((p) => p.dispositivo_id !== dispositivoId));
  }

  const rotuloDisp = (d) => `${String(d.address).padStart(3, '0')} · ${d.description || d.modelo || 'Dispositivo'}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2.5">
        {plantas.length > 0 && (
          <label className="flex flex-col gap-1 text-xs mr-auto" style={{ color: 'var(--text-secondary)' }}>Área
            <select value={plantaId || ''} onChange={(e) => setPlantaId(e.target.value)} className="px-2.5 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {plantas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        )}
        {canEdit && (
          <>
            <input ref={arquivoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) enviarPlanta(e.target.files[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => arquivoRef.current?.click()} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold"
              style={{ ...cartao, color: 'var(--text-primary)' }}><Upload size={15} /> Enviar planta</button>
            {planta && (
              <button type="button" onClick={() => { setEditando((v) => !v); setPosicionando(null); }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold"
                style={{ background: editando ? 'var(--surface-raised)' : 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}>
                <MapPin size={15} /> {editando ? 'Terminar' : 'Posicionar dispositivos'}
              </button>
            )}
          </>
        )}
      </div>
      {erro && <p className="text-sm" style={{ color: 'var(--status-danger)' }}>{erro}</p>}

      {!planta ? (
        <div className="flex flex-col items-center text-center gap-2 py-14 px-6 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
          <MapPin size={26} style={{ color: 'var(--text-secondary)' }} />
          <p className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Nenhuma planta cadastrada</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{canEdit ? 'Envie a imagem da planta baixa (PNG ou JPG) e posicione os dispositivos.' : 'A MAJ ainda não cadastrou a planta deste cliente.'}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-start">
          <div className="rounded-xl p-3" style={{ ...cartao, flex: '999 1 560px', minWidth: 0 }}>
            {posicionando && <p className="text-sm mb-2" style={{ color: 'var(--status-warn)' }}>Clique na planta onde fica o dispositivo selecionado.</p>}
            <div onClick={clicarNaPlanta} style={{ position: 'relative', cursor: posicionando ? 'crosshair' : 'default', borderRadius: 8, overflow: 'hidden', background: '#1A1515' }}>
              {url ? <img src={url} alt={`Planta: ${planta.nome}`} style={{ width: '100%', display: 'block' }} draggable={false} />
                : <div className="skeleton" style={{ height: 360 }} />}
              {url && posicoes.map((p) => {
                const disp = data.devices.find((d) => d.id === p.dispositivo_id);
                const tipo = doVisor.get(p.dispositivo_id);
                const cor = tipo ? corTipo(tipo) : 'var(--status-ok)';
                return (
                  <div key={p.dispositivo_id} title={disp ? rotuloDisp(disp) : ''}
                    style={{ position: 'absolute', left: `${p.x_pct}%`, top: `${p.y_pct}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pointerEvents: 'none' }}>
                    <Led cor={cor} pulsa={tipo === 'FOGO'} />
                    <span className="mono" style={{ fontSize: 10, padding: '0 4px', borderRadius: 3, background: tipo === 'FOGO' ? 'var(--status-danger)' : 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {disp ? String(disp.address).padStart(3, '0') : '?'}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              A cor mostra o evento que está no visor do painel agora (o painel mostra um evento por vez).
            </p>
          </div>

          {editando && (
            <aside className="rounded-xl p-3 flex flex-col gap-2" style={{ ...cartao, flex: '1 1 260px', minWidth: 0, maxHeight: 560, overflowY: 'auto' }}>
              <h3 className="font-display font-semibold" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Sem posição ({semPosicao.length})</h3>
              {semPosicao.map((d) => (
                <button key={d.id} type="button" onClick={() => setPosicionando(d.id)} className="text-left text-sm px-2.5 py-2 rounded-lg"
                  style={{ border: `1px dashed ${posicionando === d.id ? 'var(--status-warn)' : 'var(--border)'}`, color: 'var(--text-primary)', background: posicionando === d.id ? 'var(--surface-raised)' : 'transparent' }}>
                  {rotuloDisp(d)}
                </button>
              ))}
              {posicoes.length > 0 && <h3 className="font-display font-semibold mt-2" style={{ fontSize: 15, color: 'var(--text-primary)' }}>Na planta ({posicoes.length})</h3>}
              {posicoes.map((p) => {
                const d = data.devices.find((x) => x.id === p.dispositivo_id);
                return (
                  <div key={p.dispositivo_id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{d ? rotuloDisp(d) : p.dispositivo_id}</span>
                    <button type="button" title="Tirar da planta" onClick={() => removerPosicao(p.dispositivo_id)} style={{ color: 'var(--text-secondary)' }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
