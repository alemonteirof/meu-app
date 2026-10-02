import React, { useEffect, useRef, useState } from 'react';

/* Mini-jogo estilo "dinossauro do Chrome" para as telas de erro/404:
   um detector de calor corre e pula as chamas. O botão de pulo é um acionador manual
   (Espaço / seta pra cima / toque no canvas também funcionam).
   Tudo em <canvas>, sem dependência extra. Recorde fica no localStorage. */

const HI_KEY = 'ccm-fire-game-hi';
const H = 170;          // altura lógica do canvas
const GROUND = 145;     // linha do chão
const PX = 36;          // posição x do detector
const GRAVITY = 2400;   // px/s²
const JUMP_V = 680;     // px/s
const SPEED_START = 300;
const SPEED_MAX = 760;
const SPEED_ACC = 9;    // px/s a cada segundo

const COL = {
  ground: '#4A3C3C',
  dash: '#3A2F2F',
  text: '#A79999',
  textStrong: '#F1EDEA',
  red: '#C0392B',
  redLight: '#E05A4A',
  dark: '#1E1A1A',
  flameOuter: '#E25822',
  flameInner: '#F5B041',
  flameCore: '#FFF1C1',
};

function readHi() {
  try { return Number(localStorage.getItem(HI_KEY)) || 0; } catch { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem(HI_KEY, String(v)); } catch { /* ignore */ }
}

function newGame(w, hi) {
  return {
    status: 'idle', w, t: 0, speed: SPEED_START, dist: 0,
    p: { y: 0, vy: 0 }, obstacles: [], puffs: [], gapLeft: 260, hi, overAt: 0,
  };
}

function spawnObstacle(g) {
  const r = Math.random();
  let flames;
  if (r < 0.45) flames = [{ w: 16, h: 26 }];
  else if (r < 0.75) flames = [{ w: 22, h: 38 }];
  else {
    const n = g.speed > 420 && Math.random() < 0.5 ? 3 : 2;
    flames = Array.from({ length: n }, (_, i) => ({ w: 14, h: i === 1 ? 32 : 24 }));
  }
  const w = flames.reduce((s, f) => s + f.w, 0);
  const h = Math.max(...flames.map((f) => f.h));
  g.obstacles.push({ x: g.w + 10, w, h, flames, seed: Math.random() * 10 });
  g.gapLeft = g.speed * 0.65 + 140 + Math.random() * g.speed * 0.9;
}

function drawFlame(ctx, x, w, h, t, seed) {
  const hh = h * (1 + Math.sin(t * 18 + seed) * 0.08);
  const sway = Math.sin(t * 12 + seed) * w * 0.12;
  const layer = (color, ox, ow, oh) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox, GROUND);
    ctx.quadraticCurveTo(ox - ow * 0.05, GROUND - oh * 0.55, ox + ow * 0.5 + sway, GROUND - oh);
    ctx.quadraticCurveTo(ox + ow * 1.05, GROUND - oh * 0.55, ox + ow, GROUND);
    ctx.closePath();
    ctx.fill();
  };
  layer(COL.flameOuter, x, w, hh);
  layer(COL.flameInner, x + w * 0.2, w * 0.6, hh * 0.62);
  layer(COL.flameCore, x + w * 0.36, w * 0.28, hh * 0.3);
}

