/* Device orientation as an input channel: parallax on mobile, water
   current in ocean mode. iOS needs an explicit permission call from a
   user gesture — the entry-gate buttons provide it. Everything degrades
   to zeros; no feature may depend on the gyro existing. */

const clamp = (v) => Math.max(-1, Math.min(1, v));

export function createGyro() {
  let tx = 0, ty = 0;     // targets, -1..1
  let base = null, on = false;

  function handle(e) {
    if (e.beta == null || e.gamma == null) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    let db = (e.beta - base.b) / 26;
    let dg = (e.gamma - base.g) / 26;
    const ang = (screen.orientation?.angle ?? window.orientation ?? 0);
    if (ang === 90) { const t = db; db = -dg; dg = t; }
    else if (ang === 270 || ang === -90) { const t = db; db = dg; dg = -t; }
    else if (ang === 180) { db = -db; dg = -dg; }
    tx = clamp(dg);
    ty = clamp(db);
  }

  // re-zero on rotation so the neutral pose follows how the phone is held
  addEventListener('orientationchange', () => { base = null; }, { passive: true });

  return {
    /* must be called from a user gesture on iOS; harmless elsewhere */
    async enable() {
      if (on) return true;
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          if (await DeviceOrientationEvent.requestPermission() !== 'granted') return false;
        }
        addEventListener('deviceorientation', handle, { passive: true });
        on = true;
        return true;
      } catch { return false; }
    },
    get on() { return on; },
    target() { return { x: tx, y: ty }; },
  };
}
