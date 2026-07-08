/* Mission control: language, audio, scene, hands, ocean mode, and lazy
   modules. v9 "The Dive Line": scroll is a depth coordinate — stations are
   measured from the real DOM, the gauge reads meters, and the scene gets
   station-space (never uniform-fraction) scroll. Quality tier is decided
   at boot; a runtime governor steps down but never breaks features —
   everything degrades to the pointer + keyboard + touch baseline. */

import { age, STAT_NUMS, SKILL_GEO, PROJECT_LINKS, CONTACT } from './data.js';
import { I18N, LOCALES, VOICE, t, lang, setLang } from './i18n.js';
import { AudioEngine } from './audio.js';
import { detectQuality, Governor } from './quality.js';
import { createGyro } from './sensors.js';
import { createGestures } from './gestures.js';

const $ = (s) => document.querySelector(s);
const rmq = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = rmq.matches;
rmq.addEventListener('change', () => {
  reduced = rmq.matches;
  if (state.scene) state.scene.reduced = reduced;
});
const Q = detectQuality();

const state = {
  px: 0, py: 0,               // pointer parallax
  gx: 0, gy: 0,               // gyro parallax (smoothed here)
  hand: null, handsLive: 0,
  scene: null, vision: null, bot: null, game: null, orbit: null,
  art: null, games: null, fight: null,
  dwell: null, faceField: null, faceLoading: false,
  audio: new AudioEngine('assets/audio/dns-1.m4a'),
  ghost: { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 },
};
const gyro = createGyro();

/* one polite voice for world-state changes */
const announcer = $('#announcer');
function announce(msg) { if (announcer) announcer.textContent = msg; }

/* live waveform under the Sound cargo row — bound on each render */
let waveCanvas = null, waveCtx = null, waveBuf = null;

/* ---------- language ---------- */
const langSel = $('#lang');
const saved = localStorage.getItem('fgg-lang');
const guess = (navigator.language || 'en').slice(0, 2).toLowerCase();
setLang(saved || (LOCALES.includes(guess) ? guess : 'en'));
langSel.value = lang;

/* authored waypoint depths across the journey band (−150 → −400) */
const TL_DEPTHS = [150, 180, 215, 250, 285, 320, 360, 400];
/* each stage lights when the dive reaches it; entrance choreography is
   per-stage in CSS, so the biography plays as a sequence, not a wall */
let tlio = null;
function litObserve() {
  tlio?.disconnect();
  tlio = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('lit');
    tlio.unobserve(en.target);
  }), { threshold: 0.3 });
  document.querySelectorAll('.tl-item').forEach((el) => tlio.observe(el));
}

function renderContent() {
  const L = I18N[lang] ?? I18N.en;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
    el.title = t(el.dataset.i18nAria);
  });
  $('#hero-lead').textContent = t('hero.lead').replace('{age}', age());
  $('#tm-age').textContent = age();
  $('#yr').textContent = new Date().getFullYear();

  $('#stats').innerHTML = STAT_NUMS.map((n, i) => `
    <div class="stat"><span class="num">${n}</span><span class="lbl">${L.sections.stats[i]}</span></div>`).join('');

  /* descent log: each life stage is its own scene — the index picks the
     stage dialect (marker, entrance, light — css .tl-stage-N), the depth
     mark keeps the log on the same instrument as the gauge */
  $('#timeline').innerHTML = L.timeline.map((x, i) => `
    <div class="tl-item tl-stage-${i}">
      <span class="tl-depth num" aria-hidden="true">−${String(TL_DEPTHS[i] ?? 150).padStart(3, '0')} M</span>
      <span class="yr num">${x.year}</span>
      <h3>${x.title} · <span class="tl-place">${x.place}</span></h3>
      <p>${x.text}</p>
    </div>`).join('');
  litObserve();

  /* cargo manifest: three full-width rows, each its own object.
     Hold 02 ships sealed — the hatching says everything it may. */
  $('#projects').innerHTML = L.projects.map((p, i) => `
    <article class="cargo${i === 1 ? ' cargo--sealed' : ''}">
      <span class="cargo__idx num" aria-hidden="true">0${i + 1}</span>
      <div class="cargo__head">
        <span class="tag">${p.tag}</span>
        <h3>${p.title}</h3>
      </div>
      <div class="cargo__body">
        <p>${p.text}</p>
        ${PROJECT_LINKS[i] ? `<a href="${PROJECT_LINKS[i].href}" rel="noopener" target="_blank">${PROJECT_LINKS[i].label} ↗</a>` : ''}
      </div>
      ${i === 2 ? '<canvas class="cargo__wave" id="wave" width="900" height="34" aria-hidden="true"></canvas>' : ''}
    </article>`).join('');
  waveCanvas = $('#wave');
  waveCtx = waveCanvas ? waveCanvas.getContext('2d') : null;

  $('#contact-links').innerHTML = CONTACT.links
    .map((l) => `<a href="${l.href}" rel="noopener" target="_blank">${l.label}</a>`).join('');
  $('#orbit-fallback').innerHTML = L.skills.map((s) => `<li>${s.name}: ${s.note}</li>`).join('');
  $('#orbit-detail').textContent = t('sections.orbitDefault');
  $('#ctf-err').textContent = '';

  dispatchEvent(new CustomEvent('langchange'));
  queueStations();
}

