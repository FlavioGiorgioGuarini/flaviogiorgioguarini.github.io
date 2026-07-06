/* On-device vision. HandLandmarker runs every frame; FaceLandmarker is
   optional (quality-gated) and runs at 1/3 cadence for the Matrix face
   backdrop. Nothing is recorded; frames never leave the browser.

   Stability stack (v7):
   - One-Euro filters on palm, fingertip and all 21 world landmarks:
     still hand = glass-steady, fast hand = near-zero lag.
   - Per-finger extension hysteresis (enter/exit thresholds) + thumb.
   - Gestures must survive N consecutive frames before they exist,
     and N frames of disagreement before they die. No flicker.
   - 6-frame grace on detection loss so a single bad frame never
     snaps the 3D hand back to idle.

   Emits onHand({x, y, open, dx, dy, speed, world, gesture, tip}) | null
   and onFace(landmarks478 | null). Gestures: point · shaka · horns · middle. */

import { FilesetResolver, HandLandmarker, FaceLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

const WASM_DIR = 'vendor/mediapipe/wasm';

/* One-Euro filter (Casiez et al.): the standard for hand-tracking jitter */
class OneEuro {
  constructor(minCutoff, beta) { this.mc = minCutoff; this.b = beta; this.t = -1; this.x = 0; this.dx = 0; }
  static a(cut, dt) { const r = 6.2832 * cut * dt; return r / (r + 1); }
  f(x, t) {
    if (this.t < 0) { this.t = t; this.x = x; this.dx = 0; return x; }
    const dt = Math.min(Math.max(t - this.t, 1e-3), 0.1);
    this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.a(1.0, dt) * (dx - this.dx);
    this.x += OneEuro.a(this.mc + this.b * Math.abs(this.dx), dt) * (x - this.x);
    return this.x;
  }
  reset() { this.t = -1; }
}

/* finger extension with hysteresis; ratio = tip reach / pip reach from wrist */
const EXT_IN = 1.30, EXT_OUT = 1.16;
const TH_IN = 1.42, TH_OUT = 1.16;   // thumb: tip→pinky-base span vs knuckle width

function makeFingers() {
  return { thumb: false, index: false, middle: false, ring: false, pinky: false };
}
function updateFingers(lm, st) {
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const ratio = (tip, pip) => d(tip, 0) / Math.max(d(pip, 0), 1e-4);
  const upd = (name, r) => {
    if (st[name]) { if (r < EXT_OUT) st[name] = false; }
    else if (r > EXT_IN) st[name] = true;
  };
  upd('index', ratio(8, 6));
  upd('middle', ratio(12, 10));
  upd('ring', ratio(16, 14));
  upd('pinky', ratio(20, 18));
  const tr = d(4, 17) / Math.max(d(5, 17), 1e-4);
  if (st.thumb) { if (tr < TH_OUT) st.thumb = false; }
  else if (tr > TH_IN) st.thumb = true;
  return st;
}

function candidateGesture(f) {
  if (f.index && !f.middle && !f.ring && !f.pinky) return 'point';
  if (f.thumb && f.pinky && !f.index && !f.middle && !f.ring) return 'shaka';
  if (f.index && f.pinky && !f.middle && !f.ring) return 'horns';
  if (f.middle && !f.index && !f.ring && !f.pinky) return 'middle';
  return null;
}
const STABLE_IN = { point: 4, shaka: 10, horns: 5, middle: 8 };
const STABLE_OUT = 5;

export async function startVision({ onHand, onFace, onStatus, face = false }) {
  onStatus?.('Requesting camera…');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false,
  });

  const video = document.createElement('video');
  video.playsInline = true; video.muted = true;
  video.srcObject = stream;
  await video.play();

  const fileset = await FilesetResolver.forVisionTasks(WASM_DIR);
  let hands = null;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      hands = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: 'vendor/mediapipe/hand_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      break;
    } catch { onStatus?.(`hands: ${delegate} unavailable, retrying…`); }
  }
  if (!hands) { stream.getTracks().forEach((t) => t.stop()); throw new Error('vision unavailable'); }
  onStatus?.('Hand online · open mirrors · fist flies · point 3s clicks');

  /* face model loads lazily and never blocks the hand */
  let faceOn = face, faceModel = null, faceLoading = false, faceSeen = false;
  async function ensureFace() {
    if (faceModel || faceLoading || !faceOn) return;
    faceLoading = true;
    for (const delegate of ['GPU', 'CPU']) {
      try {
        faceModel = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'vendor/mediapipe/face_landmarker.task', delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
        });
        break;
      } catch { /* try next delegate */ }
    }
    faceLoading = false;
    if (!faceModel) faceOn = false;
  }

  /* filters */
  const fPalmX = new OneEuro(1.0, 0.02), fPalmY = new OneEuro(1.0, 0.02);
  const fTipX = new OneEuro(0.9, 0.015), fTipY = new OneEuro(0.9, 0.015);
  const fWorld = Array.from({ length: 63 }, () => new OneEuro(1.6, 0.14));
  const worldOut = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));

  let raf = 0, lastTs = -1, prev = null, stopped = false;
  let open = true;
  const fingers = makeFingers();
  let gesture = null, cand = null, candN = 0, outN = 0;
  let lost = 0, tick3 = 0;

  function resetFilters() {
    fPalmX.reset(); fPalmY.reset(); fTipX.reset(); fTipY.reset();
    fWorld.forEach((f) => f.reset());
  }

  function tick() {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (video.readyState < 2) return;
    const ts = performance.now();
    if (ts === lastTs) return;
    lastTs = ts;

    /* ---- face at 1/3 cadence ---- */
    if (faceOn) {
      if (!faceModel) ensureFace();
      else if (tick3++ % 3 === 0) {
        try {
          const fr = faceModel.detectForVideo(video, ts);
          const flm = fr.faceLandmarks?.[0] || null;
          if (flm || faceSeen) onFace?.(flm);
          faceSeen = !!flm;
        } catch { /* face is decorative; never let it break the hand */ }
      }
    }

    /* ---- hand every frame ---- */
    const res = hands.detectForVideo(video, ts);
    const lm = res.landmarks?.[0];
    const world = res.worldLandmarks?.[0];
    if (!lm || !world) {
      if (++lost >= 6) {
        if (lost === 6 || prev) { prev = null; resetFilters(); gesture = null; cand = null; candN = 0; onHand?.(null); }
      }
      return;
    }
    lost = 0;

    const tSec = ts / 1000;

    // palm center (wrist + finger bases), mirrored for natural control
    const ids = [0, 5, 9, 13, 17];
    let cx = 0, cy = 0;
    ids.forEach((i) => { cx += lm[i].x; cy += lm[i].y; });
    cx = 1 - cx / ids.length; cy /= ids.length;
    const sx = fPalmX.f(cx, tSec), sy = fPalmY.f(cy, tSec);

    // fingertip (index) for the dwell cursor, extra-steady filtering
    const tip = { x: fTipX.f(1 - lm[8].x, tSec), y: fTipY.f(lm[8].y, tSec) };

    // world landmarks through One-Euro for the 3D hand
    for (let i = 0; i < 21; i++) {
      worldOut[i].x = fWorld[i * 3].f(world[i].x, tSec);
      worldOut[i].y = fWorld[i * 3 + 1].f(world[i].y, tSec);
      worldOut[i].z = fWorld[i * 3 + 2].f(world[i].z, tSec);
    }

    // openness with hysteresis so the fist never flickers mid-gesture
    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
    const reach = (d(8, 0) + d(12, 0) + d(16, 0) + d(20, 0)) /
                  (d(5, 0) + d(9, 0) + d(13, 0) + d(17, 0));
    if (open && reach < 1.24) open = false;
    else if (!open && reach > 1.4) open = true;

    // gesture FSM: N frames to enter, N frames of disagreement to leave
    updateFingers(lm, fingers);
    const c = candidateGesture(fingers);
    if (gesture) {
      if (c === gesture) outN = 0;
      else if (++outN >= STABLE_OUT) { gesture = null; outN = 0; cand = c; candN = c ? 1 : 0; }
    } else if (c && c === cand) {
      if (++candN >= STABLE_IN[c]) { gesture = c; outN = 0; }
    } else { cand = c; candN = c ? 1 : 0; }

    let dx = 0, dy = 0;
    if (prev) {
      const dt = Math.max(tSec - prev.t, 0.016);
      dx = (sx - prev.x) / dt;
      dy = (sy - prev.y) / dt;
    }
    prev = { x: sx, y: sy, t: tSec };
    onHand?.({ x: sx, y: sy, open, dx, dy, speed: Math.hypot(dx, dy), world: worldOut, gesture, tip });
  }
  tick();

  return {
    setFace(on) {
      faceOn = !!on;
      if (!faceOn && faceSeen) { faceSeen = false; onFace?.(null); }
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      hands.close();
      faceModel?.close();
    },
  };
}
