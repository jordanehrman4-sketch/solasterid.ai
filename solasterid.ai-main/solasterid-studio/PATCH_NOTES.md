# Solasterid Studio — Aesthetic & UX Overhaul

This is the patch summary for the redesign pass. Changes are in-place under
`solasterid-studio/`.

## How to test locally

```bash
cd solasterid-studio
npm install
npm run dev     # http://localhost:5173
# or:
npm run build && npm run preview
```

`vite.config.ts` still ships `base: "./"`, so the GitHub Pages workflow is
unchanged.

## Files changed

### New files
- `src/lib/organicGeometry.ts` — sampleQuadraticCurve / ribbonPathFromCurve /
  organicArmPath / labelPlacement. Each arm is now a tapered ribbon swept along
  a quadratic curve, not a fat stroke.
- `src/components/ReefBackground.tsx` — layered reef backdrop: depth gradient,
  caustic rays, drifting plankton, distant coral silhouettes, kelp fronds,
  foreground coral cluster, sand floor, vignette.
- `src/components/LiveStreamCard.tsx` — pinned "Live Deliberation" card with
  phase chip, progress bar (indeterminate while waiting, determinate while
  streaming), elapsed timer, char counter, auto-following monospace stream.
- `src/components/ProgressReef.tsx` — stat pills + dual progress rows for
  export unlock (r→25) and tempseed tide (rounds-to-next-injection).

### Substantially rewritten
- `src/index.css` — new design tokens (ink/abyss/glass + cyan/foam/coral/
  lavender/plankton/kelp/tangerine), Inter/Space-Grotesk/JetBrains-Mono stack,
  glass-panel system, btn / chip / progress-track / progress-fill /
  progress-indeterminate / living-dot / stream-caret / tide-shimmer
  primitives, softer scrollbar, calmer halos.
- `src/lib/openaiClient.ts` — added `callOpenAIStream({apiKey, prompt, model,
  onPhase, onDelta, onEvent})` that POSTs `stream: true` to the Responses API,
  reads `response.body` with a reader, parses SSE chunks, accumulates
  `response.output_text.delta` events, surfaces phase transitions, and throws
  on `response.error`. Legacy `callOpenAI` retained.
- `src/components/SolasteridCanvas.tsx` — full redesign:
  - organic ribbon arms (tapered, gently curved, never straight spokes)
  - subtle sucker-ridge dots along arms
  - soft living-disc center with concentric ridges + mouth nucleus
  - committee sectors are very low-opacity tints, not glowing rings
  - retired arms are fossil fragments tucked inside the body
  - probation arms are translucent dashed wisps
  - labels hidden by default when >8 arms; hover/select shows label with a
    dashed leader line on an outer ring
  - background swapped to `<ReefBackground/>` (kelp drift, plankton, caustics)
  - kept the bubbles (softer, with inner highlight)
- `src/components/GrowthConsole.tsx`:
  - uses `callOpenAIStream`
  - tracks `phase`, `liveStreamText`, `charsReceived`, `elapsedMs`
  - passes live stream into `TranscriptPanel`
  - header shows phase chip + animated living-dot while a round is in flight
  - sidebar control card redesigned with new buttons + chips + advanced panel
  - error card uses the coral-tinted glass panel + retry that re-enters loop
- `src/components/TranscriptPanel.tsx`:
  - accepts `liveStreamText`, `isStreaming`, `currentPhase`, `elapsedMs`,
    `charsReceived` props
  - renders the `<LiveStreamCard/>` pinned at the top while the model is
    deliberating
  - cards stagger in smoothly (delay capped) instead of dumping all at once
  - soft glass cards with phase chips, mono round labels, italic speakerbot
    voice
- `src/components/AudioControls.tsx` — same behavior, repainted: rave-pressure
  meter with tick scale, animated lavender→coral fill, custom on/off toggles
  with halos, sane volume readouts.