langSel.addEventListener('change', () => {
  setLang(langSel.value);
  localStorage.setItem('fgg-lang', langSel.value);
  speechSynthesis?.cancel();
  adBtn.setAttribute('aria-pressed', 'false');
  renderContent();
});

/* ---------- audio description ---------- */
const adBtn = $('#ctl-ad');
adBtn.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    adBtn.setAttribute('aria-pressed', 'false');
    return;
  }
  const u = new SpeechSynthesisUtterance(t('ui.adText'));
  u.lang = VOICE[lang];
  u.rate = 0.98;
  u.onend = () => adBtn.setAttribute('aria-pressed', 'false');
  adBtn.setAttribute('aria-pressed', 'true');
  speechSynthesis.speak(u);
});

/* ---------- entry gate ---------- */
const gate = $('#gate');
const soundCtl = $('#ctl-sound');
/* one inert perimeter for every modal moment (gate, consent, sarcasm, layers) */
const INERT_SEL = 'header, main, .gauge, .bot, .skip-link, #guide';
const setModal = (on) => document.querySelectorAll(INERT_SEL).forEach((el) => { el.inert = on; });
setModal(true);
$('#enter-sound')?.focus();

/* luxury CLI: the gate boots like an instrument coming online. Telemetry
   voice (EN mono, aria-hidden) — same register as the hero coordinates. */
const bootEl = $('#gate-boot');
if (bootEl) {
  const bootLines = [
    'DEPTH LINK ......... OK',
    'DNS_1 SCORE ........ ARMED',
    `TRACKING ........... ${Q.coarse ? 'ONE-HAND' : 'DUAL-HAND'}`,
    'PRESSURE ........... EQUALIZED',
  ];
  if (reduced) {
    bootEl.textContent = bootLines.join('\n');
    bootEl.classList.add('done');
  } else {
    let li = 0, ci = 0, out = '';
    const tk = setInterval(() => {
      if (gate.hidden) { clearInterval(tk); return; }
      const ln = bootLines[li];
      if (!ln) { clearInterval(tk); bootEl.classList.add('done'); return; }
      ci += 3;
      if (ci >= ln.length) { out += ln + '\n'; li++; ci = 0; bootEl.textContent = out; }
      else bootEl.textContent = out + ln.slice(0, ci);
    }, 20);
  }
}

/* single shared boot for CAERUS: idle prefetch and toggle click can race */
let botP = null;
const botReady = () => (botP ||= import('./bot.js')
  .then((m) => (state.bot ||= m.startBot({ canvas: $('#bot-canvas') }))));

