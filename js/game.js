/* Past Lives Arcade: an 8-bit starfield chart of the journey.
   Fly the ship into a beacon to dock and read its log.
   Pure canvas 2D, no assets; sprites are bitmaps drawn here. */

import { ZONES } from './data.js';

const T = 32, W = 24, H = 16; // tile grid → 768x512 backing store

const SHIP = [
  '....1....',
  '...111...',
  '...121...',
  '..11111..',
  '.1112111.',
  '111121111',
  '1.11111.1',
  '...3.3...',
];

export function startGame(canvas) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const status = document.getElementById('game-status');
  const card = document.getElementById('zone-card');
  const cardTag = document.getElementById('zone-tag');
  const cardName = document.getElementById('zone-name');
  const cardStory = document.getElementById('zone-story');

  /* static starfield + scanline overlay, drawn once */
  const bg = document.createElement('canvas');
  bg.width = W * T; bg.height = H * T;
  const bgc = bg.getContext('2d');
  bgc.fillStyle = '#03040a';
  bgc.fillRect(0, 0, bg.width, bg.height);
  let s = 9;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 260; i++) {
    const b = rnd();
    bgc.fillStyle = b > 0.9 ? '#9cfff1' : b > 0.55 ? '#8b93a2' : '#3c4254';
    bgc.fillRect((rnd() * bg.width) | 0, (rnd() * bg.height) | 0, 2, 2);
  }
  for (let y = 0; y < bg.height; y += 4) {
    bgc.fillStyle = 'rgba(0,0,0,0.16)';
    bgc.fillRect(0, y, bg.width, 1);
  }

  const beacons = ZONES.map((z) => ({ ...z, px: z.x * T + T / 2, py: z.y * T + T / 2, seen: false }));
  const player = { x: 1.5 * T, y: 13.5 * T, vx: 0, vy: 0 };
  const keys = new Set();
  let docked = null, t = 0, last = performance.now();

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const inView = () => {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };
  addEventListener('keydown', (e) => {
    if (!inView() || e.target.matches('input, textarea')) return;
    const d = KEYMAP[e.code];
    if (d) { keys.add(d); if (e.code.startsWith('Arrow')) e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { const d = KEYMAP[e.code]; if (d) keys.delete(d); });

  /* touch d-pad */
  document.querySelectorAll('#dpad button').forEach((b) => {
    const d = b.dataset.d;
    const on = (e) => { e.preventDefault(); keys.add(d); };
    const off = () => keys.delete(d);
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });

  /* closed-fist lateral gesture steers the ship while the arcade is on screen */
  addEventListener('fist-move', (e) => {
    if (!inView()) return;
    player.vx += e.detail.dir * 130;
  });

  function px(mx, my, map, scale, colors) {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const c = map[y][x];
        if (c !== '.') {
          g.fillStyle = colors[c];
          g.fillRect(mx + x * scale, my + y * scale, scale, scale);
        }
      }
    }
  }

  function drawBeacon(b) {
    const blink = (Math.sin(t * 3 + b.px) + 1) / 2;
    // pylon
    g.fillStyle = '#20242e';
    g.fillRect(b.px - 3, b.py - 2, 6, 14);
    g.fillStyle = '#161a22';
    g.fillRect(b.px - 8, b.py + 10, 16, 4);
    // beacon head
    g.fillStyle = b.hue;
    g.globalAlpha = b.seen ? 0.55 : 0.75 + blink * 0.25;
    g.fillRect(b.px - 5, b.py - 12, 10, 10);
    g.globalAlpha = 1;
    // halo ring when near
    const d = Math.hypot(player.x - b.px, player.y - b.py);
    if (d < 90) {
      g.strokeStyle = b.hue;
      g.globalAlpha = 0.5 - d / 220;
      g.strokeRect(b.px - 14, b.py - 20, 28, 26);
      g.globalAlpha = 1;
    }
    // label
    g.fillStyle = d < 120 ? '#e9ecea' : '#6d7683';
    g.font = '8px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillText(b.name.toUpperCase(), b.px, b.py + 24);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!inView()) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    const acc = 620, damp = 0.86, max = 220;
    if (keys.has('up')) player.vy -= acc * dt;
    if (keys.has('down')) player.vy += acc * dt;
    if (keys.has('left')) player.vx -= acc * dt;
    if (keys.has('right')) player.vx += acc * dt;
    player.vx = Math.max(-max, Math.min(max, player.vx)) * damp;
    player.vy = Math.max(-max, Math.min(max, player.vy)) * damp;
    player.x = Math.max(12, Math.min(W * T - 12, player.x + player.vx * dt));
    player.y = Math.max(12, Math.min(H * T - 12, player.y + player.vy * dt));

    /* docking */
    let near = null;
    for (const b of beacons) {
      if (Math.hypot(player.x - b.px, player.y - b.py) < 30) { near = b; break; }
    }
    if (near && docked !== near) {
      docked = near; near.seen = true;
      cardTag.textContent = `LOG · ${near.id.toUpperCase()}`;
      cardName.textContent = near.name;
      cardStory.textContent = near.story;
      card.hidden = false;
      status.textContent = `Docked at ${near.name} · fly away to release`;
    } else if (!near && docked) {
      docked = null;
      card.hidden = true;
      const seen = beacons.filter((b) => b.seen).length;
      status.textContent = seen === beacons.length
        ? 'Every log read. One of them holds the moon date.'
        : `Beacons logged: ${seen}/${beacons.length} · arrows / WASD to fly`;
    }

    /* draw */
    g.drawImage(bg, 0, 0);
    beacons.forEach(drawBeacon);
    const flick = Math.random() > 0.5 ? '#c9814f' : '#ffd9a0';
    px(player.x - 13, player.y - 12, SHIP, 3, { 1: '#e9ecea', 2: '#59e8d5', 3: flick });
  }
  requestAnimationFrame(loop);
  return {};
}
