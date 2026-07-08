/* DEEP RUNNER (v8): the site's arcade proper. Ten levels, a mid-boss at 5,
   a final boss at 10, powerups, one engine — two complete skins. Launched
   from the deck in Space Mode it plays as a starfighter run against the
   Static and THE INVENTOR PRIME; launched underwater every sprite, name,
   palette and backdrop changes: reef creatures, ink, THE LEVIATHAN.
   Canvas 2D, procedural pixel sprites with baked glow, zero assets.
   Keyboard (arrows/WASD + auto-fire) and drag/touch, pause on blur,
   Esc or ✕ returns to the site. All HUD text localized. */

import { t } from './i18n.js';

const W = 480, H = 680;

/* ---------- pixel sprites (original designs) ---------- */
const MAPS = {
  playerS: ['....w....', '...www...', '...gwg...', '..gwwwg..', '.gwwwwwg.', 'ggw.w.wgg', 'g..r.r..g'],
  playerO: ['...ccc....', '..cwwwc...', '.cwwwwcc..', 'ccwwwwwwt.', '.cwwwwcc..', '..cwwc....', '...f.f....'],
  driftS: ['..p..', '.ppp.', 'pp.pp', '.ppp.', '..p..'],
  driftO: ['.s.s.', 'sssss', 's.s.s', 'sssss', '.s.s.'],
  swoopS: ['d......', 'ddd....', 'dddddd.', 'ddddddd', 'dddddd.', 'ddd....', 'd......'],
  swoopO: ['b........', 'bbbb.....', 'bbbbbbbb.', 'wbbbbbbbb', 'bbbbbbbb.', 'bbbb.....', 'b........'],
  spiralS: ['..m..', '.mmm.', 'mm.mm', '.mmm.', '..m..'],
  spiralO: ['.jjj.', 'jjjjj', 'j.j.j', '.j.j.', 'j.j.j'],
  shootS: ['.ttt.', 'ttttt', 't.t.t', 'ttttt', '.t.t.'],
  shootO: ['...w.', '.aaa.', 'aaaaa', 'aa.aa', 'aaaaa'],
  mine: ['.x.x.', 'x.x.x', '.xxx.', 'x.x.x', '.x.x.'],
  bossMS: [
    '....gggggggg....', '..gg..gggg..gg..', '.g....gggg....g.',
    'gg.rr.gggg.rr.gg', 'gggggggggggggggg', '.ggggg.gg.ggggg.',
    '..ggg..gg..ggg..', '...g...gg...g...',
  ],
  bossMO: [
    '......aaaa......', '....aaaaaaaa....', '..aaaaaaaaaaaa..',
    '.aaw.aaaaaa.waa.', 'aaaaaaaaaaaaaaaa', '.aa.aaaaaa..aa..',
    '..a..aaaa..a....', '......ww........',
  ],
  bossFS: [
    '.....hhhhhh.....', '....hhhhhhhh....', '..dddddddddddd..',
    '.dd.gg.dd.gg.dd.', '.dddddddddddddd.', 'bbbbbbbbbbbbbbbb',
    'b.bbbbbbbbbbbb.b', '..ll........ll..', '..ll........ll..',
  ],
  bossFO: [
    '.....mmmmmm.....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..',
    '.mm.ww.mm.ww.mm.', 'mmmmmmmmmmmmmmmm', '.t.t.t.tt.t.t.t.',
    't.t.t.t..t.t.t.t', '.t...t....t...t.',
  ],
};