function closeGate() {
  gate.style.transition = 'opacity 1.4s';
  gate.style.opacity = '0';
  document.body.classList.add('loaded');
  setModal(false);
  gyro.enable();  // user gesture: iOS grants or silently declines
  setTimeout(() => { gate.hidden = true; maybeGuide(); }, 1400);
  // CAERUS can wait for an idle moment — the scene fetch comes first
  (window.requestIdleCallback || ((f) => setTimeout(f, 1800)))(botReady);
}

/* first visit: a brief, quiet guide to the two-hand grammar */
function maybeGuide(force = false) {
  if (!force && localStorage.getItem('fgg-guide')) return;
  import('./guide.js').then((m) => m.startGuide());
}
$('#ctl-help').addEventListener('click', () => maybeGuide(true));
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

/* ---------- ocean mode: dive button + shaka gesture share one path ---------- */
const diveCtl = $('#ctl-dive');
function toggleOcean() {
  if (!state.scene) return;
  const next = state.scene.toggleMode();
  if (!next) return; // transition already running
  const ocean = next === 'ocean';
  diveCtl.setAttribute('aria-pressed', String(ocean));
  announce(t('ui.diveLabel'));
}
/* the CSS skin and the score dive exactly when the foam line crosses
   mid-screen — the scene reports the moment, no hardcoded timers */
function onFoamPeak(toOcean) {
  document.body.classList.toggle('ocean', toOcean);
  state.audio.setUnderwater(toOcean);
}
diveCtl.addEventListener('click', toggleOcean);

/* ---------- pointer + ghost hand ---------- */
const ghost = $('#ghost-hand');
let ghostSeen = false;
addEventListener('pointermove', (e) => {
  state.px = (e.clientX / innerWidth - 0.5) * 2;
  state.py = (e.clientY / innerHeight - 0.5) * 2;
  state.ghost.tx = e.clientX + 18;
  state.ghost.ty = e.clientY + 18;
  if (!ghostSeen && !state.vision) { ghost.classList.add('on'); ghostSeen = true; }
}, { passive: true });

/* ---------- camera consent + dual-hand tracking ---------- */
const camCtl = $('#ctl-cam');
const consent = $('#cam-consent');
const VIS_MSG = { req: 'ui.visReq', retry: 'ui.visRetry', ready: Q.hands === 1 ? 'ui.visReady1' : 'ui.visReady' };

/* one-hand-first: touch devices read the single-hand grammar everywhere */
if (Q.coarse) {
  document.querySelector('#cam-consent [data-i18n="ui.camBody"]')?.setAttribute('data-i18n', 'ui.camBody1');
  document.querySelector('#art-status')?.setAttribute('data-i18n', 'ui.artHint1');
}

function stopVision(msgKey = 'ui.handOff') {
  state.vision?.stop();
  state.vision = null;
  state.handsLive = 0;
  state.dwell?.hide();
  state.faceField?.setFace(null);
  camCtl.setAttribute('aria-pressed', 'false');
  $('#moon-telemetry').textContent = t('ui.handOff');
  $('#game-status').textContent = t(msgKey);
  announce(t(msgKey));
}

camCtl.addEventListener('click', () => {
  if (state.vision) {
    stopVision();
    return;
  }
  consent.hidden = false;
  setModal(true);
  $('#cam-enable')?.focus();
});
const closeConsent = () => { consent.hidden = true; setModal(false); camCtl.focus(); };
consent.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeConsent(); });
$('#cam-decline').addEventListener('click', closeConsent);
$('#cam-enable').addEventListener('click', async () => {
  consent.hidden = true;
  setModal(false);
  camCtl.disabled = true;
  try {
    const mod = await import('./vision.js');
    state.vision = await mod.startVision({
      onHands,
      onFace,
      face: Q.face,
      maxHands: Q.hands,
      onStatus: (code) => { $('#game-status').textContent = t(VIS_MSG[code] ?? code); },
    });
    if (!state.dwell) {
      const dm = await import('./dwell.js');
      state.dwell = dm.createDwell();
    }
    camCtl.setAttribute('aria-pressed', 'true');
    ghost.classList.remove('on');
    $('#moon-telemetry').textContent = t('ui.handOn');
    announce(t('ui.handOn'));
  } catch {
    $('#moon-telemetry').textContent = t('ui.handOff');
    camCtl.setAttribute('aria-pressed', 'false');
  } finally {
    camCtl.disabled = false;
    camCtl.focus();
  }
});

