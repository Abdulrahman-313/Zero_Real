# CLAUDE.md — Zero Real

@AGENTS.md

The product requirements live in `SPEC.md`. Read it before starting any milestone. If the spec and the code disagree, fix the code or update the spec in the same commit.

## Stack (versions verified 2026-09-29)

- **Next.js 16.x** (App Router, Turbopack), scaffolded with `npx create-next-app@latest`, plus **TypeScript strict** and **Tailwind CSS v4**.
- `@faker-js/faker` v10 (always a seeded instance, never the global `faker`), `zod` v4, `vitest` v5 (needs `@types/node` ≥ 22; we pin ^24).
- `@google/genai` v2 is the official Gemini JS SDK. The legacy `@google/generative-ai` is deprecated, so never use it. Check the method names against the installed SDK's types, because the docs show both `models.generateContent` and the newer `interactions.create`.
- Hashing uses `@noble/hashes` (a synchronous SHA-256 that is identical in the browser and in tests).
- Fonts: **Space Grotesk** for headings and **IBM Plex Sans** for body, both through `next/font/google`.
- Next 16 has no `next lint`. Lint runs through the ESLint CLI (`npm run lint`, which runs `eslint .`).

## Hosting constraints (Vercel Hobby)

- All three engines are **pure TypeScript that runs in the browser**. Preview and export (CSV/JSON/SQL/print) happen client-side through Blob downloads, and no bulk data passes through server functions.
- **Only AI calls** go through route handlers under `app/api/ai/*` (`infer-schema`, `synthesize-text`, `edge-cases`), so `GEMINI_API_KEY` stays on the server. Never expose the key through `NEXT_PUBLIC_*`.
- Route handlers use the Node runtime and stay small and fast.

## AI rules

- Env: `GEMINI_API_KEY` (from Google AI Studio) and `GEMINI_MODEL`. The default is `gemini-3.5-flash-lite`, which is free-tier eligible and is the model Google's model page recommends for new projects. `gemini-3.8-flash` is the higher-quality alternative. Check live limits at https://aistudio.google.com/rate-limit.
- `lib/ai` holds the provider adapter interface `{ inferSchema, synthesizeText, proposeEdgeCases }`. It has two providers: `gemini` and `fallback` (rule-based, no network).
- Every AI response carries `provider: "gemini" | "fallback"` and an optional `notice`. The UI shows the notice in a small `aria-live` toast.
- Assume the free tier allows about 10–15 RPM:
  - Keep prompts small and ask for JSON output validated with zod.
  - Cache results in two places: a server-side in-memory LRU keyed by the SHA-256 of the input, and a client-side Map.
  - Use an 8 s timeout (AbortController).
  - On any error, 429, invalid JSON, schema mismatch or missing key, use `fallback` automatically. The demo must never hang or crash.
- Route protection: zod-validate the body, cap the sample at 50 rows / 20 KB (reject anything larger with a 413 and a clear message), and apply a per-IP token bucket (in-memory; per-instance on serverless, which is acceptable) that returns a friendly 429 which the client turns into the fallback.
- AI output seeds **pools and configs**. It is never used per row, so generation stays deterministic.

## Architecture

```
app/
  layout.tsx, page.tsx          # metadata (title, description, OG/Twitter), fonts
  api/ai/{infer-schema,synthesize-text,edge-cases}/route.ts
components/workspace/           # Sidebar, ConfigPanel, PreviewCanvas, ExportMenu, ValidationPanel, ...
lib/
  engines/tabular/              # pure functions, no React
  engines/relational/
  engines/documents/            # invoices, statements, statement query parser
  engines/shared/               # seeded RNG helpers, money (minor units), locales, curated name pools, edge cases
  ai/                           # adapter, gemini provider, fallback provider, cache, rate limit, schemas
  export/                       # csv, json, sql (postgres), download (Blob)
tests/ (or *.test.ts next to the code)
```

- Engines are **pure functions** of `(config) → result`, with no React, DOM or `Date.now()`. "Today" is passed in as a parameter.
- Seeding: derive a per-record seed from `(seed, tableName, index)` so the preview is always a prefix of the export.
- Money is integer minor units everywhere. Format only at the display and export boundary with `Intl`.
- Config objects are defined as zod schemas, and the TS types are inferred from them.
- Heavy generation runs off the input path (debounced about 250 ms) so the UI stays responsive.

## Safety rules for generated content (non-negotiable)

- Every document (on screen, in print, in JSON, in CSV) carries **"SYNTHETIC TEST DATA — NOT A REAL DOCUMENT"**.
- Use only invented company, bank and merchant names from curated pools. No real brands and no logos.
- Emails only use `example.com`/`.org`/`.net`. Account numbers are obviously fake (`TEST-…`, `XX00 TEST …`).

## Quality bar

- Production-ready: no placeholders, no TODOs, no dead code. Handle empty and invalid input with clear inline messages.
- Semantic, accessible HTML: landmarks, labels, keyboard support, visible focus, AA contrast.
- Responsive: the three panels stack below 1024 px and there is no horizontal page scroll.
- Tests must cover: seed determinism, FK integrity, invoice totals, running balance (plus CSV/SQL escaping and inference heuristics).
- Test tooling: `server-only` is aliased to a stub in `vitest.config.mts`. The SQL dump is loaded into real Postgres through `@electric-sql/pglite`. Gemini is tested by stubbing `fetch` (success, 429, bad JSON, stall/timeout), so no key is needed.

## Design tokens (match the deck)

| Token | Value | Use |
|---|---|---|
| navy | `#0F2A3F` | sidebar, headings |
| teal | `#1C7C6C` | primary buttons, accents, focus |
| cream | `#F0EEE6` | app background |
| off-white | `#FAFAF7` | cards/panels |
| teal-50 | `#DCEDE9` | chips, badges, selected states |

Use rounded cards (`rounded-2xl`), subtle borders and shadows, and a clean, professional look. Define the tokens in `@theme` in `app/globals.css` (Tailwind v4).

## Workflow

- Work one milestone at a time, as planned in the chat.
- After each milestone, run `npm run lint && npm run typecheck && npm test && npm run build`, fix everything, then `git commit`.
- `npm run build` must pass before every commit.
- Scripts in `package.json`: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`), `check` (all four).
- Secrets: `.env.local` is gitignored, and `.env.example` lists `GEMINI_API_KEY` and `GEMINI_MODEL`. Never commit secrets. Use only free services.
- Environment: Windows 11, where the Bash tool is Git Bash. Use forward slashes in paths.
