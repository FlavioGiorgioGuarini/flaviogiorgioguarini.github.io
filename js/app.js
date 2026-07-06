/* Mission control: wires data, audio, scene, and lazy modules together. */

import { PROFILE, age, TIMELINE, PROJECTS, CONTACT, SKILLS } from './data.js';
import { AudioEngine } from './audio.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  px: 0, py: 0,           // pointer parallax, -1..1
  face: null,             // { rx, ry } from vision
  gaze: null,             // { x, y } iris gaze, -1..1
  hand: null,             // Hand3D cockpit hand
  handLive: false,        // true while a real hand is tracked this frame
  scene: null,
  vision: null,
  bot: null,
  game: null,
  orbit: null,
  audio: new AudioEngine('assets/audio/dns-1.m4a'),
  ghost: { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 },
};

/* ---------- content from data ---------- */
$('#age').textContent = age();
$('#tm-age').textContent = age();
$('#yr').textContent = new Date().getFullYear();

$('#timeline').innerHTML = TIMELINE.map((t) => `
  <div class="tl-item">
    <span class="yr num">${t.year}</span>
    <h3>${t.title} · <span class="tl-place">${t.place}</span></h3>
    <p>${t.text}</p>
  </div>`).join('');

$('#projects').innerHTML = PROJECTS.map((p) => `
  <article class="panel card${p.locked ? ' card--locked' : ''}">
    <span class="tag">${p.tag}</span>
    <h3>${p.title}</h3>
    <p>${p.text}</p>
    ${p.link ? `<p><a href="${p.link.href}" rel="noopener" target="_blank">${p.link.label} ↗</a></p>` : ''}
  </article>`).join('');

$('#contact-links').innerHTML = CONTACT.links
  .map((l) => `<a href="${l.href}" rel="noopener" target="_blank">${l.label}</a>`).join('');

$('#orbit-fallback').innerHTML = SKILLS
  .map((s) => `<li>${s.name}: ${s.note}</li>`).join('');

/* ---------- entry gate ---------- */
const gate = $('#gate');
const soundCtl = $('#ctl-sound');

function closeGate() {
  gate.style.transition = 'opacity 1.4s';
  gate.style.opacity = '0';
  setTimeout(() => { gate.hidden = true; }, 1400);
}
$('#enter-sound').addEventListener('click', async () => {
  closeGate();
  const ok = await state.audio.start(5);
  soundCtl.setAttribute('aria-pressed', String(ok && !state.audio.muted));
});
$('#enter-silent').addEventListener('click', closeGate);

soundCtl.addEventListener('click', async () => {
  if (!state.audio.playing) {
    const ok = await state.audio.start(3);
    soundCtl.setAttribute('aria-pressed', String(ok));
    return;
  }
  const muted = state.audio.toggleMute();
  soundCtl.setAttribute('aria-pressed', String(!muted));
});

/* ---------- pointer + ghost hand (tier-3 companion) ---------- */
const ghost = $('#ghost-hand');
let ghostSeen = false;
addEventListener('pointermove', (e) => {
  state.px = (e.clientX / innerWidth - 0.5) * 2;
  state.py = (e.clientY / innerHeight - 0.5) * 2;
  state.ghost.tx = e.clientX + 18;
  state.ghost.ty = e.clientY + 18;
  if (!ghostSeen && !state.vision) { ghost.classList.add('on'); ghostSeen = true; }
}, { passive: true });

/* ---------- camera consent + vision ---------- */
const camCtl = $('#ctl-cam');
const consent = $('#cam-consent');

camCtl.addEventListener('click', () => {
  if (state.vision) {
    state.vision.stop();
    state.vision = null;
    camCtl.setAttribute('aria-pressed', 'false');
    state.scene?.setFacePoints(null);
    state.face = null;
    $('#moon-telemetry').textContent = 'LUNAR LOCK · FACE TRACKING OFF';
    return;
  }
  consent.hidden = false;
});
$('#cam-decline').addEventListener('click', () => { consent.hidden = true; });
$('#cam-enable').addEventListener('click', async () => {
  consent.hidden = true;
  camCtl.disabled = true;
  try {
    const mod = await import('./vision.js');
    state.vision = await mod.startVision({
      onHand: onHand,
      onFace: (pts, rot, gaze) => {
        state.scene?.setFacePoints(pts);
        state.face = rot;
        state.gaze = gaze;
        $('#moon-telemetry').textContent = 'LUNAR LOCK · FACE ACQUIRED';
      },
      onStatus: (msg) => { $('#game-status').textContent = msg; },
    });
    camCtl.setAttribute('aria-pressed', 'true');
    ghost.classList.remove('on'); // the 3D hand replaces the ghost cursor
  } catch (err) {
    $('#moon-telemetry').textContent = 'LUNAR LOCK · CAMERA UNAVAILABLE';
    camCtl.setAttribute('aria-pressed', 'false');
  } finally {
    camCtl.disabled = false;
  }
});

