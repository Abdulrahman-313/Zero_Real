import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTabular } from "@/lib/engines/tabular/generate";
import { EDGE_CASES } from "@/lib/engines/tabular/edgeCases";
import { DEFAULT_TABULAR_CONFIG } from "@/lib/engines/tabular/presets";
import { validateTabularConfig } from "@/lib/engines/tabular/validate";
import { LruCache } from "./cache";
import { inferSchemaHeuristic, proposeEdgeCasesHeuristic, synthesizeTextHeuristic } from "./fallback";
import { RateLimiter, clientKey } from "./rateLimit";
import { createAiHandler } from "./route";
import { parseSample } from "./sample";
import { runAiTask } from "./service";
import { EXAMPLE_SAMPLE, inferredToColumns } from "./toColumns";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sample parsing", () => {
  it("parses CSV with quotes, embedded commas and semicolon delimiters", () => {
    const csv = parseSample('a,b\n1,"x, ""y"""\n2,');
    expect(csv.headers).toEqual(["a", "b"]);
    expect(csv.rows).toEqual([["1", 'x, "y"'], ["2", null]]);
    expect(parseSample("a;b\n1;2").rows).toEqual([["1", "2"]]);
  });

  it("parses JSON arrays of objects and caps rows at 50", () => {
    const json = JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ id: i, name: `n${i}` })));
    const parsed = parseSample(json);
    expect(parsed.format).toBe("json");
    expect(parsed.rows).toHaveLength(50);
  });

  it("gives clear errors for empty or malformed input", () => {
    expect(() => parseSample("   ")).toThrow(/Paste/);
    expect(() => parseSample("[{broken")).toThrow(/JSON/);
    expect(() => parseSample("only,a,header")).toThrow(/header row/);
    expect(() => parseSample("[1,2,3]")).toThrow(/array of objects/);
  });
});

describe("rule-based inference", () => {
  it("infers types and keys from the example sample", () => {
    const { columns } = inferSchemaHeuristic({ sample: EXAMPLE_SAMPLE });
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]));
    expect(byName.customer_id).toMatchObject({ type: "id", isKey: true });
    expect(byName.full_name.type).toBe("name");
    expect(byName.email.type).toBe("email");
    expect(byName.signup_date).toMatchObject({ type: "date", dateMin: "2025-01-27", dateMax: "2025-06-13" });
    expect(byName.plan.type).toBe("category");
    expect(byName.plan.categories.sort()).toEqual(["Basic", "Pro", "Team"]);
    expect(byName.monthly_spend).toMatchObject({ type: "currency", min: 76.2, max: 1530.75 });
    expect(byName.is_active.type).toBe("boolean");
    expect(byName.notes).toMatchObject({ type: "text", textKind: "memo", nullable: true });
  });

  it("converts inferred columns into a valid, generatable tabular config", () => {
    const { columns } = inferSchemaHeuristic({ sample: EXAMPLE_SAMPLE });
    const config = { ...DEFAULT_TABULAR_CONFIG, columns: inferredToColumns(columns, "t"), rowCount: 50 };
    expect(validateTabularConfig(config)).toEqual([]);
    expect(generateTabular(config, { seed: 1, locale: "en-US", currency: "USD" }).rows).toHaveLength(50);
  });

  it("sanitises odd AI output (inverted ranges, empty categories, duplicate names)", () => {
    const cols = inferredToColumns(
      [
        { name: "x", type: "number", isKey: false, nullable: false, min: 10, max: 1, decimals: 0, dateMin: null, dateMax: null, categories: [], textKind: null, uuid: false },
        { name: "x", type: "category", isKey: false, nullable: false, min: null, max: null, decimals: null, dateMin: null, dateMax: null, categories: [], textKind: null, uuid: false },
        { name: "d", type: "date", isKey: false, nullable: true, min: null, max: null, decimals: null, dateMin: "not a date", dateMax: null, categories: [], textKind: null, uuid: false },
      ],
      "s",
    );
    expect(validateTabularConfig({ ...DEFAULT_TABULAR_CONFIG, columns: cols })).toEqual([]);
    expect(cols[1].name).toBe("x_2");
    expect(cols[1].type).toBe("text");
  });

  it("proposes only applicable edge cases and deterministic text pools", () => {
    const res = proposeEdgeCasesHeuristic({ columns: [{ name: "amount", type: "currency" }, { name: "email", type: "email" }] });
    for (const s of res.suggestions) {
      const type = s.column === "amount" ? "currency" : "email";
      expect(EDGE_CASES[s.kind].types).toContain(type);
    }
    const a = synthesizeTextHeuristic({ kind: "product", context: "description", count: 12 });
    expect(a.texts).toHaveLength(12);
    expect(synthesizeTextHeuristic({ kind: "product", context: "description", count: 12 })).toEqual(a);
  });
});

