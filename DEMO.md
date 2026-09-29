# Live demo script (about 5 minutes)

This follows the deck: problem → approach → tabular → relational → documents → AI → why it wins.

## Before you present

- [ ] Open the deployed URL in a fresh window at 100% zoom. Close other tabs.
- [ ] Check the AI status line in **Tabular → AI assist**. It reads either "Powered by gemini-…" or "No AI key configured". Both are fine: the fallback is part of the story.
- [ ] Reload once so every setting is at its default (seed 42, en-US / USD).
- [ ] Have Postgres available (`psql`), or just be ready to show the `.sql` file, for the SQL dump step.
- [ ] Printer destination set to **Save as PDF**.

## 1. Tabular (about 75 s) · deck slide 5

1. The **Customers** preset is loaded. Point out the columns: ID, Name, Email, Signup, Balance. They match the slide.
2. **Seed determinism:** change the seed from 42 to 7, then back to 42. The rows are identical again. Say: *"Same seed, same data — reproducible test fixtures."*
3. Set **Null rate** to 5% and **Outlier rate** to 2%. Outliers are highlighted in amber and nulls show in grey italics. The column profile updates live.
4. Expand **email**, set Privacy to **Mask**. Expand **balance**, set **Numeric noise (Laplace)**. The chips in the table header show the rules.
5. Switch Locale to **Deutsch (DE)** or **English (PK)**. Names and currency change with the locale.
6. **Export → CSV.** Mention: *"10,000 rows are generated in the browser, with no server involved."*

## 2. AI layer (about 60 s) · deck slide 9

1. In **AI assist**, click **Use example sample**, then **Infer schema**. The columns are replaced by the inferred ones: key, name, email, date, category, currency, boolean, text.
2. Point at the badge (**Gemini** or **Built-in rules**). If the fallback toast appears, say: *"If the free AI tier is rate-limited, we fall back automatically — the demo never hangs."*
3. Under **Realistic free text**, click **Generate** for `notes`. The preview uses the new text pool.
4. Click **Suggest edge cases**, then turn on **Unicode names** and **Quotes & apostrophes**. Cells like `Zoë Ångström` and `O'Brien` appear, highlighted in mint.

## 3. Relational (about 60 s) · deck slide 6

1. Open **Relational**. Point to the header: 7 tables, about 2,700 rows, generated and validated in milliseconds.
2. The **Validation** panel reads **0 orphans · 0 mismatches · 0 duplicate keys**.
3. Click **Run tamper test**. It shows *"Validator caught 3 of 3 injected problems"*. Say: *"The validator isn't decorative — it independently re-checks every key and total."*
4. Change **Orders per customer** to 2–8. The panel stays green, and the schema cards show 1:1, 1:N and N:N labels.
5. **Export → Postgres SQL dump.** Optionally run `psql -f synthetic-relational-seed-42.sql` to show it loads, with all constraints.

## 4. Documents (about 75 s) · deck slides 7–8

1. Open **Documents → Invoices**. The US invoice has California sales tax at 7.25%. Point out the **SYNTHETIC TEST DATA** banner and watermark, the invented companies, and the `TEST-` tax IDs.
2. Switch Region to **United Kingdom — VAT**. Dates change to DD/MM/YYYY, currency to £, and VAT is broken down per rate (20% / 0%).
3. Switch to **Pakistan — GST** (18%, PKR). Set **Invoices to generate** to 25. The list shows a grand total; page through a few.
4. Open **Bank statement**. The query is *"last 90 days, balance over $500"*. Point at **Lowest balance** (always ≥ 500) and the running balance column.
5. Click an example chip such as *"60 days, at least 40 transactions, balance under 2000"*. The constraint chips update and the statement regenerates.
6. Click **Print / PDF**, then save as PDF. The output is clean, one document per page, with the label on every page.

## 5. Close (about 30 s) · deck slide 11

*"One workspace, three data types. Every rule is enforced by construction and re-checked by tests. It runs free on Vercel, and the AI makes it smarter without making it fragile."*

## If something goes wrong

| Symptom | What to say or do |
|---|---|
| AI toast says built-in rules were used | This is the designed behaviour. Continue; results still apply. |
| Browser blocks the download | Allow downloads for the site, or use JSON export and show it in a new tab. |
| Slow laptop with 10,000 rows | Export still works. The preview uses a 2,000-row sample for live stats. |
| Projector is narrow | The layout stacks below 1024 px: nav, then config, then preview, then export. |
