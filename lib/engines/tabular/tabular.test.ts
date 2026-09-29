import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";
import type { GlobalSettings } from "../shared/locales";
import { makeColumn } from "./columns";
import { FLAG_EDGE, FLAG_NULL, FLAG_OUTLIER, generateTabular } from "./generate";
import { DEFAULT_TABULAR_CONFIG, TABULAR_PRESETS } from "./presets";
import { profileTabular } from "./profile";
import type { TabularConfig } from "./schema";
import { validateTabularConfig } from "./validate";

const settings: GlobalSettings = { seed: 42, locale: "en-US", currency: "USD" };

function config(patch: Partial<TabularConfig> = {}): TabularConfig {
  return { ...DEFAULT_TABULAR_CONFIG, ...patch };
}

describe("tabular seed determinism", () => {
  it("produces identical output for the same seed and config", () => {
    for (const preset of TABULAR_PRESETS) {
      const cfg = config({ columns: preset.columns, rowCount: 300, nullRate: 5, outlierRate: 3 });
      expect(generateTabular(cfg, settings)).toEqual(generateTabular(cfg, settings));
    }
  });

  it("produces different output for a different seed", () => {
    const a = generateTabular(config({ rowCount: 50 }), settings);
    const b = generateTabular(config({ rowCount: 50 }), { ...settings, seed: 43 });
    expect(a.rows).not.toEqual(b.rows);
  });

  it("preview (limit) is an exact prefix of the full dataset", () => {
    const cfg = config({ rowCount: 500, nullRate: 10 });
    const full = generateTabular(cfg, settings);
    const preview = generateTabular(cfg, settings, 100);
    expect(preview.rows).toEqual(full.rows.slice(0, 100));
  });

  it("keeps other columns stable when a column is added", () => {
    const base = config({ rowCount: 20 });
    const extended = config({ rowCount: 20, columns: [...base.columns, makeColumn("number", "score", "x")] });
    const a = generateTabular(base, settings);
    const b = generateTabular(extended, settings);
    expect(b.rows.map((r) => r.slice(0, base.columns.length))).toEqual(a.rows);
  });

  it("is deterministic across all locales", () => {
    for (const locale of ["en-GB", "de-DE", "en-PK"] as const) {
      const s = { ...settings, locale };
      expect(generateTabular(config({ rowCount: 30 }), s).rows).toEqual(generateTabular(config({ rowCount: 30 }), s).rows);
    }
  });
});