- `tailwind.config.js` — new color tokens under `reef.*`, fontFamily.sans →
  Inter, fontFamily.display → Space Grotesk, fontFamily.mono → JetBrains Mono
  (so anywhere old code used `font-mono` it now uses JetBrains Mono).
- `index.html` — Google Fonts preconnect + Inter / Space Grotesk /
  JetBrains Mono imports.

### Assets copied
- `public/audio/ocean-ambience.mp3` ← repo-root Coral-Reef ASMR mp3
- `public/audio/roses-imanbek-local.mp3` ← repo-root Roses (Imanbek) mp3
- User upload fallback for Roses is preserved.

## Behavior preserved
- API-key gate, key only in RAM
- Autonomous loop, never auto-pauses for seed checkpoints
- Tempseed injection every 5 rounds
- v4 architecture import
- Export gate at r25
- ArmDetailPanel click-to-inspect behavior
- vite `base: "./"`

## What got softer / less neon
- Global `font-family` is no longer Courier New — replaced with Inter,
  Space Grotesk for display, JetBrains Mono only for IDs / round numbers
- All-caps headings reduced; `eyebrow` class uses small caps-ish display font
- `var(--halo-*)` tokens cap glow intensity; arms use `softGlow` filter with
  stdDeviation 2 instead of 6
- Sector indicators dropped to ~5% opacity instead of glowing rings
- Buttons use new `.btn / .btn-primary / .btn-ghost / .btn-coral` system

## Known follow-ups (not done in this pass)
- `ApiKeyGate.tsx` still uses the old radial-spokes starfish logo; could be
  swapped for a miniature organic preview now that `organicArmPath` exists.
- `SeedEditor.tsx`, `RoundTimeline.tsx`, `ExportPanel.tsx`,
  `ExportHistory.tsx`, `ImportArchitecture.tsx`, `MilestoneToast.tsx`,
  `ArmDetailPanel.tsx` were not visually rewritten — they inherit the new
  glass-panel base + new fonts and look acceptable, but a follow-up pass
  could repaint them with the same `.btn / .chip / .eyebrow` primitives.

---

# Second pass

Pass-2 focuses on creature legibility, runtime feel, and consistency.

## Starfish redesign — matches the reference
- Center body: terracotta radial gradient (`#C97956 → #5E2613`) ringed with
  warm golden papulae dots, a black-pupil mouth, top-left sheen.
- Aura: large soft teal halo behind the body (`radius × 3.8`), gently pulsing.
- Arm palette swapped to a pastel rainbow (coral, butter, mint, lavender,
  peach, sky, rose, apricot) and assigned by display-index so the creature
  reads visually consistent regardless of stored colors.
- Each arm: filled tapered ribbon + thin dark stroke + center highlight +
  6 sucker dots + soft tip glow + white inner tip dot.
- Canvas size bumped from 440 → 720 px; arm length 180 → 240; body radius
  36 → 56.
- Label text upsized 9.5 → 11.5 px (selected 13). Labels now render as
  rounded glass pills with a thin colored border and a dashed leader line
  to the arm tip.
- Gentle whole-creature sway (±2°, 18s period, ~12fps interval so it's not
  burning frames). Labels stay legible because they live outside the sway
  group and recompute their position from the current sway angle.

## Big AUTOPILOT indicator
- Pill at the top-center of the canvas. When running: cyan/lavender gradient,
  pulsing dot, glowing border, `AUTOPILOT` in spaced display caps. When idle:
  neutral muted `IDLE` pill. Always visible — never ambiguous.

## Per-arm speech bubbles
- During streaming: up to 8 arms get a small `•••` typing bubble at their tip
  (sampled evenly so 30-arm creatures stay readable).
- After the round parses: each arm with a report gets a white speech bubble
  with the first 8 words of its quote (or recommendation) + `…`. Bubble has
  a downward tail pointing at the arm tip.
- Bubbles fade out ~4.2s after appearing.

