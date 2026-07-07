/* Matrix face: when the visitor allows the camera and a face is seen,
   its 478 landmarks are projected as a large, slow, dim constellation of
   mutating hex digits deep behind the content. Atmospheric presence, not
   surveillance aesthetics: low opacity, heavy smoothing, long fades.
   The glyphs live in a 4x4 canvas atlas; each point cycles its digit on
   its own clock. v8 adds the structural read: face oval, lips and eyes
   as hair-thin additive contour lines riding the same smoothed points —
   more precise, still a presence, never surveillance UI.
   Nothing here ever touches the network. */

import * as THREE from '../vendor/three/three.module.min.js';

const N = 478;
const COPIES = 2;                 // second jittered copy for density
const W = 30, H = 34, Z = 26;     // face extent in world units
const GLYPHS = '0123456789ABCDEF';

/* MediaPipe FaceMesh structural contours: oval, lips, both eyes */
const CONTOURS = [
  // face oval
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356],
  [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379],
  [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149],
  [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234],
  [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
  // lips (outer)
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405],
  [405, 321], [321, 375], [375, 291],
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269],
  [269, 270], [270, 409], [409, 291],
  // left eye
  [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133],
  [133, 173], [173, 157], [157, 158], [158, 159], [159, 160], [160, 161], [161, 246], [246, 33],
  // right eye
  [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362],
  [362, 398], [398, 384], [384, 385], [385, 386], [386, 387], [387, 388], [388, 466], [466, 263],
];

function glyphAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.fillStyle = '#fff';
  g.font = '700 92px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) * 128 + 64, y = ((i / 4) | 0) * 128 + 66;
    g.fillText(GLYPHS[i], x, y);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFaceField(deep) {
  const total = N * COPIES;
  const pos = new Float32Array(total * 3);
  const seed = new Float32Array(total);
  const jit = new Float32Array(total * 3);
  for (let i = 0; i < total; i++) {
    seed[i] = Math.random();
    const j = i >= N ? 0.9 : 0.15;
    jit[i * 3] = (Math.random() - 0.5) * j;
    jit[i * 3 + 1] = (Math.random() - 0.5) * j;
    jit[i * 3 + 2] = (Math.random() - 0.5) * j * 2;
  }
  const targets = new Float32Array(total * 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

  const U = {
    uTime: { value: 0 }, uOp: { value: 0 }, uMid: { value: 0 },
    uPix: { value: 1 }, uMode: { value: 0 }, uMap: { value: glyphAtlas() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPix, uOp;
      varying float vSeed; varying float vGlow;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vSeed = aSeed;
        // slow individual flicker; a few points burn brighter
        float fl = sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 43.0) * 0.5 + 0.5;
        vGlow = mix(0.35, 1.0, fl) * (0.7 + step(0.93, aSeed) * 0.8);
        gl_PointSize = (8.0 + aSeed * 7.0) * uPix * (120.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime, uOp, uMid, uMode;
      varying float vSeed; varying float vGlow;
      void main(){
        // each point mutates through the atlas on its own clock
        float idx = floor(mod(vSeed * 61.0 + uTime * (0.5 + vSeed * 1.4), 16.0));
        vec2 cell = vec2(mod(idx, 4.0), floor(idx / 4.0));
        vec2 uv = (cell + gl_PointCoord) / 4.0;
        float a = texture2D(uMap, uv).a;
        vec3 deepc = mix(vec3(0.06, 0.37, 0.39), vec3(0.05, 0.30, 0.44), uMode);
        vec3 brightc = mix(vec3(0.61, 1.0, 0.94), vec3(0.55, 0.95, 1.0), uMode);
        vec3 col = mix(deepc, brightc, vGlow * (0.55 + uMid * 0.6));
        gl_FragColor = vec4(col, a * uOp * vGlow);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  const group = new THREE.Group();
  group.add(points);
  deep.scene.add(group);

  /* structural contour lines share the eased point positions */
  const linePos = new Float32Array(CONTOURS.length * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x59e8d5, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  let fadeTarget = 0, enabled = true, seen = false;
  const anchor = new THREE.Vector3();

  return {
    setFace(lms) {
      if (!enabled) lms = null;
      seen = !!lms;
      fadeTarget = lms ? 0.5 : 0;
      if (!lms) return;
      for (let cpy = 0; cpy < COPIES; cpy++) {
        for (let i = 0; i < N; i++) {
          const o = (cpy * N + i) * 3, j = (cpy * N + i) * 3;
          targets[o] = (0.5 - lms[i].x) * W + jit[j];
          targets[o + 1] = (0.42 - lms[i].y) * H + jit[j + 1];
          targets[o + 2] = -lms[i].z * Z + jit[j + 2];
        }
      }
    },
    setEnabled(on) {
      enabled = on;
      if (!on) { fadeTarget = 0; seen = false; }
    },
    frame(dt, mid, mix) {
      const op = U.uOp.value + (fadeTarget - U.uOp.value) * Math.min(dt * 1.4, 1);
      U.uOp.value = op;
      points.visible = op > 0.004;
      if (!points.visible) return;
      U.uTime.value += dt;
      U.uMid.value = mid;
      U.uMode.value = mix;
      U.uPix.value = deep.pix ?? 1;
      // deep backdrop that trails the camera with a long, calm lag
      anchor.set(deep.camera.position.x * 0.3, deep.camera.position.y + 2, -46);
      group.position.lerp(anchor, Math.min(dt * 1.2, 1));
      if (seen) {
        const p = geo.attributes.position.array;
        const k = Math.min(dt * 7, 1);
        for (let i = 0; i < p.length; i++) p[i] += (targets[i] - p[i]) * k;
        geo.attributes.position.needsUpdate = true;
        // contours ride the first (tight-jitter) copy of the points
        for (let s = 0; s < CONTOURS.length; s++) {
          const [a, b] = CONTOURS[s];
          const o = s * 6;
          linePos[o] = p[a * 3];     linePos[o + 1] = p[a * 3 + 1]; linePos[o + 2] = p[a * 3 + 2];
          linePos[o + 3] = p[b * 3]; linePos[o + 4] = p[b * 3 + 1]; linePos[o + 5] = p[b * 3 + 2];
        }
        lineGeo.attributes.position.needsUpdate = true;
      }
      lineMat.opacity = op * 0.16 * (0.8 + mid * 0.5);
    },
  };
}
