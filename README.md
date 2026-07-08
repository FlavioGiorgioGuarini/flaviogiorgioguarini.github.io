# flaviogiorgioguarini.github.io

Total-black 3D portfolio with a second, fully underwater skin — built
**dual-hand first** (v9 "The Dive Line" — the page is a measured descent
to −1233 m, the South Adriatic Pit). Static, hand-written, fully
self-hosted: no build step, no CDN at runtime, no trackers, no generated
imagery — every visual is real-time WebGL/canvas.

**Six languages** (EN·IT·ES·DE·PT·FR): the full experience is localized in
`js/i18n.js` + `js/i18n-x.js`, plus a spoken audio-description per language
(utility button in the top bar). Hand gestures double as an accessibility
input: the whole site can be explored with two hands, one hand, keyboard,
pointer or touch — full parity.

## What's inside

- **DNS_1** — original score by Flavio (Ableton, 192 kHz master), streamed as AAC
  and analysed live with the Web Audio API. Stars, dust and nebulae move with the
  music; underwater the score dives through a lowpass.
- **Deep-field scene** — Three.js (self-hosted, pinned 0.182), ACES filmic tone
  mapping + PMREM environment for real PBR: shader starfield, milky-way band,
  audio-reactive dust, procedural displacement moon with albedo maria.
- **Ocean Mode** — a shaka 🤙 (or the wave button, or a two-hand pinch-and-spread)
  submerges the whole site: foam sweep, lowpassed score, living water that reacts
  to both hands and the phone's gyroscope, god rays, marine snow, bubbles, caustic
  seabed, a school of procedural **koi** that steers away from your hands, and a
  detailed patrol submarine (anechoic tiling, limber holes, propeller wake) where
  the moon used to be. Same content, second world. Space keeps its own rare
  spectacle: **rocket launches** climbing out of the deep field.
- **Cockpit hands** — TWO real-time bionic 3D hands (joints + bones driven directly
  by MediaPipe's 21 world landmarks per hand, per-hand One-Euro banks, VR-style,
  no rig), with anatomical tapering and palm volume. The grammar is dual-hand
  first: your **dominant hand** (learned behaviourally, not assumed) is precision —
  **point at any button for 3 s to click it** (dwell ring), pinch to paint or grab;
  the other hand is motion — closed fist flies, up/down scrolls, left/right jumps
  sections. **Both hands pinching and spreading tears the world open** (space ↔
  ocean); spreading both open palms fades the chrome away. Underwater the pair
  turns amphibious: iridescent skin and webbing. Without a camera one hand idles
  cinematically. All on-device; keyboard/touch parity everywhere.
- **Hand Atelier** — a persistent light-painting canvas with two simultaneous
  brushes (pinch either hand), pointer/multi-touch parity, grabbable glass orbs
  with momentum, starlight or bioluminescent-ink palettes, **Save-as-JPG** export.
- **Game deck** — two cabinets at the end of the site, both skinned by the active
  world: **DEEP RUNNER** (10 levels, patterns, powerups, bosses at 5 and 10 —
  GATEKEEPER/INVENTOR PRIME in space, ANGLER SOVEREIGN/LEVIATHAN underwater) and
  **YOU vs THE LARPERS** (a stickman brawl that scripts you down to 1 HP before
  Flavio arrives with THE DEPTH BREAK). Localized HUDs, Esc returns to the site.
- **Original easter eggs** — rare 16-bit vignettes drawn at runtime (a golden
  supersonic hero circling a top-hatted mech inventor on an asteroid; a shy pixel
  axolotl in the reef; a pearl-diver chase). Homages by design, no borrowed IP.
- **Matrix face** — optional: when the camera sees a face, its 478 landmarks
  become a dim, slow constellation of mutating hex digits deep in the backdrop.
  Quality-gated, always on-device, never recorded.
- **CAERUS** — original TARS-inspired slab companion; underwater it becomes a
  bioluminescent **jellyfish** (same mind, second body). Voice in/out via the Web
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