function drawHeatDetector(ctx, g) {
  const onGround = g.p.y === 0;
  const dead = g.status === 'over';
  // Desenhado como o detector instalado no teto, de cabeça pra baixo: base larga
  // em cima, corpo afunilando e o elemento sensor (anel verde) embaixo, entre as
  // pernas. Coordenadas locais: (0,0) = chão sob o centro; y negativo = pra cima.
  const S = 1.35;
  ctx.save();
  ctx.translate(PX + 13, GROUND - g.p.y);
  ctx.scale(S, S);
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  };

  // pernas
  const phase = onGround && g.status === 'running' ? Math.floor(g.dist / 16) % 2 : 0;
  ctx.strokeStyle = '#9A9090';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6.5, -12); ctx.lineTo(-6.5 + (phase ? -3 : 2), phase ? -0.6 : 0);
  ctx.moveTo(6.5, -12); ctx.lineTo(6.5 + (phase ? 2 : -3), phase ? 0 : -0.6);
  ctx.stroke();

  // elemento sensor: colar branco, anel verde (termistor) e ponta branca
  ctx.fillStyle = '#F1EDEA';
  rr(-4.5, -12.5, 9, 1.8, 0);
  ctx.fillStyle = '#3F8A55';
  rr(-4, -10.7, 8, 2.6, 0);
  ctx.fillStyle = '#24563A';
  ctx.fillRect(-2.2, -10.7, 1, 2.6);
  ctx.fillRect(1.2, -10.7, 1, 2.6);
  ctx.fillStyle = '#F1EDEA';
  rr(-4.5, -8.1, 9, 3, [0, 0, 2.5, 2.5]);

  // corpo (afunila pra baixo)
  ctx.fillStyle = '#E6DFDA';
  ctx.beginPath();
  ctx.moveTo(-11, -20); ctx.lineTo(11, -20); ctx.lineTo(8, -12.5); ctx.lineTo(-8, -12.5);
  ctx.closePath();
  ctx.fill();

  // base de fixação no teto (parte larga, em cima)
  ctx.fillStyle = '#F1EDEA';
  rr(-16, -26.5, 32, 6.5, [7, 7, 1.5, 1.5]);
  ctx.fillStyle = '#C9C0BB';
  ctx.fillRect(-16, -21.4, 32, 1.4);

  // olhos
  ctx.fillStyle = COL.dark;
  if (dead) {
    ctx.strokeStyle = COL.dark; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const ex of [-3.8, 3.8]) {
      ctx.moveTo(ex - 1.4, -18.4); ctx.lineTo(ex + 1.4, -15.6);
      ctx.moveTo(ex + 1.4, -18.4); ctx.lineTo(ex - 1.4, -15.6);
    }
    ctx.stroke();
  } else {
    ctx.fillRect(-4.8, -18.4, 1.9, 2.4);
    ctx.fillRect(2.9, -18.4, 1.9, 2.4);
  }

  // LED: pisca normal; aceso fixo + brilho quando "entra em alarme" (game over)
  const ledOn = dead || Math.floor(g.t * 2) % 4 === 0;
  if (dead) {
    ctx.fillStyle = 'rgba(224,60,50,.35)';
    ctx.beginPath(); ctx.arc(7.5, -16.5, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = ledOn ? '#E8392C' : '#7A4A46';
  ctx.beginPath(); ctx.arc(7.5, -16.5, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

export default function FireGame() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const gRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [pressed, setPressed] = useState(false);

  const press = () => {
    const g = gRef.current;
    if (!g) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 130);
    if (g.status === 'idle' || (g.status === 'over' && g.t - g.overAt > 0.45)) {
      const fresh = newGame(g.w, g.hi);
      fresh.status = 'running';
      gRef.current = fresh;
      setStatus('running');
      return;
    }
    if (g.status === 'running' && g.p.y === 0) {
      g.p.vy = JUMP_V;
      for (let i = 0; i < 6; i++) {
        g.puffs.push({ x: PX + 6, y: GROUND - 4, vx: -60 - Math.random() * 80, vy: 20 + Math.random() * 40, life: 0.4 });
      }
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    gRef.current = newGame(wrap.clientWidth || 600, readHi());

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth || 600;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gRef.current.w = w;
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);

    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) pressRef.current();
      }
    };
    window.addEventListener('keydown', onKey);

    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gRef.current;
      g.t += dt;

      if (g.status === 'running') {
        g.speed = Math.min(SPEED_MAX, g.speed + SPEED_ACC * dt);
        g.dist += g.speed * dt;

        g.p.y += g.p.vy * dt;
        g.p.vy -= GRAVITY * dt;
        if (g.p.y <= 0) { g.p.y = 0; g.p.vy = 0; }

        for (const o of g.obstacles) o.x -= g.speed * dt;
        g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);
        g.gapLeft -= g.speed * dt;
        if (g.gapLeft <= 0) spawnObstacle(g);

        // colisão (caixas encolhidas p/ não ser injusto)
        const pl = PX + 5, pr = PX + 21, pb = GROUND - g.p.y;
        for (const o of g.obstacles) {
          const ol = o.x + 3, or = o.x + o.w - 3, ot = GROUND - o.h + 9;
          if (pr > ol && pl < or && pb > ot) {
            g.status = 'over';
            g.overAt = g.t;
            const score = Math.floor(g.dist / 10);
            if (score > g.hi) { g.hi = score; saveHi(score); }
            setStatus('over');
            break;
          }
        }
      }

      for (const pf of g.puffs) {
        pf.x += pf.vx * dt; pf.y -= pf.vy * dt; pf.life -= dt;
      }
      g.puffs = g.puffs.filter((pf) => pf.life > 0);

      // ---- desenho ----
      ctx.clearRect(0, 0, g.w, H);

      ctx.strokeStyle = COL.ground; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, GROUND + 0.5); ctx.lineTo(g.w, GROUND + 0.5); ctx.stroke();
      ctx.fillStyle = COL.dash;
      const off = g.dist % 48;
      for (let x = -off; x < g.w; x += 48) {
        ctx.fillRect(x, GROUND + 6, 10, 1.5);
        ctx.fillRect(x + 26, GROUND + 12, 5, 1.5);
      }

      for (const o of g.obstacles) {
        let x = o.x;
        o.flames.forEach((f, i) => { drawFlame(ctx, x, f.w, f.h, g.t, o.seed + i * 2.3); x += f.w; });
      }

      for (const pf of g.puffs) {
        ctx.fillStyle = `rgba(241,237,234,${Math.max(0, pf.life / 0.4) * 0.6})`;
        ctx.beginPath(); ctx.arc(pf.x, pf.y, 3 + (0.4 - pf.life) * 8, 0, Math.PI * 2); ctx.fill();
      }

      drawHeatDetector(ctx, g);

      // placar
      const score = Math.floor(g.dist / 10);
      const pad = (n) => String(n).padStart(5, '0');
      ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const blink = g.status === 'running' && score >= 100 && score % 100 < 6 && Math.floor(g.t * 8) % 2 === 0;
      ctx.fillStyle = COL.text;
      ctx.fillText(`REC ${pad(g.hi)}`, g.w - 70, 8);
      ctx.fillStyle = blink ? 'transparent' : COL.textStrong;
      ctx.fillText(pad(score), g.w - 10, 8);

      ctx.textAlign = 'center';
      if (g.status === 'idle') {
        ctx.fillStyle = COL.textStrong;
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillText('Pressione o acionador para começar', g.w / 2, 56);
        ctx.fillStyle = COL.text;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('Pule as chamas antes que o fogo se espalhe', g.w / 2, 76);
      } else if (g.status === 'over') {
        ctx.fillStyle = COL.textStrong;
        ctx.font = '700 15px ui-monospace, Consolas, monospace';
        ctx.fillText('O FOGO VENCEU', g.w / 2, 52);
        ctx.fillStyle = COL.text;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('Pressione o acionador para tentar de novo', g.w / 2, 74);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="w-full">
      <div ref={wrapRef} className="w-full rounded-xl overflow-hidden" style={{ background: '#1B1717', border: '1px solid #2E2626' }}>
        <canvas ref={canvasRef} onPointerDown={(e) => { e.preventDefault(); press(); }}
          style={{ display: 'block', touchAction: 'manipulation', cursor: 'pointer' }}
          aria-label="Mini-jogo: pule as chamas com o detector de calor" role="img" />
      </div>

      <div className="flex items-center justify-center gap-4 mt-5">
        {/* Acionador manual (botoeira de alarme) */}
        <button type="button" onPointerDown={(e) => { e.preventDefault(); press(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); press(); } }}
          aria-label={status === 'running' ? 'Pular' : 'Iniciar jogo'}
          style={{
            width: 92, height: 92, borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(160deg, #D24A3A 0%, #A8281D 100%)',
            border: '2px solid #7A1D16',
            boxShadow: pressed ? '0 1px 0 #5A140F, inset 0 2px 6px rgba(0,0,0,.35)' : '0 5px 0 #5A140F, 0 8px 18px rgba(0,0,0,.45)',
            transform: pressed ? 'translateY(4px)' : 'none',
            transition: 'transform 80ms ease-out, box-shadow 80ms ease-out',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            touchAction: 'manipulation', userSelect: 'none',
          }}>
          <span style={{
            width: 58, height: 58, borderRadius: 6, background: '#F1EDEA',
            border: '1px solid rgba(0,0,0,.25)',
            boxShadow: pressed ? 'inset 0 3px 6px rgba(0,0,0,.35)' : 'inset 0 -2px 0 rgba(0,0,0,.12)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <span style={{ width: 18, height: 18, borderRadius: 3, background: pressed ? '#2B2424' : '#3A3131' }} />
            <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: '#7A1D16', lineHeight: 1 }}>PRESSIONE</span>
          </span>
        </button>
        <div className="text-xs leading-relaxed" style={{ color: '#A79999', maxWidth: 170 }}>
          <span style={{ color: '#F1EDEA', fontWeight: 600 }}>Acionador manual</span><br />
          Toque no botão, no jogo ou use <kbd style={{ fontFamily: 'monospace' }}>Espaço</kbd> / <kbd style={{ fontFamily: 'monospace' }}>↑</kbd> para pular.
        </div>
      </div>
    </div>
  );
}
