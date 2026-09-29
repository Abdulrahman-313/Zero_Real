# Zero Real

> **Synthetic data, generated on demand.** Realistic, privacy-safe tabular, relational and document data.

**Pipeline:** Ingest schema → Model relationships → Generate with AI → Validate & export.

One no-code workspace with three generators:

| | What you get | Guarantees |
|---|---|---|
| **Tabular** | Rows from a column schema: id, name, email, date, currency, category, number, boolean, text | Same seed produces the same output. Null and outlier rates. Per-column mask, SHA-256 hash or Laplace noise. Up to 10,000 rows. |
| **Relational** | Customers → orders → order items, customer profiles (1:1), products ↔ categories (N:N) | 0 orphans and 0 mismatches, checked by an independent validator. Order totals equal the sum of their line items. |
| **Documents** | Invoices (US sales tax, UK VAT, PK GST) and bank statements | Totals reconcile exactly. Running balances are always correct. Every document is labelled **SYNTHETIC TEST DATA — NOT A REAL DOCUMENT**. |

The **AI layer** (Google Gemini, free tier) does three things. It infers a schema from a pasted sample, writes realistic free-text pools, and suggests edge cases. It falls back automatically to built-in rules, so the demo never hangs or breaks.

Exports: CSV, JSON, a Postgres SQL dump, a zipped CSV bundle, and a clean print view for *Save as PDF*.

## Quick start

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # optional: add a free Gemini key
npm run dev
```

Open http://localhost:3000. The app works fully without a key; the AI features then use the built-in rules.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | No | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Server-only and never sent to the browser. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash-lite`, which is free-tier eligible. `gemini-3.8-flash` is a higher-quality alternative. |

`.env.local` is gitignored. Never commit keys.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation, then `tsc --noEmit` (strict) |
| `npm test` | Vitest unit tests |
| `npm run check` | Lint, typecheck, test and build (run before every commit) |

## Architecture

```
Browser (all data generation and export)                     Server (AI only)
┌──────────────────────────────────────────────┐            ┌──────────────────────────────┐
│ components/workspace   Sidebar · Preview ·   │  fetch     │ app/api/ai/*  route handlers │
│                        Config · Export       │ ─────────▶ │  zod · 20 KB cap · per-IP    │
│ lib/engines/tabular    pure, seeded          │            │  rate limit · LRU cache      │
│ lib/engines/relational pure + validator      │ ◀───────── │ lib/ai  provider adapter     │
│ lib/engines/documents  invoices · statements │  JSON      │  gemini ──(8 s / 429 / err)─▶│
│ lib/export             CSV · JSON · SQL · ZIP│            │         fallback (rules)     │
│ lib/ai/client          local fallback too    │            └──────────────────────────────┘
└──────────────────────────────────────────────┘
```

**Built for Vercel's free plan.** Generating and exporting data (10,000 rows, a 50,000-row SQL dump) happens entirely in the browser through Blob downloads. Server functions only relay small AI requests, which keeps the API key on the server.

### Design decisions

- **Per-record seeding.** Every cell or record is seeded from `(seed, scope, index)`. Output is fully reproducible, the preview is always an exact prefix of the export, and changing one column never shifts the others.
- **Monotonic quality streams.** Null, outlier and edge-case decisions use a separate random stream. Raising the null rate only adds nulls; it never reshuffles existing values.
- **Money as integer minor units.** Cents, pence and paisa are integers everywhere. Tax is computed per rate bucket with half-up rounding. There is no float drift, so totals always reconcile.
- **Independent validator.** The relational validator re-scans the generated rows (PKs, unique keys, every FK, totals, SKUs, dates, cardinalities) and does not trust the generator. A **tamper test** in the UI injects broken rows into a copy of the data and shows the validator catching them.
- **Grounded AI.** Gemini decides meaning (types, keys, text kind). Numeric and date ranges and category values are always measured from the sample itself. AI text is used as a seeded pool, never per row, so generation stays deterministic and offline.
- **Never hangs.** The server enforces an 8 s timeout, and any error, 429, invalid output or missing key falls back to the rules. The browser has its own timeout and falls back locally if the network fails.

### Folder layout

```
app/                     layout (fonts, metadata), page, OG image, api/ai/* routes
components/workspace/    Workspace shell, Sidebar, ModeLayout, ExportMenu, DataTable, per-mode UIs
components/ui/           accessible form controls, icons, toast notices
lib/engines/shared/      seeded RNG, money, dates, locales, people, text templates
lib/engines/tabular/     schema (zod), generator, privacy, edge cases, profile, presets
lib/engines/relational/  schema, generator, validator (+ tamper test)
lib/engines/documents/   invoices, tax templates, statements, query parser, invented-name pools
lib/ai/                  schemas, sample parser, fallback + Gemini providers, service, route factory, client
lib/export/              CSV, JSON, Postgres SQL, ZIP, document exports, Blob download
```

## Privacy and safety

- No real records are used or uploaded. The only thing ever sent to a server is a sample you paste for AI schema inference, capped at 50 rows and 20 KB.
- Emails use reserved `example.com`, `.org` and `.net` domains.
- Companies, banks and merchants are invented. Bank names include "Test" or "Sample". No logos are used, only generic monograms.
- Account and tax numbers are obviously fake (`TEST-0000-…`, `XX00 TEST …`, `GB TEST …`).
- Every document shows **SYNTHETIC TEST DATA — NOT A REAL DOCUMENT** as a banner, a watermark and a footer on every printed page. JSON and CSV exports carry the same notice.

## Testing

`npm test` runs 65 unit tests:

- **Seed determinism.** Covered for tabular (every locale), relational and documents, plus the prefix property and column stability.
- **FK integrity.** 0 orphans, mismatches or duplicates across 25 seeds and edge configurations. The tamper test must be caught.
- **Postgres dump.** The dump is loaded into real Postgres (PGlite, WASM) twice. Row counts and totals are checked with SQL.
- **Invoice totals.** They reconcile for US, UK and PK across bulk runs and seeds. Half-up rounding is checked per tax bucket.
- **Running balance.** Balances are exact for every row. Floors, ceilings, bands, exact counts and windows are all honoured.
- **AI layer.** Covers sample parsing, heuristics, route limits (400, 413, 429), and Gemini success, 429, invalid JSON and a stalled call (8 s timeout) with `fetch` mocked.

## Deploying to Vercel (free Hobby plan)

1. Push this repository to GitHub.
2. In Vercel, click **Add New → Project**, import the repo, and accept the detected Next.js settings.
3. Optionally, add `GEMINI_API_KEY` (and `GEMINI_MODEL`) under **Settings → Environment Variables**.
4. Deploy. Without a key the AI features run on the built-in rules.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · @faker-js/faker 10 (seeded, custom randomizer) · zod 4 · @google/genai 2 · @noble/hashes · Vitest 5 · PGlite (tests).

See [SPEC.md](SPEC.md) for the product specification and [DEMO.md](DEMO.md) for the live-demo script.
