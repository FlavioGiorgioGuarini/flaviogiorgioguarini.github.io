/* Mission control: language, audio, scene, hand, ocean mode, and lazy
   modules. Quality tier is decided at boot; a runtime governor may step
   quality down but never breaks features — every capability degrades to
   the pointer + keyboard + touch baseline. */

import { age, STAT_NUMS, SKILL_GEO, PROJECT_LINKS, CONTACT } from './data.js';
import { I18N, LOCALES, VOICE, t, lang, setLang } from './i18n.js';
import { AudioEngine } from './audio.js';
import { detectQuality, Governor } from './quality.js';
import { createGyro } from './sensors.js';
import { createGestures } from './gestures.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/* ---------- language ---------- */
const langSel = $('#lang');
const saved = localStorage.getItem('fgg-lang');
const guess = (navigator.language || 'en').slice(0, 2).toLowerCase();
setLang(saved || (LOCALES.includes(guess) ? guess : 'en'));
langSel.value = lang;

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

  $('#timeline').innerHTML = L.timeline.map((x) => `
    <div class="tl-item">
      <span class="yr num">${x.year}</span>
      <h3>${x.title} · <span class="tl-place">${x.place}</span></h3>
      <p>${x.text}</p>
    </div>`).join('');

  $('#projects').innerHTML = L.projects.map((p, i) => `
    <article class="panel card${i === 1 ? ' card--locked' : ''}">
      <span class="tag">${p.tag}</span>
      <h3>${p.title}</h3>
      <p>${p.text}</p>
      ${PROJECT_LINKS[i] ? `<p><a href="${PROJECT_LINKS[i].href}" rel="noopener" target="_blank">${PROJECT_LINKS[i].label} ↗</a></p>` : ''}
    </article>`).join('');

  $('#contact-links').innerHTML = CONTACT.links
    .map((l) => `<a href="${l.href}" rel="noopener" target="_blank">${l.label}</a>`).join('');
  $('#orbit-fallback').innerHTML = L.skills.map((s) => `<li>${s.name}: ${s.note}</li>`).join('');
  $('#orbit-detail').textContent = t('sections.orbitDefault');
  $('#ctf-err').textContent = t('ctf.err');

  dispatchEvent(new CustomEvent('langchange'));
}
renderContent();

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

