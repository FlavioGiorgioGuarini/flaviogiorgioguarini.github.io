/* hand3d — procedural "couture prosthesis" hand.
   Rigid segmented FK hierarchy (no skinning): polished-ivory phalanges,
   hairline orange emissive joints, bracelet ring at the wrist.
   Roles:
     1. Scroll guide — fades in at section boundaries, points toward travel direction,
        tilts with scroll velocity.
     2. Mirror rig — when hand-tracking (js/handtrack.js) is active, mirrors the
        user's hand via setCurls()/setWrist().
   Zero generative assets. Degrades: no WebGL → layer removed, site = v1 behavior.
   prefers-reduced-motion → one static elegant frame, no loop. */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("hand-canvas");
if (canvas) init();

function init() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch (e) { canvas.remove(); return; }

  /* ——— adaptive quality ——— */
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(innerWidth, innerHeight) < 640;
  const TIER = (small || cores <= 4 || mem <= 4) ? 0 : (cores <= 8 ? 1 : 2);
  const SEG = [7, 10, 14][TIER];          // radial segments per capsule
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1.25, 1.5, 2][TIER]));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  /* studio reflections without HDR downloads */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  /* cinematic key/rim — white key high right, orange rim low left */
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5a1f, 0.9); rim.position.set(-4, -2.5, 2); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  /* ——— materials (shared) ——— */
  const ivory = new THREE.MeshPhysicalMaterial({
    color: 0xe9e6de, metalness: 0.55, roughness: 0.3,
    clearcoat: 0.65, clearcoatRoughness: 0.22, envMapIntensity: 1.15
  });
  const seam = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.4, roughness: 0.5,
    emissive: 0xff5a1f, emissiveIntensity: 0.85
  });

  /* ——— shared geometries ——— */
  const capGeo = new THREE.CapsuleGeometry(0.5, 1, 4, SEG);       // unit capsule, scaled per segment
  const ringGeo = new THREE.TorusGeometry(0.5, 0.045, 6, SEG * 2); // joint hairline
  const palmGeo = new THREE.SphereGeometry(1, SEG * 2, SEG * 2);

  /* ——— build FK chain ———
     Each phalanx: Group(pivot at proximal joint) → capsule child offset +Y/2 → next pivot at +Y. */
  function phalanx(len, rad) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(capGeo, ivory);
    m.scale.set(rad, len * 0.5 + rad * 0.28, rad);
    m.position.y = len / 2;
    g.add(m);
    const ring = new THREE.Mesh(ringGeo, seam);
    ring.scale.setScalar(rad * 1.6);
    ring.rotation.x = Math.PI / 2;
    g.add(ring); // glows at the joint line
    g.userData.len = len;
    return g;
  }

  function finger(lens, rad) {
    const segs = [];
    let parent = null, root = null;
    lens.forEach((L, i) => {
      const p = phalanx(L, rad * (1 - i * 0.14));
      if (parent) { p.position.y = parent.userData.len; parent.add(p); } else root = p;
      parent = p; segs.push(p);
    });
    return { root, segs };
  }

  const hand = new THREE.Group();

  const palm = new THREE.Mesh(palmGeo, ivory);
  palm.scale.set(0.62, 0.78, 0.24);
  palm.position.y = -0.1;
  hand.add(palm);

  /* wrist bracelet — the couture cue */
  const wrist = new THREE.Mesh(capGeo, ivory);
  wrist.scale.set(0.34, 0.3, 0.26); wrist.position.y = -0.98; hand.add(wrist);
  const bracelet = new THREE.Mesh(ringGeo, seam);
  bracelet.scale.set(0.78, 0.78, 0.9); bracelet.rotation.x = Math.PI / 2;
  bracelet.position.y = -0.88; hand.add(bracelet);

  /* four fingers — knuckle x-offsets, natural length ratios */
  const F = [];
  const defs = [
    { x: -0.44, lens: [0.52, 0.34, 0.24], r: 0.115, splay: 0.10 },  // index
    { x: -0.15, lens: [0.58, 0.38, 0.26], r: 0.12,  splay: 0.02 },  // middle
    { x:  0.14, lens: [0.53, 0.35, 0.25], r: 0.115, splay: -0.05 }, // ring
    { x:  0.42, lens: [0.4, 0.27, 0.2],  r: 0.10,  splay: -0.14 },  // pinky
  ];
  defs.forEach(d => {
    const f = finger(d.lens, d.r);
    f.root.position.set(d.x, 0.62, 0);
    f.root.rotation.z = d.splay;
    hand.add(f.root); F.push(f);
  });
  /* thumb — 3 segments from palm side, opposed */
  const thumb = finger([0.42, 0.3, 0.24], 0.13);
  thumb.root.position.set(-0.62, -0.18, 0.1);
  thumb.root.rotation.set(0.25, 0.5, 1.05);
  hand.add(thumb.root);
  F.push(thumb);

  hand.rotation.set(-0.15, -0.5, 0.12);
  scene.add(hand);

  /* ——— pose engine ———
     curls[5]: 0 = extended … 1 = fully curled (index, middle, ring, pinky, thumb) */
  const cur = [0.25, 0.3, 0.32, 0.3, 0.35];
  const tgt = [...cur];
  const POSE = {
    relaxed: [0.25, 0.3, 0.32, 0.3, 0.35],
    point:   [0.04, 0.85, 0.9, 0.9, 0.55],
    open:    [0.05, 0.05, 0.05, 0.07, 0.15],
  };
  const W = [0.9, 1.15, 0.75]; // per-phalanx curl weights
  function applyCurls() {
    for (let i = 0; i < 5; i++) {
      cur[i] += (tgt[i] - cur[i]) * 0.12;
      const segs = F[i].segs, isThumb = i === 4;
      segs.forEach((s, j) => {
        s.rotation.x = -cur[i] * W[j] * (isThumb ? 0.9 : 1.25);
      });
    }
  }
  function setPose(name) { POSE[name] && POSE[name].forEach((v, i) => tgt[i] = v); }

  /* ——— placement / responsive ——— */
  let baseX = 0, baseY = 0, baseS = 1;
  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (w > 900)      { baseX = 2.6;  baseY = 0;    baseS = 1;    }
    else if (w > 640) { baseX = 1.9;  baseY = -0.4, baseS = 0.85; }
    else              { baseX = 1.15; baseY = -1.5; baseS = 0.62; }
    hand.scale.setScalar(baseS);
  }
  addEventListener("resize", layout); layout();

  /* ——— scroll choreography ——— */
  const sections = [...document.querySelectorAll(".section")];
  let opacity = 0, opacityT = 0;
  let vel = 0, lastY = scrollY, lastMove = 0, dir = 1;
  let tracking = false;

  addEventListener("scroll", () => {
    const y = scrollY;
    vel = vel * 0.7 + (y - lastY) * 0.3;
    if (Math.abs(y - lastY) > 1) { dir = y > lastY ? 1 : -1; lastMove = performance.now(); }
    lastY = y;
  }, { passive: true });

  function boundaryProximity() {
    const probe = scrollY + innerHeight * 0.5;
    let best = Infinity;
    for (const s of sections) {
      const d = Math.abs(probe - s.offsetTop);
      if (d < best) best = d;
    }
    return best;
  }

  function setLayerOpacity(v) {
    opacity = v;
    canvas.style.opacity = v.toFixed(3);
  }

  /* mirror-mode API for handtrack.js */
  window.HAND3D = {
    setTracking(on) {
      tracking = on;
      canvas.style.opacity = on ? "1" : "0";
      if (!on) setPose("relaxed");
    },
    setCurls(c) { for (let i = 0; i < 5; i++) tgt[i] = Math.min(1, Math.max(0, c[i])); },
    setWrist(nx, ny, rot) {
      // nx, ny normalized 0..1 (already mirrored by caller)
      hand.position.x = (nx - 0.5) * 7;
      hand.position.y = (0.5 - ny) * 4.2;
      hand.rotation.z = rot;
    },
    pulse() { hand.scale.setScalar(baseS * 1.07); },
  };

  /* ——— render loop ——— */
  const clock = new THREE.Clock();
  let running = false;

  function frame() {
    running = true;
    if (document.hidden) { running = false; return; }
    const t = clock.getElapsedTime();

    if (!tracking) {
      const near = boundaryProximity() < innerHeight * 0.42;
      const active = performance.now() - lastMove < 1100;
      const pastHero = scrollY > innerHeight * 0.55;
      opacityT = (near && active && pastHero) ? 1 : 0;
      setLayerOpacity(opacity + (opacityT - opacity) * 0.07);

      if (opacityT > 0.5) setPose("point"); else setPose("relaxed");

      /* point along travel direction; velocity tilts the wrist */
      const targetRotZ = dir === 1 ? Math.PI : 0; // index points down when scrolling down
      hand.rotation.z += (targetRotZ + THREE.MathUtils.clamp(vel * 0.004, -0.35, 0.35) - hand.rotation.z) * 0.08;
      hand.rotation.y = -0.5 + Math.sin(t * 0.7) * 0.1;
      hand.position.x = baseX;
      hand.position.y = baseY + Math.sin(t * 1.6) * 0.07 + (dir === 1 ? -1 : 1) * Math.min(Math.abs(vel) * 0.002, 0.3);
      hand.scale.setScalar(baseS + (baseS * 1.0 - hand.scale.x) * 0.1);
      vel *= 0.9;
    } else {
      hand.rotation.y += (-0.15 - hand.rotation.y) * 0.1;
      hand.scale.setScalar(hand.scale.x + (baseS - hand.scale.x) * 0.12);
    }

    applyCurls();
    if (opacity > 0.01 || tracking) renderer.render(scene, camera);
    if (!reduced) requestAnimationFrame(frame);
    else running = false;
  }

  if (reduced) {
    /* static elegant frame: relaxed pose, fixed angle, subtle presence */
    setPose("relaxed");
    for (let i = 0; i < 60; i++) applyCurls(); // settle the lerp
    hand.position.set(baseX, baseY, 0);
    canvas.style.opacity = "0.22";
    renderer.render(scene, camera);
  } else {
    requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !running) requestAnimationFrame(frame);
    });
  }
}
