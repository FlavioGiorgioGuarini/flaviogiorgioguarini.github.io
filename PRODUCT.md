# Flavio Giorgio Guarini — Interstellar-grade Portfolio

## What it is
Personal portfolio at https://flaviogiorgioguarini.github.io/ — a single-page cinematic experience. The visitor doesn't browse a résumé; they enter Flavio's universe: deep space, his own soundtrack (DNS_1, composed by him), and interactions that respond to hand, face, gaze, and sound.

## Who it's for
Recruiters, security/AI teams, collaborators, clients. They should leave thinking: "working with him means going beyond — response and evolution."

## Brand
Kicker: **SECURITY · SOUND · SYSTEMS**. 22, Bari, Italy. Two bachelor's degrees in parallel (Computer Engineering + Communication & Multimedia, target 2027). TryHackMe top 3%. Official Ableton beta tester since 2019. The soundtrack is his own composition — sound is not decoration, it's identity.

## Mood — grounded sci-fi (Interstellar)
- Vast, quiet, precise. Epic but practical. IMAX + 35mm — never neon cyberpunk, never gamer RGB, never AI-slop gradients.
- Palette: warm obsidian near-black space; bioluminescent teal for key elements; platinum neutrals; a restrained ember warmth (dust, cornfields, engine burn) for humanity.
- Typography: cinematic display (Space Grotesk, wide-tracked), quiet serif italics for poetic lines (Cormorant Garamond), system sans body.
- Layout: massive spacing, each section a film set. Dark is the only mode.
- Motion: slow, physical, inertial. Peaks follow the music. Reduced-motion gets a dignified still version.

## Sections (in narrative order)
1. **Hero** — hyperreal cyborg hand (Higgsfield), audio-reactive particle swarm on DNS_1, headline about going beyond.
2. **About** — 3D timeline 2003→2027 (Bari → Gran Canaria 2017 → sound 2019 → diploma 2023 → Rome 2024 → security pivot 2025 → dual degree + Erasmus León 2026 → double graduation 2027).
3. **Projects** — exactly 3: SIEM 3D v2.0 (flagship), Second Brain AI (teaser only, "Coming soon", zero detail), Sound (Ableton beta testing + this very soundtrack).
4. **Skills** — data-driven orbital visualization, no icon soup.
5. **Mini Game** — 8-bit map of his past, modern shader layer on top.
6. **CTF Moon** — 3D moon, riddle, reward: a coffee with Flavio.
7. **Contact** — email + WhatsApp, clean and cinematic.
Persistent: TARS-inspired robot companion (original design), voice chat, corner canvas.

## Technical constraints
- Static GitHub Pages. No build step. Vanilla ES modules + self-hosted Three.js. Self-hosted MediaPipe (lazy, opt-in camera only).
- Strict CSP: everything self-hosted; only formsubmit.co for the CTF email.
- Privacy: all tracking on-device, nothing recorded or sent. Explicit consent gates for camera/mic.
- A11y: full keyboard/mouse/touch parity with every gesture; visible focus; reduced-motion path.
- Performance: Lighthouse ≥ 85. Heavy assets (MediaPipe ~21MB, audio 8MB) lazy/streamed, never in critical path.

## Quality bar
Perceived value: €100k site at €0 real cost. Every visual must feel authored, physical, and inevitable — if an element could appear in a template, it doesn't ship.
