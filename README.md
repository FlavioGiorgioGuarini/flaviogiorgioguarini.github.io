# flaviogiorgioguarini.github.io

Personal portfolio — Flavio Giorgio Guarini. Security · Sound · Systems.

- **Stack:** pure static HTML/CSS/JS. Zero dependencies, zero build step, zero trackers.
- **3D hero:** hand-rolled perspective-projected particle system on Canvas 2D (`js/hero3d.js`) — works without WebGL, honors `prefers-reduced-motion`, adaptive particle budget for low-power devices, touch-drag rotation on mobile, magnetic cursor field on desktop.
- **Languages:** IT / EN / ES via `js/i18n.js` (client-side, localStorage persistence, browser-language default).
- **Hosting:** GitHub Pages (this repo). Cloudflare Pages–ready as-is (no build command, output dir = root).

## Local preview

```
python3 -m http.server 8000
```

## Content pipeline

Copy is mined from a private Obsidian knowledge base and reviewed for public safety before landing here. No fact on this site is invented. Content source of truth: `wiki/personal/website/site-content-source.md` (private vault).
