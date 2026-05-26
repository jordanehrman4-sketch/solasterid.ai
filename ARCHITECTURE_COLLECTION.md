# Solasterid Architecture Collection

Solasterid Studio still never saves the visitor's OpenAI API key. The key remains in React state only and is not included in exports or architecture collection payloads.

When `VITE_ARCHITECTURE_COLLECTOR_URL` is set, the **Take My Solasterid Home** button does three things:

1. Downloads the user's local Solasterid zip.
2. Saves the same full fossil locally in the user's browser IndexedDB.
3. POSTs a **sanitized architecture fossil** to your collector endpoint.

The submitted architecture fossil includes arms, committees, mutation summaries/payloads, counts, and a seed fingerprint. It deliberately omits:

- OpenAI API keys
- Full Solasterid state
- Full transcript
- Full seed text

## Why an endpoint is required

GitHub Pages is static. Browser code cannot safely write collected JSON files into the repo because that would expose your GitHub write token to every visitor. The front-end can prepare the sanitized architecture fossil, but a tiny server-side endpoint must hold the GitHub token and write the JSON file.

This repo includes a Cloudflare Worker collector in `architecture-collector-worker/`.

## Deploy the collector with Cloudflare Workers

From the repo root:

```bash
cd architecture-collector-worker
npm install
```

Edit `wrangler.toml`:

```toml
GITHUB_REPO = "jordanehrman4-sketch/solasterid.ai"
GITHUB_BRANCH = "main"
ALLOWED_ORIGINS = "https://solasterid.ai,https://jordanehrman4-sketch.github.io"
```

Create a fine-grained GitHub token with **Contents: Read and write** permission for this repo only. Then store it as a Worker secret:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Deploy:

```bash
npm run deploy
```

Cloudflare will print a Worker URL like:

```text
https://solasterid-architecture-collector.<your-subdomain>.workers.dev
```

## Wire the Studio front-end to the collector

In `solasterid-studio/.env.production`:

```bash
VITE_ARCHITECTURE_COLLECTOR_URL=https://solasterid-architecture-collector.<your-subdomain>.workers.dev
```

Then rebuild and deploy the Studio:

```bash
cd solasterid-studio
npm install
npm run build
```

Commit/push the updated source and the rebuilt deployed files according to your current GitHub Pages workflow.

## Where collected architectures go

The Worker writes one JSON file per export:

```text
collected-architectures/YYYY-MM-DD/r<round>_<export-id>.json
```

If the collector is not configured or fails, the export still downloads locally. The upload is intentionally non-blocking.

## Local test with curl

After deployment, test CORS/collection with a tiny fake fossil:

```bash
curl -X POST "$VITE_ARCHITECTURE_COLLECTOR_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "schemaVersion": 1,
    "exportId": "test-fossil",
    "createdAt": "2026-05-26T00:00:00.000Z",
    "privacy": {
      "openaiApiKeyIncluded": false,
      "seedTextIncluded": false,
      "transcriptIncluded": false,
      "fullStateIncluded": false
    },
    "architecture": { "arms": [], "committees": [], "mutations": [] },
    "export": { "filename": "test.zip", "round": 50, "version": 50 },
    "metrics": {},
    "seedFingerprint": { "sha256": null, "length": 0, "historyCount": 0 },
    "source": { "app": "solasterid-studio", "origin": "manual-test" }
  }'
```
