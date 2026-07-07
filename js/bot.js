/* CAERUS: mission companion. Original slab-monolith design (four floating
   segments) in space; underwater it becomes MEDUSA — a bioluminescent
   jellyfish (pulsing bell, swaying tentacles) — same mind, second body.
   Voice in and out via the Web Speech API. Two brains:
   - on-device intent engine (always available, zero network) and
   - optional grounded LLM (ai-config.js key) locked to the public KB.
   The LLM path degrades to the local answer on any error or timeout. */

import * as THREE from '../vendor/three/three.module.min.js';
import { age } from './data.js';
import { I18N, BOT_KEYS, VOICE, t, lang } from './i18n.js';
import { AI } from './ai-config.js';
import { kbText } from './kb.js';

export function startBot({ canvas }) {
  /* ---------- the little monolith ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(168, 168, false);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  cam.position.set(0, 0.25, 6.4);

  const group = new THREE.Group();
  scene.add(group);
  const slabGeo = new THREE.BoxGeometry(0.42, 2.35, 0.62);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.34, metalness: 0.85 });
  const stripeGeo = new THREE.BoxGeometry(0.05, 0.62, 0.05);
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x0c2825, emissive: 0x59e8d5, emissiveIntensity: 1.4,
  });
  const slabs = [];
  [-0.72, -0.24, 0.24, 0.72].forEach((x, i) => {
    const s = new THREE.Mesh(slabGeo, slabMat);
    s.position.x = x;
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, i === 1 ? 0.55 : -0.25 - i * 0.12, 0.34);
    s.add(stripe);
    group.add(s);
    slabs.push(s);
  });
  scene.add(new THREE.DirectionalLight(0xf2ede2, 2.4).translateX(-3).translateY(4).translateZ(5));
  const teal = new THREE.PointLight(0x59e8d5, 6, 8);
  teal.position.set(0, -1, 2.5);
  scene.add(teal);
  scene.add(new THREE.AmbientLight(0x202226, 1.6));

  /* ---------- MEDUSA: the underwater body ---------- */
  const jelly = new THREE.Group();
  jelly.scale.setScalar(0.001);
  scene.add(jelly);
  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0x2f8f8a, transparent: true, opacity: 0.6,
    roughness: 0.25, metalness: 0, clearcoat: 0.8,
    emissive: 0x59e8d5, emissiveIntensity: 0.35,
    sheen: 1, sheenColor: new THREE.Color(0x9cfff1), sheenRoughness: 0.4,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    bellMat,
  );
  bell.position.y = 0.5;
  jelly.add(bell);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.05, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0x0c2825, emissive: 0x9cfff1, emissiveIntensity: 1.2 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.14;
  jelly.add(rim);
  /* tentacles: 7 swaying lines + 2 oral arms, rebuilt on the CPU (cheap) */
  const TSEG = 9, tentacles = [];
  const tentMat = new THREE.LineBasicMaterial({
    color: 0x7df0e2, transparent: true, opacity: 0.65,
  });
  for (let i = 0; i < 9; i++) {
    const oral = i >= 7;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array((TSEG + 1) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const line = new THREE.Line(geo, tentMat);
    const a = (i / 7) * Math.PI * 2;
    tentacles.push({
      line, arr, geo,
      x0: oral ? (i === 7 ? -0.16 : 0.16) : Math.cos(a) * 0.86,
      z0: oral ? 0 : Math.sin(a) * 0.86,
      len: oral ? 2.6 : 1.9,
      ph: Math.random() * 6.28,
    });
    jelly.add(line);
  }

  let bt = 0, talking = 0, listening = false, mode = 0;

  /* ---------- panel + chat ---------- */
  const panel = document.getElementById('bot-panel');
  const log = document.getElementById('bot-log');
  const form = document.getElementById('bot-form');
  const input = document.getElementById('bot-input');
  const micBtn = document.getElementById('bot-mic');
  const toggle = document.getElementById('bot-toggle');
  let greeted = false, lastVoice = false;

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = `msg msg--${who}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function answer(text) {
    // accent-fold so "perché studia" matches "perche" keywords and vice versa
    const q = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const L = (I18N[lang] ?? I18N.en).bot;
    let best = null, bestScore = 0;
    for (const [intent, keys] of Object.entries(BOT_KEYS)) {
      const score = keys.reduce((s, kw) => s + (q.includes(kw) ? (kw.length > 4 ? 2 : 1) : 0), 0);
      if (score > bestScore) { bestScore = score; best = intent; }
    }
    if (!best) return L.fallback[Math.floor(Math.random() * L.fallback.length)];
    return L.a[best].replace('{age}', age());
  }

  /* grounded LLM path: public KB as system prompt, short history, 12s cap */
  const history = [];
  async function askLLM(q) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(`${AI.endpoint}${AI.model}:generateContent?key=${AI.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: kbText() + `\nCurrent site language: ${lang}.` }] },
          contents: [...history, { role: 'user', parts: [{ text: q }] }],
          generationConfig: { temperature: AI.temperature, maxOutputTokens: AI.maxTokens },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      if (!out) throw new Error('empty');
      history.push({ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: out }] });
      if (history.length > 8) history.splice(0, history.length - 8);
      return out;
    } finally { clearTimeout(timer); }
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE[lang]; u.rate = 1.02; u.pitch = 0.72;
    u.onstart = () => { talking = 1; };
    u.onend = () => { talking = 0; };
    speechSynthesis.speak(u);
  }

  function deliver(a, voice) {
    addMsg(a, 'bot');
    talking = 1; setTimeout(() => { if (!speechSynthesis?.speaking) talking = 0; }, 1400);
    if (voice) speak(a);
  }

  async function send(text, { voice = false } = {}) {
    const clean = text.trim().slice(0, 280);
    if (!clean) return;
    lastVoice = voice;
    addMsg(clean, 'user');
    if (!AI.key) {
      const a = answer(clean);
      setTimeout(() => deliver(a, voice), 260);
      return;
    }
    const wait = document.createElement('div');
    wait.className = 'msg msg--bot msg--wait';
    wait.textContent = '· · ·';
    log.appendChild(wait);
    log.scrollTop = log.scrollHeight;
    listening = false; talking = 1;
    let a;
    try { a = await askLLM(clean); } catch { a = answer(clean); }
    wait.remove();
    deliver(a, voice);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
    input.value = '';
  });

  /* voice input */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (SR) {
    rec = new SR();
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => send(e.results[0][0].transcript, { voice: true });
    rec.onend = () => { listening = false; micBtn.setAttribute('aria-pressed', 'false'); };
    rec.onerror = () => {
      listening = false;
      micBtn.setAttribute('aria-pressed', 'false');
      addMsg(t('bot.micErr'), 'bot');
    };
  }
  micBtn.addEventListener('click', () => {
    if (!rec) { addMsg(t('bot.noSR'), 'bot'); return; }
    if (listening) { rec.stop(); return; }
    listening = true;
    rec.lang = VOICE[lang];
    micBtn.setAttribute('aria-pressed', 'true');
    rec.start();
  });

  function togglePanel() {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !greeted) {
      greeted = true;
      addMsg(t('bot.greet'), 'bot');
    }
    if (open) input.focus();
  }

  /* ---------- per-frame animation, driven by the main loop ---------- */
  function frame(dt, musicLevel = 0, mix = 0) {
    bt += dt;
    mode += (mix - mode) * Math.min(dt * 2.5, 1);
    const energy = talking ? 0.34 : listening ? 0.22 : 0.05 + musicLevel * 0.1;

    // monolith body (space)
    group.scale.setScalar(Math.max(0.001, 1 - mode));
    group.visible = mode < 0.98;
    if (group.visible) {
      slabs.forEach((s, i) => {
        s.position.y = Math.sin(bt * (talking ? 9 : 1.6) + i * 1.35) * energy * (i === 1 || i === 2 ? 1.25 : 0.8);
        s.rotation.x = Math.sin(bt * 0.7 + i) * 0.04;
      });
      group.rotation.y = Math.sin(bt * 0.4) * 0.32;
    }

    // jellyfish body (ocean): the bell pulses, the tentacles trail
    jelly.scale.setScalar(Math.max(0.001, mode));
    jelly.visible = mode > 0.02;
    if (jelly.visible) {
      const rate = talking ? 5.2 : 2.1;
      const pulse = Math.sin(bt * rate);
      bell.scale.set(1 - pulse * 0.07, 1 + pulse * 0.13, 1 - pulse * 0.07);
      rim.scale.setScalar(1 - pulse * 0.06);
      jelly.position.y = Math.sin(bt * 0.9) * 0.22 + pulse * 0.06;
      jelly.rotation.y = Math.sin(bt * 0.3) * 0.4;
      jelly.rotation.z = Math.sin(bt * 0.5) * 0.08;
      bellMat.emissiveIntensity = 0.3 + (talking ? 0.5 : 0.12) + musicLevel * 0.3 + pulse * 0.08;
      for (const tc of tentacles) {
        const A = tc.arr;
        for (let s = 0; s <= TSEG; s++) {
          const f = s / TSEG;
          A[s * 3] = tc.x0 * (1 - f * 0.25) + Math.sin(bt * 1.6 + tc.ph + f * 2.6) * 0.16 * f;
          A[s * 3 + 1] = 0.12 - f * tc.len - pulse * 0.05 * f;
          A[s * 3 + 2] = tc.z0 * (1 - f * 0.25) + Math.cos(bt * 1.3 + tc.ph + f * 2.2) * 0.14 * f;
        }
        tc.geo.attributes.position.needsUpdate = true;
      }
      tentMat.opacity = 0.4 + mode * 0.25;
    }

    teal.intensity = 4.5 + Math.sin(bt * 3) * 1.2 + (talking ? 3 : 0) + mode * 1.5;
    renderer.render(scene, cam);
  }

  return { frame, togglePanel };
}
