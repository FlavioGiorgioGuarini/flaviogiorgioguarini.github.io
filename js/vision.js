/* On-device vision, dual-hand first (v8). HandLandmarker tracks up to two
   hands every frame; FaceLandmarker stays optional (quality-gated) at a
   reduced cadence for the Matrix face backdrop. Nothing is recorded;
   frames never leave the browser.

   Stability stack:
   - Two independent tracks (slots 'L'/'R'), each with its own One-Euro
     filter bank (palm, fingertip, pinch point, all 21 world landmarks),
     finger hysteresis and gesture FSM. Still hand = glass-steady.
   - Slot assignment: MediaPipe handedness first, nearest-palm fallback
     when labels collide or hands cross. Identity survives occlusions.
   - Gestures must survive N consecutive frames before they exist and
     N frames of disagreement before they die. No flicker.
   - 6-frame grace per hand so a single bad frame never drops a track.

   Emits onHands(hands[], now) where each hand is
   {uid:'L'|'R', x, y, open, dx, dy, speed, world, gesture, tip, pinch}
   and onFace(landmarks478 | null).
   Gestures: point · shaka · horns · middle. Pinch is a parallel channel. */

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
/* pinch: thumb-tip↔index-tip gap vs palm length, with hysteresis */
const PIN_IN = 0.30, PIN_OUT = 0.42;

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

/* per-slot state: filters, FSM, grace counter, reusable output object */
function makeTrack(uid) {
  return {
    uid,
    alive: false,
    lost: 99,
    lx: -9, ly: -9,                 // last mirrored palm position for matching
    fPalmX: new OneEuro(1.0, 0.02), fPalmY: new OneEuro(1.0, 0.02),
    fTipX: new OneEuro(0.9, 0.015), fTipY: new OneEuro(0.9, 0.015),
    fPinX: new OneEuro(0.9, 0.015), fPinY: new OneEuro(0.9, 0.015),
    fWorld: Array.from({ length: 63 }, () => new OneEuro(1.6, 0.14)),
    worldOut: Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })),
    open: true,
    fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    gesture: null, cand: null, candN: 0, outN: 0,
    pinchOn: false,
    prev: null,
    out: {
      uid, x: 0.5, y: 0.5, open: true, dx: 0, dy: 0, speed: 0,
      world: null, gesture: null,
      tip: { x: 0.5, y: 0.5 },
      pinch: { on: false, x: 0.5, y: 0.5 },
    },
  };
}

function resetTrack(tr) {
  tr.alive = false;
  tr.lost = 99;
  tr.prev = null;
  tr.gesture = null; tr.cand = null; tr.candN = 0; tr.outN = 0;
  tr.pinchOn = false;
  tr.fPalmX.reset(); tr.fPalmY.reset();
  tr.fTipX.reset(); tr.fTipY.reset();
  tr.fPinX.reset(); tr.fPinY.reset();
  tr.fWorld.forEach((f) => f.reset());
}

/* MediaPipe labels handedness for a mirrored (selfie) frame; our buffer is
   unmirrored, so the label swaps: reported 'Left' is the visitor's right
   hand. The behavioural dominance layer upstream forgives any exception. */
const slotForLabel = (label) => (label === 'Left' ? 'R' : 'L');

