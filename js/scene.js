/* Deep-field scene: starfield + dust + nebulae + procedural moon +
   face constellation. One WebGL context, no postprocessing chain;
   glow comes from additive sprites (cheaper, steadier on mobile). */

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

/* value-noise fbm painted to a canvas: reused as moon displacement+bump */
function fbmTexture(size = 512, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rnd = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return rnd(xi, yi) * (1 - u) * (1 - v) + rnd(xi + 1, yi) * u * (1 - v) +
           rnd(xi, yi + 1) * (1 - u) * v + rnd(xi + 1, yi + 1) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0.18, f = 14 / size, amp = 0.5;
      for (let o = 0; o < 6; o++) { a += smooth(x * f, y * f) * amp; f *= 2.15; amp *= 0.52; }
      // crater pits: sparse soft-edged wells at two scales
      const cr = smooth(x * 26 / size, y * 26 / size);
      if (cr > 0.74) a -= (cr - 0.74) * 2.2;
      const cr2 = smooth(x * 9 / size + 40, y * 9 / size + 40);
      if (cr2 > 0.8) a -= (cr2 - 0.8) * 1.6;
      const v = Math.max(0, Math.min(1, a)) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

export class DeepField {
  constructor(canvas, { reduced = false } = {}) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x030408, 1);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030408, 0.0115);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    this.camera.position.set(0, 0, 26);
    this.t = 0;
    this.sectionCount = 7;
    this.scrollY = 0;          // smoothed section-progress 0..sectionCount-1
    this.targetScroll = 0;
    this.parallax = { x: 0, y: 0 };
    this.shake = 0;

    this._buildStars();
    this._buildDust();
    this._buildNebulae();
    this._buildMoon();
    this._buildFaceCloud();
    this.resize();
  }

  _buildStars() {
    const N = this.reduced ? 3200 : 9000;
    const pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // a tall cylinder of sky so scrolling always has stars
      const r = 60 + Math.random() * 240;
      const a = Math.random() * TAU;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 420;
      pos[i * 3 + 2] = Math.sin(a) * r - 60;
      size[i] = 0.6 + Math.random() * 1.8;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.starU = { uTime: { value: 0 }, uMid: { value: 0 }, uLevel: { value: 0 }, uPix: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.starU,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize; attribute float aSeed;
        uniform float uTime, uMid, uLevel, uPix;
        varying float vA; varying float vSeed;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = sin(uTime * (0.5 + aSeed * 2.4) + aSeed * 6.2831) * 0.5 + 0.5;
          vA = mix(0.35, 1.0, tw * (0.4 + uMid * 1.4));
          vSeed = aSeed;
          gl_PointSize = aSize * (1.0 + uLevel * 1.1) * uPix * (160.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying float vSeed;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.05, length(q));
          vec3 warm = vec3(0.95, 0.90, 0.82);
          vec3 cool = vec3(0.62, 0.95, 0.90);
          vec3 col = mix(warm, cool, step(0.72, vSeed));
          gl_FragColor = vec4(col, d * vA);
        }`,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildDust() {
    const N = this.reduced ? 0 : 900;
    this.dustN = N;
    if (!N) return;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustU = { uTime: { value: 0 }, uBass: { value: 0 }, uPix: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.dustU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uBass, uPix;
        varying float vA;
        void main(){
          vec3 p = position;
          float sp = 0.4 + aSeed * 1.2 + uBass * 5.0;
          p.z = mod(p.z + uTime * sp + 25.0, 50.0) - 25.0;
          p.x += sin(uTime * (0.2 + aSeed) + aSeed * 40.0) * (0.6 + uBass * 2.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.10 + uBass * 0.5) * smoothstep(25.0, 6.0, -mv.z);
          gl_PointSize = (1.4 + aSeed * 2.4) * uPix * (70.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.0, length(q));
          gl_FragColor = vec4(0.35, 0.91, 0.84, d * vA);
        }`,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  _buildNebulae() {
    const mk = (color, x, y, z, s) => {
      const m = new THREE.SpriteMaterial({
        map: glowTexture(color[0], color[1]),
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.10,
      });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      this.scene.add(sp);
      return sp;
    };
    this.nebulae = [
      mk(['rgba(38,150,140,0.85)', 'rgba(15,95,99,0.25)'], -90, 10, -160, 260),
      mk(['rgba(160,110,60,0.7)', 'rgba(110,70,40,0.2)'], 110, -70, -190, 300),
      mk(['rgba(70,190,175,0.8)', 'rgba(20,80,85,0.22)'], 40, -150, -170, 240),
    ];
  }

  _buildMoon() {
    const tex = fbmTexture(512);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xaab0b6, roughness: 1.0, metalness: 0.0,
      bumpMap: tex, bumpScale: 4.2,
      displacementMap: tex, displacementScale: 0.3, displacementBias: -0.15,
    });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(8.5, 128, 128), mat);
    this.moonHome = new THREE.Vector3(11, -132, -18);
    this.moon.position.copy(this.moonHome);
    this.scene.add(this.moon);

    const key = new THREE.DirectionalLight(0xf2ede2, 2.6);
    key.position.set(-30, 10, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x59e8d5, 0.55);
    rim.position.set(26, -8, -20);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x14161c, 2.2));
  }

  _buildFaceCloud() {
    const N = 156;
    this.faceN = N;
    const pos = new Float32Array(N * 3);
    this.faceHome = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 30 + Math.random() * 60, a = Math.random() * TAU, b = (Math.random() - 0.5) * Math.PI;
      const x = Math.cos(a) * Math.cos(b) * r - 20;
      const y = Math.sin(b) * r * 0.7;
      const z = Math.sin(a) * Math.cos(b) * r - 70;
      pos.set([x, y, z], i * 3);
      this.faceHome.set([x, y, z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55, map: glowTexture('rgba(156,255,241,1)', 'rgba(89,232,213,0.4)'),
      color: 0x9cfff1, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.faceCloud = new THREE.Points(geo, mat);
    this.scene.add(this.faceCloud);
    this.facePts = null; // set by vision: Float32Array of landmark triplets (normalized)
  }

  setScroll(progress) { // 0..1 across the whole page
    this.targetScroll = progress * (this.sectionCount - 1);
  }

  setFacePoints(pts) { this.facePts = pts; }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pix = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 1.75);
    this.renderer.setPixelRatio(pix);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.starU.uPix.value = pix;
    if (this.dustU) this.dustU.uPix.value = pix;
  }

  frame(dt, audio, input) {
    this.t += dt;
    const calm = this.reduced;
    const { bass = 0, mid = 0, level = 0 } = audio || {};

    // uniforms
    this.starU.uTime.value = this.t;
    this.starU.uMid.value = calm ? 0.12 : mid;
    this.starU.uLevel.value = calm ? 0 : level;
    if (this.dustU) { this.dustU.uTime.value = this.t; this.dustU.uBass.value = calm ? 0 : bass; }

    // nebulae idle near-black, then flare with the score: dynamic range is the luxury
    if (!calm) {
      this.nebulae[0].material.opacity = 0.055 + mid * 0.22;
      this.nebulae[1].material.opacity = 0.045 + bass * 0.26;
      this.nebulae[2].material.opacity = 0.05 + level * 0.18;
      const fov = 58 + bass * 2.4;
      if (Math.abs(fov - this.camera.fov) > 0.08) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    // camera travels down the field with scroll, drifts on a slow figure
    this.scrollY += (this.targetScroll - this.scrollY) * (calm ? 1 : 0.06);
    const y = -this.scrollY * 26;
    const driftX = calm ? 0 : Math.sin(this.t * 0.05) * 1.6;
    const driftY = calm ? 0 : Math.cos(this.t * 0.04) * 1.1;
    // bass punch: brief, tiny, physical
    if (!calm && bass > 0.62) this.shake = Math.min(this.shake + (bass - 0.62) * 0.5, 0.6);
    this.shake *= 0.9;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    this.camera.position.x = driftX + input.px * 2.2 + sx;
    this.camera.position.y = y + driftY + input.py * 1.4 + sy;
    this.camera.position.z = 26;
    this.camera.lookAt(driftX * 0.4 + input.px * 4, y + input.py * 2.5, -30);

    // moon: waits at its station; near the moon section it tilts toward you
    const moonFocus = Math.max(0, 1 - Math.abs(this.scrollY - 5) * 1.2);
    this.moon.rotation.y += dt * 0.03;
    this.moon.rotation.x = input.face ? input.face.ry * 0.5 * moonFocus : input.py * 0.25 * moonFocus;
    this.moon.rotation.z = input.face ? input.face.rx * 0.35 * moonFocus : input.px * 0.15 * moonFocus;
    const mScale = 1 + (calm ? 0 : bass * 0.045);
    this.moon.scale.setScalar(mScale);
    this.moon.position.x = this.moonHome.x - moonFocus * 4 + (input.face ? input.face.rx * 3 * moonFocus : 0);

    // face constellation morph
    const attr = this.faceCloud.geometry.attributes.position;
    const arr = attr.array;
    const k = 0.07;
    for (let i = 0; i < this.faceN; i++) {
      let tx, ty, tz;
      if (this.facePts && this.facePts.length >= this.faceN * 3) {
        tx = (0.5 - this.facePts[i * 3]) * 30 - 14;
        ty = (0.5 - this.facePts[i * 3 + 1]) * 24 + y / 1.0 + 2;
        tz = -46 + this.facePts[i * 3 + 2] * -40;
      } else {
        tx = this.faceHome[i * 3];
        ty = this.faceHome[i * 3 + 1] + y * 0.9;
        tz = this.faceHome[i * 3 + 2];
      }
      arr[i * 3] += (tx - arr[i * 3]) * k;
      arr[i * 3 + 1] += (ty - arr[i * 3 + 1]) * k;
      arr[i * 3 + 2] += (tz - arr[i * 3 + 2]) * k;
    }
    attr.needsUpdate = true;
    this.faceCloud.material.opacity = this.facePts ? 0.95 : 0.5;

    // nebulae follow the camera loosely so every section has atmosphere
    this.nebulae.forEach((n, i) => { n.position.y = n.userData.oy ?? (n.userData.oy = n.position.y); n.position.y = n.userData.oy + y * 0.82; });
    if (this.dust) this.dust.position.y = y;

    this.renderer.render(this.scene, this.camera);
  }
}