/* Dual-hand grammar. The gesture engine decides what the pair means;
   this block only wires its verbs to the page. Two secrets stay secret. */
const SECTIONS = [...document.querySelectorAll('main .section')];
const sarcasm = $('#sarcasm');
let sarcOpener = null;
const closeSarcasm = () => { sarcasm.hidden = true; setModal(false); sarcOpener?.focus?.(); };
$('#sarcasm-close').addEventListener('click', closeSarcasm);
sarcasm.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSarcasm(); });

/* middle finger = close whatever is front-most; sass only when idle */
function closeFrontmost() {
  if (state.games?.close?.()) return;
  if (state.fight?.close?.()) return;
  if (state.art?.closeFull?.()) return;
  if (window.__guide?.close?.()) return;
  const botPanel = $('#bot-panel');
  if (botPanel && !botPanel.hidden) { state.bot?.togglePanel(); return; }
  if (sarcasm.hidden) {
    sarcOpener = document.activeElement;
    sarcasm.hidden = false;
    setModal(true);
    $('#sarcasm-close')?.focus();
  }
}

/* symmetric palm spread = cinema view (chrome dissolves); close = return */
function setImmersive(on) {
  document.body.classList.toggle('immersive', on);
}

const lastPokeAt = { L: 0, R: 0 };
const gest = createGestures({
  dwell: (pt, now) => state.dwell?.update(pt, now),
  scroll: (dy) => scrollBy({ top: dy * innerHeight * 0.14, behavior: 'instant' }),
  jump: (dir) => jumpSection(dir),
  dive: () => toggleOcean(),
  warp: () => state.scene?.triggerWarp(),
  middle: () => closeFrontmost(),
  immersive: setImmersive,
  portal: (phase, scale) => state.scene?.setPortal(phase === 'move' ? scale : 1),
  stir: (h, i) => {
    if (!state.scene || state.scene.mix <= 0.05) return;
    state.scene.setHand(i, h.x, h.y, h.speed);
    const now = performance.now();
    if (h.speed > 0.5 && now - lastPokeAt[h.uid] > 130) {
      lastPokeAt[h.uid] = now;
      state.scene.pokeWater(h.x, h.y, Math.min(0.25 + h.speed * 0.3, 1.1));
    }
  },
});

/* stability watchdog (one-hand mobile): tracking that keeps dropping is
   worse than no tracking — after 4 losses in 30 s the page hands the
   controls straight back to touch, immediately and audibly */
let dropLog = [];
let prevLive = 0;
function onHands(hands, now) {
  if (Q.coarse && state.vision) {
    if (!hands.length && prevLive > 0) {
      dropLog.push(now);
      dropLog = dropLog.filter((t0) => now - t0 < 30000);
      if (dropLog.length >= 4) {
        dropLog = [];
        prevLive = 0;
        stopVision('ui.visUnstable');
        return;
      }
    }
    prevLive = hands.length;
  }
  state.handsLive = hands.length;
  state.hand?.setHands(hands);
  gest.feed(hands, now);
  state.art?.setHands?.(hands);
}

function onFace(f) {
  if (!Q.face || !state.scene) return;
  if (f && !state.faceField && !state.faceLoading) {
    state.faceLoading = true;
    import('./facefield.js').then((m) => {
      state.faceField = m.createFaceField(state.scene);
      state.faceField.setFace(f);
    });
    return;
  }
  state.faceField?.setFace(f);
}

function currentSection() {
  const y = scrollY + innerHeight / 2;
  return Math.max(0, SECTIONS.findLastIndex((s) => s.offsetTop <= y));
}
function jumpSection(dir) {
  const i = Math.min(SECTIONS.length - 1, Math.max(0, currentSection() + dir));
  SECTIONS[i].scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
}
addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.altKey)) { e.preventDefault(); jumpSection(1); }
  if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.altKey)) { e.preventDefault(); jumpSection(-1); }
});