## Autoscroll
- TranscriptPanel only auto-scrolls the *container* (never the page) and
  only when the user is already within 60px of the top (newest card). If
  the user has scrolled away to read an older card, we never hijack them.
- Smooth scroll, not jump.

## ApiKeyGate rebuild
- New mini `<GrowingStarfish/>` that loops 3 → 5 → 7 → 8 arms with the same
  body + papulae + mouth, and rotates slowly (60s per turn). Same palette
  and geometry helpers as the main canvas so users see exactly what they're
  about to grow.
- Simpler copy: "Grow a starfish that thinks for you. Survive 25 rounds and
  take it home."
- Larger primary button: "Enter the Reef".
- New design tokens applied — no more loose Tailwind slate variants.

## Second-pass repaints on supporting panels
- `SeedEditor`, `RoundTimeline`, `ExportPanel`, `ImportArchitecture`,
  `MilestoneToast`, `ArmDetailPanel` all repainted to use the new
  `.btn / .chip / .eyebrow / .progress-*` primitives, foam/coral/plankton
  palette, and consistent rounded-pill chips.
- `ExportPanel` button copy → "Take My Solasterid Home".
- `MilestoneToast` colors moved onto the pastel palette and now uses
  display font with letter-spacing.

---

# Third pass — persistence + lore + speed presets

## localStorage persistence
- New `src/lib/persistence.ts` with `loadSavedState / saveState / clearSavedState`.
- `GrowthConsole` autosaves the live creature ~800ms after every change.
  Page refresh = creature still there. History lists are capped at sensible
  sizes (300 transcript, 300 mutations, 200 visual events, 200 seed history)
  before serialization so we don't blow localStorage quota over a long run.
- A "Welcome back — your r{N} Solasterid is right where you left it" banner
  appears on cold start when a saved state exists. The banner offers
  **keep it** or **start fresh**.
- Header shows a live "saved Xs ago" chip (green dot when a save exists,
  muted when none).
- **reset** also wipes the localStorage snapshot so users get a real fresh
  start, not a phantom restore.

## About / lore sheet
- New `AboutSheet.tsx` opened via a new **ℹ about** button in the header.
- Leans into the actual marine-biology joke: Solasteridae = the sun-star
  family, members typically have 8–16 arms, more than the classical
  5-pointed starfish. The studio's creature starts pentagonal and grows
  out the same way.
- Quick legend grid: Speakerbot · Arms · Committees · Tempseed tide ·
  Autopilot · Fossil at r25, each with a pastel dot and a one-liner.
- Tiny "what to ask for" reminder at the bottom.

## Header tooltip
- The header subtitle now reads `fam. *Solasteridae* · sun stars` and
  exposes the pronunciation + arm-count factoid on hover.

## Footer
- A subtle bottom strip with the studio tagline on the left and on the
  right: `fam. Solasteridae · key in RAM · creature in localStorage ·
  fossils in IndexedDB`. The whole storage story in one line.

## Speed presets
- Replaced the bare slider with three preset cards inside the advanced
  panel: **🌊 Tide (3.6s, calm)** · **🐠 Cruise (1.2s, default)** ·
  **🦑 Sprint (0.5s, burn the seed)**. The raw slider is still there
  underneath for fine-tuning.

## Shared arm palette
- Extracted `src/lib/armColors.ts` (`ARM_PALETTE`, `paletteFor`,
  `buildArmColorMap`). The canvas and transcript now share the same
  committee-walk → palette mapping, so the color dot prefix on each
  `arm_report` card matches the actual ribbon color on the creature.

## Transcript color dots
- `TranscriptPanel` accepts `arms` + `committees`, builds the shared
  color map, and prepends a small color dot + colored speaker name to
  every `arm_report` card — so you can scan who said what at a glance.

## Custom favicon
- `public/favicon.svg` rewritten to a miniature of the new starfish:
  terracotta body, papulae ring, pastel arm rays, soft teal aura. No
  more generic placeholder in the browser tab.
