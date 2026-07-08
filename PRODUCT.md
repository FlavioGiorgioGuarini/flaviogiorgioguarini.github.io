# Flavio Giorgio Guarini — Interstellar-grade Portfolio

## What it is
Personal portfolio at https://flaviogiorgioguarini.github.io/ — a single-page cinematic experience. The visitor doesn't browse a résumé; they enter Flavio's deep: his own soundtrack (DNS_1, composed by him), a world that flips between space and ocean, and interactions built hand-first. On desktop both hands are tracked and mirrored as two bionic hands with distinct roles (dominant = precision, other = motion). On phones and tablets the grammar is strictly ONE-hand (v10): a single hand points to click, closes to glide, pinches to paint — and if tracking wavers, control returns to touch instantly. Touch, pointer and keyboard always drive everything at full parity.

## Who it's for
Recruiters, security/AI teams, collaborators, clients. They should leave thinking: "working with him means going beyond — response and evolution."

## Brand
Kicker: **SECURITY · SOUND · SYSTEMS**. 22, Bari, Italy. Two bachelor's degrees in parallel (Computer Engineering + Communication & Multimedia, target 2027). TryHackMe top 3%. Official Ableton beta tester since 2019. The soundtrack is his own composition — sound is not decoration, it's identity.

## Mood — grounded sci-fi (Interstellar)
- Vast, quiet, precise. Epic but practical. IMAX + 35mm — never neon cyberpunk, never gamer RGB, never AI-slop gradients.
- Palette: total-black space; bioluminescent teal for key elements; platinum/silver neutrals. Dark is the only mode.
- Typography: Syncopate (cinematic titling), STIX Two Text italic (poetic lines), mono labels, system body.
- Layout: massive spacing, each section a film set.
- Motion: slow, physical, inertial. Peaks follow the music. Reduced-motion gets a dignified still version.
- Second world (v7): **Ocean Mode** — a shaka gesture or the wave button submerges the entire site (foam sweep, lowpassed score, living hand-reactive water, submarine instead of the moon). Same content and functions, different scenography.
- v8 — **"Into the Deep"**: the narrative flips from stargazing to descent (he was a competitive swimmer before an engineer; the water is biographical). Dual-hand grammar everywhere: bi-pinch tears the world open, symmetric palm spread clears the chrome, middle finger closes the front-most panel. Ocean gains koi that avoid your hands, a detailed sub and CAERUS-as-jellyfish; space gains rare rocket launches. Original 16-bit easter eggs only — no borrowed IP, ever.
- v9 — **"The Dive Line"**: depth becomes the organizing axis. The page IS the dive, bottoming out at **−1233 m — the South Adriatic Pit, the deepest point of Bari's own sea**. A graduated depth gauge replaces the nav dots (live meters readout; the ONE home of the telemetry voice). The camera rides a per-station rail measured from the real DOM; fog, exposure and star density grade with depth; the ocean is world-anchored (surface recedes overhead, the seabed waits at the floor). Projects are a full-width cargo manifest — hold 02 ships sealed, hold 03's separator is DNS_1's live waveform. A single-line interstitial beat replaces the old dead zone. The first-visit guide is a coach chip beside CAERUS that folds on scroll and leaves. The moon rises into frame only at its own station, full-disc, never clipped.

## Sections (in narrative order)
1. **Hero** — "Into the deep": two live bionic hands, audio-reactive deep field on DNS_1.
2. **Descent** — timeline 2003→2027 with 8 3D waypoint glyphs that change character per world (Bari → Gran Canaria 2017 → sound 2019 → diploma 2023 → Rome 2024 → security pivot 2025 → dual degree + Erasmus León 2026 → double graduation 2027).
3. **Projects** — exactly 3: SIEM 3D v2.0 (flagship), Second Brain AI (teaser only, "Coming soon", zero detail), Sound (Ableton beta testing + this very soundtrack).
4. **Skills** — data-driven orbital visualization, no icon soup.
5. **Past Lives Arcade** — 8-bit map of his past, modern shader layer on top.
6. **Hand Atelier** — light painting: two brushes on desktop (pinch either hand), one finger or one pinch on mobile, with a fullscreen takeover for drawing/signing; grabbable orbs with momentum, Save-as-JPG + Reset.
7. **CTF Moon** — 3D moon, riddle, reward: a coffee with Flavio.
8. **Contact + Game Deck** — email + WhatsApp, then two cabinets: DEEP RUNNER (10 levels, space/abyss skins, bosses at 5 and 10) and YOU vs THE LARPERS (scripted 1-HP overwhelm, Flavio's rescue, THE DEPTH BREAK).
Persistent: CAERUS companion (slab monolith in space, jellyfish underwater), voice chat, corner canvas, first-visit two-hand guide (? replays it).

## Technical constraints
- Static GitHub Pages. No build step. Vanilla ES modules + self-hosted Three.js. Self-hosted MediaPipe (lazy, opt-in camera only).
- Strict CSP: everything self-hosted; connect-src only formsubmit.co (CTF email) + generativelanguage.googleapis.com (opt-in CAERUS LLM, key referrer-locked, empty by default).
- Privacy: all tracking on-device, nothing recorded or sent. Explicit consent gates for camera/mic. The bot's optional LLM is grounded to `js/kb.js` (public site facts only) and never reveals the moon date.
- A11y: full keyboard/mouse/touch parity with every gesture (dwell-click included); visible focus; reduced-motion path.
- Performance: Lighthouse ≥ 85. Heavy assets (MediaPipe ~21MB, audio 8MB) lazy/streamed, never in critical path. Device tiering at boot + runtime FPS governor (steps down DPR → dust → face → stars; never up).

## Quality bar
Perceived value: €100k site at €0 real cost. Every visual must feel authored, physical, and inevitable — if an element could appear in a template, it doesn't ship.
