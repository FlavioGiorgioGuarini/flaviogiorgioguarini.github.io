/* Dwell click: point with the index finger, hold on a target for 3s,
   the ring fills, the click fires. The cursor dot is always visible while
   pointing so aim is never a guess; the ring only appears on actionable
   elements. Small blips are forgiven — the target survives while the
   fingertip stays inside its bounds. */

const DWELL_MS = 3000;
const REFRACT_MS = 1400;
const CIRC = 2 * Math.PI * 17; // svg ring circumference

const ACTIONABLE = 'a[href], button, input, textarea, .card';

export function createDwell() {
  const el = document.createElement('div');
  el.id = 'hand-cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <svg viewBox="0 0 44 44">
      <circle class="dwell-track" cx="22" cy="22" r="17"/>
      <circle class="dwell-ring" cx="22" cy="22" r="17"/>
    </svg>
    <span class="dwell-dot"></span>`;
  document.body.appendChild(el);
  const ring = el.querySelector('.dwell-ring');
  ring.style.strokeDasharray = String(CIRC);
  ring.style.strokeDashoffset = String(CIRC);

  let target = null, t0 = 0, lastFired = null, firedAt = -1e9, visible = false;

  function reset() {
    target = null;
    el.classList.remove('locked');
    ring.style.strokeDashoffset = String(CIRC);
  }

  function hide() {
    if (!visible) return;
    visible = false;
    el.classList.remove('on', 'fired');
    reset();
  }

  return {
    /* pt = {x, y} in px, or null when not pointing */
    update(pt, now) {
      if (!pt) { hide(); return; }
      if (!visible) { visible = true; el.classList.add('on'); }
      el.style.transform = `translate(${(pt.x - 22).toFixed(1)}px, ${(pt.y - 22).toFixed(1)}px)`;

      const hitEl = document.elementFromPoint(pt.x, pt.y);
      const hit = hitEl?.closest(ACTIONABLE) ?? null;

      // refractory: after a click, the same target stays inert until left
      if (hit && hit === lastFired && now - firedAt < REFRACT_MS) { reset(); return; }
      if (hit !== lastFired) lastFired = null;

      if (!hit) { reset(); return; }
      if (hit !== target) {
        target = hit;
        t0 = now;
        el.classList.add('locked');
      }
      const p = Math.min((now - t0) / DWELL_MS, 1);
      ring.style.strokeDashoffset = String(CIRC * (1 - p));
      if (p >= 1) {
        lastFired = target;
        firedAt = now;
        el.classList.add('fired');
        setTimeout(() => el.classList.remove('fired'), 500);
        try { target.focus?.({ preventScroll: true }); } catch { /* non-focusable */ }
        target.click();
        reset();
      }
    },
    hide,
  };
}
