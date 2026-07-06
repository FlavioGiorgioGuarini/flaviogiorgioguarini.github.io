/* Cockpit hand: a real-time bionic hand driven by MediaPipe's 21 world
   landmarks, VR-style — joints and bones follow your fingers directly.
   v7 realism pass: physical materials under the scene envmap (titanium
   phalanges, carbon joints, ceramic tips), anatomical per-bone tapering,
   rounded palm plate, forearm stub with a lit seam ring.
   Ocean mode morphs it amphibious: iridescent bio-polymer, bioluminescent
   tips, translucent webbing stretched between the fingers.
   ponytail: shared geometries, zero assets, zero skinning. */

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
    bone: { color: 0x585f69, rough: 0.30, met: 0.92, cc: 0.5, irid: 0 },
    joint: { color: 0x2e333b, rough: 0.42, met: 0.78, em: 0x59e8d5, ei: 0.10 },
    tip: { color: 0x3a3f45, rough: 0.48, met: 0.60, em: 0xbfe8e2, ei: 0.16 },
    palm: { color: 0x31363d, rough: 0.40, met: 0.72 },
    web: 0,
  },
  ocean: {
    bone: { color: 0x1d5049, rough: 0.36, met: 0.30, cc: 0.9, irid: 0.75 },
    joint: { color: 0x16403c, rough: 0.44, met: 0.25, em: 0x59e8d5, ei: 0.30 },
    tip: { color: 0x1d4f47, rough: 0.38, met: 0.20, em: 0x9cfff1, ei: 0.65 },
    palm: { color: 0x1a453f, rough: 0.42, met: 0.28 },
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
}

export class Hand3D {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.mode = 0; // 0 space · 1 ocean

