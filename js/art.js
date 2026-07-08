/* The hand atelier (v8): a persistent light-painting canvas built for two
   hands. Pinch either hand to paint with it — two brushes at once — or use
   pointer / multi-touch; full parity. Four glass orbs float in the frame:
   grab one (pinch or press inside it), throw it, watch it bank off the
   walls. Space paints starlight; the ocean paints bioluminescent ink.
   Save composites the artwork over the world's black and exports a JPG.
   Everything is local; nothing leaves the page. */

import { t } from './i18n.js';

const STREAMERS = 12;         // swarm filaments per brush
const ORBS = 4;

const PALETTE = {
  /* silver replaces the old gold: warm accents stay retired (v6 mandate) */
  space: ['#59e8d5', '#e9ecea', '#c9d4d2', '#9cfff1', '#5a6f9a'],
  ocean: ['#7df0e2', '#4aa8c9', '#e8f6f4', '#6f5a9a', '#2f8f8a'],
};

export function startArt(canvas) {
  const g = canvas.getContext('2d');
  const paintC = document.createElement('canvas');   // persistent artwork
  const pg = paintC.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function size() {
    const w = canvas.clientWidth || 800;
    /* inline: fixed 16:10; takeover: the stage decides both dimensions */
    const h = canvas.closest('.layer')
      ? (canvas.clientHeight || Math.round(w * 0.625))
      : Math.round(w * 0.625);
    if (w === W && h === H) return;
    // keep the artwork through resizes
    const keep = document.createElement('canvas');
    keep.width = paintC.width; keep.height = paintC.height;
    if (paintC.width) keep.getContext('2d').drawImage(paintC, 0, 0);
    W = w; H = h;
    canvas.width = paintC.width = W * dpr;
    canvas.height = paintC.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    pg.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (keep.width) pg.drawImage(keep, 0, 0, keep.width / dpr, keep.height / dpr);
  }
  size();
  addEventListener('resize', size, { passive: true });

  const ocean = () => document.body.classList.contains('ocean');
  const palette = () => PALETTE[ocean() ? 'ocean' : 'space'];

  /* ---------- brushes: id → {x, y, px, py, down, streams[]} ---------- */
  const brushes = new Map();
  function brush(id) {
    let b = brushes.get(id);
    if (!b) {
      b = {
        x: 0, y: 0, px: 0, py: 0, down: false, fresh: true,
        streams: Array.from({ length: STREAMERS }, (_, i) => ({
          a: (i / STREAMERS) * Math.PI * 2,
          r: 2 + Math.random() * 16,
          sp: 0.6 + Math.random() * 2.4,
          w: 0.4 + Math.random() * 1.2,
          col: 0,
          ox: 0, oy: 0,
        })),
      };
      b.streams.forEach((s, i) => { s.col = i % 5; });
      brushes.set(id, b);
    }
    return b;
  }

  function moveBrush(id, x, y, down) {
    const b = brush(id);
    b.px = b.fresh ? x : b.x;
    b.py = b.fresh ? y : b.y;
    b.x = x; b.y = y;
    b.down = down;
    b.fresh = false;
  }

  /* ---------- orbs: grab (pinch/press), throw, bounce ---------- */
  const orbs = Array.from({ length: ORBS }, (_, i) => ({
    x: 120 + i * 130, y: 80 + (i % 2) * 160,
    vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
    r: 16 + i * 4, held: null, hue: i,
  }));

  function tryGrab(id, x, y) {
    for (const o of orbs) {
      if (o.held === null && Math.hypot(o.x - x, o.y - y) < o.r + 14) { o.held = id; return; }
    }
  }
  function release(id) {
    for (const o of orbs) if (o.held === id) o.held = null;
  }

  /* ---------- pointer + touch parity ---------- */
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    /* capture can throw for synthetic/AT-dispatched pointers — the stroke
       must survive either way */
    try { canvas.setPointerCapture(e.pointerId); } catch { /* draw uncaptured */ }
    const p = toLocal(e);
    moveBrush(`p${e.pointerId}`, p.x, p.y, true);
    tryGrab(`p${e.pointerId}`, p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!brushes.has(`p${e.pointerId}`)) return;
    const p = toLocal(e);
    const b = brushes.get(`p${e.pointerId}`);
    moveBrush(`p${e.pointerId}`, p.x, p.y, b.down);
  });
  const pointerUp = (e) => {
    const b = brushes.get(`p${e.pointerId}`);
    if (b) b.down = false;
    release(`p${e.pointerId}`);
  };
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);

  /* ---------- hands: pinch = brush down; either hand, both at once ---------- */
  const handHeld = { L: false, R: false };
  function setHands(hands) {
    const r = canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const seen = { L: false, R: false };
    for (const h of hands) {
      seen[h.uid] = true;
      const x = (h.pinch.x * innerWidth - r.left) * (W / r.width);
      const y = (h.pinch.y * innerHeight - r.top) * (H / r.height);
      const inside = x >= 0 && x <= W && y >= 0 && y <= H;
      moveBrush(h.uid, Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y)), h.pinch.on && inside);
      if (h.pinch.on && !handHeld[h.uid] && inside) tryGrab(h.uid, x, y);
      if (!h.pinch.on && handHeld[h.uid]) release(h.uid);
      handHeld[h.uid] = h.pinch.on;
    }
    for (const uid of ['L', 'R']) {
      if (!seen[uid] && brushes.has(uid)) {
        brushes.get(uid).down = false;
        release(uid);
        handHeld[uid] = false;
      }
    }
  }

  /* ---------- painting ---------- */
  function paintStroke(b, dt) {
    const pal = palette();
    const speed = Math.hypot(b.x - b.px, b.y - b.py);
    pg.globalCompositeOperation = 'lighter';
    for (const s of b.streams) {
      s.a += s.sp * dt * (ocean() ? 0.7 : 1.3);
      const wob = ocean() ? Math.sin(s.a * 0.7) * 6 : 0;
      const nx = b.x + Math.cos(s.a) * (s.r + wob);
      const ny = b.y + Math.sin(s.a * (ocean() ? 0.8 : 1)) * (s.r + wob);
      const ox = s.ox || nx, oy = s.oy || ny;
      pg.strokeStyle = pal[s.col];
      pg.globalAlpha = Math.min(0.05 + speed * 0.004, 0.3) * (ocean() ? 1.25 : 1);
      pg.lineWidth = s.w * (ocean() ? 1.8 : 1);
      pg.lineCap = 'round';
      pg.beginPath();
      pg.moveTo(ox, oy);
      pg.lineTo(nx, ny);
      pg.stroke();
      s.ox = nx; s.oy = ny;
      // starlight leaves rare hard sparks; the ocean leaves rising beads
      if (!ocean() && Math.random() < 0.02) {
        pg.globalAlpha = 0.85;
        pg.fillStyle = '#ffffff';
        pg.fillRect(nx, ny, 1.4, 1.4);
      } else if (ocean() && Math.random() < 0.015) {
        pg.globalAlpha = 0.4;
        pg.beginPath();
        pg.arc(nx, ny - 3, 1.6, 0, Math.PI * 2);
        pg.stroke();
      }
    }
    pg.globalAlpha = 1;
    pg.globalCompositeOperation = 'source-over';
  }

  /* ---------- frame loop (only while the section is on screen) ---------- */
  let last = performance.now(), raf = 0;
  const inView = () => {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!inView() || document.hidden) return;

    for (const b of brushes.values()) {
      if (b.down) paintStroke(b, dt);
      else b.streams.forEach((s) => { s.ox = s.oy = 0; });
    }

    // orbs physics
    for (const o of orbs) {
      if (o.held !== null && brushes.has(o.held)) {
        const b = brushes.get(o.held);
        o.vx = (b.x - o.x) * 14;
        o.vy = (b.y - o.y) * 14;
        o.x += (b.x - o.x) * 0.5;
        o.y += (b.y - o.y) * 0.5;
      } else {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.vx *= 0.995; o.vy *= 0.995;
        if (ocean()) o.vy -= 6 * dt;              // gentle buoyancy underwater
        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * 0.82; }
        if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) * 0.82; }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) * 0.82; }
        if (o.y > H - o.r) { o.y = H - o.r; o.vy = -Math.abs(o.vy) * 0.82; }
      }
    }

    // composite: artwork, then the living layer (orbs + brush auras)
    g.clearRect(0, 0, W, H);
    g.drawImage(paintC, 0, 0, W, H);
    const pal = palette();
    for (const o of orbs) {
      const col = pal[o.hue % pal.length];
      const gr = g.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 1, o.x, o.y, o.r);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.35, col + 'cc');
      gr.addColorStop(1, col + '11');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    for (const b of brushes.values()) {
      if (!b.down) continue;
      g.fillStyle = pal[0] + '2a';
      g.beginPath();
      g.arc(b.x, b.y, 22, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  raf = requestAnimationFrame(loop);

  /* ---------- save / reset ---------- */
  document.getElementById('art-save').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = paintC.width; out.height = paintC.height;
    const og = out.getContext('2d');
    og.fillStyle = ocean() ? '#041016' : '#030408';
    og.fillRect(0, 0, out.width, out.height);
    og.drawImage(paintC, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `flavio-atelier-${ocean() ? 'ocean' : 'space'}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/jpeg', 0.92);
  });
  document.getElementById('art-reset').addEventListener('click', () => {
    pg.clearRect(0, 0, W, H);
    document.getElementById('art-status').textContent =
      t(matchMedia('(pointer: coarse)').matches ? 'ui.artHint1' : 'ui.artHint');
  });

  /* ---------- one-hand takeover: the canvas becomes the whole frame ----------
     iPhone Safari has no element-fullscreen API, so this is a real
     body-level layer (same pattern + inert perimeter as the arcade
     cabinets). The canvas NODE moves — context and artwork move with it. */
  const INERT = 'header, main, .gauge, .bot, .skip-link, #guide';
  const frame = canvas.closest('.art-frame');
  const actions = document.querySelector('.art-actions');
  const hud = actions?.parentElement;
  let layer = null, prevFocus = null;

  function onFullKey(e) { if (e.key === 'Escape') closeFull(); }

  function openFull() {
    if (layer) return;
    prevFocus = document.activeElement;
    layer = document.createElement('div');
    layer.className = 'layer layer--art';
    layer.innerHTML = `
      <div class="layer__bar">
        <p class="tag tag--teal">${t('sections.atelierT1')} ${t('sections.atelierT2')}</p>
        <button class="ctl layer-close" aria-label="${t('ui.artExit')}">✕</button>
      </div>
      <div class="layer__stage layer__stage--art"></div>`;
    document.body.appendChild(layer);
    layer.querySelector('.layer__stage').appendChild(canvas);
    if (actions) layer.querySelector('.layer__bar').insertBefore(actions, layer.querySelector('.layer-close'));
    document.querySelectorAll(INERT).forEach((el) => { el.inert = true; });
    addEventListener('keydown', onFullKey);
    layer.querySelector('.layer-close').addEventListener('click', closeFull);
    layer.querySelector('.layer-close').focus();
    size();
  }

  function closeFull() {
    if (!layer) return false;
    frame.appendChild(canvas);
    if (actions && hud) hud.appendChild(actions);
    document.querySelectorAll(INERT).forEach((el) => { el.inert = false; });
    removeEventListener('keydown', onFullKey);
    layer.remove();
    layer = null;
    size();
    prevFocus?.focus?.();
    return true;
  }

  document.getElementById('art-full')?.addEventListener('click', openFull);

  return { setHands, closeFull };
}
