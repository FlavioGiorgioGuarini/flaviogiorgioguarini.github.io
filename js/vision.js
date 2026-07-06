/* On-device hand tracking: MediaPipe HandLandmarker only (face/eye removed
   on purpose — one model = lower latency, higher stability, all frames for
   the hand). Nothing is recorded; frames never leave the browser.
   Emits: onHand({x, y, open, dx, dy, world, gesture}) or onHand(null). */

import { FilesetResolver, HandLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

const WASM_DIR = 'vendor/mediapipe/wasm';

/* per-finger "extended" test: tip reach vs pip reach from the wrist */
function fingerStates(lm) {
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const ext = (tip, pip) => d(tip, 0) / Math.max(d(pip, 0), 1e-4) > 1.18;
  return {
    index: ext(8, 6), middle: ext(12, 10), ring: ext(16, 14), pinky: ext(20, 18),
  };
}

export async function startVision({ onHand, onStatus }) {
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
  onStatus?.('Hand online · open mirrors you, fist flies the ship');

  let raf = 0, lastTs = -1, prev = null, stopped = false;
  let open = true;            // hysteresis state
  let sx = 0, sy = 0, seeded = false; // smoothed palm position

  function tick() {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (video.readyState < 2) return;
    const ts = performance.now();
    if (ts === lastTs) return;
    lastTs = ts;

    const res = hands.detectForVideo(video, ts);
    const lm = res.landmarks?.[0];
    const world = res.worldLandmarks?.[0];
    if (!lm || !world) { prev = null; seeded = false; onHand?.(null); return; }

    // palm center (wrist + finger bases), mirrored for natural control
    const ids = [0, 5, 9, 13, 17];
    let cx = 0, cy = 0;
    ids.forEach((i) => { cx += lm[i].x; cy += lm[i].y; });
    cx = 1 - cx / ids.length; cy /= ids.length;
    // adaptive smoothing: heavier when slow (steady aim), lighter when fast (low lag)
    if (!seeded) { sx = cx; sy = cy; seeded = true; }
    const speed = Math.hypot(cx - sx, cy - sy);
    const k = Math.min(0.2 + speed * 6, 0.85);
    sx += (cx - sx) * k;
    sy += (cy - sy) * k;

    // openness with hysteresis so the fist never flickers mid-gesture
    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
    const reach = (d(8, 0) + d(12, 0) + d(16, 0) + d(20, 0)) /
                  (d(5, 0) + d(9, 0) + d(13, 0) + d(17, 0));
    if (open && reach < 1.24) open = false;
    else if (!open && reach > 1.4) open = true;

    // special gestures, only meaningful on a mostly-closed hand
    const f = fingerStates(lm);
    let gesture = null;
    if (f.index && f.pinky && !f.middle && !f.ring) gesture = 'horns';
    else if (f.middle && !f.index && !f.ring && !f.pinky) gesture = 'middle';

    const now = ts / 1000;
    let dx = 0, dy = 0;
    if (prev) {
      const dt = Math.max(now - prev.t, 0.016);
      dx = (sx - prev.x) / dt;
      dy = (sy - prev.y) / dt;
    }
    prev = { x: sx, y: sy, t: now };
    onHand?.({ x: sx, y: sy, open, dx, dy, world, gesture });
  }
  tick();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      hands.close();
    },
  };
}
