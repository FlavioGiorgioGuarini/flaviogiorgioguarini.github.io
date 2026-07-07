/* Deep field, two worlds, one WebGL context.
   SPACE: starfield + dust + nebulae + milky-way band + procedural moon.
   OCEAN: living surface (hand + gyro driven ripples), god rays, marine
   snow, bubbles, caustic seabed, patrol submarine.
   A single eased `mix` (0..1) crossfades everything; the dive/surface
   transition adds a camera-locked foam sweep so the site visibly submerges.
   No postprocessing chain: ACES tone mapping + PMREM environment give the
   PBR realism; glow stays additive sprites (cheap, steady on mobile). */

import * as THREE from '../vendor/three/three.module.min.js';

const TAU = Math.PI * 2;
const RIPPLES = 12;

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

/* value-noise fbm field: canvas for textures + raw bytes for CPU sampling */
function fbmField(size = 512, seed = 7) {
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
  return { canvas: c, data: img.data, size };
}

/* moon albedo: grey base, darker maria patches, faint warm variation */
function moonAlbedo(field) {
  const size = field.size;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const h = field.data[i * 4] / 255;
    let r = 168, gr = 172, b = 178;
    if (h < 0.42) { const k = 0.72 + h * 0.4; r *= k; gr *= k; b *= k * 1.02; } // maria
    if (h > 0.78) { r += 18; gr += 16; b += 12; }                              // ejecta
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = gr; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function milkyWayTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(120,140,160,0.16)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 1024;
    const y = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 70;
    const a = Math.random() * 0.28;
    const teal = Math.random() > 0.86;
    g.fillStyle = teal ? `rgba(150,235,225,${a})` : `rgba(235,240,245,${a})`;
    const s = Math.random() < 0.92 ? 1 : 2;
    g.fillRect(x, y, s, s);
  }
  return new THREE.CanvasTexture(c);
}

const easeInOut = (p) => p * p * (3 - 2 * p);