/* VR-style gestures: an OPEN hand only mirrors you (the cockpit hand
   replicates fingers and pose, the page holds still); a CLOSED fist
   flies the ship: up/down scrolls, left/right jumps sections. */
const SECTIONS = [...document.querySelectorAll('main .section')];
let lastJump = 0;
function onHand(h) {
  state.handLive = !!h;
  if (!h) return;
  state.hand?.setPose(h);
  const now = performance.now();
  if (!h.open) {
    if (Math.abs(h.dy) > 0.1) scrollBy({ top: h.dy * innerHeight * 0.14, behavior: 'instant' });
    if (Math.abs(h.dx) > 1.0 && now - lastJump > 900) { lastJump = now; jumpSection(h.dx > 0 ? 1 : -1); }
  }
}
function currentSection() {
  const y = scrollY + innerHeight / 2;
  return Math.max(0, SECTIONS.findLastIndex((s) => s.offsetTop <= y));
}
function jumpSection(dir) {
  const i = Math.min(SECTIONS.length - 1, Math.max(0, currentSection() + dir));
  SECTIONS[i].scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
}

/* keyboard parity for gestures */
addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.altKey)) { e.preventDefault(); jumpSection(1); }
  if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.altKey)) { e.preventDefault(); jumpSection(-1); }
});

/* ---------- rail highlight + lazy modules ---------- */
const rail = [...document.querySelectorAll('#rail a')];
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    const idx = SECTIONS.indexOf(en.target);
    if (en.isIntersecting) {
      rail.forEach((a, i) => a.setAttribute('aria-current', String(i === idx)));
      if (en.target.id === 'arcade' && !state.game) {
        import('./game.js').then((m) => { state.game = m.startGame($('#game')); });
      }
      if (en.target.id === 'moon' && !window.__ctf) {
        window.__ctf = true;
        import('./ctf.js').then((m) => m.initCTF());
      }
      if (en.target.id === 'systems' && !state.orbit) state.orbit = makeOrbit($('#orbit'));
    }
  });
}, { threshold: 0.4 });
SECTIONS.forEach((s) => io.observe(s));

