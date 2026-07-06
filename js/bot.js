/* CAERUS: mission companion. Original slab-monolith design (four floating
   segments), voice in and out via the Web Speech API, knowledge fully
   on-device from data.js. No network calls, ever (BOT.endpoint reserved). */

import * as THREE from '../vendor/three/three.module.min.js';
import { BOT } from './data.js';

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

  let t = 0, talking = 0, listening = false;

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
    const q = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const intent of BOT.intents) {
      const score = intent.k.reduce((s, kw) => s + (q.includes(kw) ? (kw.length > 4 ? 2 : 1) : 0), 0);
      if (score > bestScore) { bestScore = score; best = intent; }
    }
    if (!best) return BOT.fallback[Math.floor(Math.random() * BOT.fallback.length)];
    return typeof best.a === 'function' ? best.a() : best.a;
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 1.02; u.pitch = 0.72;
    u.onstart = () => { talking = 1; };
    u.onend = () => { talking = 0; };
    speechSynthesis.speak(u);
  }

  function send(text, { voice = false } = {}) {
    const clean = text.trim().slice(0, 280);
    if (!clean) return;
    lastVoice = voice;
    addMsg(clean, 'user');
    const a = answer(clean);
    setTimeout(() => {
      addMsg(a, 'bot');
      talking = 1; setTimeout(() => { if (!speechSynthesis?.speaking) talking = 0; }, 1400);
      if (voice) speak(a);
    }, 260);
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
    rec.lang = navigator.language?.startsWith('it') ? 'it-IT' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => send(e.results[0][0].transcript, { voice: true });
    rec.onend = () => { listening = false; micBtn.setAttribute('aria-pressed', 'false'); };
    rec.onerror = () => {
      listening = false;
      micBtn.setAttribute('aria-pressed', 'false');
      addMsg('Microphone unavailable or permission denied. Keyboard still works; I do not judge.', 'bot');
    };
  }
  micBtn.addEventListener('click', () => {
    if (!rec) { addMsg('This browser has no speech recognition. Type to me instead.', 'bot'); return; }
    if (listening) { rec.stop(); return; }
    listening = true;
    micBtn.setAttribute('aria-pressed', 'true');
    rec.start();
  });

  function togglePanel() {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !greeted) {
      greeted = true;
      addMsg(`${BOT.name} online. ${BOT.tagline} Ask me about Flavio, the score, or the moon.`, 'bot');
    }
    if (open) input.focus();
  }

  /* ---------- per-frame animation, driven by the main loop ---------- */
  function frame(dt, musicLevel = 0) {
    t += dt;
    const energy = talking ? 0.34 : listening ? 0.22 : 0.05 + musicLevel * 0.1;
    slabs.forEach((s, i) => {
      s.position.y = Math.sin(t * (talking ? 9 : 1.6) + i * 1.35) * energy * (i === 1 || i === 2 ? 1.25 : 0.8);
      s.rotation.x = Math.sin(t * 0.7 + i) * 0.04;
    });
    group.rotation.y = Math.sin(t * 0.4) * 0.32;
    teal.intensity = 4.5 + Math.sin(t * 3) * 1.2 + (talking ? 3 : 0);
    renderer.render(scene, cam);
  }

  return { frame, togglePanel };
}
