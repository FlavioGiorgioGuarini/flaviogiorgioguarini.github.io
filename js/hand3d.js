/* Cockpit hands, dual-hand first (v8): TWO real-time bionic hands driven
   by MediaPipe world landmarks, VR-style — joints and bones follow the
   visitor's fingers directly, no rig, no assets.

   Realism pass over v7:
   - anatomical tapering baked into the bone geometry (each phalanx narrows
     toward the tip) on top of per-bone radii;
   - palm volume: palmar plate + dorsal plate + thenar and hypothenar pads
     that follow the live joints, so the hand reads as flesh-over-frame;
   - one shared physical material set under the scene envmap (titanium,
     carbon joints, ceramic tips) — a single lerp drives the whole pair
     between worlds. Ocean morphs them amphibious: iridescent bio-polymer,
     bioluminescent tips, translucent webbing.

   Presence choreography: each hand materializes (scale ease) when its
   track goes live and dissolves when lost. With no camera at all, the
   right hand idles cinematically; the left waits in the dark.
   ponytail: shared geometries and materials across both hands. */

import * as THREE from '../vendor/three/three.module.min.js';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [9, 10], [10, 11], [11, 12],             // middle
  [13, 14], [14, 15], [15, 16],            // ring
  [0, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [5, 9], [9, 13], [13, 17],               // knuckle bridge
];
/* radius factor per bone, tapering toward the tips like a real hand */
const BONE_R = [
  1.5, 1.35, 1.2, 1.0,
  1.3, 1.15, 1.0, 0.85,
  1.2, 1.05, 0.9,
  1.15, 1.0, 0.85,
  1.15, 1.0, 0.9, 0.78,
  0.9, 0.9, 0.9,
];
const TIPS = new Set([4, 8, 12, 16, 20]);
const MCP = new Set([5, 9, 13, 17]);
/* webbing quads: [baseA, jointA, baseB, jointB] */
const WEBS = [[2, 3, 5, 6], [5, 6, 9, 10], [9, 10, 13, 14], [13, 14, 17, 18]];
const K = 17;          // metres → cockpit units
const DEPTH = 7;       // distance in front of the camera

/* material presets: space (bionic titanium) ↔ ocean (amphibious) */
const PRESET = {
  space: {
    bone: { color: 0x5d646e, rough: 0.26, met: 0.94, cc: 0.6, irid: 0, sheen: 0.15 },
    joint: { color: 0x2e333b, rough: 0.42, met: 0.78, em: 0x59e8d5, ei: 0.10 },
    tip: { color: 0x3a3f45, rough: 0.44, met: 0.60, em: 0xbfe8e2, ei: 0.16 },
    palm: { color: 0x31363d, rough: 0.38, met: 0.74, cc: 0.4, sheen: 0.1 },
    web: 0,
  },
  ocean: {
    bone: { color: 0x1d5049, rough: 0.36, met: 0.28, cc: 0.9, irid: 0.8, sheen: 0.9 },
    joint: { color: 0x16403c, rough: 0.44, met: 0.25, em: 0x59e8d5, ei: 0.30 },
    tip: { color: 0x1d4f47, rough: 0.38, met: 0.20, em: 0x9cfff1, ei: 0.65 },
    palm: { color: 0x1a453f, rough: 0.42, met: 0.26, cc: 0.7, sheen: 0.8 },
    web: 0.5,
  },
};