const SKIN = {
  space: {
    bg: '#03040a', ink: '#e9ecea', accent: '#59e8d5', hot: '#f2c14e', bad: '#ff7a5c',
    colors: {
      w: '#e9ecea', g: '#59e8d5', r: '#ffb27a', p: '#8b93a2', d: '#b9c2c6',
      m: '#c98bd4', t: '#7aa2ff', x: '#ff7a5c', h: '#14161c', b: '#3d4c6e', l: '#2a3040',
    },
    boss5: 'bossMS', boss10: 'bossFS',
  },
  ocean: {
    bg: '#02141b', ink: '#e8f6f4', accent: '#7df0e2', hot: '#f2c14e', bad: '#ff9d7a',
    colors: {
      w: '#f4f1ec', c: '#2f8f8a', t: '#1d4f47', f: '#16403c', s: '#d9a04f',
      b: '#4aa8c9', j: '#9cd4f0', a: '#6f5a9a', x: '#ff9d7a', m: '#6f5a9a',
    },
    boss5: 'bossMO', boss10: 'bossFO',
  },
};

/* levels 1–10: quota + allowed patterns + pacing; 5 and 10 are bosses */
const LEVELS = [
  { n: 12, types: ['drift'], rate: 1.15 },
  { n: 16, types: ['drift', 'swoop'], rate: 1.0 },
  { n: 20, types: ['drift', 'swoop', 'spiral'], rate: 0.9 },
  { n: 24, types: ['swoop', 'spiral', 'shoot'], rate: 0.82 },
  { boss: 5 },
  { n: 26, types: ['drift', 'spiral', 'shoot'], rate: 0.75 },
  { n: 30, types: ['swoop', 'spiral', 'shoot', 'miner'], rate: 0.68 },
  { n: 34, types: ['drift', 'swoop', 'shoot', 'miner'], rate: 0.6 },
  { n: 38, types: ['swoop', 'spiral', 'shoot', 'miner'], rate: 0.54 },
  { boss: 10 },
];

function bake(map, colors, scale, glow) {
  const c = document.createElement('canvas');
  const w = map[0].length * scale, h = map.length * scale;
  c.width = w + 24; c.height = h + 24;
  const g = c.getContext('2d');
  const draw = () => {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        if (ch === '.') continue;
        g.fillStyle = colors[ch] || '#fff';
        g.fillRect(12 + x * scale, 12 + y * scale, scale, scale);
      }
    }
  };
  if (glow) { g.shadowColor = glow; g.shadowBlur = 10; draw(); }
  g.shadowBlur = 0;
  draw();
  return c;
}

