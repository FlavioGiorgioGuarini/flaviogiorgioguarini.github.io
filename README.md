# flaviogiorgioguarini.github.io

Total-black 3D portfolio with a second, fully underwater skin. Static,
hand-written, fully self-hosted: no build step, no CDN at runtime, no
trackers, no generated imagery — every visual is real-time WebGL/canvas.

**Six languages** (EN·IT·ES·DE·PT·FR): the full experience is localized in
`js/i18n.js`, plus a spoken audio-description of the site per language
(utility button in the top bar). Hand gestures double as an accessibility
input: the whole site can be explored with one hand.

## What's inside

- **DNS_1** — original score by Flavio (Ableton, 192 kHz master), streamed as AAC
  and analysed live with the Web Audio API. Stars, dust and nebulae move with the
  music; underwater the score dives through a lowpass.
- **Deep-field scene** — Three.js (self-hosted, pinned 0.182), ACES filmic tone
  mapping + PMREM environment for real PBR: shader starfield, milky-way band,
  audio-reactive dust, procedural displacement moon with albedo maria.
- **Ocean Mode** — a shaka 🤙 (or the wave button) submerges the whole site: foam
  sweep, lowpassed score, living water surface that reacts to your hand and the
  phone's gyroscope, god rays, marine snow, bubbles, caustic seabed, and a
  patrol submarine where the moon used to be. Same content, second world.
- **Cockpit hand** — a real-time bionic 3D hand (joints + bones driven directly by
  MediaPipe's 21 world landmarks, One-Euro filtered, VR-style, no rig).
  Open hand mirrors you; closed fist flies — up/down scrolls, left/right jumps
  sections; **point at any button for 3 s to click it** (dwell ring shows the
  countdown). Underwater the hand turns amphibious: iridescent skin and webbing.
  Without a camera it idles cinematically. All on-device; keyboard/touch parity.
- **Matrix face** — optional: when the camera sees a face, its 478 landmarks
  become a dim, slow constellation of mutating hex digits deep in the backdrop.
  Quality-gated, always on-device, never recorded.
- **CAERUS** — original TARS-inspired slab companion. Voice in/out via the Web
  Speech API. On-device intent engine by default; optional grounded LLM upgrade
  (below) locked to the public knowledge base in `js/kb.js`.
- **Past Lives Arcade** — 8-bit map of the journey. One log matters to the moon.
- **CTF Moon** — answer verified as SHA-256 (never stored in clear), reward form
  guarded by honeypot, minimum-time gate and client rate limit, delivered via
  FormSubmit AJAX.
- **Quality governor** — device tiering at boot (memory/cores/GPU probe) plus a
  runtime FPS governor that steps effects down (DPR → dust → face → stars)
  before anything can stutter. Gyroscope parallax on mobile, with the iOS
  permission taken at the entry gate.

## CAERUS AI (optional, free)

Out of the box the bot is 100% on-device. To let it answer free-form questions:

1. Create an API key in **Google AI Studio** on an account **without billing**
   (free tier: it can rate-limit, it cannot spend).
2. In Google Cloud Console → Credentials, restrict the key to
   **HTTP referrer** `https://flaviogiorgioguarini.github.io/*` and to the
   **Generative Language API** only.
3. Paste it into `js/ai-config.js` (`key: '...'`) and push.

The system prompt (`js/kb.js`) is compiled strictly from content already
public on this site and hard-refuses the moon answer. On any error or timeout
the bot falls back to the local intent engine.

## Security posture

Strict CSP meta (`default-src 'self'`; connect-src exceptions: formsubmit.co
and generativelanguage.googleapis.com for the opt-in bot; `'wasm-unsafe-eval'`
for MediaPipe). No inline scripts or styles, no eval, input length caps
everywhere, external links `rel="noopener"`.

## Operations note

The CTF email endpoint uses FormSubmit: the **first submission from the live
domain sends an activation link to the inbox — click it once** and the flow is live.

## Local dev

```bash
python3 -m http.server 8017
```
