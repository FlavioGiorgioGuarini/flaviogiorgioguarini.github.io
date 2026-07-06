# flaviogiorgioguarini.github.io

Total-black 3D portfolio. Static, hand-written, fully self-hosted:
no build step, no CDN at runtime, no trackers, no generated imagery —
every visual is real-time WebGL/canvas.

**Six languages** (EN·IT·ES·DE·PT·FR): the full experience is localized in
`js/i18n.js`, plus a spoken audio-description of the site per language
(utility button in the top bar). Hand gestures double as an accessibility
input: the whole site can be explored with one hand.

## What's inside

- **DNS_1** — original score by Flavio (Ableton, 192 kHz master), streamed as AAC
  and analysed live with the Web Audio API. Stars, dust and nebulae move with the music.
- **Deep-field scene** — Three.js (self-hosted, pinned 0.182): shader starfield,
  audio-reactive dust, procedural displacement moon.
- **Cockpit hand** — a real-time bionic 3D hand (joints + bones driven directly by
  MediaPipe's 21 world landmarks, VR-style, no rig). Open hand: it mirrors your
  fingers and pose, the page holds still. Closed fist: you fly — up/down scrolls,
  left/right jumps sections. Without a camera it idles cinematically and follows
  the pointer. Face joins the starfield as a constellation; iris gaze steers the
  drift. All on-device (self-hosted WASM, lazy, opt-in); keyboard/touch parity.
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
