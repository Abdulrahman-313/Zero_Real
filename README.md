# Synthetic Data Platform

> HackDataV2 submission — realistic, privacy-safe tabular, relational and document data, generated on demand.

**Pipeline:** Ingest schema → Model relationships → Generate with AI → Validate & export.

All data generation runs in the browser (pure TypeScript engines). Only the optional AI features call a server route, which keeps the Gemini API key on the server.

## Quick start

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local   # optional: add a free Gemini key from Google AI Studio
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run check` | All of the above |

See [SPEC.md](SPEC.md) for the product specification and [CLAUDE.md](CLAUDE.md) for repository conventions.
