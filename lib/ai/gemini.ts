import "server-only";
import { GoogleGenAI } from "@google/genai";
import { COLUMN_TYPES, EDGE_CASE_KINDS } from "@/lib/engines/tabular/schema";
import { EDGE_CASES } from "@/lib/engines/tabular/edgeCases";
import { TEXT_KINDS } from "@/lib/engines/shared/text";
import { inferSchemaHeuristic, proposeEdgeCasesHeuristic } from "./fallback";
import { parseSample, sampleToPromptCsv } from "./sample";
import {
  edgeCasesResultSchema,
  synthesizeTextResultSchema,
  type AiProvider,
  type EdgeCasesRequest,
  type EdgeCasesResult,
  type InferSchemaRequest,
  type InferSchemaResult,
  type InferredColumn,
  type SynthesizeTextRequest,
  type SynthesizeTextResult,
} from "./schemas";
import { z } from "zod";

export const AI_TIMEOUT_MS = 8000;

export class AiTimeoutError extends Error {
  constructor() {
    super("The AI provider did not answer in time.");
    this.name = "AiTimeoutError";
  }
}

async function generateJson(client: GoogleGenAI, model: string, prompt: string, schema: object, maxOutputTokens: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await Promise.race([
      client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0.4,
          maxOutputTokens,
          abortSignal: controller.signal,
        },
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new AiTimeoutError()), { once: true });
      }),
    ]);
    const text = response.text;
    if (!text) throw new Error("The AI provider returned an empty response.");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// ---- JSON schemas sent to Gemini (kept deliberately small) ----

const INFER_JSON_SCHEMA = {
  type: "object",
  properties: {
    columns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: [...COLUMN_TYPES] },
          isKey: { type: "boolean" },
          textKind: { type: "string", enum: [...TEXT_KINDS, "none"] },
        },
        required: ["name", "type", "isKey", "textKind"],
      },
    },
  },
  required: ["columns"],
};

const aiInferSchema = z.object({
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.enum(COLUMN_TYPES),
      isKey: z.boolean(),
      textKind: z.enum([...TEXT_KINDS, "none"]).optional(),
    }),
  ),
});

const TEXT_JSON_SCHEMA = {
  type: "object",
  properties: { texts: { type: "array", items: { type: "string" } } },
  required: ["texts"],
};

const EDGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          column: { type: "string" },
          kind: { type: "string", enum: [...EDGE_CASE_KINDS] },
          reason: { type: "string" },
        },
        required: ["column", "kind", "reason"],
      },
    },
  },
  required: ["suggestions"],
};

/**
 * AI decides semantics (types, keys, text kind); numeric/date ranges and category
 * values are always measured from the sample itself so they stay grounded.
 */
function mergeInference(ai: z.infer<typeof aiInferSchema>, measured: InferSchemaResult): InferSchemaResult {
  const byName = new Map(ai.columns.map((c) => [c.name.trim().toLowerCase(), c]));
  const columns: InferredColumn[] = measured.columns.map((m) => {
    const a = byName.get(m.name.trim().toLowerCase());
    if (!a) return m;
    const type = a.type;
    const numericMeasured = m.min !== null && m.max !== null;
    const textKind = a.textKind && a.textKind !== "none" ? a.textKind : m.textKind;
    // Only trust a numeric/date type if the data actually parses that way.
    if ((type === "number" || type === "currency") && !numericMeasured) return { ...m, isKey: a.isKey || m.isKey };
    if (type === "date" && m.dateMin === null) return { ...m, isKey: a.isKey || m.isKey };
    return {
      ...m,
      type,
      isKey: a.isKey,
      textKind: type === "text" ? (textKind ?? "sentence") : null,
      decimals: type === "currency" ? 2 : m.decimals,
      categories: type === "category" ? m.categories : [],
    };
  });
  return { columns, rowsAnalyzed: measured.rowsAnalyzed };
}

function cleanTexts(texts: string[], count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const t = raw.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "");
    if (t.length < 3 || t.length > 300) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

const TEXT_KIND_PROMPTS = {
  product: "short, realistic e-commerce product descriptions (one sentence each)",
  memo: "short bank-transfer or invoice payment memos (3–8 words each)",
  sentence: "short, realistic customer-service or CRM notes (one sentence each)",
} as const;

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",

    async inferSchema(req: InferSchemaRequest): Promise<InferSchemaResult> {
      const measured = inferSchemaHeuristic(req);
      const sample = parseSample(req.sample);
      const prompt = [
        "You are a data engineer. Infer the semantic type of each column in this CSV sample.",
        `Allowed types: ${COLUMN_TYPES.join(", ")}.`,
        "Use 'id' for identifiers/keys, 'currency' for money amounts, 'category' for small fixed sets of labels,",
        "'text' for free-form text (set textKind to product, memo or sentence), otherwise textKind 'none'.",
        "Set isKey true only for primary or foreign key columns. Return every column exactly once, keeping names unchanged.",
        "",
        sampleToPromptCsv(sample, 15, 50),
      ].join("\n");
      const raw = await generateJson(client, model, prompt, INFER_JSON_SCHEMA, 1024);
      return mergeInference(aiInferSchema.parse(raw), measured);
    },

    async synthesizeText(req: SynthesizeTextRequest): Promise<SynthesizeTextResult> {
      const prompt = [
        `Write ${req.count} distinct ${TEXT_KIND_PROMPTS[req.kind]} for synthetic test data.`,
        `Context: ${req.context}.`,
        "Rules: invent all brand, company and person names; never mention real companies, brands or people;",
        "no personal data; plain text only; vary wording and length (under 140 characters each).",
      ].join("\n");
      const raw = await generateJson(client, model, prompt, TEXT_JSON_SCHEMA, 1500);
      const parsed = synthesizeTextResultSchema.parse({ texts: cleanTexts(z.object({ texts: z.array(z.string()) }).parse(raw).texts, req.count) });
      return parsed;
    },

    async proposeEdgeCases(req: EdgeCasesRequest): Promise<EdgeCasesResult> {
      const catalog = EDGE_CASE_KINDS.map((k) => `${k} (${EDGE_CASES[k].types.join("/")}): ${EDGE_CASES[k].description}`).join("\n");
      const prompt = [
        "You are a QA engineer. Suggest edge cases that would catch bugs for these columns.",
        "Only use kinds from this catalog, and only for columns whose type is listed next to the kind:",
        catalog,
        "",
        "Columns:",
        ...req.columns.map((c) => `- ${c.name} (${c.type})`),
        "",
        "Give a one-sentence reason per suggestion that mentions the column.",
      ].join("\n");
      const raw = await generateJson(client, model, prompt, EDGE_JSON_SCHEMA, 1500);
      const parsed = edgeCasesResultSchema.parse(raw);
      const types = new Map(req.columns.map((c) => [c.name, c.type]));
      const valid = parsed.suggestions.filter((s) => {
        const type = types.get(s.column);
        return type !== undefined && EDGE_CASES[s.kind].types.includes(type);
      });
      // If the model returned nothing usable, fall back to the rule table for completeness.
      return valid.length > 0 ? { suggestions: valid } : proposeEdgeCasesHeuristic(req);
    },
  };
}