/* ---------- the dive line: stations measured from the real DOM ----------
   Anchors are the eight rail targets. Depth (meters) interpolates between
   their data-depth marks, bottoming out at −1233 m — the South Adriatic
   Pit, the deepest point of Bari's own sea. The 3D world receives scroll
   in station space so landmarks land exactly on their chapters. */
const rail = [...document.querySelectorAll('#rail a')];
const railEl = $('#rail');
const depthReadout = $('#depth-readout');
const anchors = rail.map((a) => $(a.getAttribute('href')));
const depths = rail.map((a) => Number(a.dataset.depth) || 0);
let stationTops = [];
let docH = 1;

function computeStations() {
  docH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  stationTops = anchors.map((s) => Math.max(0, Math.min(s.offsetTop - innerHeight * 0.12, docH)));
  state.scene?.setStations?.(stationTops.map((tp) => tp / docH));
}
let stationsQueued = false;
function queueStations() {
  if (stationsQueued) return;
  stationsQueued = true;
  requestAnimationFrame(() => { stationsQueued = false; computeStations(); });
}
new ResizeObserver(queueStations).observe(document.body);
addEventListener('load', queueStations);

/* continuous station coordinate: 0..7 across the eight anchors */
function stationPos() {
  const y = scrollY;
  if (!stationTops.length || y <= stationTops[0]) return 0;
  const last = stationTops.length - 1;
  if (y >= stationTops[last]) return last;
  let i = 0;
  while (i < last && stationTops[i + 1] <= y) i++;
  const span = Math.max(1, stationTops[i + 1] - stationTops[i]);
  return i + (y - stationTops[i]) / span;
}

let railIdx = -1, lastDepth = -1;
function updateGauge(u) {
  const i = Math.min(depths.length - 2, Math.floor(u));
  const frac = u - i;
  const d = Math.round(depths[i] + (depths[i + 1] - depths[i]) * frac);
  if (d !== lastDepth) {
    lastDepth = d;
    if (depthReadout) depthReadout.textContent = `−${String(d).padStart(4, '0')} M`;
    railEl?.style.setProperty('--gauge-p', (u / (depths.length - 1)).toFixed(4));
  }
  const idx = Math.round(u);
  if (idx !== railIdx) {
    railIdx = idx;
    rail.forEach((a, j) => a.setAttribute('aria-current', String(j === idx)));
  }
}

/* ---------- lazy modules (thresholds a tall section can actually reach) ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    if (en.target.id === 'arcade' && !state.game) {
      import('./game.js').then((m) => { state.game = m.startGame($('#game')); });
    }
    if (en.target.id === 'atelier' && !state.art) {
      import('./art.js').then((m) => { state.art = m.startArt($('#art')); });
    }
    if (en.target.id === 'moon' && !window.__ctf) {
      window.__ctf = true;
      import('./ctf.js').then((m) => m.initCTF());
    }
    if (en.target.id === 'systems' && !state.orbit) state.orbit = makeOrbit($('#orbit'));
  });
}, { threshold: 0.05, rootMargin: '0px 0px -20% 0px' });
anchors.forEach((s) => io.observe(s));

/* first paint: every station binding above is initialized by now */
renderContent();

