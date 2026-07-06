# flaviogiorgioguarini.github.io

Interstellar-grade portfolio. Static, hand-written, fully self-hosted:
no build step, no CDN at runtime, no trackers.

## What's inside

- **DNS_1** — original score by Flavio (Ableton, 192 kHz master), streamed as AAC
  and analysed live with the Web Audio API. Stars, dust and nebulae move with the music.
- **Deep-field scene** — Three.js (self-hosted, pinned 0.182): shader starfield,
  audio-reactive dust, procedural displacement moon.
- **Vision tiers** — optional on-device MediaPipe hand + face tracking (self-hosted
  WASM, lazy-loaded, camera opt-in). Open palm steers, fist jumps sections, your
  face becomes a constellation in the starfield. No camera → a ghost hand follows
  the pointer; keyboard and touch always have full parity.
- **CAERUS** — original TARS-inspired slab companion. Voice in/out via the Web
  Speech API, knowledge fully on-device; no external AI endpoint, no key to leak.
- **Past Lives Arcade** — 8-bit map of the journey. One log matters to the moon.
- **CTF Moon** — answer verified as SHA-256 (never stored in clear), reward form
  guarded by honeypot, minimum-time gate and client rate limit, delivered via
  FormSubmit AJAX.

## Security posture

Strict CSP meta (`default-src 'self'`; the only connect-src exception is
formsubmit.co; `'wasm-unsafe-eval'` for MediaPipe). No inline scripts or styles,
no eval, input length caps everywhere, external links `rel="noopener"`.

## Operations note

The CTF email endpoint uses FormSubmit: the **first submission from the live
domain sends an activation link to the inbox — click it once** and the flow is live.

## Local dev

```bash
python3 -m http.server 8017
```
