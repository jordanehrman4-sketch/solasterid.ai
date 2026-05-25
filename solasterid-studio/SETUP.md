# Solasterid Studio — Setup

## Requirements
- Node.js 18+ and npm

## Install & Run

```bash
cd solasterid-studio
npm install
npm run dev
```

Then open http://localhost:5173

## Audio (optional)

Drop audio files into `public/audio/`:
- `ocean-ambience.mp3` — any ocean/scuba ASMR loop
- `roses-imanbek-local.mp3` — local copy of Roses (Imanbek remix)

Audio defaults to ON after the user clicks "Enable Audio". If files are missing, the UI shows a notice and lets the user upload Roses from their machine.

## Build for production

```bash
npm run build
npm run preview
```

## What it is

Solasterid Studio is a browser-based growth chamber for a v4 Solasterid — a multi-agent starfish architecture that evolves over rounds via OpenAI API calls.

- Starts with 5 arms (Literalist, Mechanic, Dreamer, Adversary, Verifier)
- Each round: arms deliberate, Speakerbot synthesizes, mutations are applied
- Every 5 rounds: the current tempseed is injected as a recurrent growth signal
- At round 25: export unlocks (ZIP containing state, transcript, mutations, replay script)
- Roses volume scales with active arm count — full cognitive reef rave at 30+ arms

## Key behaviors

- API key is held in RAM only. Never logged, never stored, never exported.
- The creature's fossil (export ZIP) is saved to IndexedDB locally.
- tempseed can be edited at any time without pausing the run.
- The v4_seed.json in public/ is the actual Solasterid v4 architecture after 60 iterations — kept for future "Import Architecture" feature.

## Slogan

> The creature's fossil is saved. The user's API key is not.
