# DESIGN — v9 "The Dive Line"

Register: brand/portfolio — the design IS the product. Voice (physical words): **submerged · instrumental · inevitable**.
Identity anchors (do not touch): total black, bioluminescent teal, silver ink, Syncopate + STIX Two italic + mono
telemetry, DNS_1 original score, dual worlds (space/ocean), dual-hand grammar, CAERUS, arcade + moon riddle.
Warm accents stay retired (v6 user mandate). Hierarchy is built INSIDE teal + white, never by adding hues.

## The organizing idea
v8 said "Into the Deep" but scrolled like an elevator over one starfield. v9 makes depth the single organizing
axis — the page IS the dive. The bottom of the page is **−1233 m: the South Adriatic Pit, the deepest point of
Bari's own sea**. Every station on the way down is a chapter of the biography.

Depth stations (drive both the gauge and the scene): home 0 · journey −150 · payload −400 · systems −650 ·
arcade −800 · atelier −950 · moon −1100 · contact −1233.

## Systems
- **Depth gauge** replaces the dot rail: fixed right-edge graduated instrument; stations as ticks (nav semantics
  preserved — it is still the `<nav>`); live mono readout of current depth. The ONE deliberate home of the
  telemetry voice. Mono-tracked labels elsewhere are demoted or retired (no AI-scaffold eyebrows).
- **Camera rail** in scene.js: per-section keyframes (position/lookAt/fov) sampled by eased scroll in *station
  space* (stations measured from real section offsetTops, recomputed on resize/langchange — never uniform
  fractions). Depth grades the atmosphere: fog density/color, exposure, star fade, particle strata that do NOT
  follow the camera 1:1 (parallax shells). Moon gets one full-bleed composed frame at its station.
- **Chrome**: one top scrim (blur + gradient, kills every scroll-under collision); controls in a single capsule
  cluster; FGG wordmark left. Guide = compact one-line coach chip docked bottom-left, auto-docks/dismisses on
  scroll past hero, `?` replays; never covers a CTA.
- **Type scale** (committed, ratio ≥1.25): hero clamp(2.6rem, 10.5vw, 6rem); section clamp(2.4rem, 5.5vw, 4.4rem);
  serif clamp(1.35rem, 2.6vw, 2rem); body 1.0625rem. Modular tokens --fs-*, spacing --s-*, z-scale --z-*.
- **Composition variety** (kill the one-template rhythm): hero left-copy vs hand; journey = descent log ON the
  gauge line, year numerals large; payload = full-width cargo rows (01 SIEM linked / 02 sealed+hatched /
  03 sound with live waveform separator), a real manifest — the one legitimate numbered sequence; systems =
  orbit center-stage, copy right-aligned; arcade + atelier frames full-bleed; moon = centered composition around
  the full moon; contact = abyss floor, sign-off line "the sea keeps the rest" + coordinates, then games.
- **Sections**: only #home keeps 100svh centering. Content sections flow with rhythm tokens. The stats strip
  dissolves into the descent log (waypoint data), killing the SaaS stat-tile tell and the dead zone; the void
  between journey and payload becomes a composed interstitial beat (single serif line, full viewport, scene event).
- **Buttons/panels**: bezel language — corner ticks on panels, sweep-fill hover on .btn — nothing template-shaped.
- **Motion**: time-corrected smoothing everywhere (k = 1 − exp(−dt·λ)); per-section reveal signatures (shutter
  for displays, rise for prose, draw for frames) with authored order (data-reveal-order); scroll-velocity star
  stretch; reduced-motion = static world + instant states, honestly.
- **A11y floor**: real dialogs (role, aria-modal, focus trap via inert, Esc), one polite live region for world
  state, form errors announced, focus ring never removed, gauge/dpad touch targets ≥24px, arcade layers manage
  focus, reduced-motion listener live.
- **Perf floor**: modulepreload chain, PMREM 128 (kills sigma warning), context-loss rebuild, rVFC-driven
  MediaPipe cadence, grain buffer reuse, deferred ocean/sub build, no per-frame allocations, dead assets deleted.

## Bans (from impeccable + audit)
Identical card grids · stat-tile hero-metric template · mono eyebrow on every block · gradient text ·
glassmorphism-by-default · borrowed IP · warm palette resurrection · guide that outlives the hero ·
any fixed element that can occlude a CTA.
