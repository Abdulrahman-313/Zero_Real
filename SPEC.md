# Synthetic Data Platform — Product Spec

> **HackDataV2 submission.** Realistic, privacy-safe tabular, relational and document data — generated on demand.

This spec follows the pitch deck (`Synthetic Data Platform — HackDataV2.pdf`). If they disagree, the deck's wording and claims win, and this spec should be updated to match.

## 1. Problem & approach

Real data is **scarce, sensitive and slow to get**. Privacy rules block sharing, real datasets are small and skewed with few edge cases, and a sanctioned extract can take weeks to get signed off.

Our approach is **schema-aware, not random**. The pipeline has four stages, and the UI shows them as a stepper:

1. **Ingest schema.** Infer tables, columns, types and keys from a sample, or define them by hand.
2. **Model relationships.** Set distributions and foreign-key cardinalities across tables.
3. **Generate with AI.** The AI layer fills in realistic names, free text and edge cases that the schema alone can't describe.
4. **Validate & export.** Check referential integrity and reconciliation, then export CSV, JSON, SQL or a printable document.

**System design** (deck slide 4): the inputs (schema definition, sample dataset, business rules) feed three generation engines (tabular, relational, document). The AI layer works across all three. Outputs are CSV/JSON tables, a relational DB dump and PDF-style documents.

## 2. Cross-cutting guarantees

| Guarantee | How |
|---|---|
| **Determinism** | Same config + same seed gives byte-identical output. Each row/record gets its own seed derived from `(seed, table, index)`, so the preview is always an exact prefix of the full export. |
| **Money is exact** | Money is held as integer minor units (cents/pence/paisa) and only formatted with `Intl.NumberFormat` for display. There is no float arithmetic on money. |
| **Privacy by construction** | No real records are ever used. Emails use RFC 2606 domains (`example.com`, `example.org`, `example.net`). Phone numbers use reserved fictional ranges. Company, bank and merchant names come from curated invented pools (no real brands, no logos). |
| **Obviously fake identifiers** | Account numbers look like `TEST-0000-4821-7730`. IBAN-like values use country code `XX` (e.g. `XX00 TEST 0000 4821 77`). |
| **Never hangs** | Every AI call has an 8 s timeout and falls back to a rule-based provider automatically. |
| **Limits** | Tabular: ≤ 10,000 rows. Relational: ≤ 2,000 customers and ≤ 50,000 total rows. Bulk invoices: ≤ 500. Statement window: ≤ 365 days. Inputs over a limit are clamped and the UI says so. |

Supported **locale & currency** pairs: `en-US`/USD, `en-GB`/GBP, `de-DE`/EUR, `en-PK`/PKR. For en-PK, a curated Pakistani name/city pool is layered over English. Locale and currency can be chosen independently; the defaults are paired.

## 3. Features

### 3.1 Tabular generation

**Column schema.** Each column has a name, a type, type options, a privacy rule and a nullable flag. Columns can be added, removed, renamed and reordered.

| Type | Options | Example |
|---|---|---|
| `id` | start, step, or UUID mode | `10231` |
| `name` | full / first / last | `Maria Chen` |
| `email` | derived from the row's name when present | `m.chen@example.com` |
| `date` | min/max date, output format (ISO or locale) | `2025-02-11` |
| `currency` | min, max, distribution (uniform / normal / log-normal) | `$482.10` (exported as a number, `482.10`) |
| `category` | list of values with optional weights | `Gold` |
| `number` | min, max, decimals, distribution | `37` |
| `boolean` | probability of `true` | `true` |
| `text` | kind: sentence / product description / memo; uses the AI text pool when available | `Hand-stitched canvas tote…` |

**Config** (right panel): row count (1–10,000), seed (integer, with a "randomize" button), locale & currency, null rate % (0–50, applies to nullable, non-`id` columns), outlier rate % (0–20, applies to `number`/`currency`; outliers are ×10–×100 or negative values and are flagged in the preview), and the edge-case toggles from §3.4.

**Privacy per column** (applied after generation, deterministic):

- **Mask.** Keep the shape and hide the content: `m*****@example.com`, `M**** C***`, `***-***-7730`.
- **Hash.** SHA-256 hex of the value plus a per-dataset salt derived from the seed. Uses a synchronous implementation so it behaves the same in the browser and in tests.
- **Noise.** Numeric columns only. Adds Laplace noise with a configurable ε (differential-privacy style), seeded, and rounds to the column's precision.

**Export:** CSV (RFC 4180 quoting, UTF-8 with BOM for Excel) and JSON (array of objects). Downloads are built client-side as Blobs.