/* ---------- skills orbital map (canvas 2D) ---------- */
function makeOrbit(canvas) {
  const g = canvas.getContext('2d');
  const detail = $('#orbit-detail');
  let W, H, C, dpr, sel = -1, hover = -1, t0 = performance.now();
  const nodes = SKILLS.map((s, i) => {
    const perOrbit = SKILLS.filter((k) => k.orbit === s.orbit);
    const idx = perOrbit.indexOf(s);
    return { ...s, phase: (idx / perOrbit.length) * TAU_(), i };
  });
  function TAU_() { return Math.PI * 2; }
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight || W;
    canvas.width = W * dpr; canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    C = { x: W / 2, y: H / 2 };
  }
  size();
  addEventListener('resize', size);
  const R = (o) => Math.min(W, H) * (0.16 + o * 0.135);
  function pos(n, t) {
    const dir = n.orbit === 2 ? -1 : 1;
    const sp = reduced ? 0 : (0.05 / n.orbit) * dir;
    const a = n.phase + t * sp;
    return { x: C.x + Math.cos(a) * R(n.orbit), y: C.y + Math.sin(a) * R(n.orbit) * 0.86 };
  }
  function pick(mx, my, t) {
    let best = -1, bd = 26;
    nodes.forEach((n, i) => {
      const p = pos(n, t);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    hover = pick(e.clientX - r.left, e.clientY - r.top, (performance.now() - t0) / 1000);
    show(hover);
  });
  canvas.addEventListener('click', () => { sel = hover; show(sel); });
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { sel = (sel + 1) % nodes.length; show(sel); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { sel = (sel - 1 + nodes.length) % nodes.length; show(sel); e.preventDefault(); }
  });
  function show(i) {
    if (i < 0) return;
    detail.textContent = `${nodes[i].name.toUpperCase()} — ${nodes[i].note}`;
  }
  return {
    frame(mid) {
      const t = (performance.now() - t0) / 1000;
      g.clearRect(0, 0, W, H);
      // orbits
      g.strokeStyle = 'rgba(233,236,234,0.08)';
      for (let o = 1; o <= 3; o++) {
        g.beginPath();
        g.ellipse(C.x, C.y, R(o), R(o) * 0.86, 0, 0, Math.PI * 2);
        g.stroke();
      }
      // core
      const pulse = 3.4 + mid * 5;
      g.fillStyle = 'rgba(89,232,213,0.9)';
      g.beginPath(); g.arc(C.x, C.y, pulse, 0, Math.PI * 2); g.fill();
      // nodes
      nodes.forEach((n, i) => {
        const p = pos(n, t);
        const r = 3 + n.size * 2.2 + (i === hover || i === sel ? 2.5 : 0) + mid * 1.6;
        const col = n.orbit === 1 ? '#59e8d5' : n.orbit === 2 ? '#e9ecea' : '#c99b66';
        g.shadowColor = col; g.shadowBlur = i === hover || i === sel ? 18 : 8;
        g.fillStyle = col;
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = i === hover || i === sel ? '#e9ecea' : 'rgba(151,161,158,0.9)';
        g.font = '10px ui-monospace, Menlo, monospace';
        g.textAlign = 'center';
        const lw = g.measureText(n.name).width / 2 + 6;
        g.fillText(n.name.toUpperCase(), Math.min(Math.max(p.x, lw), W - lw), p.y + r + 14);
      });
    },
  };
}

/* ---------- robot companion (lazy) ---------- */
$('#bot-toggle').addEventListener('click', async () => {
  if (!state.bot) {
    const m = await import('./bot.js');
    state.bot = m.startBot({ canvas: $('#bot-canvas') });
  }
  state.bot.togglePanel();
}, { once: false });

/* boot the idle face of the robot without opening the panel */
import('./bot.js').then((m) => { if (!state.bot) state.bot = m.startBot({ canvas: $('#bot-canvas'), panelClosed: true }); });

/* ---------- scene + main loop ---------- */
import('./scene.js').then(async ({ DeepField }) => {
  state.scene = new DeepField($('#stage'), { reduced });
  addEventListener('resize', () => state.scene.resize(), { passive: true });
  const { Hand3D } = await import('./hand3d.js');
  state.hand = new Hand3D(state.scene.camera);
  state.scene.scene.add(state.scene.camera); // camera children need the camera in-graph
});

const docH = () => document.documentElement.scrollHeight - innerHeight;
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.audio.frame();
  // iris gaze steers the drift when a face is tracked; pointer otherwise
  const gx = state.gaze ? state.gaze.x : state.px;
  const gy = state.gaze ? state.gaze.y : state.py;
  if (state.scene) {
    state.scene.setScroll(docH() > 0 ? scrollY / docH() : 0);
    state.scene.frame(dt, state.audio, { px: gx, py: gy, face: state.face });
  }
  if (state.hand) {
    if (!state.handLive) state.hand.setIdle(now / 1000, state.px, state.py);
    state.hand.update(dt, state.audio.level);
  }
  // ghost hand easing
  state.ghost.x += (state.ghost.tx - state.ghost.x) * 0.16;
  state.ghost.y += (state.ghost.ty - state.ghost.y) * 0.16;
  ghost.style.transform = `translate(${state.ghost.x}px, ${state.ghost.y}px)`;
  if (state.orbit && nearViewport('#systems')) state.orbit.frame(state.audio.mid);
  if (state.bot) state.bot.frame(dt, state.audio.level);
  requestAnimationFrame(loop);
}
function nearViewport(sel) {
  const el = $(sel);
  const r = el.getBoundingClientRect();
  return r.bottom > -100 && r.top < innerHeight + 100;
}
requestAnimationFrame(loop);
