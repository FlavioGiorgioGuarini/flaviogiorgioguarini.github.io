/* Bimanual gesture engine (v8). Pure state machine: consumes the hands
   array from vision.js, decides what the pair means, and calls back into
   the app. No DOM in here.

   Roles — dual-hand first:
   - Dominant hand (learned, not assumed): precision. Its index dwell-clicks,
     its pinch grabs. Dominance is an EMA of who actually points/pinches,
     sticky so it never ping-pongs; defaults to the right slot.
   - Other hand: navigation and atmosphere. Fist flies the page, open palm
     stirs the water. Every single-hand gesture still works with either
     hand alone — one hand is the fallback, not a different product.

   Pair gestures:
   - both pinch → portal: live scale factor between the two pinch points;
     crossing the open/close thresholds flips the world (space ↔ ocean).
   - both palms spreading apart → immersive reveal (chrome fades away);
     both palms closing together → chrome returns / top overlay closes.
   - shaka 🤙 (surf salute, either hand) → dive toggle.
   - horns → warp. middle finger → closes the front-most panel, with
     attitude. Cooldowns keep all of it intentional. */

const COOL = { dive: 8000, warp: 6000, middle: 15000, jump: 900, immersive: 1600 };
const PORTAL_OPEN = 1.45;   // bi-pinch spread ratio that flips the world
const PORTAL_CLOSE = 0.62;  // bi-pinch squeeze ratio that flips it back
const SPREAD_ON = 0.20;     // palm-distance growth (screen units) → reveal
const SPREAD_OFF = -0.20;   // symmetric closing → compress

export function createGestures(cb) {
  const score = { L: 0, R: 6 };       // right-handed prior, quickly re-learned
  let dominant = 'R';
  const last = { dive: 0, warp: 0, middle: 0, jump: 0, immersive: 0 };

  let pinchPair = null;               // {d0, flipped}
  let spread = null;                  // {d0, fired}

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function updateDominance(hands) {
    for (const h of hands) {
      if (h.gesture === 'point' || h.pinch.on) score[h.uid] += 1;
    }
    score.L *= 0.995; score.R *= 0.995;
    // sticky handover: the other hand must earn a clear 25% lead
    if (dominant === 'R' && score.L > score.R * 1.25 + 2) { dominant = 'L'; cb.dominantChanged?.('L'); }
    else if (dominant === 'L' && score.R > score.L * 1.25 + 2) { dominant = 'R'; cb.dominantChanged?.('R'); }
  }

  return {
    get dominant() { return dominant; },

    feed(hands, now) {
      if (!hands.length) {
        pinchPair = null; spread = null;
        cb.dwell?.(null, now);
        return;
      }
      updateDominance(hands);

      const hd = hands.find((h) => h.uid === dominant) || hands[0];
      const ho = hands.find((h) => h !== hd) || null;

      /* ---- precision: dwell pointer (dominant first, either as fallback) ---- */
      const pointer = hd.gesture === 'point' ? hd : (ho?.gesture === 'point' ? ho : null);
      cb.dwell?.(pointer ? { x: pointer.tip.x * innerWidth, y: pointer.tip.y * innerHeight } : null, now);

      /* ---- single-hand verbs, either hand ---- */
      for (const h of hands) {
        if (h.gesture === 'shaka' && now - last.dive > COOL.dive) {
          last.dive = now; cb.dive?.(h);
        } else if (h.gesture === 'horns' && now - last.warp > COOL.warp) {
          last.warp = now; cb.warp?.(h);
        } else if (h.gesture === 'middle' && now - last.middle > COOL.middle) {
          last.middle = now; cb.middle?.(h);
        }
      }

      /* ---- navigation: a fist flies the page (prefer the non-dominant) ---- */
      const fist = (ho && !ho.open && !ho.gesture && !ho.pinch.on) ? ho
                 : (!hd.open && !hd.gesture && !hd.pinch.on) ? hd : null;
      if (fist) {
        if (Math.abs(fist.dy) > 0.1) cb.scroll?.(fist.dy);
        if (Math.abs(fist.dx) > 1.0 && now - last.jump > COOL.jump) {
          last.jump = now;
          cb.jump?.(fist.dx > 0 ? 1 : -1);
        }
      }

      /* ---- pair gestures need both hands live ---- */
      if (hands.length === 2) {
        const [a, b] = hands;

        // bi-pinch portal: live scale between the two pinch points
        if (a.pinch.on && b.pinch.on) {
          const d = dist(a.pinch, b.pinch);
          if (!pinchPair) pinchPair = { d0: Math.max(d, 0.05), flipped: false };
          const scale = d / pinchPair.d0;
          cb.portal?.('move', scale);
          if (!pinchPair.flipped && (scale > PORTAL_OPEN || scale < PORTAL_CLOSE)) {
            pinchPair.flipped = true;
            cb.dive?.(a);            // the portal flips the world
            last.dive = now;
          }
        } else if (pinchPair) {
          pinchPair = null;
          cb.portal?.('end', 1);
        }

        // symmetric open palms: spread = reveal, close = compress
        if (a.open && b.open && !a.pinch.on && !b.pinch.on && !a.gesture && !b.gesture) {
          const d = dist(a, b);
          if (!spread) spread = { d0: d, fired: false };
          const delta = d - spread.d0;
          if (!spread.fired && now - last.immersive > COOL.immersive) {
            if (delta > SPREAD_ON) { spread.fired = true; last.immersive = now; cb.immersive?.(true); }
            else if (delta < SPREAD_OFF) { spread.fired = true; last.immersive = now; cb.immersive?.(false); }
          }
        } else {
          spread = null;
        }
      } else {
        if (pinchPair) { pinchPair = null; cb.portal?.('end', 1); }
        spread = null;
      }

      /* ---- atmosphere: every live hand stirs the world ---- */
      hands.forEach((h, i) => cb.stir?.(h, i));
    },
  };
}