**Preview:** the first 100 rows. It updates live, debounced about 250 ms. Null cells, outliers and edge-case cells are visually marked. A summary shows the row count and the per-column null/min/max/distinct counts.

### 3.2 Relational generation

**Tables (fixed demo model, matching deck slide 6 and extending it):**

```
customers         (customer_id PK, name, email, signup_date, country)
customer_profiles (profile_id PK, customer_id FK UNIQUE → customers, tier, marketing_opt_in)   -- 1:1
products          (product_id PK, sku UNIQUE, name, unit_price_minor, currency)
categories        (category_id PK, name)
product_categories(product_id FK → products, category_id FK → categories, PK(product_id, category_id)) -- N:N
orders            (order_id PK, customer_id FK → customers, order_date, status, total_minor)          -- 1:N
order_items       (item_id PK, order_id FK → orders, product_id FK → products, sku, qty, unit_price_minor, line_total_minor) -- 1:N
```

**Config:** customer count; toggle for the 1:1 profile table (on/off, with a coverage % since not every customer needs a profile, e.g. 100% or 80%); orders per customer (1:N, min/max, and min may be 0); items per order (min/max, ≥ 1); product count; categories per product (N:N min/max, no duplicate pairs); seed; locale & currency.

**Invariants (guaranteed by construction and re-checked by the validator):**

- Every FK points at an existing PK, so there are 0 orphans.
- PKs are unique, the 1:1 FK is unique, and N:N pairs are unique.
- `order_items.line_total_minor = qty × unit_price_minor`.
- `orders.total_minor = Σ line_total_minor` of that order's items, so there are 0 mismatches.
- `order_items.sku` matches `products.sku` for its `product_id`.
- `order_date ≥ customers.signup_date`.

**Validation panel** (always visible): one row per check with a pass/fail badge, for example "0 orphans · 0 mismatches · 0 duplicate keys". The validator is a standalone pure function that re-scans the output. It does not trust the generator.

**Export:**

- CSV per table and JSON per table (or all tables as one JSON object).
- A Postgres `.sql` dump: `BEGIN;`, then `CREATE TABLE` statements in dependency order with PK/FK/UNIQUE constraints, then batched `INSERT`s with correct escaping (quotes, backslashes, unicode, NULL), then `COMMIT;`. It must load cleanly into a fresh Postgres database.

**Preview:** a tab or segmented control per table (first 100 rows), plus a small schema diagram (cards with PK/FK markers and cardinality labels).

### 3.3 Document generation

**The safety rule applies to every document in every view and export.** Each one shows a prominent **"SYNTHETIC TEST DATA — NOT A REAL DOCUMENT"** label: a banner, repeated in the print footer, and included as a `_notice` field in JSON and a header comment in CSV. Only invented company and bank names are used, there are no logos (a generic monogram is used instead), and account numbers are obviously fake.

#### Invoices

- Invoice number, issue/due dates, seller and buyer (invented companies with fictional addresses), 1–N line items (description, qty, unit price, amount), subtotal, tax lines, total, payment terms.
- **Region tax templates:**

  | Region | Label | Rates | Date format | Currency |
  |---|---|---|---|---|
  | US | Sales Tax | per selected state (e.g. CA 7.25%, NY 4%, TX 6.25%, OR 0%) | MM/DD/YYYY | USD |
  | UK | VAT | 20% standard, 5% reduced, 0% zero-rated (per line) | DD/MM/YYYY | GBP |
  | PK | GST | 18% standard | DD-MM-YYYY | PKR |

- **Totals reconcile exactly:** `amount = qty × unit_price`, `subtotal = Σ amounts`, tax is computed per rate bucket with round-half-up to minor units, and `total = subtotal + Σ tax`.
- **Bulk generation:** N invoices (≤ 500) from one seed, exported as JSON (array), CSV (a header table plus a line-items table), and a printable multi-page view (one invoice per page).

#### Bank statements

- Invented bank name, account holder, fake account number, statement period, opening balance, and transactions (date, description, merchant category, debit, credit, running balance), closing balance.
- **Realistic merchants** from a curated invented pool by category (groceries, utilities, dining, transport, subscriptions, payroll, transfers, ATM). Includes recurring patterns: monthly payroll credit, rent/utilities on fixed days, and frequent small grocery and dining debits.
- **Running balance is always correct:** `balance[i] = balance[i-1] + credit[i] − debit[i]`, `closing = opening + Σ credits − Σ debits`, all in integer minor units.
- **Query-style generation.** A text box accepts phrases like *"last 90 days, balance over $500"* or *"60 days, at least 20 transactions, balance under 2000"*. A rule-based parser extracts the window (days), a min/max balance constraint and a transaction count. The generator then satisfies the constraints: it picks the opening balance so the minimum running balance stays above the floor, and caps debits so the maximum stays under the ceiling. The parsed constraints are shown as chips. Unparseable input gets a clear message plus example phrases.
- **Export:** JSON, CSV, and a printable statement view.