/* ---------- skills orbital map ---------- */
function makeOrbit(canvas) {
  const g = canvas.getContext('2d');
  const detail = $('#orbit-detail');
  let W, H, C, dpr, sel = -1, hover = -1, t0 = performance.now();
  const perOrbitCount = {};
  const nodes = SKILL_GEO.map((s, i) => {
    perOrbitCount[s.orbit] = (perOrbitCount[s.orbit] || 0) + 1;
    return { ...s, idx: perOrbitCount[s.orbit] - 1, i };
  });
  nodes.forEach((n) => { n.phase = (n.idx / perOrbitCount[n.orbit]) * Math.PI * 2; });
  const name = (i) => (I18N[lang] ?? I18N.en).skills[i].name;
  const note = (i) => (I18N[lang] ?? I18N.en).skills[i].note;
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
  function pos(n, tt) {
    const dir = n.orbit === 2 ? -1 : 1;
    const sp = reduced ? 0 : (0.05 / n.orbit) * dir;
    const a = n.phase + tt * sp;
    return { x: C.x + Math.cos(a) * R(n.orbit), y: C.y + Math.sin(a) * R(n.orbit) * 0.86 };
  }
  function pick(mx, my, tt) {
    let best = -1, bd = 30;
    nodes.forEach((n, i) => {
      const p = pos(n, tt);
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
  /* tap-friendly: pick from the tap point itself, never a stale hover */
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    sel = pick(e.clientX - r.left, e.clientY - r.top, (performance.now() - t0) / 1000);
    show(sel);
  });
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { sel = (sel + 1) % nodes.length; show(sel); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { sel = (sel - 1 + nodes.length) % nodes.length; show(sel); e.preventDefault(); }
  });
  function show(i) {
    if (i < 0) return;
    detail.textContent = `${name(i).toUpperCase()} — ${note(i)}`;
  }
  const labels = []; // reused each frame for collision-resolved placement
  return {
    frame(mid) {
      const tt = (performance.now() - t0) / 1000;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(233,236,234,0.08)';
      for (let o = 1; o <= 3; o++) {
        g.beginPath();
        g.ellipse(C.x, C.y, R(o), R(o) * 0.86, 0, 0, Math.PI * 2);
        g.stroke();
      }
      const pulse = 3.4 + mid * 5;
      g.fillStyle = 'rgba(89,232,213,0.9)';
      g.beginPath(); g.arc(C.x, C.y, pulse, 0, Math.PI * 2); g.fill();
      labels.length = 0;
      g.font = '11px ui-monospace, Menlo, monospace';
      nodes.forEach((n, i) => {
        const p = pos(n, tt);
        const r = 3 + n.size * 2.2 + (i === hover || i === sel ? 2.5 : 0) + mid * 1.6;
        const col = n.orbit === 1 ? '#59e8d5' : n.orbit === 2 ? '#e9ecea' : '#b9c2c6';
        g.shadowColor = col; g.shadowBlur = i === hover || i === sel ? 18 : 8;
        g.fillStyle = col;
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        const txt = name(i).toUpperCase();
        const hw = g.measureText(txt).width / 2 + 6;
        labels.push({ x: Math.min(Math.max(p.x, hw), W - hw), y: p.y + r + 15, hw, txt, hot: i === hover || i === sel });
      });
      /* one greedy pass keeps labels off each other */
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) {
        const a = labels[i - 1], b = labels[i];
        if (Math.abs(b.y - a.y) < 13 && Math.abs(b.x - a.x) < a.hw + b.hw) b.y = a.y + 13;
      }
      labels.forEach((l) => {
        g.fillStyle = l.hot ? '#e9ecea' : 'rgba(151,161,158,0.9)';
        g.textAlign = 'center';
        g.fillText(l.txt, l.x, l.y);
      });
    },
  };
}

/* ---------- cinema layer: grain, reveals, tilt, magnetism ---------- */
const grain = document.createElement('canvas');
grain.id = 'grain'; grain.width = 128; grain.height = 128;
grain.setAttribute('aria-hidden', 'true');
document.body.appendChild(grain);
const gg = grain.getContext('2d');
const grainImg = gg.createImageData(128, 128); // one buffer, refilled in place
let grainMs = Q.grainMs;
function grainTick() {
  setTimeout(grainTick, grainMs);
  if (reduced || document.hidden) return;
  const a = grainImg.data;
  for (let i = 0; i < a.length; i += 4) { a[i] = a[i + 1] = a[i + 2] = (Math.random() * 255) | 0; a[i + 3] = 36; }
  gg.putImageData(grainImg, 0, 0);
}
grainTick();