export class DeepField {
  constructor(canvas, { reduced = false, quality } = {}) {
    this.reduced = reduced;
    this.q = quality || { stars: 9000, dust: true, waterSeg: 72, snow: 380, bubbles: 220, rays: 7, dprCap: 1.75 };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x030408, 1);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030408, 0.0115);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
    this.camera.position.set(0, 0, 26);
    this.t = 0;
    this.sectionCount = 8;
    this.scrollY = 0;
    this.targetScroll = 0;
    this.shake = 0;
    this.warp = 0;
    this.portal = 1;         // bi-pinch world-scale flourish, eased
    this.portalT = 1;
    this.extras = null;      // lazy: rockets, koi, easter eggs, glyphs
    this.dprCap = this.q.dprCap;
    this.pix = 1;

    this.mode = 'space';
    this.mix = 0;            // eased 0 space → 1 ocean
    this.trans = null;       // {t0, dir}
    this.DUR = reduced ? 1.0 : 2.8;

    this._fbm = fbmField(512);
    this._fogA = new THREE.Color(0x030408);
    this._fogB = new THREE.Color(0x04222d);
    this._colTmp = new THREE.Color();
    this._colTmp2 = new THREE.Color();

    this._buildEnv();
    this._buildStars();
    this._buildDust();
    this._buildNebulae();
    this._buildMilkyWay();
    this._buildMoon();
    this._buildRibbon();
    this._buildSlabs();
    this._buildOcean();
    this._buildSubmarine();
    this._buildFoam();
    this.resize();
  }

  /* small emissive studio → PMREM: every PBR material gains real reflections */
  _buildEnv() {
    const es = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x0a0e14 }),
    );
    es.add(sky);
    const panel = (color, intensity, x, y, z, w, h, ry = 0) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.material.color.multiplyScalar(intensity);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      m.rotateY(ry);
      es.add(m);
    };
    panel(0xfff2e0, 5.5, -14, 16, 8, 18, 10);   // warm key above-left
    panel(0x59e8d5, 2.2, 16, -4, -10, 12, 22);  // teal rim
    panel(0x8fa3b8, 1.2, 4, -16, 12, 20, 8);    // cool floor bounce
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(es, 0.045).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    es.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  /* ---------------- SPACE ---------------- */

  _buildStars() {
    const N = this.reduced ? Math.min(3200, this.q.stars) : this.q.stars;
    const pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
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
    this.starN = N;
    this.starU = { uTime: { value: 0 }, uMid: { value: 0 }, uLevel: { value: 0 }, uPix: { value: 1 }, uWarp: { value: 0 }, uFade: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.starU,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize; attribute float aSeed;
        uniform float uTime, uMid, uLevel, uPix, uWarp;
        varying float vA; varying float vSeed;
        void main(){
          vec3 p = position;
          p.z = mix(p.z, mod(p.z + uTime * 260.0 * uWarp, 300.0) - 240.0, step(0.001, uWarp));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = sin(uTime * (0.5 + aSeed * 2.4) + aSeed * 6.2831) * 0.5 + 0.5;
          vA = mix(0.35, 1.0, tw * (0.4 + uMid * 1.4)) + uWarp * 0.5;
          vSeed = aSeed;
          gl_PointSize = aSize * (1.0 + uLevel * 1.1 + uWarp * 2.4) * uPix * (160.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying float vSeed;
        uniform float uFade;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.05, length(q));
          vec3 warm = vec3(0.95, 0.90, 0.82);
          vec3 cool = vec3(0.62, 0.95, 0.90);
          vec3 col = mix(warm, cool, step(0.72, vSeed));
          gl_FragColor = vec4(col, d * vA * uFade);
        }`,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildDust() {
    const N = (this.reduced || !this.q.dust) ? 0 : 900;
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
    this.dustU = { uTime: { value: 0 }, uBass: { value: 0 }, uPix: { value: 1 }, uFade: { value: 1 } };
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
        uniform float uFade;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.0, length(q));
          gl_FragColor = vec4(0.35, 0.91, 0.84, d * vA * uFade);
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
      mk(['rgba(88,108,138,0.7)', 'rgba(36,50,74,0.2)'], 110, -70, -190, 300),
      mk(['rgba(70,190,175,0.8)', 'rgba(20,80,85,0.22)'], 40, -150, -170, 240),
    ];
  }

  _buildMilkyWay() {
    const m = new THREE.SpriteMaterial({
      map: milkyWayTexture(),
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.10,
    });
    this.milky = new THREE.Sprite(m);
    this.milky.position.set(70, 30, -330);
    this.milky.scale.set(640, 200, 1);
    this.milky.material.rotation = -0.32;
    this.scene.add(this.milky);
  }

  _buildMoon() {
    const tex = new THREE.CanvasTexture(this._fbm.canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: moonAlbedo(this._fbm),
      color: 0xd8dade, roughness: 1.0, metalness: 0.0,
      bumpMap: tex, bumpScale: 4.2,
      displacementMap: tex, displacementScale: 0.3, displacementBias: -0.15,
      envMapIntensity: 0.25,
    });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(8.5, 128, 128), mat);
    this.moonHome = new THREE.Vector3(11, -132, -18);
    this.moon.position.copy(this.moonHome);
    this.scene.add(this.moon);

    // halo: not an atmosphere, a lens breathing against the black
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(190,215,255,0.32)', 'rgba(90,140,200,0.07)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.10,
    }));
    this.moonHalo.position.copy(this.moonHome).add(new THREE.Vector3(1.5, 0.5, -7));
    this.moonHalo.scale.setScalar(34);
    this.scene.add(this.moonHalo);

    this.key = new THREE.DirectionalLight(0xf2ede2, 2.6);
    this.key.position.set(-30, 10, 18);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0x59e8d5, 0.55);
    this.rim.position.set(26, -8, -20);
    this.scene.add(this.rim);
    this.amb = new THREE.AmbientLight(0x14161c, 2.2);
    this.scene.add(this.amb);
  }

  _buildRibbon() {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      pts.push(new THREE.Vector3(
        Math.sin(i * 1.25) * 9 + 2,
        -14 - i * 3.4,
        -14 - Math.cos(i * 0.9) * 8,
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
    this.ribbon = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x59e8d5, transparent: true, opacity: 0.55,
    }));
    this.ribbon.geometry.setDrawRange(0, 0);
    this.scene.add(this.ribbon);
    const nodeGeo = new THREE.SphereGeometry(0.22, 10, 10);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x9cfff1, transparent: true, opacity: 0.9 });
    this.ribbonDots = pts.map((p) => {
      const m = new THREE.Mesh(nodeGeo, nodeMat);
      m.position.copy(p);
      m.visible = false;
      this.scene.add(m);
      return m;
    });
  }

  _buildSlabs() {
    this.slabs = new THREE.Group();
    const geo = new THREE.BoxGeometry(3.0, 4.2, 0.16);
    const edges = new THREE.EdgesGeometry(geo);
    for (let i = 0; i < 3; i++) {
      const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x14161b, metalness: 0.85, roughness: 0.35,
      }));
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x59e8d5, transparent: true, opacity: 0.35,
      }));
      slab.add(line);
      slab.position.set(-1.6 + i * 1.6, (i - 1) * 0.5, -i * 1.4);
      slab.rotation.y = i * 0.5;
      this.slabs.add(slab);
    }
    this.slabs.position.set(9, -54, -16);
    this.scene.add(this.slabs);
  }

  /* ---------------- OCEAN ---------------- */

  _buildOcean() {
    this.ocean = new THREE.Group();
    this.ocean.visible = false;
    this.scene.add(this.ocean);

    /* living surface, seen from below; ripple ring buffer fed by the hand */
    this.rip = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0));
    this.ripI = 0;
    const seg = this.q.waterSeg;
    this.surfU = {
      uTime: { value: 0 }, uOp: { value: 0 }, uMid: { value: 0 },
      uCur: { value: new THREE.Vector2() }, uRip: { value: this.rip },
    };
    this.surface = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220, seg, seg),
      new THREE.ShaderMaterial({
        uniforms: this.surfU,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: `
          uniform float uTime; uniform vec2 uCur; uniform vec4 uRip[${RIPPLES}];
          varying float vH; varying vec2 vUv;
          void main(){
            vUv = uv;
            vec3 p = position;
            vec2 q = p.xy + uCur * 8.0;
            float h = sin(dot(q, vec2(0.08, 0.075)) + uTime * 0.7) * 0.55
                    + sin(dot(q, vec2(-0.06, 0.10)) + uTime * 0.9) * 0.42
                    + sin(dot(q, vec2(0.12, -0.07)) + uTime * 1.4) * 0.26
                    + sin(dot(q, vec2(-0.17, -0.19)) + uTime * 1.9) * 0.15;
            for (int i = 0; i < ${RIPPLES}; i++) {
              vec4 r = uRip[i];
              float age = uTime - r.z;
              if (r.w < 0.001 || age < 0.0) continue;
              float d = distance(p.xy, r.xy);
              h += sin(d * 2.1 - age * 8.5) * r.w * exp(-d * 0.24) * max(0.0, 1.0 - age * 0.5);
            }
            p.z += h;
            vH = h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          uniform float uOp, uMid;
          varying float vH; varying vec2 vUv;
          void main(){
            float crest = smoothstep(-0.9, 1.3, vH);
            vec3 deepc = vec3(0.012, 0.10, 0.13);
            vec3 lightc = vec3(0.26, 0.74, 0.74);
            vec3 col = mix(deepc, lightc, crest * 0.38) * (0.9 + uMid * 0.5);
            float ex = smoothstep(0.20, 0.5, abs(vUv.x - 0.5));
            float ey = smoothstep(0.20, 0.5, abs(vUv.y - 0.5));
            float edge = max(ex, ey);
            gl_FragColor = vec4(col, uOp * (1.0 - edge) * (0.30 + crest * 0.22));
          }`,
      }),
    );
    this.surface.rotation.x = Math.PI / 2;
    this.ocean.add(this.surface);

    /* god rays hanging from the surface */
    this.rays = [];
    const rayMat = (w) => new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uSeed: { value: Math.random() * 10 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime, uOp, uSeed;
        varying vec2 vUv;
        void main(){
          float core = pow(sin(vUv.x * 3.14159), 1.6);
          float fallOff = pow(1.0 - vUv.y, 1.7);
          float shimmer = 0.88 + 0.12 * sin(vUv.x * ${(14 + Math.random() * 14).toFixed(1)} + uTime * 1.3 + uSeed);
          gl_FragColor = vec4(0.55, 0.85, 0.88, uOp * core * fallOff * shimmer);
        }`,
    });
    for (let i = 0; i < this.q.rays; i++) {
      const w = 3 + Math.random() * 7;
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(w, 46), rayMat(w));
      ray.position.set((Math.random() - 0.5) * 90, -8, -30 - Math.random() * 45);
      ray.rotation.y = (Math.random() - 0.5) * 0.9;
      ray.userData = { sway: Math.random() * TAU, x0: ray.position.x };
      this.rays.push(ray);
      this.ocean.add(ray);
    }

    /* seabed displaced on the CPU from the fbm field + caustic web above it */
    const bedGeo = new THREE.PlaneGeometry(420, 420, 80, 80);
    {
      const p = bedGeo.attributes.position;
      const { data, size } = this._fbm;
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) / 420 + 0.5) * (size - 1);
        const v = (p.getY(i) / 420 + 0.5) * (size - 1);
        const h = data[((v | 0) * size + (u | 0)) * 4] / 255;
        p.setZ(i, h * 9);
      }
      bedGeo.computeVertexNormals();
    }
    this.bed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({
      color: 0x11242b, roughness: 0.95, metalness: 0.05,
      transparent: true, opacity: 0,
    }));
    this.bed.rotation.x = -Math.PI / 2;
    this.ocean.add(this.bed);

    this.causU = { uTime: { value: 0 }, uOp: { value: 0 } };
    this.caustics = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.ShaderMaterial({
        uniforms: this.causU,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uTime, uOp;
          varying vec2 vUv;
          vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
          float caustic(vec2 p){
            vec2 g = floor(p), f = fract(p);
            float f1 = 8.0, f2 = 8.0;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
              vec2 o = vec2(float(x), float(y));
              vec2 h = h2(g + o);
              vec2 r = o + h + 0.35 * sin(uTime * 0.8 + 6.2831 * h) - f;
              float d = dot(r, r);
              if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
            }
            return 1.0 - smoothstep(0.0, 0.10, f2 - f1);
          }
          void main(){
            float c = caustic(vUv * 46.0) * 0.7 + caustic(vUv * 82.0 + 17.0) * 0.3;
            float fade = smoothstep(0.42, 0.16, distance(vUv, vec2(0.5)));
            gl_FragColor = vec4(0.42, 0.88, 0.83, pow(c, 2.6) * uOp * fade);
          }`,
      }),
    );
    this.caustics.rotation.x = -Math.PI / 2;
    this.ocean.add(this.caustics);

    /* marine snow: slow drifting particulate */
    const SN = this.reduced ? Math.min(120, this.q.snow) : this.q.snow;
    const sp = new Float32Array(SN * 3), ss = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 70;
      sp[i * 3 + 1] = (Math.random() - 0.5) * 46;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 60;
      ss[i] = Math.random();
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    this.snowU = { uTime: { value: 0 }, uPix: { value: 1 }, uFade: { value: 0 }, uCur: { value: new THREE.Vector2() } };
    this.snow = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
      uniforms: this.snowU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uPix; uniform vec2 uCur;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime * (0.25 + aSeed * 0.5) + 23.0, 46.0) - 23.0;
          p.x += sin(uTime * (0.15 + aSeed * 0.4) + aSeed * 40.0) * 1.6 + uCur.x * (2.0 + aSeed * 3.0);
          p.z += uCur.y * (1.0 + aSeed * 2.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = 0.16 * smoothstep(34.0, 8.0, -mv.z);
          gl_PointSize = (1.6 + aSeed * 3.2) * uPix * (76.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        uniform float uFade;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.06, length(q));
          gl_FragColor = vec4(0.78, 0.92, 0.92, d * vA * uFade);
        }`,
    }));
    this.ocean.add(this.snow);

    /* bubbles: rising rings; the hand "rows" them brighter nearby */
    const BN = this.q.bubbles;
    const bp = new Float32Array(BN * 3), bs = new Float32Array(BN);
    for (let i = 0; i < BN; i++) {
      bp[i * 3] = (Math.random() - 0.5) * 60;
      bp[i * 3 + 1] = (Math.random() - 0.5) * 46;
      bp[i * 3 + 2] = (Math.random() - 0.5) * 50;
      bs[i] = Math.random();
    }
    const bubGeo = new THREE.BufferGeometry();
    bubGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bubGeo.setAttribute('aSeed', new THREE.BufferAttribute(bs, 1));
    this.bubU = {
      uTime: { value: 0 }, uPix: { value: 1 }, uFade: { value: 0 },
      uHand: { value: new THREE.Vector3(0, 0, 999) },
      uHand2: { value: new THREE.Vector3(0, 0, 999) },
      uBurst: { value: 0 },
    };
    this.bubbles = new THREE.Points(bubGeo, new THREE.ShaderMaterial({
      uniforms: this.bubU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uPix, uBurst; uniform vec3 uHand, uHand2;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime * (1.2 + aSeed * 2.2) + 23.0, 46.0) - 23.0;
          p.x += sin(uTime * (0.8 + aSeed) + aSeed * 30.0) * 0.7;
          float near = 1.0 - smoothstep(2.0, 9.0, min(distance(p, uHand), distance(p, uHand2)));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.10 + near * (0.30 + uBurst * 0.5)) * smoothstep(36.0, 6.0, -mv.z);
          gl_PointSize = (2.2 + aSeed * 3.4) * (1.0 + near * (0.8 + uBurst)) * uPix * (86.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        uniform float uFade;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          float ring = smoothstep(0.5, 0.40, d) * smoothstep(0.26, 0.36, d);
          float glint = smoothstep(0.16, 0.0, distance(q, vec2(-0.12, 0.12)));
          gl_FragColor = vec4(0.75, 0.95, 0.95, (ring * 0.85 + glint * 0.5 + 0.05) * vA * uFade);
        }`,
    }));
    this.ocean.add(this.bubbles);
  }

  /* dark-steel patrol submarine; replaces the moon underwater */
  _buildSubmarine() {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x222a31, metalness: 0.85, roughness: 0.38,
      clearcoat: 0.3, clearcoatRoughness: 0.3,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x171d22, metalness: 0.7, roughness: 0.5 });
    const warmGlow = new THREE.MeshStandardMaterial({
      color: 0x2a2013, emissive: 0xffd9a0, emissiveIntensity: 1.6,
    });
    const tealGlow = new THREE.MeshStandardMaterial({
      color: 0x0c2825, emissive: 0x59e8d5, emissiveIntensity: 1.8,
    });

    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.0, 10, 6, 28), hullMat);
    hull.rotation.z = Math.PI / 2;
    g.add(hull);

    // deck strake along the spine
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.5, 1.5), darkMat);
    deck.position.y = 1.85;
    g.add(deck);

    // sail / conning tower
    const sail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.3, 1.1), hullMat);
    sail.position.set(1.4, 3.0, 0);
    g.add(sail);
    const sailCap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 16), hullMat);
    sailCap.rotation.z = Math.PI / 2;
    sailCap.position.set(1.4, 4.1, 0);
    g.add(sailCap);
    const window_ = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.14), warmGlow);
    window_.position.set(1.4, 3.6, 0);
    g.add(window_);
    const peri1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8), darkMat);
    peri1.position.set(0.9, 4.9, 0);
    g.add(peri1);
    const peri2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.9, 8), darkMat);
    peri2.position.set(1.7, 4.75, 0.2);
    g.add(peri2);

    // dive planes + stern control surfaces
    const plane = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hullMat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    plane(1.5, 0.14, 4.6, 1.4, 2.6, 0);      // sail planes
    plane(1.8, 0.16, 5.6, -5.6, 0, 0);       // stern horizontal
    plane(1.8, 5.6, 0.16, -5.6, 0, 0);       // stern vertical

    // propeller
    this.prop = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 14), darkMat);
    hub.rotation.z = Math.PI / 2;
    this.prop.add(hub);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.5), hullMat);
      blade.position.y = 0.85;
      const holder = new THREE.Group();
      holder.rotation.x = (i / 5) * TAU;
      blade.rotation.y = 0.6;
      holder.add(blade);
      this.prop.add(holder);
    }
    this.prop.position.set(-7.6, 0, 0);
    g.add(this.prop);

    // portholes + running lights
    const ph = new THREE.SphereGeometry(0.13, 8, 8);
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(ph, warmGlow);
        p.position.set(-3 + i * 1.5, -0.2, s * 1.98);
        g.add(p);
      }
    }
    const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), tealGlow);
    bowLight.position.set(7.3, 0.6, 0);
    g.add(bowLight);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), tealGlow);
    this.beacon.position.set(1.4, 5.85, 0);
    g.add(this.beacon);

    // headlight + visible beam
    const spot = new THREE.SpotLight(0xcfeaff, 160, 80, 0.36, 0.55, 1.1);
    spot.position.set(7.0, 0, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(40, -6, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uOp; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(0.7, 0.88, 0.95, pow(vUv.y, 1.6) * uOp); }`,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(5.5, 26, 22, 1, true), this.beamMat);
    beam.rotation.z = -Math.PI / 2 - 0.12;
    beam.position.set(19.5, -2.4, 0);
    g.add(beam);

    // a cool local fill so the hull reads even in the murk
    const fill = new THREE.PointLight(0x8fe0e8, 26, 36, 1.5);
    fill.position.set(2, 7, 10);
    g.add(fill);

    g.position.copy(this.moonHome);
    g.rotation.y = -0.45;
    g.scale.setScalar(0.001);
    g.visible = false;
    this.sub = g;
    this.scene.add(g);
  }

  /* camera-locked foam sweep: the visible act of submersion */
  _buildFoam() {
    this.foamU = { uProg: { value: 0 }, uDir: { value: 1 }, uTime: { value: 0 } };
    this.foam = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.foamU,
        transparent: true, depthTest: false, depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uProg, uDir, uTime;
          varying vec2 vUv;
          float n(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          float sn(float x){
            float i = floor(x), f = fract(x);
            return mix(n(vec2(i, 7.0)), n(vec2(i + 1.0, 7.0)), f * f * (3.0 - 2.0 * f));
          }
          void main(){
            float pr = uDir > 0.5 ? uProg : 1.0 - uProg;
            float line = -0.18 + pr * 1.36;
            float wob = sin(vUv.x * 21.0 + uTime * 7.0) * 0.012
                      + sin(vUv.x * 47.0 - uTime * 11.0) * 0.007;
            float y = vUv.y - wob;
            float foam = exp(-pow((y - line) * 26.0, 2.0));
            foam *= 0.80 + 0.20 * sn(vUv.x * 34.0 + uTime * 1.8);
            float under = smoothstep(line + 0.015, line - 0.12, y);
            float floodA = uDir > 0.5 ? (1.0 - smoothstep(0.72, 1.0, uProg)) : 1.0;
            float vis = smoothstep(0.0, 0.03, uProg) * (1.0 - smoothstep(0.985, 1.0, uProg));
            vec3 water = vec3(0.05, 0.22, 0.27);
            vec3 col = mix(water, vec3(0.85, 0.97, 0.95), clamp(foam, 0.0, 1.0));
            float a = max(under * 0.38 * floodA, foam * 0.85) * vis;
            gl_FragColor = vec4(col, a);
          }`,
      }),
    );
    this.foam.renderOrder = 999;
    this.foam.frustumCulled = false;
    this.foam.position.set(0, 0, -1.4);
    this.foam.visible = false;
    this.camera.add(this.foam);
  }

  /* ---------------- API ---------------- */

  triggerWarp() { if (this.mix < 0.5) this.warp = 1; }

  toggleMode() {
    if (this.trans) return null;
    const next = this.mode === 'space' ? 'ocean' : 'space';
    this.trans = { t0: this.t, dir: next === 'ocean' ? 1 : 0 };
    this.mode = next;
    this.foam.visible = true;
    this.ocean.visible = true;
    this.sub.visible = true;
    return next;
  }

  /* hand → water. nx/ny are mirrored screen coords 0..1; top of the
     screen maps to far water, bottom to the water just overhead */
  pokeWater(nx, ny, amp = 0.5) {
    const v = this.rip[this.ripI = (this.ripI + 1) % RIPPLES];
    v.set((nx - 0.5) * 64, -64 + ny * 76, this.t, Math.min(amp, 1.2));
  }

  /* continuous hand presence for bubbles (world-approximate); i = 0 | 1 */
  setHand(i, nx, ny, speed) {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 14;
    const w = h * this.camera.aspect;
    const u = i === 1 ? this.bubU.uHand2 : this.bubU.uHand;
    u.value.set(
      this.camera.position.x + (nx - 0.5) * 2 * w,
      this.camera.position.y - (ny - 0.5) * 2 * h,
      this.camera.position.z - 14,
    );
    this.bubU.uBurst.value = Math.min(this.bubU.uBurst.value + speed * 0.02, 1);
  }

  /* bi-pinch portal: live world-scale flourish while both hands pinch */
  setPortal(v) {
    this.portalT = Math.max(0.78, Math.min(1.55, v));
  }

  /* governor hooks */
  setDprCap(v) { this.dprCap = v; this.resize(); }
  setDust(on) {
    if (this.dust) this.dust.visible = on;
    this.snow.visible = on;
  }
  setStarFrac(f) {
    this.stars.geometry.setDrawRange(0, Math.floor(this.starN * f));
  }

  setScroll(progress) {
    this.targetScroll = progress * (this.sectionCount - 1);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pix = Math.min(devicePixelRatio || 1, innerWidth < 700 ? Math.min(1.5, this.dprCap) : this.dprCap);
    this.pix = pix;
    this.renderer.setPixelRatio(pix);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // foam sweep must out-cover the frustum even at peak warp fov
    this.foam.scale.set(2.4 * this.camera.aspect, 2.4, 1);
    this.starU.uPix.value = pix;
    if (this.dustU) this.dustU.uPix.value = pix;
    this.snowU.uPix.value = pix;
    this.bubU.uPix.value = pix;
  }

  frame(dt, audio, input) {
    this.t += dt;
    const calm = this.reduced;
    const { bass = 0, mid = 0, level = 0 } = audio || {};
    const cur = input.cur || { x: 0, y: 0 };

    /* transition progress → eased mix */
    if (this.trans) {
      const p = Math.min((this.t - this.trans.t0) / this.DUR, 1);
      this.mix = this.trans.dir ? easeInOut(p) : 1 - easeInOut(p);
      this.foamU.uProg.value = p;
      this.foamU.uDir.value = this.trans.dir;
      this.foamU.uTime.value = this.t;
      if (p >= 1) {
        this.mix = this.trans.dir;
        this.trans = null;
        this.foam.visible = false;
        if (this.mix === 0) { this.ocean.visible = false; this.sub.visible = false; }
      }
    }
    const mix = this.mix;
    const space = 1 - mix;

    // uniforms
    this.starU.uTime.value = this.t;
    this.starU.uMid.value = calm ? 0.12 : mid;
    this.starU.uLevel.value = calm ? 0 : level;
    this.starU.uFade.value = space;
    this.stars.visible = space > 0.01;
    this.milky.material.opacity = 0.10 * space;
    this.milky.visible = space > 0.01;
    if (this.dustU) {
      this.dustU.uTime.value = this.t;
      this.dustU.uBass.value = calm ? 0 : bass;
      this.dustU.uFade.value = space;
    }

    // fog + clear color breathe between worlds
    this.scene.fog.color.copy(this._fogA).lerp(this._fogB, mix);
    this.scene.fog.density = 0.0115 + mix * 0.017;
    this.renderer.setClearColor(this.scene.fog.color, 1);

    // lights crossfade
    this.key.color.copy(this._colTmp.setHex(0xf2ede2)).lerp(this._colTmp2.setHex(0x9fd7e4), mix);
    this.key.intensity = 2.6 - mix * 0.7;
    this.key.position.set(-30 + mix * 26, 10 + mix * 32, 18 - mix * 14);
    this.rim.intensity = 0.55 + mix * 0.3;
    this.amb.color.copy(this._colTmp.setHex(0x14161c)).lerp(this._colTmp2.setHex(0x0d2a33), mix);
    this.amb.intensity = 2.2 + mix * 0.9;

    // nebulae idle near-black, flare with the score; tinted aqua underwater
    this.portal += (this.portalT - this.portal) * Math.min(dt * 6, 1);
    if (!calm) {
      const nScale = 1 - mix * 0.45;
      this.nebulae[0].material.opacity = (0.055 + mid * 0.22) * nScale;
      this.nebulae[1].material.opacity = (0.045 + bass * 0.26) * nScale;
      this.nebulae[2].material.opacity = (0.05 + level * 0.18) * nScale;
      const fov = 58 + bass * 2.4 + this.warp * 16 + mix * 2 - (this.portal - 1) * 14;
      if (Math.abs(fov - this.camera.fov) > 0.08) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }
    this.nebulae.forEach((n) => {
      n.material.color.copy(this._colTmp.setHex(0xffffff)).lerp(this._colTmp2.setHex(0x6fd8e8), mix);
    });

    // camera travels down the field with scroll, drifts on a slow figure
    this.scrollY += (this.targetScroll - this.scrollY) * (calm ? 1 : 0.06);
    const y = -this.scrollY * 26;
    const driftX = calm ? 0 : Math.sin(this.t * 0.05) * 1.6;
    const driftY = calm ? 0 : Math.cos(this.t * 0.04) * 1.1;
    if (!calm && bass > 0.62) this.shake = Math.min(this.shake + (bass - 0.62) * 0.5 * (1 - mix * 0.6), 0.6);
    this.shake *= 0.9;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    // underwater: slow current sway replaces the hard vacuum stillness
    const swayX = mix * Math.sin(this.t * 0.32) * 0.7;
    const swayY = mix * Math.sin(this.t * 0.21 + 2) * 0.4;

    this.camera.position.x = driftX + input.px * 2.2 + sx + swayX;
    this.camera.position.y = y + driftY + input.py * 1.4 + sy + swayY;
    this.camera.position.z = 26;
    this.camera.lookAt(driftX * 0.4 + input.px * 4, y + input.py * 2.5, -30);

    this.warp *= 0.975;
    if (this.warp < 0.003) this.warp = 0;
    this.starU.uWarp.value = this.warp;

    // moon ↔ submarine at the same station
    const moonFocus = Math.max(0, 1 - Math.abs(this.scrollY - 5) * 1.2);
    const moonScale = (1 + (calm ? 0 : bass * 0.045)) * Math.max(space, 0.001);
    this.moon.visible = space > 0.02;
    this.moonHalo.visible = this.moon.visible;
    if (this.moon.visible) {
      this.moon.rotation.y += dt * 0.03;
      this.moon.rotation.x = input.py * 0.3 * moonFocus;
      this.moon.rotation.z = input.px * 0.2 * moonFocus;
      this.moon.scale.setScalar(moonScale);
      this.moon.position.x = this.moonHome.x - moonFocus * 4;
      this.moonHalo.material.opacity = 0.10 * space * (0.7 + level * 0.5);
    }
    if (this.sub.visible) {
      const s = Math.max(mix, 0.001) * 1.04;
      this.sub.scale.setScalar(s);
      this.sub.position.y = this.moonHome.y + Math.sin(this.t * 0.4) * 0.9 * mix;
      this.sub.position.x = this.moonHome.x - moonFocus * 4 + Math.sin(this.t * 0.13) * 2.2 * mix;
      this.sub.rotation.z = Math.sin(this.t * 0.3) * 0.03;
      this.sub.rotation.y = -0.45 + moonFocus * 0.5 + Math.sin(this.t * 0.09) * 0.08;
      this.prop.rotation.x -= dt * (3.2 + bass * 4);
      this.beacon.material.emissiveIntensity = 1.2 + Math.sin(this.t * 2.4) * 0.9;
      this.beamMat.uniforms.uOp.value = 0.10 * mix * (0.8 + mid * 0.5);
    }

    // trajectory ribbon draws itself across the journey section
    const jp = Math.min(Math.max((this.scrollY - 0.55) / 1.6, 0), 1);
    this.ribbon.geometry.setDrawRange(0, Math.floor(161 * jp));
    this.ribbonDots.forEach((d, i) => {
      d.visible = jp > (i + 0.5) / 9;
      if (d.visible) d.scale.setScalar(1 + Math.sin(this.t * 2 + i) * 0.18 + mid * 0.9);
    });

    // payload slabs: slow drift, edges flare with the mids
    this.slabs.rotation.y = this.t * 0.1;
    this.slabs.children.forEach((s, i) => {
      s.rotation.y += dt * (0.12 + i * 0.05);
      s.position.y = (i - 1) * 0.5 + Math.sin(this.t * 0.7 + i * 2.1) * 0.35;
      s.children[0].material.opacity = 0.28 + (calm ? 0 : mid * 0.5);
    });

    // nebulae + milky way follow the camera loosely
    this.nebulae.forEach((n) => {
      n.userData.oy ??= n.position.y;
      n.position.y = n.userData.oy + y * 0.82;
    });
    this.milky.position.y = 30 + y * 0.95;
    if (this.dust) this.dust.position.y = y;

    /* ---- ocean world ---- */
    if (this.ocean.visible) {
      const oceanOp = mix;
      this.surfU.uTime.value = this.t;
      this.surfU.uOp.value = 0.5 * oceanOp;
      this.surfU.uMid.value = calm ? 0.1 : mid;
      this.surfU.uCur.value.set(cur.x, cur.y);
      this.surface.position.y = y + 19;

      this.rays.forEach((r, i) => {
        r.material.uniforms.uTime.value = this.t;
        // squared fade: rays bloom only once the water has settled
        r.material.uniforms.uOp.value = (0.05 + mid * 0.10) * oceanOp * oceanOp;
        r.position.y = y + 17 - 22;
        r.position.x = r.userData.x0 + Math.sin(this.t * 0.12 + r.userData.sway) * 3 + cur.x * 7;
        r.rotation.z = Math.sin(this.t * 0.10 + r.userData.sway) * 0.05 + cur.x * 0.08;
      });

      this.bed.material.opacity = oceanOp;
      this.bed.position.y = y - 26;
      this.caustics.position.y = y - 25.4;
      this.causU.uTime.value = this.t;
      this.causU.uOp.value = (0.10 + bass * 0.08) * oceanOp * oceanOp;

      this.snowU.uTime.value = this.t;
      this.snowU.uFade.value = oceanOp;
      this.snowU.uCur.value.set(cur.x, cur.y);
      this.snow.position.y = y;

      this.bubU.uTime.value = this.t;
      this.bubU.uFade.value = oceanOp;
      this.bubU.uBurst.value *= 0.94;
      this.bubbles.position.y = y;
    }

    /* lazy layer: rockets, koi school, easter eggs, timeline glyphs */
    this.extras?.frame(dt, audio || {}, this, y);

    this.renderer.render(this.scene, this.camera);
  }
}
