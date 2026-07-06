/* Cockpit hand: a real-time bionic hand driven by MediaPipe's 21 world
   landmarks, VR-style — joints and bones follow your fingers directly,
   no rig needed. Idle mode poses it procedurally and lets it breathe.
   ponytail: 2 shared geometries + 3 materials; no assets, no skinning. */

import * as THREE from '../vendor/three/three.module.min.js';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [9, 10], [10, 11], [11, 12],             // middle
  [13, 14], [14, 15], [15, 16],            // ring
  [0, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [5, 9], [9, 13], [13, 17],               // knuckle bridge
];
const TIPS = new Set([4, 8, 12, 16, 20]);
const K = 17;          // metres → cockpit units
const DEPTH = 7;       // distance in front of the camera

/* relaxed half-open pose, wrist at origin, world-landmark metre scale.
   Each finger: knuckle base, then three phalanges curling gently palm-ward. */
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

export class Hand3D {
  constructor(camera, aspectRef) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);

    const jointGeo = new THREE.SphereGeometry(0.09, 14, 12);
    const boneGeo = new THREE.CylinderGeometry(0.052, 0.062, 1, 10);
    const boneMat = new THREE.MeshStandardMaterial({ color: 0x363b43, metalness: 0.6, roughness: 0.48 });
    this.jointMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47, metalness: 0.55, roughness: 0.5,
      emissive: 0x59e8d5, emissiveIntensity: 0.09,
    });
    this.tipMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d43, metalness: 0.5, roughness: 0.52,
      emissive: 0xc9814f, emissiveIntensity: 0.16,
    });
    // a warm key of its own, range-limited so it barely touches the scene
    const lamp = new THREE.PointLight(0xf2e6d4, 26, 16, 1.8);
    lamp.position.set(-3, 4, 3);
    this.group.add(lamp);

    this.joints = [];
    for (let i = 0; i < 21; i++) {
      const scale = i === 0 ? 1.9 : TIPS.has(i) ? 1.0 : 1.25;
      const m = new THREE.Mesh(jointGeo, TIPS.has(i) ? this.tipMat : this.jointMat);
      m.scale.setScalar(scale);
      this.group.add(m);
      this.joints.push(m);
    }
    this.bones = BONES.map(() => {
      const m = new THREE.Mesh(boneGeo, boneMat);
      this.group.add(m);
      return m;
    });
    const palmMat = new THREE.MeshStandardMaterial({
      color: 0x2c3037, metalness: 0.62, roughness: 0.44,
    });
    this.palm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.16), palmMat);
    this.group.add(this.palm);

    this.target = relaxedPose().map((v) => v.clone().multiplyScalar(K));
    this.cur = this.target.map((v) => v.clone());
    this.anchor = new THREE.Vector3();
    this.anchorTarget = new THREE.Vector3();
    this.idlePose = relaxedPose();
    this.tracked = false;
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._z = new THREE.Vector3(0, 0, 1);
    this._ax = new THREE.Vector3(1, 0, 0);
    this._az = new THREE.Vector3(0, 0, 1);
  }

  _screenAnchor(nx, ny, out) {
    // place the wrist on the camera frustum plane at DEPTH
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * DEPTH;
    const w = h * this.camera.aspect;
    out.set((nx - 0.5) * 2 * w, -(ny - 0.5) * 2 * h, -DEPTH);
  }

  /* live landmarks: world = 21 [x,y,z] metres (unmirrored), cx/cy = screen 0..1 (mirrored) */
  setPose({ world, x, y }) {
    this.tracked = true;
    this._screenAnchor(x, y, this.anchorTarget);
    const w0 = world[0];
    for (let i = 0; i < 21; i++) {
      this.target[i].set(
        -(world[i].x - w0.x) * K,   // mirror to match the on-screen hand
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

  update(dt, level = 0) {
    const k = this.tracked ? 0.45 : 0.06;
    this.anchor.lerp(this.anchorTarget, k);
    for (let i = 0; i < 21; i++) {
      this.cur[i].lerp(this.target[i], this.tracked ? 0.5 : 0.08);
      this.joints[i].position.copy(this.cur[i]).add(this.anchor);
    }
    BONES.forEach(([a, b], i) => {
      const A = this.joints[a].position, B = this.joints[b].position;
      const m = this.bones[i];
      m.position.copy(A).add(B).multiplyScalar(0.5);
      this._tmp.copy(B).sub(A);
      const len = this._tmp.length() || 0.001;
      m.quaternion.setFromUnitVectors(this._up, this._tmp.normalize());
      m.scale.set(1, len, 1);
    });
    // palm plate spans wrist and knuckle bridge
    const w = this.joints[0].position, i5 = this.joints[5].position, i17 = this.joints[17].position;
    this.palm.position.copy(w).add(i5).add(this.joints[9].position).add(i17).multiplyScalar(0.25);
    this._tmp.copy(i5).sub(w);
    const across = i17.clone().sub(i5);
    const normal = this._tmp.clone().cross(across).normalize();
    this.palm.quaternion.setFromUnitVectors(this._z, normal); // local-space, no lookAt
    this.palm.scale.set(across.length() * 0.92, this._tmp.length() * 0.78, 1);
    // the score breathes through the seams
    this.jointMat.emissiveIntensity = 0.09 + level * 0.3;
  }
}