/* reveal signatures: displays uncover, frames draw in, prose rises */
document.querySelectorAll('.display--section').forEach((el) => el.classList.add('reveal', 'reveal--shutter'));
document.querySelectorAll('.game-frame, .art-frame, .orbit-wrap, .cargo').forEach((el) => el.classList.add('reveal', 'reveal--draw'));
document.querySelectorAll(
  '.serif-line, .lead, .channel, .stats, #ctf-form, .links-row, .signoff'
).forEach((el) => el.classList.add('reveal'));
const rio = new IntersectionObserver((es) => es.forEach((en) => {
  if (!en.isIntersecting) return;
  const el = en.target;
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.transitionDelay = `${(Math.max(sibs.indexOf(el), 0) % 6) * 90}ms`;
  el.classList.add('in');
  el.addEventListener('transitionend', () => {
    el.classList.remove('reveal', 'reveal--shutter', 'reveal--draw', 'in');
    el.style.transitionDelay = '';
  }, { once: true });
  rio.unobserve(el);
}), { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el) => rio.observe(el));

if (matchMedia('(pointer: fine)').matches && !reduced) {
  document.querySelectorAll('.card, .channel').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (reduced) return; // honors a mid-session reduced-motion flip
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-3px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  document.querySelectorAll('.btn').forEach((b) => {
    /* while magnetized the CSS transform transition is paused, so the pull
       is 1:1; on leave it resumes and eases the button home */
    b.addEventListener('pointermove', (e) => {
      if (reduced) return;
      const r = b.getBoundingClientRect();
      b.style.transition = 'none';
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1)}px)`;
      /* the liquid highlight tracks the pointer through the glass */
      b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      b.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    });
    b.addEventListener('pointerleave', () => { b.style.transition = ''; b.style.transform = ''; });
  });
}

/* real portrait appears only when assets/img/portrait.jpg exists */
const pimg = $('#portrait-img');
pimg?.addEventListener('load', () => { $('#portrait').hidden = false; });

/* ---------- game deck: two arcade cabinets at the end of the site ---------- */
const themeOf = () => (state.scene && state.scene.mix > 0.5 ? 'ocean' : 'space');
$('#play-runner')?.addEventListener('click', async () => {
  if (!state.games) {
    const m = await import('./games.js');
    state.games = m.createRunner(themeOf);
  }
  state.games.open();
});
$('#play-fight')?.addEventListener('click', async () => {
  if (!state.fight) {
    const m = await import('./fight.js');
    state.fight = m.createFight(themeOf);
  }
  state.fight.open();
});

/* ---------- robot companion (lazy; boot deferred to idle in closeGate) ---------- */
$('#bot-toggle').addEventListener('click', async () => {
  await botReady();
  state.bot.togglePanel();
});

/* ---------- scene + cockpit hand pair + main loop ---------- */
import('./scene.js').then(({ DeepField }) => {
  state.scene = new DeepField($('#stage'), { reduced, quality: Q });
  state.scene.onFoamPeak = onFoamPeak;
  state.scene.scene.add(state.scene.camera); // foam + hands ride the camera
  computeStations();
  /* the hand and the decorative life are enhancements: if either fails,
     the world keeps rendering — only a true scene failure gets no3d */
  import('./hand3d.js').then(({ Hands3D }) => {
    state.hand = new Hands3D(state.scene.camera);
  }).catch(() => {});
  if (!reduced) {
    import('./extras.js').then((m) => { state.scene.extras = m.createExtras(state.scene, Q); }).catch(() => {});
  }
}).catch(() => {
  /* no WebGL / blocked GPU: the black still reads deliberate, content stands alone */
  document.body.classList.add('no3d');
});

/* resize guard: mobile URL-bar collapse fires resize with same width —
   re-laying the GL canvas for that just causes a visible hitch.
   DPR changes (monitor hop, zoom) must bypass the guard. */
let lastW = innerWidth, lastH = innerHeight, lastDpr = devicePixelRatio;
function onResize() {
  if (!state.scene) return;
  if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 130 && devicePixelRatio === lastDpr) return;
  lastW = innerWidth; lastH = innerHeight; lastDpr = devicePixelRatio;
  state.scene.resize();
  queueStations();
}
addEventListener('resize', onResize, { passive: true });
addEventListener('orientationchange', () => {
  lastW = -1;
  setTimeout(onResize, 220);
}, { passive: true });

/* ---------- fps governor: steps down, never up ---------- */
const governor = new Governor((step) => {
  if (!state.scene) return;
  if (step === 1) state.scene.setDprCap(Math.max(1, Q.dprCap - 0.3));
  if (step === 2) state.scene.setDust(false);
  if (step === 3) {
    state.vision?.setFace(false);
    state.faceField?.setEnabled(false);
    state.vision?.setMaxHands(1);   // dual-hand degrades before the world does
  }
  if (step === 4) { state.scene.setStarFrac(0.55); grainMs = 400; }
});

/* live waveform under the Sound cargo row — DNS_1 drawing itself */
let waveDirty = false;
function drawWave() {
  if (!waveCtx || !state.audio.analyser || !state.audio.playing || state.audio.muted) {
    if (waveDirty && waveCtx) { waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height); waveDirty = false; }
    return;
  }
  waveDirty = true;
  const r = waveCanvas.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const an = state.audio.analyser;
  waveBuf ||= new Uint8Array(an.fftSize);
  an.getByteTimeDomainData(waveBuf);
  const W = waveCanvas.width, H = waveCanvas.height;
  waveCtx.clearRect(0, 0, W, H);
  waveCtx.strokeStyle = 'rgba(89,232,213,0.8)';
  waveCtx.lineWidth = 1.4;
  waveCtx.beginPath();
  const step = Math.floor(waveBuf.length / W) || 1;
  for (let x = 0; x < W; x++) {
    const v = waveBuf[x * step] / 255;
    const y = H / 2 + (v - 0.5) * H * 0.9;
    x === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();
}

const systemsSec = $('#systems');
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.audio.frame();

  // gyro folds into the same parallax bus as the pointer (time-corrected)
  const kg = 1 - Math.exp(-dt * 5);
  const g = gyro.target();
  state.gx += (g.x - state.gx) * kg;
  state.gy += (g.y - state.gy) * kg;
  const px = Math.max(-1.2, Math.min(1.2, state.px + state.gx * 0.8));
  const py = Math.max(-1.2, Math.min(1.2, state.py + state.gy * 0.6));

  const u = stationPos();
  updateGauge(u);

  if (state.scene) {
    state.scene.setStationScroll(u);
    state.scene.frame(dt, state.audio, { px, py, cur: { x: state.gx, y: state.gy } });
    state.hand?.setMode(state.scene.mix);
  }
  if (state.hand) {
    if (!state.handsLive) {
      /* portrait frames and the sea floor tuck the idle hand away so it
         never blankets copy, CTAs or the sign-off coordinates */
      const portrait = innerHeight > innerWidth || innerWidth < 1024 ? 0.85 : 0;
      const floorSink = Math.min(1, Math.max(0, (u - 6.15) / 0.7));
      state.hand.setIdle(now / 1000, px, py, Math.max(portrait, floorSink));
    }
    state.hand.update(dt, state.audio.level);
  }
  state.faceField?.frame(dt, state.audio.mid, state.scene ? state.scene.mix : 0);
  const kgh = 1 - Math.exp(-dt * 10);
  state.ghost.x += (state.ghost.tx - state.ghost.x) * kgh;
  state.ghost.y += (state.ghost.ty - state.ghost.y) * kgh;
  if (ghostSeen) ghost.style.transform = `translate(${state.ghost.x}px, ${state.ghost.y}px)`;
  if (state.orbit && nearViewport(systemsSec)) state.orbit.frame(state.audio.mid);
  if (state.bot) state.bot.frame(dt, state.audio.level, state.scene ? state.scene.mix : 0);
  drawWave();
  governor.tick(dt);
  requestAnimationFrame(loop);
}
function nearViewport(elm) {
  const r = elm.getBoundingClientRect();
  return r.bottom > -100 && r.top < innerHeight + 100;
}
requestAnimationFrame(loop);

/* QA hook (harmless in production): lets tests drive the mode switch */
window.__fgg = { state, toggleOcean, quality: Q };