describe("cache and rate limiting", () => {
  it("evicts least-recently-used entries and expires by TTL", () => {
    const cache = new LruCache<number>(2, 1000);
    cache.set("a", 1, 0);
    cache.set("b", 2, 0);
    cache.get("a", 1);
    cache.set("c", 3, 2);
    expect(cache.get("b", 3)).toBeUndefined();
    expect(cache.get("a", 3)).toBe(1);
    expect(cache.get("a", 5000)).toBeUndefined();
  });

  it("limits bursts and refills over time", () => {
    const limiter = new RateLimiter(3, 6);
    expect([limiter.take("ip", 0), limiter.take("ip", 0), limiter.take("ip", 0)]).toEqual([0, 0, 0]);
    expect(limiter.take("ip", 0)).toBeGreaterThan(0);
    expect(limiter.take("other", 0)).toBe(0);
    expect(limiter.take("ip", 10_000)).toBe(0);
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
});

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/ai/test", { method: "POST", body: text, headers: { "content-type": "application/json", ...headers } });
}

describe("AI route handler", () => {
  it("falls back to rules with a notice when no key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await createAiHandler("infer-schema")(post({ sample: EXAMPLE_SAMPLE }, { "x-forwarded-for": "10.0.0.1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("fallback");
    expect(body.notice).toMatch(/No AI key/);
    expect(body.data.columns.length).toBe(8);
  });

  it("validates input and enforces size limits", async () => {
    const handler = createAiHandler("synthesize-text");
    expect((await handler(post("{nope", { "x-forwarded-for": "10.0.0.2" }))).status).toBe(400);
    expect((await handler(post({ kind: "product", context: "", count: 5 }, { "x-forwarded-for": "10.0.0.2" }))).status).toBe(400);
    expect((await handler(post({ kind: "product", context: "x", count: 500 }, { "x-forwarded-for": "10.0.0.2" }))).status).toBe(400);
    const big = { sample: "a,b\n" + "1,2\n".repeat(8000) };
    expect((await createAiHandler("infer-schema")(post(big, { "x-forwarded-for": "10.0.0.2" }))).status).toBe(413);
    const unparseable = await createAiHandler("infer-schema")(post({ sample: "just one line" }, { "x-forwarded-for": "10.0.0.2" }));
    expect(unparseable.status).toBe(422);
  });

  it("rate-limits a noisy client with 429 and Retry-After", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const handler = createAiHandler("edge-cases");
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await handler(post({ columns: [{ name: `c${i}`, type: "text" }] }, { "x-forwarded-for": "10.9.9.9" }));
      statuses.push(res.status);
      if (res.status === 429) expect(res.headers.get("Retry-After")).toBeTruthy();
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(8);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });
});

describe("Gemini provider fallback", () => {
  function geminiResponse(obj: unknown) {
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  it("uses Gemini output when the call succeeds, grounded by measured ranges", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-success");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        geminiResponse({
          columns: [
            { name: "sku", type: "id", isKey: true, textKind: "none" },
            { name: "price", type: "currency", isKey: false, textKind: "none" },
            { name: "blurb", type: "text", isKey: false, textKind: "product" },
          ],
        }),
      ),
    );
    const res = await runAiTask("infer-schema", { sample: "sku,price,blurb\nA1,10.50,Nice mug\nB2,99.00,Big lamp" });
    expect(res.provider).toBe("gemini");
    const byName = Object.fromEntries(res.data.columns.map((c) => [c.name, c]));
    expect(byName.sku).toMatchObject({ type: "id", isKey: true });
    expect(byName.price).toMatchObject({ type: "currency", min: 10.5, max: 99 });
    expect(byName.blurb).toMatchObject({ type: "text", textKind: "product" });
  });

  it("falls back with a friendly notice on 429 and on invalid JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-429");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }), { status: 429, headers: { "content-type": "application/json" } })),
    );
    const limited = await runAiTask("synthesize-text", { kind: "memo", context: "payments 429", count: 5 });
    expect(limited.provider).toBe("fallback");
    expect(limited.notice).toMatch(/quota/i);
    expect(limited.data.texts).toHaveLength(5);

    vi.stubEnv("GEMINI_API_KEY", "test-key-garbage");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), { status: 200 })));
    const garbage = await runAiTask("edge-cases", { columns: [{ name: "garbage_col", type: "date" }] });
    expect(garbage.provider).toBe("fallback");
    expect(garbage.data.suggestions.every((s) => s.kind === "boundary_dates")).toBe(true);
  }, 20_000);

  it("never hangs: a stalled provider falls back after the 8 s timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.stubEnv("GEMINI_API_KEY", "test-key-stall");
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
      const pending = runAiTask("synthesize-text", { kind: "sentence", context: "stalled call", count: 3 });
      await vi.advanceTimersByTimeAsync(8_100);
      const res = await pending;
      expect(res.provider).toBe("fallback");
      expect(res.notice).toMatch(/too long/);
    } finally {
      vi.useRealTimers();
    }
  });
});
