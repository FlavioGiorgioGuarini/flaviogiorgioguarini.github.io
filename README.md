# flaviogiorgioguarini.github.io

Personal portfolio — Flavio Giorgio Guarini. Security · Sound · Systems.

- **Stack:** static HTML/CSS/JS, no build step, no trackers. v2 adds two CDN runtime deps (pinned): Three.js 0.170 (import map) and MediaPipe tasks-vision 0.10.14 (lazy, opt-in only).
- **3D hero:** hand-rolled perspective-projected particle system on Canvas 2D (`js/hero3d.js`) — works without WebGL, honors `prefers-reduced-motion`, adaptive particle budget, touch-drag rotation, magnetic cursor field.
- **Couture hand (v2, `js/hand3d.js`):** fully procedural segmented hand in Three.js — polished-ivory PBR phalanges, orange emissive joint rings, wrist bracelet. Scroll-guided: appears at section transitions, points along travel direction, tilts with scroll velocity. No generative assets, no skinning — rigid FK hierarchy. Reduced-motion → one static frame. No WebGL → layer absent, site behaves as v1.
- **Hand tracking (v2, `js/handtrack.js`):** optional. Nothing loads until the pill is clicked; camera + MediaPipe HandLandmarker run 100% on-device (stated in the UI). Index tip = cursor, pinch = click, GPU→CPU delegate fallback, stop button tears down stream+model. Deny/unsupported → silent fallback to normal input.
- **Languages:** IT / EN / ES via `js/i18n.js` (64 keys ×3, parity-checked).
- **Hosting:** GitHub Pages. Cloudflare Pages–ready (no build command, output dir = root).

## Local preview

ES modules require a server (not `file://`):

```
python3 -m http.server 8000
```

## Content pipeline

Copy is mined from a private Obsidian knowledge base and reviewed for public safety before landing here. No fact on this site is invented. Content source of truth: `wiki/personal/website/site-content-source.md` (private vault).
