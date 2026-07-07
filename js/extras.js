/* Scene life (v8), lazy-loaded and skipped entirely under reduced motion.
   SPACE: rare, spectacular rocket launches climbing out of the deep field.
   OCEAN: a school of procedural koi (lathe body, shader spine-wave, painted
   patterning), a bubble wake behind the submarine's propeller.
   BOTH:  the trajectory ribbon gains eight 3D waypoint glyphs that change
   character with the world; two rare pixel-art easter eggs — every sprite
   is original work drawn here at runtime (16-bit homage, no borrowed IP).
   ponytail: one module owns all of it; scene.js only calls frame(). */

import * as THREE from '../vendor/three/three.module.min.js';

const TAU = Math.PI * 2;

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* pixel-art helper: string map → rects. '.' = transparent */
function px(g, map, ox, oy, s, colors) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch === '.') continue;
      g.fillStyle = colors[ch];
      g.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
}

/* ---------- original 16-bit cast ---------- */
/* VOLT — a golden supersonic hedgehog-archetype: crouched ball of spikes */
const VOLT = [
  '...aa....',
  '..aggga..',
  '.aggggga.',
  'agggwggga',
  '.agggggga',
  '..aggga..',
  '.a.aa.a..',
];
/* DR. COG — round walker-mech with a dome, goggles and a top hat */
const COG = [
  '...hhhh...',
  '...hhhh...',
  '..dddddd..',
  '.dgg..ggd.',
  '.dddddddd.',
  'bbbbbbbbbb',
  'b.bbbbbb.b',
  '..l....l..',
  '..l....l..',
];
/* PEARL DIVER — original free-diver, teal suit, cream hood */
const DIVER = [
  '..cc......',
  '.cttc.....',
  '.cttc..p..',
  '..tttttt..',
  '..tt.tt...',
  '..f...f...',
];
/* SQUALO INK — squid-like pursuer, plum mantle, wavy arms */
const SQUID = [
  '...mmmm...',
  '..mmmmmm..',
  '.mm.ww.mm.',
  '.mmmmmmmm.',
  '..t.t.t.t.',
  '.t.t.t.t..',
];
/* LUME — a shy pixel axolotl peeking from the reef */
const AXO = [
  '.g......g.',
  'g.pppppp.g',
  '.pp.pp.pp.',
  '.pppppppp.',
  'g.pwwwwp.g',
  '...pppp...',
];

