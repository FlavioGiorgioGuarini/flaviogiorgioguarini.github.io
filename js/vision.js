/* On-device vision: MediaPipe hands + face, self-hosted, lazy-loaded.
   Nothing is recorded; frames never leave the GPU/browser.
   Tiers degrade gracefully: GPU → CPU → hands-only → caller catches to tier 3. */

import { FilesetResolver, HandLandmarker, FaceLandmarker }
  from '../vendor/mediapipe/vision_bundle.mjs';

const WASM_DIR = 'vendor/mediapipe/wasm';

export async function startVision({ onHand, onFace, onStatus }) {
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

  async function make(Ctor, modelPath, opts, label) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        return await Ctor.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate },
          runningMode: 'VIDEO',
          ...opts,
        });
      } catch (e) {
        onStatus?.(`${label}: ${delegate} unavailable, retrying…`);
      }
    }
    return null;
  }

  const hands = await make(HandLandmarker, 'vendor/mediapipe/hand_landmarker.task', { numHands: 1 }, 'hands');
  const face = await make(FaceLandmarker, 'vendor/mediapipe/face_landmarker.task', { numFaces: 1 }, 'face');
  if (!hands && !face) { stream.getTracks().forEach((t) => t.stop()); throw new Error('vision unavailable'); }
  onStatus?.(face ? 'Tracking online: open hand mirrors you, fist flies the ship, your face joins the stars'
                  : 'Hand tracking online: open to mirror, fist to fly');

  let raf = 0, lastTs = -1, prev = null, frame = 0, stopped = false;
  const facePts = new Float32Array(156 * 3);

  function tick() {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (video.readyState < 2) return;
    const ts = performance.now();
    if (ts === lastTs) return;
    lastTs = ts;
    frame++;

    if (hands) {
      const res = hands.detectForVideo(video, ts);
      const lm = res.landmarks?.[0];
      const world = res.worldLandmarks?.[0];
      if (lm && world) {
        // palm center from wrist + finger bases; mirrored for natural control
        const ids = [0, 5, 9, 13, 17];
        let cx = 0, cy = 0;
        ids.forEach((i) => { cx += lm[i].x; cy += lm[i].y; });
        cx = 1 - cx / ids.length; cy /= ids.length;
        // openness: fingertip reach vs knuckle reach from the wrist
        const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
        const reach = (d(8, 0) + d(12, 0) + d(16, 0) + d(20, 0)) /
                      (d(5, 0) + d(9, 0) + d(13, 0) + d(17, 0));
        const open = reach > 1.32;
        const now = ts / 1000;
        let dx = 0, dy = 0;
        if (prev) {
          const dt = Math.max(now - prev.t, 0.016);
          dx = (cx - prev.x) / dt;
          dy = (cy - prev.y) / dt;
        }
        prev = { x: cx, y: cy, t: now };
        onHand?.({ x: cx, y: cy, open, dx, dy, world });
      } else {
        prev = null;
        onHand?.(null); // hand lost: caller returns the cockpit hand to idle
      }
    }

    if (face && frame % 2 === 0) {
      const res = face.detectForVideo(video, ts);
      const lm = res.faceLandmarks?.[0];
      if (lm) {
        for (let i = 0; i < 156; i++) {
          const p = lm[i * 3]; // subsample the 468-point mesh
          facePts[i * 3] = p.x; facePts[i * 3 + 1] = p.y; facePts[i * 3 + 2] = p.z;
        }
        const nose = lm[1];
        // gaze from the iris landmarks (468+): where the eyes point, -1..1
        let gaze = null;
        if (lm.length > 477) {
          const gx = (e, iL, iR) => (e.x - iL.x) / Math.max(iR.x - iL.x, 1e-4) * 2 - 1;
          const gy = (e, top, bot) => (e.y - top.y) / Math.max(bot.y - top.y, 1e-4) * 2 - 1;
          gaze = {
            x: -((gx(lm[468], lm[33], lm[133]) + gx(lm[473], lm[362], lm[263])) / 2),
            y: (gy(lm[468], lm[159], lm[145]) + gy(lm[473], lm[386], lm[374])) / 2,
          };
        }
        onFace?.(facePts, { rx: (0.5 - nose.x) * 2, ry: (nose.y - 0.5) * 2 }, gaze);
      }
    }
  }
  tick();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      hands?.close(); face?.close();
    },
  };
}