describe("tabular generation", () => {
  it("respects row count and column order", () => {
    const res = generateTabular(config({ rowCount: 123 }), settings);
    expect(res.rows).toHaveLength(123);
    expect(res.headers).toEqual(DEFAULT_TABULAR_CONFIG.columns.map((c) => c.name));
  });

  it("uses reserved email domains derived from the row's name", () => {
    const res = generateTabular(config({ rowCount: 200 }), settings);
    const emailIdx = res.headers.indexOf("email");
    for (const row of res.rows) expect(String(row[emailIdx])).toMatch(/@example\.(com|org|net)$/);
  });

  it("keeps numbers and dates inside their ranges (no outliers configured)", () => {
    const res = generateTabular(config({ rowCount: 1000 }), settings);
    const [profile] = profileTabular(res).filter((p) => p.name === "balance");
    expect(profile.min as number).toBeGreaterThanOrEqual(10);
    expect(profile.max as number).toBeLessThanOrEqual(2500);
    const signup = profileTabular(res).find((p) => p.name === "signup")!;
    expect(signup.min! >= "2024-06-01").toBe(true);
    expect(signup.max! <= "2025-06-30").toBe(true);
  });

  it("applies null rate approximately and never nulls id columns", () => {
    const res = generateTabular(config({ rowCount: 5000, nullRate: 20 }), settings);
    const nullable = DEFAULT_TABULAR_CONFIG.columns.filter((c) => c.nullable && c.type !== "id").length;
    const ratio = res.counts.nulls / (5000 * nullable);
    expect(ratio).toBeGreaterThan(0.17);
    expect(ratio).toBeLessThan(0.23);
    const idIdx = res.headers.indexOf("id");
    expect(res.rows.every((r) => r[idIdx] !== null)).toBe(true);
  });

  it("null rate is monotonic: raising it only adds nulls", () => {
    const low = generateTabular(config({ rowCount: 400, nullRate: 5 }), settings);
    const high = generateTabular(config({ rowCount: 400, nullRate: 15 }), settings);
    for (let k = 0; k < low.flags.length; k++) {
      if (low.flags[k] & FLAG_NULL) expect(high.flags[k] & FLAG_NULL).toBeTruthy();
    }
  });

  it("flags outliers and edge cases", () => {
    const res = generateTabular(
      config({ rowCount: 1000, outlierRate: 10, edgeCases: { kinds: ["unicode", "boundary_numbers", "plus_email"], rate: 10 } }),
      settings,
    );
    expect(res.counts.outliers).toBeGreaterThan(0);
    expect(res.counts.edgeCases).toBeGreaterThan(0);
    expect(Array.from(res.flags).some((f) => f & FLAG_OUTLIER)).toBe(true);
    expect(Array.from(res.flags).some((f) => f & FLAG_EDGE)).toBe(true);
  });

  it("uses AI text pools when provided", () => {
    const pool = ["Alpha product", "Beta product"];
    const cfg = config({
      rowCount: 50,
      columns: [makeColumn("text", "desc", "d")],
      textPools: { desc: pool },
    });
    const res = generateTabular(cfg, settings);
    expect(res.rows.every((r) => pool.includes(r[0] as string))).toBe(true);
  });

  it("generates 10,000 rows quickly", () => {
    const start = performance.now();
    const res = generateTabular(config({ rowCount: 10_000, nullRate: 5 }), settings);
    expect(res.rows).toHaveLength(10_000);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});

describe("tabular privacy", () => {
  const privacyCfg = (privacy: "mask" | "hash" | "noise") =>
    config({
      rowCount: 100,
      columns: [
        { ...makeColumn("email", "email", "e"), privacy: privacy === "noise" ? "none" : privacy },
        { ...makeColumn("currency", "amount", "a"), privacy: privacy === "noise" ? "noise" : "none" },
      ],
    });

  it("masks emails but keeps the domain", () => {
    const res = generateTabular(privacyCfg("mask"), settings);
    for (const row of res.rows) expect(row[0]).toMatch(/^.\*{5}@example\.(com|org|net)$/);
  });

  it("hashes with SHA-256 deterministically", () => {
    const a = generateTabular(privacyCfg("hash"), settings);
    const b = generateTabular(privacyCfg("hash"), settings);
    for (const row of a.rows) expect(row[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(a.rows).toEqual(b.rows);
  });

  it("adds noise to numeric values", () => {
    const plain = generateTabular({ ...privacyCfg("noise"), columns: [privacyCfg("noise").columns[0], makeColumn("currency", "amount", "a")] }, settings);
    const noisy = generateTabular(privacyCfg("noise"), settings);
    const changed = plain.rows.filter((r, i) => r[1] !== noisy.rows[i][1]).length;
    expect(changed).toBeGreaterThan(50);
  });
});

describe("tabular config validation", () => {
  it("accepts the default config", () => {
    expect(validateTabularConfig(DEFAULT_TABULAR_CONFIG)).toEqual([]);
  });

  it("reports empty schemas, duplicates and bad ranges", () => {
    expect(validateTabularConfig(config({ columns: [] }))[0].message).toMatch(/at least one column/);
    const dup = config({ columns: [makeColumn("name", "a", "1"), makeColumn("email", "A", "2")] });
    expect(validateTabularConfig(dup).some((i) => /Duplicate/.test(i.message))).toBe(true);
    const range = config({ columns: [{ ...makeColumn("number", "n", "1"), min: 10, max: 1 } as never] });
    expect(validateTabularConfig(range).some((i) => /minimum/.test(i.message))).toBe(true);
  });
});

describe("csv export", () => {
  it("escapes quotes, commas, newlines and formula prefixes", () => {
    const csv = toCsv(["a", "b"], [["O'Brien, \"Jr\"", "line\nbreak"], ["=SUM(A1)", null]]);
    expect(csv).toBe('a,b\r\n"O\'Brien, ""Jr""","line\nbreak"\r\n\'=SUM(A1),\r\n');
  });
});