/* relaxed half-open pose, wrist at origin, world-landmark metre scale. */
function relaxedPose() {
  const X = new THREE.Vector3(1, 0, 0);
  const p = [new THREE.Vector3(0, 0, 0)];
  const finger = (base, aim, segs, curl) => {
    const out = [new THREE.Vector3(...base)];
    let dir = new THREE.Vector3(...aim).normalize();
    for (const len of segs) {
      dir = dir.clone().applyAxisAngle(X, -curl).normalize();
      out.push(out[out.length - 1].clone().addScaledVector(dir, len));
    }
    return out;
  };
  p.push(...finger([-0.034, 0.018, 0.008], [-0.6, 0.72, -0.15], [0.034, 0.03, 0.026], 0.18)); // thumb 1-4
  p.push(...finger([-0.027, 0.074, 0], [-0.1, 1, 0], [0.038, 0.025, 0.02], 0.24));            // index 5-8
  p.push(...finger([0.0, 0.079, 0], [0, 1, 0], [0.042, 0.028, 0.021], 0.28));                 // middle 9-12
  p.push(...finger([0.025, 0.073, 0], [0.09, 1, 0], [0.038, 0.026, 0.02], 0.32));             // ring 13-16
  p.push(...finger([0.047, 0.062, 0.004], [0.22, 1, 0], [0.03, 0.02, 0.017], 0.36));          // pinky 17-20
  return p;
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpMat(mat, a, b, m) {
  mat.color.copy(_c1.set(a.color)).lerp(_c2.set(b.color), m);
  mat.roughness = a.rough + (b.rough - a.rough) * m;
  mat.metalness = a.met + (b.met - a.met) * m;
  if (a.em != null) {
    mat.emissive.copy(_c1.set(a.em)).lerp(_c2.set(b.em ?? a.em), m);
    mat.emissiveIntensity = a.ei + ((b.ei ?? a.ei) - a.ei) * m;
  }
  if (a.cc != null && 'clearcoat' in mat) mat.clearcoat = a.cc + ((b.cc ?? a.cc) - a.cc) * m;
  if (a.irid != null && 'iridescence' in mat) mat.iridescence = a.irid + ((b.irid ?? a.irid) - a.irid) * m;
  if (a.sheen != null && 'sheen' in mat) mat.sheen = a.sheen + ((b.sheen ?? a.sheen) - a.sheen) * m;
}

/* ---------- one hand: geometry rig + smoothing + presence ---------- */
class OneHand {
  constructor(camera, mats, geos) {
    this.camera = camera;
    this.mats = mats;
    this.group = new THREE.Group();
    camera.add(this.group);

    this.joints = [];
    for (let i = 0; i < 21; i++) {
      const scale = i === 0 ? 1.9 : TIPS.has(i) ? 0.95 : MCP.has(i) ? 1.35 : 1.12;
      const m = new THREE.Mesh(geos.joint, TIPS.has(i) ? mats.tip : mats.joint);
      m.scale.setScalar(scale);
      if (TIPS.has(i)) m.scale.y *= 1.18;   // fingertip pads, slightly oval
      this.group.add(m);
      this.joints.push(m);
    }
    this.bones = BONES.map((_, i) => {
      const m = new THREE.Mesh(geos.bone, mats.bone);
      m.userData.r = BONE_R[i];
      this.group.add(m);
      return m;
    });

    // palm volume: palmar plate, dorsal plate, thenar + hypothenar pads
    this.palm = new THREE.Mesh(geos.pad, mats.palm);
    this.group.add(this.palm);
    this.dorsal = new THREE.Mesh(geos.pad, mats.bone);
    this.group.add(this.dorsal);
    this.thenar = new THREE.Mesh(geos.pad, mats.palm);
    this.group.add(this.thenar);
    this.hypo = new THREE.Mesh(geos.pad, mats.palm);
    this.group.add(this.hypo);

    // forearm stub with a lit seam ring: anchors the hand to the cockpit
    this.forearm = new THREE.Mesh(geos.forearm, mats.bone);
    this.group.add(this.forearm);
    this.cuff = new THREE.Mesh(geos.cuff, mats.cuff);
    this.group.add(this.cuff);

    // webbing membranes (ocean): 4 quads = 8 triangles, rebuilt per frame
    this.webGeo = new THREE.BufferGeometry();
    this.webPos = new Float32Array(WEBS.length * 6 * 3);
    this.webGeo.setAttribute('position', new THREE.BufferAttribute(this.webPos, 3));
    this.web = new THREE.Mesh(this.webGeo, mats.web);
    this.web.visible = false;
    this.group.add(this.web);

    this.target = relaxedPose().map((v) => v.clone().multiplyScalar(K));
    this.cur = this.target.map((v) => v.clone());
    this.anchor = new THREE.Vector3();
    this.anchorTarget = new THREE.Vector3();
    this.idlePose = relaxedPose();
    this.tracked = false;
    this.presence = 0;        // eased 0..1 materialization
    this.presTarget = 0;
    this.idleShrink = 1;      // compact idle: smaller + tucked on narrow frames
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._tmp3 = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._z = new THREE.Vector3(0, 0, 1);
    this._ax = new THREE.Vector3(1, 0, 0);
    this._az = new THREE.Vector3(0, 0, 1);
    this.group.visible = false;
  }

  _screenAnchor(nx, ny, out) {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * DEPTH;
    const w = h * this.camera.aspect;
    out.set((nx - 0.5) * 2 * w, -(ny - 0.5) * 2 * h, -DEPTH);
  }

  /* live landmarks: world = 21 {x,y,z} metres (unmirrored), x/y = screen 0..1 (mirrored) */
  setPose({ world, x, y }) {
    this.tracked = true;
    this.presTarget = 1;
    this._screenAnchor(x, y, this.anchorTarget);
    const w0 = world[0];
    for (let i = 0; i < 21; i++) {
      this.target[i].set(
        -(world[i].x - w0.x) * K,
        -(world[i].y - w0.y) * K,
        -(world[i].z - w0.z) * K * 0.85,
      );
    }
  }

  setIdle(t, px, py, compact = 0) {
    this.tracked = false;
    this.presTarget = 1;
    /* compact 0..1: portrait frames and the sea floor tuck the hand into
       the corner and shrink it so it never blankets copy or CTAs */
    this.idleShrink = 1 - compact * 0.42;
    this._screenAnchor(0.74 + compact * 0.15 + px * 0.015, 0.86 + compact * 0.09 + py * 0.012, this.anchorTarget);
    const breathe = Math.sin(t * 0.9) * 0.15;
    const tiltZ = 0.42 + Math.sin(t * 0.23) * 0.05 + px * 0.12;
    const tiltX = -0.34 + py * 0.14;
    for (let i = 0; i < 21; i++) {
      const b = this.idlePose[i];
      this.target[i].set(b.x * K, b.y * K, b.z * K - breathe)
        .applyAxisAngle(this._az, tiltZ)
        .applyAxisAngle(this._ax, tiltX);
    }
  }

  drop() { this.tracked = false; this.presTarget = 0; }

  update(dt) {
    this.presence += (this.presTarget - this.presence) * Math.min(dt * 3.2, 1);
    const vis = this.presence > 0.015;
    this.group.visible = vis;
    if (!vis) return;
    const s = (0.25 + this.presence * 0.75) * (this.tracked ? 1 : this.idleShrink);
    this.group.scale.setScalar(s);           // materialize: grow into place

    const k = this.tracked ? 0.45 : 0.06;
    this.anchor.lerp(this.anchorTarget, k);
    for (let i = 0; i < 21; i++) {
      this.cur[i].lerp(this.target[i], this.tracked ? 0.55 : 0.08);
      this.joints[i].position.copy(this.cur[i]).add(this.anchor);
    }
    BONES.forEach(([a, b], i) => {
      const A = this.joints[a].position, B = this.joints[b].position;
      const m = this.bones[i];
      m.position.copy(A).add(B).multiplyScalar(0.5);
      this._tmp.copy(B).sub(A);
      const len = this._tmp.length() || 0.001;
      m.quaternion.setFromUnitVectors(this._up, this._tmp.normalize());
      m.scale.set(m.userData.r, len, m.userData.r);
    });

    // palmar/dorsal plates span wrist and knuckle bridge
    const w = this.joints[0].position, i5 = this.joints[5].position,
          i9 = this.joints[9].position, i17 = this.joints[17].position;
    this.palm.position.copy(w).add(i5).add(i9).add(i17).multiplyScalar(0.25);
    this._tmp.copy(i5).sub(w);
    const across = this._tmp2.copy(i17).sub(i5);
    const normal = this._tmp3.crossVectors(this._tmp, across).normalize();
    this.palm.quaternion.setFromUnitVectors(this._z, normal);
    const spanY = this._tmp.length();
    const spanX = across.length();
    this.palm.scale.set(spanX * 0.5, spanY * 0.42, 0.24);
    this.dorsal.position.copy(this.palm.position).addScaledVector(normal, -0.12);
    this.dorsal.quaternion.copy(this.palm.quaternion);
    this.dorsal.scale.set(spanX * 0.36, spanY * 0.34, 0.14);

    // thenar pad rides the thumb root; hypothenar hugs the pinky edge
    const j1 = this.joints[1].position, j2 = this.joints[2].position;
    this.thenar.position.copy(j1).add(j2).add(w).multiplyScalar(1 / 3)
      .addScaledVector(normal, 0.05);
    this.thenar.quaternion.copy(this.palm.quaternion);
    this.thenar.scale.set(spanX * 0.20, spanY * 0.24, 0.20);
    this.hypo.position.copy(w).add(i17).multiplyScalar(0.5).addScaledVector(normal, 0.04);
    this.hypo.quaternion.copy(this.palm.quaternion);
    this.hypo.scale.set(spanX * 0.16, spanY * 0.30, 0.16);

    // forearm continues the wrist→knuckle axis backwards
    const mid = this._tmp.copy(i5).add(i9).add(i17).multiplyScalar(1 / 3);
    const back = this._tmp2.copy(w).sub(mid).normalize();
    this.forearm.position.copy(w).addScaledVector(back, 0.85);
    this.forearm.quaternion.setFromUnitVectors(this._up, back);
    this.cuff.position.copy(w).addScaledVector(back, 1.55);
    this.cuff.quaternion.copy(this.forearm.quaternion);
    this.cuff.rotateX(Math.PI / 2);

    // webbing follows the finger roots
    if (this.web.visible) {
      const P = this.webPos;
      WEBS.forEach(([a1, a2, b1, b2], q) => {
        const A1 = this.joints[a1].position, A2 = this.joints[a2].position;
        const B1 = this.joints[b1].position, B2 = this.joints[b2].position;
        let o = q * 18;
        const put = (v) => { P[o++] = v.x; P[o++] = v.y; P[o++] = v.z; };
        put(A1); put(B1); put(A2);
        put(A2); put(B1); put(B2);
      });
      this.webGeo.attributes.position.needsUpdate = true;
      this.webGeo.computeVertexNormals();
    }
  }
}

/* ---------- the pair ---------- */
export class Hands3D {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0 space · 1 ocean

    this.mats = {
      bone: new THREE.MeshPhysicalMaterial({
        color: 0x5d646e, metalness: 0.94, roughness: 0.26,
        clearcoat: 0.6, clearcoatRoughness: 0.25,
        iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 480],
        sheen: 0.15, sheenColor: new THREE.Color(0x9cfff1), sheenRoughness: 0.5,
      }),
      joint: new THREE.MeshStandardMaterial({
        color: 0x2e333b, metalness: 0.78, roughness: 0.42,
        emissive: 0x59e8d5, emissiveIntensity: 0.10,
      }),
      tip: new THREE.MeshStandardMaterial({
        color: 0x3a3f45, metalness: 0.6, roughness: 0.44,
        emissive: 0xbfe8e2, emissiveIntensity: 0.16,
      }),
      palm: new THREE.MeshPhysicalMaterial({
        color: 0x31363d, metalness: 0.74, roughness: 0.38, clearcoat: 0.4,
        sheen: 0.1, sheenColor: new THREE.Color(0x9cfff1), sheenRoughness: 0.5,
      }),
      cuff: new THREE.MeshStandardMaterial({
        color: 0x0c2825, emissive: 0x59e8d5, emissiveIntensity: 1.1,
      }),
      web: new THREE.MeshPhysicalMaterial({
        color: 0x0d3f3a, metalness: 0.1, roughness: 0.35,
        transparent: true, opacity: 0, side: THREE.DoubleSide,
        iridescence: 0.9, iridescenceIOR: 1.3,
        sheen: 1, sheenColor: new THREE.Color(0x59e8d5), sheenRoughness: 0.4,
        depthWrite: false,
      }),
    };
    this.geos = {
      joint: new THREE.SphereGeometry(0.09, 16, 14),
      bone: new THREE.CylinderGeometry(0.047, 0.058, 1, 12),  // baked phalanx taper
      pad: new THREE.CapsuleGeometry(0.5, 0.55, 6, 14),
      forearm: new THREE.CylinderGeometry(0.30, 0.36, 1.5, 18),
      cuff: new THREE.TorusGeometry(0.37, 0.022, 10, 32),
    };

    // one warm key for the pair, range-limited so it barely touches the scene
    this.lamp = new THREE.PointLight(0xf2e6d4, 26, 16, 1.8);
    this.lamp.position.set(-3, 4, 3);
    camera.add(this.lamp);

    this.hand = {
      R: new OneHand(camera, this.mats, this.geos),
      L: new OneHand(camera, this.mats, this.geos),
    };
    this.liveCount = 0;
  }

  /* feed the vision hands array (0, 1 or 2 entries) every detection frame */
  setHands(list) {
    this.liveCount = list.length;
    const seen = { L: false, R: false };
    for (const h of list) {
      seen[h.uid] = true;
      this.hand[h.uid].setPose(h);
    }
    if (!seen.L && this.hand.L.tracked) this.hand.L.drop();
    if (!seen.R && this.hand.R.tracked) this.hand.R.drop();
  }

  /* no camera / no hands: the right hand keeps a cinematic idle */
  setIdle(t, px, py, compact = 0) {
    this.hand.R.setIdle(t, px, py, compact);
    this.hand.L.drop();
  }

  /* 0 = space, 1 = ocean; called with the scene's eased mix every frame */
  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    const S = PRESET.space, O = PRESET.ocean;
    lerpMat(this.mats.bone, S.bone, O.bone, m);
    lerpMat(this.mats.joint, S.joint, O.joint, m);
    lerpMat(this.mats.tip, S.tip, O.tip, m);
    lerpMat(this.mats.palm, S.palm, O.palm, m);
    const webOp = S.web + (O.web - S.web) * m;
    this.mats.web.opacity = webOp;
    const webVis = webOp > 0.02;
    this.hand.L.web.visible = webVis && this.hand.L.group.visible;
    this.hand.R.web.visible = webVis && this.hand.R.group.visible;
    this.lamp.color.setHex(m > 0.5 ? 0xbfeee8 : 0xf2e6d4);
  }

  update(dt, level = 0) {
    this.hand.R.update(dt);
    this.hand.L.update(dt);
    // keep webbing flags honest as hands materialize/dissolve
    const webOn = this.mats.web.opacity > 0.02;
    this.hand.R.web.visible = webOn && this.hand.R.group.visible;
    this.hand.L.web.visible = webOn && this.hand.L.group.visible;
    // the score breathes through the seams; ocean glows harder
    this.mats.joint.emissiveIntensity = 0.10 + this.mode * 0.20 + level * 0.3;
    this.mats.cuff.emissiveIntensity = 1.1 + level * 1.4;
  }
}