export function createRunner(themeOf) {
  /* ---------- layer DOM ---------- */
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="layer__bar">
      <span class="tag tag--teal" id="gl-name"></span>
      <span class="small num" id="gl-hud" role="status"></span>
      <button class="ctl layer-close" id="gl-close" aria-label="Close">✕</button>
    </div>
    <div class="layer__stage"><canvas id="gl-canvas" width="${W}" height="${H}"></canvas></div>
    <div class="layer__msg panel" id="gl-msg" hidden>
      <p class="tag" id="gl-msg-tag"></p>
      <h3 id="gl-msg-title"></h3>
      <p class="small" id="gl-msg-body"></p>
      <button class="btn btn--solid" id="gl-msg-btn"></button>
    </div>`;
  document.body.appendChild(layer);
  const $ = (s) => layer.querySelector(s);
  const cv = $('#gl-canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;

  /* ---------- state ---------- */
  let skin, sprites, open = false, raf = 0, last = 0, shake = 0;
  let lvlIdx = 0, phase = 'ready', score = 0, lives = 3, inv = 0, slow = 0;
  let spread = 0, shield = 0, fireT = 0, spawnT = 0, quota = 0, alive = 0;
  const player = { x: W / 2, y: H - 90, tx: W / 2, ty: H - 90, r: 12 };
  let boss = null;
  const bullets = [], ebullets = [], enemies = [], drops = [], parts = [];
  const keys = new Set();
  const bgDots = Array.from({ length: 70 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: 0.4 + Math.random() * 1.8, z: 0.3 + Math.random() * 0.7,
  }));

  function bakeAll() {
    const th = themeOf() === 'ocean' ? 'ocean' : 'space';
    skin = SKIN[th];
    const C = skin.colors, A = skin.accent;
    sprites = {
      player: bake(th === 'ocean' ? MAPS.playerO : MAPS.playerS, C, 3, A),
      drift: bake(th === 'ocean' ? MAPS.driftO : MAPS.driftS, C, 3, null),
      swoop: bake(th === 'ocean' ? MAPS.swoopO : MAPS.swoopS, C, 3, null),
      spiral: bake(th === 'ocean' ? MAPS.spiralO : MAPS.spiralS, C, 3, A),
      shoot: bake(th === 'ocean' ? MAPS.shootO : MAPS.shootS, C, 3, skin.bad),
      mine: bake(MAPS.mine, C, 3, skin.bad),
      boss5: bake(MAPS[skin.boss5], C, 5, A),
      boss10: bake(MAPS[skin.boss10], C, 6, skin.bad),
    };
    $('#gl-name').textContent = `${t('ui.playName')} · ${t(th === 'ocean' ? 'game.themeO' : 'game.themeS')}`;
  }

  /* ---------- helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  function burst(x, y, col, n = 14, sp = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(sp * 0.3, sp);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.7), col });
    }
  }
  function msg(tag, title, body, btn) {
    $('#gl-msg-tag').textContent = tag;
    $('#gl-msg-title').textContent = title;
    $('#gl-msg-body').textContent = body;
    $('#gl-msg-btn').textContent = btn;
    $('#gl-msg').hidden = false;
  }
  const hideMsg = () => { $('#gl-msg').hidden = true; };
  function hud() {
    const L = Math.min(lvlIdx + 1, 10);
    $('#gl-hud').textContent =
      `${t('game.lvl')} ${L}/10 · ${t('game.score')} ${score} · ${'♥'.repeat(Math.max(lives, 0))}`;
  }

  /* ---------- spawning ---------- */
  function spawnEnemy(type, sc) {
    const e = { type, hp: 1, r: 12, t: 0, dead: false };
    if (type === 'drift') {
      Object.assign(e, { x: rnd(30, W - 30), y: -20, vy: rnd(50, 80) * sc, amp: rnd(20, 60), hp: 1 });
    } else if (type === 'swoop') {
      const left = Math.random() > 0.5;
      Object.assign(e, { x: left ? -20 : W + 20, y: rnd(40, 220), dir: left ? 1 : -1, vx: rnd(120, 170) * sc, hp: 1 });
    } else if (type === 'spiral') {
      Object.assign(e, { x: rnd(60, W - 60), y: -20, vy: rnd(46, 60) * sc, rad: rnd(30, 70), hp: 2 });
    } else if (type === 'shoot') {
      Object.assign(e, { x: rnd(40, W - 40), y: -20, ty: rnd(60, 170), vy: 60 * sc, fire: rnd(0.8, 1.6), hp: 3, r: 13 });
    } else if (type === 'miner') {
      const left = Math.random() > 0.5;
      Object.assign(e, { x: left ? -24 : W + 24, y: rnd(50, 140), dir: left ? 1 : -1, vx: 90 * sc, drop: 0.9, hp: 3, r: 14 });
    } else if (type === 'mine') {
      Object.assign(e, { vy: 34 * sc, hp: 1, r: 9 });
    }
    enemies.push(e);
    return e;
  }

  function makeBoss(final) {
    boss = {
      final, x: W / 2, y: -80, ty: 110, t: 0, phase: 0,
      hp: final ? 130 : 70, hpMax: final ? 130 : 70,
      r: final ? 46 : 40, dead: false,
      name: t(final ? (skin === SKIN.ocean ? 'game.bossFO' : 'game.bossFS')
                    : (skin === SKIN.ocean ? 'game.bossMO' : 'game.bossMS')),
    };
  }

  function startLevel() {
    const conf = LEVELS[lvlIdx];
    bullets.length = ebullets.length = enemies.length = drops.length = 0;
    boss = null;
    if (conf.boss) makeBoss(conf.boss === 10);
    else { quota = conf.n; alive = 0; spawnT = 0.5; }
    phase = 'run';
    hideMsg();
    hud();
  }

  /* ---------- combat ---------- */
  function fire(dt) {
    fireT -= dt;
    if (fireT > 0) return;
    fireT = 0.16;
    const mk = (vx) => bullets.push({ x: player.x, y: player.y - 14, vx, vy: -520, r: 3 });
    mk(0);
    if (spread > 0) { mk(-140); mk(140); }
  }
  function eShot(x, y, tx, ty, sp = 180) {
    const d = Math.hypot(tx - x, ty - y) || 1;
    ebullets.push({ x, y, vx: (tx - x) / d * sp, vy: (ty - y) / d * sp, r: 4 });
  }
  function hitPlayer() {
    if (inv > 0) return;
    if (shield > 0) { shield = 0; burst(player.x, player.y, skin.accent, 18); inv = 0.8; return; }
    lives--;
    hud();
    burst(player.x, player.y, skin.bad, 26, 220);
    shake = 0.5;
    inv = 1.6;
    if (lives <= 0) {
      phase = 'over';
      msg(t('game.overTag'), t('game.overT'), `${t('game.score')} ${score}`, t('game.retry'));
    }
  }
  function killEnemy(e, i) {
    enemies.splice(i, 1);
    score += e.type === 'mine' ? 5 : 15;
    alive--;
    burst(e.x, e.y, skin.accent, 12);
    if (Math.random() < 0.1) {
      const kind = ['S', 'H', 'T'][Math.floor(Math.random() * 3)];
      drops.push({ x: e.x, y: e.y, vy: 60, kind, r: 10 });
    }
    hud();
  }

  /* ---------- per-frame ---------- */
  function step(dt) {
    const sc = 1 + lvlIdx * 0.07;
    const es = slow > 0 ? 0.45 : 1;
    inv = Math.max(0, inv - dt);
    slow = Math.max(0, slow - dt);
    spread = Math.max(0, spread - dt);
    shake = Math.max(0, shake - dt * 1.6);

    // player steering: keys push the target, drag sets it
    const KV = 340;
    if (keys.has('left')) player.tx -= KV * dt;
    if (keys.has('right')) player.tx += KV * dt;
    if (keys.has('up')) player.ty -= KV * dt;
    if (keys.has('down')) player.ty += KV * dt;
    player.tx = Math.max(20, Math.min(W - 20, player.tx));
    player.ty = Math.max(H * 0.4, Math.min(H - 30, player.ty));
    player.x += (player.tx - player.x) * Math.min(dt * 14, 1);
    player.y += (player.ty - player.y) * Math.min(dt * 14, 1);
    fire(dt);

    // spawn flow
    const conf = LEVELS[lvlIdx];
    if (!conf.boss && quota > 0) {
      spawnT -= dt;
      if (spawnT <= 0 && alive < 9) {
        spawnT = conf.rate;
        quota--;
        alive++;
        spawnEnemy(conf.types[Math.floor(Math.random() * conf.types.length)], sc);
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t += dt * es;
      if (e.type === 'drift') {
        e.y += e.vy * dt * es;
        e.x += Math.sin(e.t * 2.2) * e.amp * dt;
      } else if (e.type === 'swoop') {
        e.x += e.dir * e.vx * dt * es;
        e.y += Math.sin(e.t * 3) * 60 * dt + 26 * dt;
      } else if (e.type === 'spiral') {
        e.y += e.vy * dt * es;
        e.x += Math.cos(e.t * 3.4) * e.rad * dt;
      } else if (e.type === 'shoot') {
        if (e.y < e.ty) e.y += e.vy * dt * es;
        else {
          e.fire -= dt * es;
          if (e.fire <= 0) { e.fire = rnd(1.1, 1.9) / sc; eShot(e.x, e.y, player.x, player.y, 200 * sc); }
        }
      } else if (e.type === 'miner') {
        e.x += e.dir * e.vx * dt * es;
        e.drop -= dt * es;
        if (e.drop <= 0) { e.drop = 0.9; alive++; quota = Math.max(quota, 0); spawnEnemy('mine', sc); enemies[enemies.length - 1].x = e.x; enemies[enemies.length - 1].y = e.y + 14; }
      } else if (e.type === 'mine') {
        e.y += e.vy * dt * es;
      }
      // out of bounds
      if (e.y > H + 30 || e.x < -40 || e.x > W + 40) { enemies.splice(i, 1); alive--; continue; }
      // collide with player
      if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) {
        killEnemy(e, i);
        hitPlayer();
        continue;
      }
    }

    // boss logic
    if (boss && !boss.dead) {
      boss.t += dt * es;
      if (boss.y < boss.ty) boss.y += 60 * dt;
      boss.x = W / 2 + Math.sin(boss.t * (boss.final ? 0.9 : 0.7)) * (W / 2 - 90);
      const cadence = boss.final ? 1.1 : 1.5;
      boss.phase += dt * es;
      if (boss.phase > cadence) {
        boss.phase = 0;
        if (boss.final) {
          for (let k = -2; k <= 2; k++) eShot(boss.x + k * 14, boss.y + 30, player.x + k * 40, player.y, 230);
        } else {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + boss.t;
            ebullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 150, vy: Math.abs(Math.sin(a)) * 150 + 40, r: 4 });
          }
        }
      }
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.r) hitPlayer();
    }

    // player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20) { bullets.splice(i, 1); continue; }
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          e.hp--;
          hit = true;
          if (e.hp <= 0) killEnemy(e, j);
          else burst(b.x, b.y, skin.ink, 3, 60);
          break;
        }
      }
      if (!hit && boss && !boss.dead && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.r) {
        boss.hp--;
        hit = true;
        burst(b.x, b.y, skin.hot, 3, 80);
        if (boss.hp <= 0) {
          boss.dead = true;
          score += boss.final ? 500 : 200;
          burst(boss.x, boss.y, skin.hot, 60, 300);
          shake = 1;
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    // enemy bullets
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt * es; b.y += b.vy * dt * es;
      if (b.y > H + 20 || b.x < -20 || b.x > W + 20) { ebullets.splice(i, 1); continue; }
      if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r - 2) {
        ebullets.splice(i, 1);
        hitPlayer();
      }
    }

    // drops
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      if (d.y > H + 20) { drops.splice(i, 1); continue; }
      if (Math.hypot(d.x - player.x, d.y - player.y) < d.r + player.r) {
        if (d.kind === 'S') spread = 10;
        else if (d.kind === 'H') shield = 1;
        else slow = 4;
        burst(d.x, d.y, skin.hot, 10, 120);
        drops.splice(i, 1);
      }
    }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    }

    // level complete?
    if (phase === 'run') {
      const done = conf.boss ? (boss && boss.dead && parts.length < 10)
                             : (quota <= 0 && enemies.length === 0);
      if (done) {
        lvlIdx++;
        if (lvlIdx >= LEVELS.length) {
          phase = 'win';
          msg(t('game.winTag'), t('game.winT'), t('game.winB').replace('{score}', score), t('game.again'));
        } else {
          phase = 'ready';
          msg(t('game.lvlTag'), `${t('game.lvl')} ${lvlIdx + 1}`, t('game.lvlB'), t('game.go'));
        }
      }
    }
  }

  /* ---------- draw ---------- */
  function draw(now) {
    const oceanTh = skin === SKIN.ocean;
    g.fillStyle = skin.bg;
    g.fillRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * shake * 10;
    const sy = (Math.random() - 0.5) * shake * 10;
    g.save();
    g.translate(sx, sy);

    // backdrop: scrolling stars / rising bubbles + shafts
    for (const d of bgDots) {
      d.y += (oceanTh ? -22 : 46) * d.z * 0.016;
      if (d.y > H) d.y -= H;
      if (d.y < 0) d.y += H;
      g.fillStyle = oceanTh ? 'rgba(125,240,226,0.35)' : 'rgba(233,236,234,0.5)';
      g.globalAlpha = d.z;
      if (oceanTh) { g.beginPath(); g.arc(d.x, d.y, d.s, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(d.x, d.y, d.s, d.s + (d.z > 0.7 ? 2 : 0));
    }
    g.globalAlpha = 1;
    if (oceanTh) {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(125,240,226,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    // drops
    for (const d of drops) {
      g.fillStyle = skin.hot;
      g.strokeStyle = skin.hot;
      g.strokeRect(d.x - 8, d.y - 8, 16, 16);
      g.font = '10px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.fillText(d.kind, d.x, d.y + 4);
    }

    // entities
    const blit = (spr, x, y) => g.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
    for (const e of enemies) blit(sprites[e.type === 'miner' ? 'shoot' : e.type] || sprites.mine, e.x, e.y);
    if (boss && !boss.dead) {
      blit(sprites[boss.final ? 'boss10' : 'boss5'], boss.x, boss.y);
      // boss bar
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(60, 26, W - 120, 6);
      g.fillStyle = skin.bad;
      g.fillRect(60, 26, (W - 120) * (boss.hp / boss.hpMax), 6);
      g.fillStyle = skin.ink;
      g.font = '10px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.fillText(boss.name, W / 2, 20);
    }

    if (inv <= 0 || (now / 90 | 0) % 2 === 0) blit(sprites.player, player.x, player.y);
    if (shield > 0) {
      g.strokeStyle = skin.accent;
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(player.x, player.y, 20, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // bullets
    g.fillStyle = skin.accent;
    for (const b of bullets) g.fillRect(b.x - 1.5, b.y - 6, 3, 10);
    g.fillStyle = skin.bad;
    for (const b of ebullets) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); }

    // particles
    for (const p of parts) {
      g.globalAlpha = Math.max(p.life * 1.6, 0);
      g.fillStyle = p.col;
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;

    if (slow > 0) {
      g.fillStyle = 'rgba(122,162,255,0.06)';
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  /* ---------- loop / lifecycle ---------- */
  function loop(now) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;
    if (document.hidden) return;
    if (phase === 'run') step(dt);
    draw(now);
  }

  function reset(full) {
    if (full) { lvlIdx = 0; score = 0; lives = 3; }
    spread = shield = slow = 0;
    inv = 1;
    player.x = player.tx = W / 2;
    player.y = player.ty = H - 90;
    bullets.length = ebullets.length = enemies.length = drops.length = parts.length = 0;
  }

  $('#gl-msg-btn').addEventListener('click', () => {
    if (phase === 'over' || phase === 'win') { reset(true); phase = 'ready'; msg(t('game.lvlTag'), `${t('game.lvl')} 1`, t('game.lvlB'), t('game.go')); return; }
    reset(false);
    startLevel();
  });
  $('#gl-close').addEventListener('click', () => close());

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape') { close(); return; }
    const d = KEYMAP[e.code];
    if (d) { e.preventDefault(); e.type === 'keydown' ? keys.add(d) : keys.delete(d); }
    if (e.code === 'Space' && e.type === 'keydown' && !$('#gl-msg').hidden) $('#gl-msg-btn').click();
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);

  // drag / touch steering
  let dragging = false;
  const toGame = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); const p = toGame(e); player.tx = p.x; player.ty = p.y; });
  cv.addEventListener('pointermove', (e) => { if (!dragging) return; const p = toGame(e); player.tx = p.x; player.ty = p.y; });
  cv.addEventListener('pointerup', () => { dragging = false; });

  let prevFocus = null;
  function openLayer() {
    bakeAll();
    layer.hidden = false;
    open = true;
    prevFocus = document.activeElement;
    document.querySelectorAll('header, main, .gauge, .bot, .skip-link, #guide').forEach((el) => { el.inert = true; });
    $('#gl-close').focus();
    last = performance.now();
    if (phase === 'ready' && lvlIdx === 0 && score === 0) {
      msg(t('game.lvlTag'), `${t('game.lvl')} 1`, t('game.lvlB'), t('game.go'));
    }
    hud();
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
