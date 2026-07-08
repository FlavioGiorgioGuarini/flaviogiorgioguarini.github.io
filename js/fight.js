/* STICKMAN: YOU vs THE LARPERS (v8). A stylized side-view brawl with a
   scripted arc: you hold the line against waves of foam-sword larpers,
   the third wave overwhelms you down to exactly 1 HP — and Flavio arrives.
   One original technique (a grounded fist-slam that detonates expanding
   depth-rings), the larpers dissolve to ash, and a motivational line in
   the visitor's language closes the scene. Shonen energy, zero borrowed
   moves. Canvas 2D lines, keyboard + touch, Esc returns to the site.
   The skin follows the active world: dojo under stars or on the seabed. */

import { t } from './i18n.js';

const W = 720, H = 400, FLOOR = H - 56;

export function createFight(themeOf) {
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="layer__bar">
      <span class="tag tag--teal" id="fl-name"></span>
      <span class="small num" id="fl-hud" role="status"></span>
      <button class="ctl layer-close" id="fl-close" aria-label="Close">✕</button>
    </div>
    <div class="layer__stage layer__stage--wide"><canvas id="fl-canvas" width="${W}" height="${H}"></canvas></div>
    <p class="small layer__hint" id="fl-hint"></p>
    <div class="layer__msg panel" id="fl-msg" hidden>
      <p class="tag tag--teal" id="fl-msg-tag"></p>
      <h3 id="fl-msg-title"></h3>
      <p class="small" id="fl-msg-body"></p>
      <button class="btn btn--solid" id="fl-msg-btn"></button>
    </div>`;
  document.body.appendChild(layer);
  const $ = (s) => layer.querySelector(s);
  const cv = $('#fl-canvas'), g = cv.getContext('2d');

  let open = false, raf = 0, last = 0, tt = 0, state = 'run', wave = 1, shake = 0, flash = 0;
  const P = { x: 140, vx: 0, hp: 100, face: 1, punch: 0, hurt: 0, walk: 0 };
  let larpers = [], ash = [], rings = [];
  const F = { x: W + 60, active: false, t: 0 };   // Flavio
  const keys = new Set();

  const ocean = () => themeOf() === 'ocean';

  /* ---------- cast ---------- */
  function spawnLarper(side) {
    larpers.push({
      x: side > 0 ? W + 20 + Math.random() * 60 : -20 - Math.random() * 60,
      hp: 3, face: -side, wind: 0, swing: 0, hurt: 0, walk: Math.random() * 6,
      dead: false,
    });
  }
  function startWave(n) {
    wave = n;
    for (let i = 0; i < 2 + n; i++) spawnLarper(i % 2 === 0 ? 1 : -1);
    hud();
  }

  function hud() {
    $('#fl-hud').textContent =
      `${t('fight.wave')} ${wave}/3 · HP ${Math.max(P.hp, 0)}`;
  }

  /* ---------- stick figures ---------- */
  function stick(x, y, face, opts) {
    const { col = '#e9ecea', walk = 0, punch = 0, wind = 0, glow = 0, coat = false, dead = 0 } = opts;
    g.save();
    g.translate(x, y);
    if (dead) g.rotate(face * dead * 1.5);
    g.scale(face, 1);
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.lineCap = 'round';
    if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
    const leg = Math.sin(walk) * 7;
    g.beginPath();
    // legs
    g.moveTo(0, -16); g.lineTo(-5 + leg, 0);
    g.moveTo(0, -16); g.lineTo(5 - leg, 0);
    // torso
    g.moveTo(0, -16); g.lineTo(0, -34);
    // arms: rest / windup / punch
    const ext = punch > 0 ? 14 * Math.sin(Math.min(punch * 6, Math.PI)) : 0;
    g.moveTo(0, -30); g.lineTo(10 + ext, -30 + (wind ? -6 : 0));
    g.moveTo(0, -30); g.lineTo(-8, -22);
    if (coat) { g.moveTo(-2, -16); g.lineTo(-7, -2); g.moveTo(2, -16); g.lineTo(8, -3); }
    g.stroke();
    // head
    g.beginPath();
    g.arc(0, -40, 6, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function label(x, y, txt, col) {
    g.fillStyle = col;
    g.font = '9px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillText(txt.toUpperCase(), x, y);
  }

  /* ---------- the rescue ---------- */
  function triggerRescue() {
    if (state !== 'run') return;
    state = 'rescue';
    P.hp = 1;
    hud();
    F.active = true;
    F.x = W + 60;
    F.t = 0;
  }

  function endScene() {
    state = 'end';
    msg(t('fight.saveTag'), t('fight.techName'), t('fight.endLine'), t('fight.again'));
  }

  function msg(tag, title, body, btn) {
    $('#fl-msg-tag').textContent = tag;
    $('#fl-msg-title').textContent = title;
    $('#fl-msg-body').textContent = body;
    $('#fl-msg-btn').textContent = btn;
    $('#fl-msg').hidden = false;
  }

  /* ---------- step ---------- */
  function step(dt) {
    tt += dt;
    shake = Math.max(0, shake - dt * 2);
    flash = Math.max(0, flash - dt * 2.4);
    P.punch = Math.max(0, P.punch - dt);
    P.hurt = Math.max(0, P.hurt - dt);

    if (state === 'run') {
      // player input
      P.vx = 0;
      if (keys.has('left')) { P.vx = -170; P.face = -1; }
      if (keys.has('right')) { P.vx = 170; P.face = 1; }
      P.x = Math.max(24, Math.min(W - 24, P.x + P.vx * dt));
      P.walk += Math.abs(P.vx) * dt * 0.09;

      // larpers AI
      let aliveN = 0;
      for (const L of larpers) {
        if (L.dead) continue;
        aliveN++;
        L.hurt = Math.max(0, L.hurt - dt);
        L.swing = Math.max(0, L.swing - dt);
        const d = P.x - L.x;
        L.face = d > 0 ? 1 : -1;
        if (Math.abs(d) > 34) {
          const sp = (52 + wave * 16) * (L.hurt > 0 ? 0.3 : 1);
          L.x += Math.sign(d) * sp * dt;
          L.walk += sp * dt * 0.09;
        } else if (L.wind <= 0 && L.swing <= 0) {
          L.wind = 0.42;
        }
        if (L.wind > 0) {
          L.wind -= dt;
          if (L.wind <= 0) {
            L.swing = 0.3;
            if (Math.abs(P.x - L.x) < 40 && P.hurt <= 0) {
              const dmg = 6 + wave * 2;
              P.hp -= dmg;
              P.hurt = 0.5;
              shake = 0.4;
              hud();
              if (P.hp <= 1) { triggerRescue(); return; }
            }
          }
        }
      }

      // punch resolution
      if (P.punch > 0.12) {
        for (const L of larpers) {
          if (L.dead || L.hurt > 0) continue;
          const d = (L.x - P.x) * P.face;
          if (d > 0 && d < 46 && Math.abs(L.x - P.x) < 46) {
            L.hp--;
            L.hurt = 0.4;
            L.x += P.face * 26;
            shake = Math.max(shake, 0.15);
            if (L.hp <= 0) { L.dead = true; L.deadT = 0; }
          }
        }
      }
      for (const L of larpers) if (L.dead) L.deadT = (L.deadT || 0) + dt;
      larpers = larpers.filter((L) => !L.dead || L.deadT < 1.2);

      // wave flow: waves 1–2 are winnable; wave 3 is designed to drown you
      if (aliveN === 0) startWave(wave < 3 ? wave + 1 : 3);
      if (wave === 3 && aliveN > 0 && aliveN < 4 && Math.random() < dt * 0.9) {
        spawnLarper(Math.random() > 0.5 ? 1 : -1);   // the swarm never thins
      }
    }

    if (state === 'rescue') {
      F.t += dt;
      // larpers freeze mid-strut, then turn to the newcomer
      if (F.t < 1.6) {
        F.x += (P.x + 120 - F.x) * Math.min(dt * 3.2, 1);
      } else if (F.t < 2.2) {
        // the slam: one frame of stillness, then the detonation
        if (rings.length === 0) {
          rings.push({ r: 8, w: 5 }, { r: 2, w: 3.4 }, { r: 0, w: 2.2 });
          flash = 1;
          shake = 1;
        }
      } else if (F.t < 4.6) {
        for (const R of rings) R.r += dt * 420 * (1 + R.w * 0.1);
        for (const L of larpers) {
          if (!L.dead && Math.abs(L.x - F.x) < rings[0].r) {
            L.dead = true;
            for (let i = 0; i < 16; i++) {
              ash.push({
                x: L.x + (Math.random() - 0.5) * 14, y: FLOOR - Math.random() * 44,
                vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 70,
                life: 0.9 + Math.random() * 0.8,
              });
            }
          }
        }
      } else {
        endScene();
      }
    }

    for (let i = ash.length - 1; i >= 0; i--) {
      const a = ash[i];
      a.life -= dt;
      if (a.life <= 0) { ash.splice(i, 1); continue; }
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.vy += 30 * dt;
    }
  }

  /* ---------- draw ---------- */
  function draw() {
    const oc = ocean();
    g.fillStyle = oc ? '#02141b' : '#03040a';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    // backdrop: stars or seabed light
    g.fillStyle = oc ? 'rgba(125,240,226,0.25)' : 'rgba(233,236,234,0.4)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 97.3) % W, y = (i * 53.7) % (FLOOR - 60);
      g.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    // floor
    g.strokeStyle = oc ? '#0f3f43' : '#20242e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, FLOOR + 8);
    g.lineTo(W, FLOOR + 8);
    g.stroke();
    if (oc) {
      g.fillStyle = '#0a2a30';
      for (let i = 0; i < 8; i++) g.fillRect(30 + i * 92, FLOOR + 2, 26, 6);
    }

    // depth-rings (the technique)
    for (const R of rings) {
      if (R.r <= 0) continue;
      g.strokeStyle = oc ? 'rgba(125,240,226,0.8)' : 'rgba(89,232,213,0.8)';
      g.lineWidth = R.w;
      g.globalAlpha = Math.max(0, 1 - R.r / (W * 0.9));
      g.beginPath();
      g.arc(F.x, FLOOR - 8, R.r, Math.PI, 0);
      g.stroke();
    }
    g.globalAlpha = 1;

    // cast
    for (const L of larpers) {
      const col = L.hurt > 0 ? '#ffffff' : '#8b93a2';
      stick(L.x, FLOOR, L.face, { col, walk: L.walk, wind: L.wind > 0, punch: L.swing, dead: L.dead ? Math.min(L.deadT ?? 0, 1) : 0 });
      // foam sword
      if (!L.dead) {
        g.strokeStyle = '#9a8f7c';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(L.x + L.face * 10, FLOOR - 30);
        g.lineTo(L.x + L.face * (L.wind > 0 ? 20 : 26), FLOOR - (L.wind > 0 ? 44 : 30));
        g.stroke();
        label(L.x, FLOOR - 54, t('fight.larper'), 'rgba(139,147,162,0.8)');
      }
    }
    stick(P.x, FLOOR, P.face, { col: P.hurt > 0 ? '#ff9d7a' : '#e9ecea', walk: P.walk, punch: P.punch });
    label(P.x, FLOOR - 54, t('fight.you'), '#e9ecea');
    if (F.active) {
      stick(F.x, FLOOR, -1, { col: oc ? '#7df0e2' : '#59e8d5', glow: 14, coat: true, punch: F.t > 1.6 && F.t < 2.4 ? 0.2 : 0 });
      label(F.x, FLOOR - 58, 'Flavio Giorgio Guarini', oc ? '#7df0e2' : '#59e8d5');
    }

    // HP bar
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(20, 16, 180, 6);
    g.fillStyle = P.hp > 30 ? '#59e8d5' : '#ff9d7a';
    g.fillRect(20, 16, 180 * Math.max(P.hp, 0) / 100, 6);

    if (flash > 0) {
      g.fillStyle = `rgba(240,255,252,${flash * 0.85})`;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = oc ? 'rgba(60,120,140,0.5)' : 'rgba(60,70,90,0.45)';
    for (const a of ash) g.fillRect(a.x, a.y, 2, 2);
    g.restore();
  }

  /* ---------- loop / lifecycle ---------- */
  function loop(now) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;
    if (document.hidden || state === 'end') { draw(); return; }
    step(dt);
    draw();
  }

  function reset() {
    P.x = 140; P.hp = 100; P.punch = P.hurt = 0; P.face = 1;
    larpers = []; ash = []; rings = [];
    F.active = false; F.t = 0;
    state = 'run';
    $('#fl-msg').hidden = true;
    startWave(1);
  }

  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape') { close(); return; }
    const d = KEYMAP[e.code];
    if (d) { e.preventDefault(); e.type === 'keydown' ? keys.add(d) : keys.delete(d); }
    if (e.type === 'keydown' && (e.code === 'KeyX' || e.code === 'KeyJ' || e.code === 'Space')) {
      e.preventDefault();
      if (state === 'run' && P.punch <= 0) P.punch = 0.3;
    }
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);

  /* touch: hold a side to walk, tap to punch */
  let touchT = 0;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    touchT = performance.now();
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    keys.add(x < 0.5 ? 'left' : 'right');
  });
  const releaseTouch = () => {
    keys.delete('left'); keys.delete('right');
    if (performance.now() - touchT < 220 && state === 'run' && P.punch <= 0) P.punch = 0.3;
  };
  cv.addEventListener('pointerup', releaseTouch);
  cv.addEventListener('pointercancel', releaseTouch);

  $('#fl-close').addEventListener('click', () => close());
  $('#fl-msg-btn').addEventListener('click', reset);

  let prevFocus = null;
  function openLayer() {
    $('#fl-name').textContent = t('ui.fightName');
    $('#fl-hint').textContent = t('fight.hint');
    layer.hidden = false;
    open = true;
    prevFocus = document.activeElement;
    document.querySelectorAll('header, main, .gauge, .bot, .skip-link, #guide').forEach((el) => { el.inert = true; });
    $('#fl-close').focus();
    last = performance.now();
    reset();
    raf = requestAnimationFrame(loop);
  }
  function close() {
    if (layer.hidden) return false;
    layer.hidden = true;
    open = false;
    cancelAnimationFrame(raf);
    document.querySelectorAll('header, main, .gauge, .bot, .skip-link, #guide').forEach((el) => { el.inert = false; });
    prevFocus?.focus();
    return true;
  }

  return { open: openLayer, close };
}