export function createExtras(deep, Q) {
  let t = 0;

  /* ============ SPACE: rocket launches ============ */
  const rocketGroup = new THREE.Group();
  rocketGroup.visible = false;
  deep.scene.add(rocketGroup);

  const head = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.9, 4, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff4e0 }),
  );
  rocketGroup.add(head);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,238,200,0.95)', 'rgba(255,160,70,0.35)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  flare.scale.setScalar(7);
  rocketGroup.add(flare);

  const TRAIL = 96;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailBirth = new Float32Array(TRAIL).fill(-99);
  const trailSeed = new Float32Array(TRAIL);
  for (let i = 0; i < TRAIL; i++) trailSeed[i] = Math.random();
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('aBirth', new THREE.BufferAttribute(trailBirth, 1));
  trailGeo.setAttribute('aSeed', new THREE.BufferAttribute(trailSeed, 1));
  trailGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
  const trailU = { uTime: { value: 0 }, uPix: { value: 1 } };
  const trail = new THREE.Points(trailGeo, new THREE.ShaderMaterial({
    uniforms: trailU,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aBirth; attribute float aSeed;
      uniform float uTime, uPix;
      varying float vA; varying float vSeed;
      void main(){
        float age = uTime - aBirth;
        vec3 p = position;
        p.x += (aSeed - 0.5) * age * 1.4;
        p.y -= age * (0.4 + aSeed * 0.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(2.2, 0.0, age) * step(0.0, age) * 0.8;
        vSeed = aSeed;
        gl_PointSize = (2.0 + aSeed * 2.5 + age * 4.0) * uPix * (110.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA; varying float vSeed;
      void main(){
        float d = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
        vec3 col = mix(vec3(1.0, 0.86, 0.62), vec3(0.95, 0.55, 0.28), vSeed);
        gl_FragColor = vec4(col, d * vA);
      }`,
  }));
  trail.frustumCulled = false;
  deep.scene.add(trail);
  trail.visible = false;

  const rocket = { active: false, next: 22 + Math.random() * 40, t0: 0, DUR: 11, ti: 0, base: new THREE.Vector3() };
  const _dir = new THREE.Vector3(), _prev = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  function rocketFrame(dt, level) {
    if (!rocket.active) {
      if (deep.mix < 0.12 && t > rocket.next && !document.hidden) {
        rocket.active = true;
        rocket.t0 = t;
        rocket.base.set(deep.camera.position.x - 30, deep.camera.position.y - 22, -95);
        rocketGroup.visible = true;
        trail.visible = true;
      }
      return;
    }
    const p = (t - rocket.t0) / rocket.DUR;
    if (p >= 1 || deep.mix > 0.4) {
      rocket.active = false;
      rocketGroup.visible = false;
      rocket.next = t + 75 + Math.random() * 75;
      setTimeout(() => { if (!rocket.active) trail.visible = false; }, 2600);
      return;
    }
    const tt = p * rocket.DUR;
    _prev.copy(head.position);
    head.position.set(
      rocket.base.x + tt * 1.6 + p * p * 14,
      rocket.base.y + Math.pow(tt, 1.62) * 3.4,
      rocket.base.z + tt * 0.4,
    );
    _dir.copy(head.position).sub(_prev);
    if (_dir.lengthSq() > 1e-6) head.quaternion.setFromUnitVectors(_up, _dir.normalize());
    flare.position.copy(head.position);
    flare.material.opacity = (0.5 + level * 0.4) * Math.min(p * 8, 1) * (1 - Math.max(0, p - 0.85) / 0.15);
    // exhaust: three particles a frame into the ring buffer
    for (let n = 0; n < 3; n++) {
      const i = rocket.ti = (rocket.ti + 1) % TRAIL;
      trailPos[i * 3] = head.position.x + (Math.random() - 0.5) * 0.3;
      trailPos[i * 3 + 1] = head.position.y - 0.8 + (Math.random() - 0.5) * 0.3;
      trailPos[i * 3 + 2] = head.position.z;
      trailBirth[i] = t;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aBirth.needsUpdate = true;
  }

  /* ============ OCEAN: koi school ============ */
  function koiTexture(seed) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.fillStyle = '#efe9df';
    g.fillRect(0, 0, 128, 256);
    // dorsal shading at the wrap seam, lighter belly band in the middle
    const sh = g.createLinearGradient(0, 0, 128, 0);
    sh.addColorStop(0, 'rgba(90,100,110,0.35)');
    sh.addColorStop(0.5, 'rgba(255,255,252,0.25)');
    sh.addColorStop(1, 'rgba(90,100,110,0.35)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 128, 256);
    const blob = (fill) => {
      const bx = rnd() * 128, by = 20 + rnd() * 216, r = 14 + rnd() * 26;
      g.fillStyle = fill;
      g.beginPath();
      for (let a = 0; a <= 12; a++) {
        const ang = (a / 12) * TAU;
        const rr = r * (0.7 + rnd() * 0.5);
        const x = bx + Math.cos(ang) * rr, y = by + Math.sin(ang) * rr * 1.4;
        a ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.fill();
    };
    const n = 3 + (rnd() * 3 | 0);
    for (let i = 0; i < n; i++) blob(rnd() > 0.72 ? '#20232a' : (rnd() > 0.5 ? '#e8641e' : '#d94f28'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  const koiGroup = new THREE.Group();
  deep.ocean.add(koiGroup);

  const KOI_R = [0.02, 0.20, 0.27, 0.30, 0.295, 0.26, 0.20, 0.14, 0.09, 0.05, 0.02];
  const koiProfile = KOI_R.map((r, i) => new THREE.Vector2(r * 0.92, (i / (KOI_R.length - 1)) * 2.2));
  const koiGeo = new THREE.LatheGeometry(koiProfile, 14);
  koiGeo.rotateZ(-Math.PI / 2);       // length along +X, head at x=0
  koiGeo.translate(-1.1, 0, 0);       // centre; head −X, tail +X
  koiGeo.scale(1, 1.05, 0.62);        // laterally compressed like a real carp
  const finGeo = new THREE.PlaneGeometry(0.62, 0.44);
  finGeo.translate(0.3, 0, 0);
  const finMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0d9c0, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    roughness: 0.5, metalness: 0, sheen: 0.6, sheenColor: new THREE.Color(0xffe9d2),
    depthWrite: false,
  });

  const kois = [];
  const KN = Q.koi ?? 5;
  for (let i = 0; i < KN; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      map: koiTexture(11 + i * 97), roughness: 0.42, metalness: 0.02,
      clearcoat: 0.55, clearcoatRoughness: 0.3,
      sheen: 0.35, sheenColor: new THREE.Color(0xbfe8e2),
    });
    const phase = Math.random() * TAU;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPhase = { value: phase };
      shader.vertexShader = `uniform float uTime, uPhase;\n` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.z += sin(position.x * 2.4 - uTime * 5.2 + uPhase)
                        * 0.15 * smoothstep(-0.7, 1.1, position.x);`,
      );
      mat.userData.shader = shader;
    };
    const body = new THREE.Mesh(koiGeo, mat);
    const tail = new THREE.Mesh(finGeo, finMat);
    tail.position.set(1.08, 0, 0);
    body.add(tail);
    const finL = new THREE.Mesh(finGeo, finMat);
    finL.scale.setScalar(0.55);
    finL.position.set(-0.55, -0.12, 0.2);
    finL.rotation.set(0.9, 0.5, 0);
    body.add(finL);
    const finR = finL.clone();
    finR.position.z = -0.2;
    finR.rotation.set(-0.9, -0.5, 0);
    body.add(finR);

    const s = 0.75 + Math.random() * 0.65;
    body.scale.setScalar(s);
    koiGroup.add(body);
    kois.push({
      body, tail, phase,
      cx: (Math.random() - 0.5) * 22,
      cz: -20 - Math.random() * 14,
      yb: -6 + Math.random() * 10,
      r1: 6 + Math.random() * 8,
      r2: 4 + Math.random() * 6,
      sp: (0.10 + Math.random() * 0.10) * (Math.random() > 0.5 ? 1 : -1),
      ox: 0, oz: 0,               // eased hand-repulsion offset
    });
  }

  const _hand = new THREE.Vector3();
  function koiFrame(dt, mid, y) {
    koiGroup.position.y = y;
    for (const k of kois) {
      const a = t * k.sp * TAU + k.phase;
      const px_ = k.cx + Math.cos(a) * k.r1;
      const pz = k.cz + Math.sin(a) * k.r2;
      const dxdt = -Math.sin(a) * k.r1 * k.sp;
      const dzdt = Math.cos(a) * k.r2 * k.sp;

      // both live hands push the school away, softly
      let rx = 0, rz = 0;
      for (const u of [deep.bubU.uHand.value, deep.bubU.uHand2.value]) {
        if (u.z > 500) continue;
        _hand.set(u.x, u.y - y, u.z);
        const dx = px_ - _hand.x, dz = pz - _hand.z;
        const d = Math.hypot(dx, dz, k.body.position.y - _hand.y);
        if (d < 7 && d > 0.01) {
          const f = (7 - d) / 7 * 2.2;
          rx += (dx / d) * f;
          rz += (dz / d) * f;
        }
      }
      k.ox += (rx - k.ox) * Math.min(dt * 2, 1);
      k.oz += (rz - k.oz) * Math.min(dt * 2, 1);

      k.body.position.set(px_ + k.ox, k.yb + Math.sin(t * 0.6 + k.phase) * 0.9, pz + k.oz);
      k.body.rotation.y = Math.atan2(dzdt, -dxdt);
      k.body.rotation.z = Math.sin(t * 1.1 + k.phase) * 0.06;
      k.tail.rotation.y = Math.sin(t * 5.2 + k.phase + 2.2) * 0.55;
      const sh = k.body.material.userData.shader;
      if (sh) sh.uniforms.uTime.value = t * (1 + mid * 0.3);
    }
  }

  /* ============ OCEAN: propeller wake ============ */
  const WN = 34;
  const wSeed = new Float32Array(WN);
  for (let i = 0; i < WN; i++) wSeed[i] = Math.random();
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WN * 3), 3));
  wGeo.setAttribute('aSeed', new THREE.BufferAttribute(wSeed, 1));
  wGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(-10, 0, 0), 12);
  const wU = { uTime: { value: 0 }, uFade: { value: 0 }, uPix: { value: 1 } };
  const wake = new THREE.Points(wGeo, new THREE.ShaderMaterial({
    uniforms: wU,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPix;
      varying float vA;
      void main(){
        float age = fract(uTime * (0.34 + aSeed * 0.2) + aSeed * 7.13);
        vec3 p = vec3(
          -8.2 - age * 5.0,
          (fract(aSeed * 91.7) - 0.5) * 0.9 + age * 1.6,
          (fract(aSeed * 47.3) - 0.5) * 0.9
        );
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (1.0 - age) * 0.5;
        gl_PointSize = (1.4 + aSeed * 1.8 + age * 2.4) * uPix * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      uniform float uFade;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float ring = smoothstep(0.5, 0.38, d) * smoothstep(0.22, 0.34, d) + 0.12;
        gl_FragColor = vec4(0.75, 0.95, 0.95, ring * vA * uFade);
      }`,
  }));
  deep.sub.add(wake);

  /* ============ EASTER EGGS ============ */
  function eggSprite(w, h, parent) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0,
    }));
    sp.visible = false;
    parent.add(sp);
    return { c, g: c.getContext('2d'), tex, sp };
  }

  /* space vignette: VOLT circles DR. COG on an asteroid, 16-bit homage */
  const eggS = eggSprite(160, 96, deep.scene);
  eggS.sp.scale.set(26, 15.6, 1);
  function drawSpaceEgg(tt) {
    const g = eggS.g;
    g.clearRect(0, 0, 160, 96);
    // asteroid
    g.fillStyle = '#565b66';
    g.beginPath();
    g.ellipse(80, 84, 62, 16, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#464b55';
    g.fillRect(48, 76, 10, 4); g.fillRect(96, 80, 14, 4); g.fillRect(70, 86, 8, 3);
    // DR. COG stands right of centre; flashes when VOLT connects
    const hit = (tt % 5) > 4.28;
    px(g, COG, 92, 46, 3, {
      h: '#14161c', d: hit ? '#ffffff' : '#5a6f9a', g: '#bfe8ff',
      b: hit ? '#ffffff' : '#3d4c6e', l: '#2a3040',
    });
    // pellets arc out while he fires
    const ft = (tt % 5) / 5;
    if (ft < 0.6) {
      g.fillStyle = '#ffd9a0';
      for (let i = 0; i < 3; i++) {
        const p = ft + i * 0.1;
        g.fillRect(88 - p * 70, 58 - Math.sin(p * 3.1) * 22, 3, 3);
      }
    }
    // VOLT orbits in a flat ellipse and dashes through on the last beat
    const a = tt * 2.6;
    const dash = (tt % 5) > 4.1;
    const vx = 78 + Math.cos(a) * (dash ? 20 : 46);
    const vy = 58 + Math.sin(a) * 10 - (dash ? 8 : 0);
    if (dash) {
      g.fillStyle = 'rgba(242,193,78,0.5)';
      g.fillRect(vx - 18, vy + 6, 16, 3);
      g.fillRect(vx - 30, vy + 7, 9, 2);
    }
    px(g, VOLT, vx - 13, vy - 8, 3, { a: '#c9932b', g: '#f2c14e', w: '#fff8e8' });
    eggS.tex.needsUpdate = true;
  }

  /* water vignettes: LUME peeks from the reef · the pearl chase */
  const eggA = eggSprite(96, 64, deep.ocean);
  eggA.sp.scale.set(11, 7.3, 1);
  function drawAxo(tt, p) {
    const g = eggA.g;
    g.clearRect(0, 0, 96, 64);
    g.fillStyle = '#233039';
    g.beginPath(); g.ellipse(48, 58, 34, 10, 0, 0, TAU); g.fill();
    g.fillStyle = '#2c3d48';
    g.fillRect(22, 46, 16, 10); g.fillRect(58, 44, 20, 12);
    const rise = Math.sin(Math.min(p, 1) * Math.PI) * 22;   // peek up, sink back
    const blink = (tt % 2.6) > 2.35;
    px(g, AXO, 33, 52 - rise, 3, {
      g: '#e26d7d', p: '#f2a7b8', w: blink ? '#f2a7b8' : '#31222a',
    });
    eggA.tex.needsUpdate = true;
  }
  const eggB = eggSprite(192, 64, deep.ocean);
  eggB.sp.scale.set(21, 7, 1);
  function drawChase(tt) {
    const g = eggB.g;
    g.clearRect(0, 0, 192, 64);
    const kick = Math.sin(tt * 9) > 0;
    px(g, DIVER, 24, 18, 3, {
      c: '#efe3cd', t: '#2f8f8a', p: '#ffffff',
      f: kick ? '#1d4f47' : '#16403c',
    });
    // bubbles between them
    g.fillStyle = 'rgba(190,235,235,0.7)';
    for (let i = 0; i < 4; i++) g.fillRect(70 + i * 18, 26 - Math.sin(tt * 3 + i) * 8, 2, 2);
    px(g, SQUID, 128, 14, 3, {
      m: '#6f5a9a', w: '#f4f1ec',
      t: Math.sin(tt * 7) > 0 ? '#584a7e' : '#6f5a9a',
    });
    eggB.tex.needsUpdate = true;
  }

  const eggs = {
    space: { active: false, next: 50 + Math.random() * 70, t0: 0, DUR: 12 },
    water: { active: false, next: 30 + Math.random() * 50, t0: 0, DUR: 12, which: 0 },
    lastDraw: 0,
  };

  function eggsFrame(dt, y) {
    const redraw = t - eggs.lastDraw > 0.125;   // 8 fps: honest pixel cadence
    if (redraw) eggs.lastDraw = t;

    const S = eggs.space;
    if (!S.active) {
      if (deep.mix < 0.12 && t > S.next && !document.hidden && !rocket.active) {
        S.active = true; S.t0 = t;
        eggS.sp.position.set(deep.camera.position.x - 34, deep.camera.position.y + 11, -92);
        eggS.sp.visible = true;
      }
    } else {
      const p = (t - S.t0) / S.DUR;
      if (p >= 1 || deep.mix > 0.4) {
        S.active = false; eggS.sp.visible = false;
        S.next = t + 110 + Math.random() * 90;
      } else {
        eggS.sp.material.opacity = 0.5 * Math.min(p * 6, 1, (1 - p) * 6);
        if (redraw) drawSpaceEgg(t - S.t0);
      }
    }

    const W = eggs.water;
    if (!W.active) {
      if (deep.mix > 0.85 && t > W.next && !document.hidden) {
        W.active = true; W.t0 = t;
        W.which = 1 - W.which;
        W.DUR = W.which ? 14 : 9;
        const sp = W.which ? eggB.sp : eggA.sp;
        // anchored to the camera column, like the rest of the ocean
        if (W.which) sp.position.set(deep.camera.position.x + 34, y - 7 + Math.random() * 8, -32);
        else sp.position.set(deep.camera.position.x + 14 * (Math.random() > 0.5 ? 1 : -1), y - 20, -34);
        sp.visible = true;
      }
    } else {
      const p = (t - W.t0) / W.DUR;
      const egg = W.which ? eggB : eggA;
      if (p >= 1 || deep.mix < 0.6) {
        W.active = false; egg.sp.visible = false;
        W.next = t + 70 + Math.random() * 70;
      } else {
        egg.sp.material.opacity = 0.62 * Math.min(p * 6, 1, (1 - p) * 6);
        if (W.which) egg.sp.position.x -= dt * 4.05;   // the chase drifts left
        if (redraw) (W.which ? drawChase : (pp) => drawAxo(pp, p))(t - W.t0);
      }
    }
  }

  /* ============ BOTH: timeline waypoint glyphs ============ */
  const glyphMat = new THREE.MeshPhysicalMaterial({
    color: 0xb9c2c6, metalness: 0.8, roughness: 0.32,
    clearcoat: 0.5, iridescenceIOR: 1.3, iridescenceThicknessRange: [140, 460],
  });
  const glyphGeos = [
    new THREE.OctahedronGeometry(0.34),                 // launch site
    new THREE.ConeGeometry(0.24, 0.62, 4),              // the crossing
    new THREE.TorusGeometry(0.26, 0.085, 10, 24),       // sound ignition
    new THREE.BoxGeometry(0.44, 0.3, 0.07),             // diploma
    new THREE.IcosahedronGeometry(0.3),                 // confidential year
    new THREE.DodecahedronGeometry(0.3),                // security pivot
    new THREE.CylinderGeometry(0.2, 0.2, 0.34, 6),      // two tracks
    new THREE.TorusKnotGeometry(0.2, 0.065, 48, 6),     // double graduation
  ];
  const glyphs = glyphGeos.map((geo, i) => {
    const m = new THREE.Mesh(geo, glyphMat);
    m.visible = false;
    deep.scene.add(m);
    return m;
  });
  const _gc1 = new THREE.Color(0xb9c2c6), _gc2 = new THREE.Color(0x59e8d5);
  let lastGlyphMix = -1;

  function glyphFrame(dt, mid) {
    const mix = deep.mix;
    if (Math.abs(mix - lastGlyphMix) > 0.01) {
      lastGlyphMix = mix;
      glyphMat.color.copy(_gc1).lerp(_gc2, mix * 0.85);
      glyphMat.iridescence = mix * 0.8;
      glyphMat.metalness = 0.8 - mix * 0.5;
    }
    for (let i = 0; i < glyphs.length && i < deep.ribbonDots.length; i++) {
      const dot = deep.ribbonDots[i], m = glyphs[i];
      m.visible = dot.visible;
      if (!m.visible) continue;
      m.position.copy(dot.position);
      m.position.x += 1.15;
      m.position.y += 0.15 + Math.sin(t * (0.8 + mix * 0.6) + i * 1.7) * (0.12 + mix * 0.22);
      m.rotation.y += dt * (0.4 + i * 0.06);
      m.rotation.x = Math.sin(t * 0.5 + i) * 0.25;
      const s = 1 + mid * 0.35;
      m.scale.setScalar(s);
    }
  }

  /* ============ the one call scene.js makes ============ */
  return {
    frame(dt, audio, d, y) {
      t += dt;
      const { mid = 0, level = 0 } = audio;
      trailU.uTime.value = t;
      trailU.uPix.value = d.pix;
      rocketFrame(dt, level);
      if (d.ocean.visible) {
        koiFrame(dt, mid, y);
        wU.uTime.value = t;
        wU.uPix.value = d.pix;
        wU.uFade.value = d.mix;
      }
      eggsFrame(dt, y);
      glyphFrame(dt, mid);
    },
  };
}