**Printable view:** a dedicated print stylesheet (`@media print`) with a clean A4/Letter layout, the sidebar and config hidden, page breaks between documents, and the safety label repeated on every page. The user presses **Print / Save as PDF**, which calls `window.print()`.

### 3.4 AI layer

The AI layer uses Google Gemini (free tier) behind a provider adapter, with a rule-based fallback that makes no network calls. The UI shows a small, friendly notice whenever the fallback was used, e.g. "AI is busy. Used built-in rules instead."

| Capability | Input | Output | Fallback behavior |
|---|---|---|---|
| **(a) Infer schema** | Pasted CSV or JSON sample (≤ 50 rows, ≤ 20 KB) | A column list with inferred type, options (ranges, category values, date bounds), a key flag and nullable flag | Heuristics: regexes for email/date/UUID/currency, numeric ranges, low-cardinality → category, unique ascending ints → id, `*_id` names → key |
| **(b) Synthesize text** | Kind (product description / memo / sentence), context (e.g. column name + category), count ≤ 30 | A **pool** of short texts that the engine samples from deterministically by seed | Template grammar (adjective + material + noun + benefit) |
| **(c) Propose edge cases** | Current column schema | A list of suggested edge cases per column (nulls, outliers, unicode, boundary values, long strings, leap-day dates, quotes/escaping), each with a toggle | A rule table keyed by column type |

**Edge-case catalog**, which can be applied at a configurable injection rate: empty string; very long string (255+ chars); unicode names (`Zoë Ångström`, `李雷`, `Ольга`, `محمد`); emoji; apostrophes and quotes (`O'Brien`, `"quoted"`); leading and trailing whitespace; boundary numbers (0, −0.01, max safe int); min/max dates, `2024-02-29` and `1970-01-01`; plus-addressed emails (`a+test@example.com`).

The AI output is never used per row. It seeds pools and configs, so the generation stays deterministic, fast and offline once those pools exist. The applied pools are saved in the config, so exports reproduce exactly.

### 3.5 Workspace UI

- **Left sidebar** (navy): the logo and name, the Tabular / Relational / Documents nav, and the pipeline stepper (Ingest → Model → Generate → Validate & export).
- **Center:** a live preview canvas (table / schema diagram / document) that updates as settings change, with row count and generation time shown.
- **Right config panel:** row count, seed, locale & currency, privacy rules, and the section-specific settings. One primary **Export** button at the bottom opens a format menu (CSV / JSON / SQL / Print). The AI actions sit in their own "AI assist" card.
- **Mobile (< 1024 px):** the panels stack in the order nav (top bar with tabs), config, preview, export. Nothing needs horizontal page scroll, and tables scroll inside their own container.
- No code is needed at any point. Every error has a clear inline message.

## 4. Non-functional

- **Hosting:** Vercel Hobby. All generation and export runs in the browser, and only `/api/ai/*` runs on the server.
- **Performance:** 10,000 tabular rows generated in under about 1.5 s on a laptop. Preview updates in under 300 ms for 100 rows.
- **Accessibility:** semantic landmarks (`nav`, `main`, `aside`), labelled inputs, keyboard-operable controls, visible focus, WCAG AA contrast, and `aria-live` for notices.
- **SEO/social:** title, meta description, Open Graph and Twitter tags, and favicon.
- **Tests (vitest):** seed determinism (tabular, relational and documents), FK integrity (0 orphans across seeds), invoice totals reconcile (all regions), running balance correctness and query-constraint satisfaction, CSV/SQL escaping, and schema-inference heuristics.

## 5. Demo script (maps to deck slides 5–10)

1. **Tabular.** Pick a preset, set seed 42, and show that the same output appears again. Change the seed. Add null 5% and outliers 2%. Set the email column to Mask and the balance column to Noise. Export CSV.
2. **AI.** Paste a 10-row CSV, click Infer schema to fill the config, click Suggest edge cases, and toggle unicode + boundaries on.
3. **Relational.** Use 200 customers, 1–5 orders each and 1–4 items. The validation panel shows 0 orphans and 0 mismatches. Download the SQL dump.
4. **Documents.** Generate a UK VAT invoice, switch to PK GST, and bulk-generate 25. Generate a bank statement with the query "last 90 days, balance over $500". Open the print view and Save as PDF. Point out the SYNTHETIC label.