    const jointGeo = new THREE.SphereGeometry(0.09, 16, 14);
    const boneGeo = new THREE.CylinderGeometry(0.05, 0.06, 1, 12);
    this.boneMat = new THREE.MeshPhysicalMaterial({
      color: 0x585f69, metalness: 0.92, roughness: 0.3,
      clearcoat: 0.5, clearcoatRoughness: 0.25,
      iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 480],
    });
    this.jointMat = new THREE.MeshStandardMaterial({
      color: 0x2e333b, metalness: 0.78, roughness: 0.42,
      emissive: 0x59e8d5, emissiveIntensity: 0.10,
    });
    this.tipMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f45, metalness: 0.6, roughness: 0.48,
      emissive: 0xbfe8e2, emissiveIntensity: 0.16,
    });
    this.palmMat = new THREE.MeshPhysicalMaterial({
      color: 0x31363d, metalness: 0.72, roughness: 0.4, clearcoat: 0.35,
    });
    // a warm key of its own, range-limited so it barely touches the scene
    this.lamp = new THREE.PointLight(0xf2e6d4, 26, 16, 1.8);
    this.lamp.position.set(-3, 4, 3);
    this.group.add(this.lamp);

    this.joints = [];
    for (let i = 0; i < 21; i++) {
      const scale = i === 0 ? 1.9 : TIPS.has(i) ? 0.95 : MCP.has(i) ? 1.35 : 1.15;
      const m = new THREE.Mesh(jointGeo, TIPS.has(i) ? this.tipMat : this.jointMat);
      m.scale.setScalar(scale);
      this.group.add(m);
      this.joints.push(m);
    }
    this.bones = BONES.map((_, i) => {
      const m = new THREE.Mesh(boneGeo, this.boneMat);
      m.userData.r = BONE_R[i];
      this.group.add(m);
      return m;
    });

    // rounded palm plate + slimmer dorsal plate for mechanical depth
    const palmGeo = new THREE.CapsuleGeometry(0.5, 0.55, 6, 14);
    this.palm = new THREE.Mesh(palmGeo, this.palmMat);
    this.palm.scale.set(1, 1, 0.24);
    this.group.add(this.palm);
    this.dorsal = new THREE.Mesh(palmGeo, this.boneMat);
    this.dorsal.scale.set(0.72, 0.8, 0.14);
    this.group.add(this.dorsal);

    // forearm stub with a lit seam ring: anchors the hand to the cockpit
    this.forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 1.5, 18), this.boneMat);
    this.group.add(this.forearm);
    this.cuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.022, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x0c2825, emissive: 0x59e8d5, emissiveIntensity: 1.1 }),
    );
    this.group.add(this.cuff);

    // webbing membranes (ocean): 4 quads = 8 triangles, rebuilt per frame
    this.webGeo = new THREE.BufferGeometry();
    this.webPos = new Float32Array(WEBS.length * 6 * 3);
    this.webGeo.setAttribute('position', new THREE.BufferAttribute(this.webPos, 3));
    this.webMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d3f3a, metalness: 0.1, roughness: 0.35,
      transparent: true, opacity: 0, side: THREE.DoubleSide,
      iridescence: 0.9, iridescenceIOR: 1.3,
      sheen: 1, sheenColor: new THREE.Color(0x59e8d5), sheenRoughness: 0.4,
      depthWrite: false,
    });
    this.web = new THREE.Mesh(this.webGeo, this.webMat);
    this.web.visible = false;
    this.group.add(this.web);

    this.target = relaxedPose().map((v) => v.clone().multiplyScalar(K));
    this.cur = this.target.map((v) => v.clone());
    this.anchor = new THREE.Vector3();
    this.anchorTarget = new THREE.Vector3();
    this.idlePose = relaxedPose();
    this.tracked = false;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._z = new THREE.Vector3(0, 0, 1);
    this._ax = new THREE.Vector3(1, 0, 0);
    this._az = new THREE.Vector3(0, 0, 1);
  }

  _screenAnchor(nx, ny, out) {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * DEPTH;
    const w = h * this.camera.aspect;
    out.set((nx - 0.5) * 2 * w, -(ny - 0.5) * 2 * h, -DEPTH);
  }

  /* live landmarks: world = 21 {x,y,z} metres (unmirrored), x/y = screen 0..1 (mirrored) */
  setPose({ world, x, y }) {
    this.tracked = true;
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

  setIdle(t, px, py) {
    this.tracked = false;
    this._screenAnchor(0.74 + px * 0.015, 0.86 + py * 0.012, this.anchorTarget);
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

  /* 0 = space, 1 = ocean; called with the scene's eased mix every frame */
  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    const S = PRESET.space, O = PRESET.ocean;
    lerpMat(this.boneMat, S.bone, O.bone, m);
    lerpMat(this.jointMat, S.joint, O.joint, m);
    lerpMat(this.tipMat, S.tip, O.tip, m);
    lerpMat(this.palmMat, S.palm, O.palm, m);
    const webOp = S.web + (O.web - S.web) * m;
    this.webMat.opacity = webOp;
    this.web.visible = webOp > 0.02;
    this.lamp.color.setHex(m > 0.5 ? 0xbfeee8 : 0xf2e6d4);
  }

  update(dt, level = 0) {
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

    // palm plates span wrist and knuckle bridge
    const w = this.joints[0].position, i5 = this.joints[5].position,
          i9 = this.joints[9].position, i17 = this.joints[17].position;
    this.palm.position.copy(w).add(i5).add(i9).add(i17).multiplyScalar(0.25);
    this._tmp.copy(i5).sub(w);
    const across = this._tmp2.copy(i17).sub(i5);
    const normal = this._tmp.clone().cross(across).normalize();
    this.palm.quaternion.setFromUnitVectors(this._z, normal);
    const spanY = this._tmp.length();
    this.palm.scale.set(across.length() * 0.5, spanY * 0.42, 0.24);
    this.dorsal.position.copy(this.palm.position).addScaledVector(normal, -0.12);
    this.dorsal.quaternion.copy(this.palm.quaternion);
    this.dorsal.scale.set(across.length() * 0.36, spanY * 0.34, 0.14);

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

    // the score breathes through the seams; ocean glows harder
    const base = 0.10 + this.mode * 0.20;
    this.jointMat.emissiveIntensity = base + level * 0.3;
    this.cuff.material.emissiveIntensity = 1.1 + level * 1.4;
  }
}