function closeGate() {
  gate.style.transition = 'opacity 1.4s';
  gate.style.opacity = '0';
  document.body.classList.add('loaded');
  gyro.enable();  // user gesture: iOS grants or silently declines
  setTimeout(() => { gate.hidden = true; maybeGuide(); }, 1400);
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
  // the CSS skin and the score dive at the foam peak, not at click time
  setTimeout(() => {
    document.body.classList.toggle('ocean', ocean);
    state.audio.setUnderwater(ocean);
  }, reduced ? 200 : 1150);
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
const VIS_MSG = { req: 'ui.visReq', retry: 'ui.visRetry', ready: 'ui.visReady' };

camCtl.addEventListener('click', () => {
  if (state.vision) {
    state.vision.stop();
    state.vision = null;
    state.handsLive = 0;
    state.dwell?.hide();
    state.faceField?.setFace(null);
    camCtl.setAttribute('aria-pressed', 'false');
    $('#moon-telemetry').textContent = t('ui.handOff');
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
  } catch {
    $('#moon-telemetry').textContent = t('ui.handOff');
    camCtl.setAttribute('aria-pressed', 'false');
  } finally {
    camCtl.disabled = false;
  }
});

/* Dual-hand grammar. The gesture engine decides what the pair means;
   this block only wires its verbs to the page. Two secrets stay secret. */
const SECTIONS = [...document.querySelectorAll('main .section')];
const sarcasm = $('#sarcasm');
$('#sarcasm-close').addEventListener('click', () => { sarcasm.hidden = true; });

/* middle finger = close whatever is front-most; sass only when idle */
function closeFrontmost() {
  if (state.games?.close?.()) return;
  if (state.fight?.close?.()) return;
  if (window.__guide?.close?.()) return;
  const botPanel = $('#bot-panel');
  if (botPanel && !botPanel.hidden) { state.bot?.togglePanel(); return; }
  if (sarcasm.hidden) sarcasm.hidden = false;
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

function onHands(hands, now) {
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
      if (en.target.id === 'atelier' && !state.art) {
        import('./art.js').then((m) => { state.art = m.startArt($('#art')); });
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
    let best = -1, bd = 26;
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
  canvas.addEventListener('click', () => { sel = hover; show(sel); });
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { sel = (sel + 1) % nodes.length; show(sel); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { sel = (sel - 1 + nodes.length) % nodes.length; show(sel); e.preventDefault(); }
  });
  function show(i) {
    if (i < 0) return;
    detail.textContent = `${name(i).toUpperCase()} — ${note(i)}`;
  }
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
      nodes.forEach((n, i) => {
        const p = pos(n, tt);
        const r = 3 + n.size * 2.2 + (i === hover || i === sel ? 2.5 : 0) + mid * 1.6;
        const col = n.orbit === 1 ? '#59e8d5' : n.orbit === 2 ? '#e9ecea' : '#b9c2c6';
        g.shadowColor = col; g.shadowBlur = i === hover || i === sel ? 18 : 8;
        g.fillStyle = col;
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = i === hover || i === sel ? '#e9ecea' : 'rgba(151,161,158,0.9)';
        g.font = '10px ui-monospace, Menlo, monospace';
        g.textAlign = 'center';
        const lw = g.measureText(name(i)).width / 2 + 6;
        g.fillText(name(i).toUpperCase(), Math.min(Math.max(p.x, lw), W - lw), p.y + r + 14);
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
let grainMs = Q.grainMs;
function grainTick() {
  setTimeout(grainTick, grainMs);
  if (reduced || document.hidden) return;
  const d = gg.createImageData(128, 128), a = d.data;
  for (let i = 0; i < a.length; i += 4) { a[i] = a[i + 1] = a[i + 2] = (Math.random() * 255) | 0; a[i + 3] = 36; }
  gg.putImageData(d, 0, 0);
}
grainTick();

document.querySelectorAll(
  '.display--section, .serif-line, .lead, .card, .channel, .stats, .game-frame, .orbit-wrap, #ctf-form, .links-row'
).forEach((el) => el.classList.add('reveal'));
const rio = new IntersectionObserver((es) => es.forEach((en) => {
  if (!en.isIntersecting) return;
  const el = en.target;
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.transitionDelay = `${(Math.max(sibs.indexOf(el), 0) % 6) * 90}ms`;
  el.classList.add('in');
  el.addEventListener('transitionend', () => {
    el.classList.remove('reveal', 'in');
    el.style.transitionDelay = '';
  }, { once: true });
  rio.unobserve(el);
}), { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el) => rio.observe(el));

if (matchMedia('(pointer: fine)').matches && !reduced) {
  document.querySelectorAll('.card, .channel').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-3px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  document.querySelectorAll('.btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1)}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
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

/* ---------- robot companion (lazy) ---------- */
$('#bot-toggle').addEventListener('click', async () => {
  if (!state.bot) {
    const m = await import('./bot.js');
    state.bot = m.startBot({ canvas: $('#bot-canvas') });
  }
  state.bot.togglePanel();
});
import('./bot.js').then((m) => { if (!state.bot) state.bot = m.startBot({ canvas: $('#bot-canvas') }); });

/* ---------- scene + cockpit hand pair + main loop ---------- */
import('./scene.js').then(async ({ DeepField }) => {
  state.scene = new DeepField($('#stage'), { reduced, quality: Q });
  const { Hands3D } = await import('./hand3d.js');
  state.hand = new Hands3D(state.scene.camera);
  state.scene.scene.add(state.scene.camera);
  // decorative life (rockets, koi, easter eggs): never on the reduced path
  if (!reduced) {
    import('./extras.js').then((m) => { state.scene.extras = m.createExtras(state.scene, Q); });
  }
});

/* resize guard: mobile URL-bar collapse fires resize with same width —
   re-laying the GL canvas for that just causes a visible hitch */
let lastW = innerWidth, lastH = innerHeight;
function onResize() {
  if (!state.scene) return;
  if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 130) return;
  lastW = innerWidth; lastH = innerHeight;
  state.scene.resize();
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

const docH = () => document.documentElement.scrollHeight - innerHeight;
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.audio.frame();

  // gyro folds into the same parallax bus as the pointer
  const g = gyro.target();
  state.gx += (g.x - state.gx) * 0.08;
  state.gy += (g.y - state.gy) * 0.08;
  const px = Math.max(-1.2, Math.min(1.2, state.px + state.gx * 0.8));
  const py = Math.max(-1.2, Math.min(1.2, state.py + state.gy * 0.6));

  if (state.scene) {
    state.scene.setScroll(docH() > 0 ? scrollY / docH() : 0);
    state.scene.frame(dt, state.audio, { px, py, cur: { x: state.gx, y: state.gy } });
    state.hand?.setMode(state.scene.mix);
  }
  if (state.hand) {
    if (!state.handsLive) state.hand.setIdle(now / 1000, px, py);
    state.hand.update(dt, state.audio.level);
  }
  state.faceField?.frame(dt, state.audio.mid, state.scene ? state.scene.mix : 0);
  state.ghost.x += (state.ghost.tx - state.ghost.x) * 0.16;
  state.ghost.y += (state.ghost.ty - state.ghost.y) * 0.16;
  ghost.style.transform = `translate(${state.ghost.x}px, ${state.ghost.y}px)`;
  if (state.orbit && nearViewport('#systems')) state.orbit.frame(state.audio.mid);
  if (state.bot) state.bot.frame(dt, state.audio.level, state.scene ? state.scene.mix : 0);
  governor.tick(dt);
  requestAnimationFrame(loop);
}
function nearViewport(sel) {
  const r = $(sel).getBoundingClientRect();
  return r.bottom > -100 && r.top < innerHeight + 100;
}
requestAnimationFrame(loop);

/* QA hook (harmless in production): lets tests drive the mode switch */
window.__fgg = { state, toggleOcean, quality: Q };
