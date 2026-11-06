# Freshservice Console

Local React + TypeScript UI for working Freshservice tickets through the API. See [SPEC.md](SPEC.md).

## Setup

```bash
npm install
cp .env.example .env   # then fill in FRESHSERVICE_DOMAIN and FRESHSERVICE_API_KEY
```

## Run

| Command | What it does |
|---|---|
| `npm run dev` | UI on http://127.0.0.1:5173, proxy on 8787, talking to your real Freshservice |
| `npm run dev:mock` | Same, but against a local fake Freshservice (no key needed) |
| `npm start` | Build, then serve UI + proxy together on http://127.0.0.1:8787 |
| `npm test` | Unit + proxy tests |

The API key lives only in `.env` and is used by the local proxy (`server/`). The browser never sees it.
The proxy only listens on 127.0.0.1 and only forwards the endpoints in `server/allowlist.ts` (no ticket deletes).