export async function startVision({ onHands, onFace, onStatus, face = false, maxHands = 2 }) {
  onStatus?.('req');
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
        numHands: 2,
      });
      break;
    } catch { onStatus?.('retry'); }
  }
  if (!hands) { stream.getTracks().forEach((t) => t.stop()); throw new Error('vision unavailable'); }
  onStatus?.('ready');

  /* face model loads lazily and never blocks the hands */
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

  const tracks = { L: makeTrack('L'), R: makeTrack('R') };
  let cap = Math.max(1, Math.min(2, maxHands));
  let raf = 0, lastTs = -1, stopped = false, tickN = 0, anyLive = false;
  const emitList = [];

  /* drive detection once per NEW camera frame, not per display refresh:
     rVFC fires on decoded frames (~30fps); the rAF fallback skips ticks
     where currentTime hasn't advanced. Keeps 120Hz displays from running
     4x inference against a 30fps webcam. */
  const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
  let lastMediaTime = -1;
  const schedule = () => {
    raf = hasRVFC ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  };

  /* one detection → one track update (the v7 single-hand pipeline, per slot) */
  function feedTrack(tr, lm, world, tSec) {
    tr.lost = 0;
    tr.alive = true;

    // palm center (wrist + finger bases), mirrored for natural control
    const ids = [0, 5, 9, 13, 17];
    let cx = 0, cy = 0;
    ids.forEach((i) => { cx += lm[i].x; cy += lm[i].y; });
    cx = 1 - cx / ids.length; cy /= ids.length;
    const sx = tr.fPalmX.f(cx, tSec), sy = tr.fPalmY.f(cy, tSec);
    tr.lx = sx; tr.ly = sy;

    // index fingertip for the dwell cursor, extra-steady filtering
    const tip = tr.out.tip;
    tip.x = tr.fTipX.f(1 - lm[8].x, tSec);
    tip.y = tr.fTipY.f(lm[8].y, tSec);

    // world landmarks through One-Euro for the 3D hand pair
    for (let i = 0; i < 21; i++) {
      tr.worldOut[i].x = tr.fWorld[i * 3].f(world[i].x, tSec);
      tr.worldOut[i].y = tr.fWorld[i * 3 + 1].f(world[i].y, tSec);
      tr.worldOut[i].z = tr.fWorld[i * 3 + 2].f(world[i].z, tSec);
    }

    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);

    // openness with hysteresis so a fist never flickers mid-gesture
    const reach = (d(8, 0) + d(12, 0) + d(16, 0) + d(20, 0)) /
                  (d(5, 0) + d(9, 0) + d(13, 0) + d(17, 0));
    if (tr.open && reach < 1.24) tr.open = false;
    else if (!tr.open && reach > 1.4) tr.open = true;

    // pinch channel: thumb-tip ↔ index-tip vs palm length, hysteresis
    const pr = d(4, 8) / Math.max(d(0, 9), 1e-4);
    if (tr.pinchOn) { if (pr > PIN_OUT) tr.pinchOn = false; }
    else if (pr < PIN_IN) tr.pinchOn = true;
    const pinch = tr.out.pinch;
    pinch.on = tr.pinchOn;
    pinch.x = tr.fPinX.f(1 - (lm[4].x + lm[8].x) / 2, tSec);
    pinch.y = tr.fPinY.f((lm[4].y + lm[8].y) / 2, tSec);

    // gesture FSM: N frames to enter, N frames of disagreement to leave
    updateFingers(lm, tr.fingers);
    const c = candidateGesture(tr.fingers);
    if (tr.gesture) {
      if (c === tr.gesture) tr.outN = 0;
      else if (++tr.outN >= STABLE_OUT) { tr.gesture = null; tr.outN = 0; tr.cand = c; tr.candN = c ? 1 : 0; }
    } else if (c && c === tr.cand) {
      if (++tr.candN >= STABLE_IN[c]) { tr.gesture = c; tr.outN = 0; }
    } else { tr.cand = c; tr.candN = c ? 1 : 0; }

    let dx = 0, dy = 0;
    if (tr.prev) {
      const dtp = Math.max(tSec - tr.prev.t, 0.016);
      dx = (sx - tr.prev.x) / dtp;
      dy = (sy - tr.prev.y) / dtp;
    } else {
      tr.prev = { x: sx, y: sy, t: tSec };
    }
    tr.prev.x = sx; tr.prev.y = sy; tr.prev.t = tSec;

    const o = tr.out;
    o.x = sx; o.y = sy; o.open = tr.open;
    o.dx = dx; o.dy = dy; o.speed = Math.hypot(dx, dy);
    o.world = tr.worldOut;
    o.gesture = tr.gesture;
  }

  /* detections → slots. Labels first; when labels collide or a lone hand
     wanders, fall back to nearest last-seen palm so identity never swaps. */
  function assign(dets) {
    const res = { L: null, R: null };
    if (dets.length === 2 && dets[0].slot !== dets[1].slot) {
      res[dets[0].slot] = dets[0];
      res[dets[1].slot] = dets[1];
      return res;
    }
    if (dets.length === 2) {
      // same label twice: order on mirrored screen x
      const [a, b] = dets[0].cx <= dets[1].cx ? [dets[0], dets[1]] : [dets[1], dets[0]];
      res.L = a; res.R = b;
      return res;
    }
    if (dets.length === 1) {
      const d0 = dets[0];
      const dl = tracks.L.alive ? Math.hypot(d0.cx - tracks.L.lx, d0.cy - tracks.L.ly) : 9;
      const dr = tracks.R.alive ? Math.hypot(d0.cx - tracks.R.lx, d0.cy - tracks.R.ly) : 9;
      if (Math.min(dl, dr) < 0.28) res[dl <= dr ? 'L' : 'R'] = d0;
      else res[d0.slot] = d0;
    }
    return res;
  }

  function tick() {
    if (stopped) return;
    schedule();
    if (video.readyState < 2) return;
    if (!hasRVFC) {
      if (video.currentTime === lastMediaTime) return;
      lastMediaTime = video.currentTime;
    }
    const ts = performance.now();
    if (ts === lastTs) return;
    lastTs = ts;
    tickN++;

    /* ---- face at reduced cadence (slower still with two live hands) ---- */
    if (faceOn) {
      if (!faceModel) ensureFace();
      else if (tickN % (anyLive && tracks.L.alive && tracks.R.alive ? 4 : 3) === 0) {
        try {
          const fr = faceModel.detectForVideo(video, ts);
          const flm = fr.faceLandmarks?.[0] || null;
          if (flm || faceSeen) onFace?.(flm);
          faceSeen = !!flm;
        } catch { /* face is decorative; never let it break the hands */ }
      }
    }

    /* ---- hands every frame ---- */
    const res = hands.detectForVideo(video, ts);
    const n = res.landmarks?.length || 0;
    const tSec = ts / 1000;

    const dets = [];
    for (let i = 0; i < n && i < 2; i++) {
      const lm = res.landmarks[i], world = res.worldLandmarks?.[i];
      if (!lm || !world) continue;
      const label = res.handednesses?.[i]?.[0]?.categoryName || 'Right';
      dets.push({ lm, world, slot: slotForLabel(label), cx: 1 - lm[9].x, cy: lm[9].y });
    }
    const bySlot = assign(dets);

    let changed = false;
    for (const uid of ['L', 'R']) {
      const tr = tracks[uid], det = bySlot[uid];
      if (det) {
        feedTrack(tr, det.lm, det.world, tSec);
        changed = true;
      } else if (tr.alive && ++tr.lost >= 6) {
        resetTrack(tr);
        changed = true;
      }
    }

    emitList.length = 0;
    // dominant-agnostic stable order: R first (majority right-handed), then L
    if (tracks.R.alive) emitList.push(tracks.R.out);
    if (tracks.L.alive) emitList.push(tracks.L.out);
    if (emitList.length > cap) emitList.length = cap;

    const live = emitList.length > 0;
    if (live || anyLive || changed) onHands?.(emitList, ts);
    anyLive = live;
  }
  tick();

  return {
    setFace(on) {
      faceOn = !!on;
      if (!faceOn && faceSeen) { faceSeen = false; onFace?.(null); }
    },
    /* governor hook: cap how many hands are consumed downstream */
    setMaxHands(n) { cap = Math.max(1, Math.min(2, n)); },
    stop() {
      stopped = true;
      if (hasRVFC) video.cancelVideoFrameCallback(raf);
      else cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      hands.close();
      faceModel?.close();
    },
  };
}
