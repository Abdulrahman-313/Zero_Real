import { z } from "zod";
import { TEXT_KINDS } from "@/lib/engines/shared/text";
import { COLUMN_TYPES, EDGE_CASE_KINDS } from "@/lib/engines/tabular/schema";

/** Hard limits for AI inputs (enforced on client and server). */
export const MAX_SAMPLE_BYTES = 20 * 1024;
export const MAX_SAMPLE_ROWS = 50;
export const MAX_BODY_BYTES = 24 * 1024;

export const AI_TASKS = ["infer-schema", "synthesize-text", "edge-cases"] as const;
export type AiTask = (typeof AI_TASKS)[number];

export type AiProviderName = "gemini" | "fallback";

// ---- Requests ----

export const inferSchemaRequestSchema = z.object({
  sample: z
    .string()
    .min(1, "Paste a small CSV or JSON sample first.")
    .refine((s) => new TextEncoder().encode(s).length <= MAX_SAMPLE_BYTES, `Sample must be ${MAX_SAMPLE_BYTES / 1024} KB or smaller.`),
});
export type InferSchemaRequest = z.infer<typeof inferSchemaRequestSchema>;

export const synthesizeTextRequestSchema = z.object({
  kind: z.enum(TEXT_KINDS),
  /** Short description of what the text is for, e.g. the column name. */
  context: z.string().trim().min(1).max(200),
  count: z.number().int().min(1).max(30),
});
export type SynthesizeTextRequest = z.infer<typeof synthesizeTextRequestSchema>;

export const edgeCasesRequestSchema = z.object({
  columns: z
    .array(z.object({ name: z.string().trim().min(1).max(64), type: z.enum(COLUMN_TYPES) }))
    .min(1, "Add at least one column first.")
    .max(40),
});
export type EdgeCasesRequest = z.infer<typeof edgeCasesRequestSchema>;

// ---- Results ----

export const inferredColumnSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(COLUMN_TYPES),
  isKey: z.boolean(),
  nullable: z.boolean(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  decimals: z.number().int().min(0).max(6).nullable(),
  dateMin: z.string().nullable(),
  dateMax: z.string().nullable(),
  categories: z.array(z.string().max(80)).max(50),
  textKind: z.enum(TEXT_KINDS).nullable(),
  uuid: z.boolean(),
});
export type InferredColumn = z.infer<typeof inferredColumnSchema>;

export const inferSchemaResultSchema = z.object({
  columns: z.array(inferredColumnSchema).min(1).max(40),
  rowsAnalyzed: z.number().int().min(0),
});
export type InferSchemaResult = z.infer<typeof inferSchemaResultSchema>;

export const synthesizeTextResultSchema = z.object({ texts: z.array(z.string().min(1).max(300)).min(1).max(30) });
export type SynthesizeTextResult = z.infer<typeof synthesizeTextResultSchema>;

export const edgeCaseSuggestionSchema = z.object({
  column: z.string(),
  kind: z.enum(EDGE_CASE_KINDS),
  reason: z.string().max(200),
});
export type EdgeCaseSuggestion = z.infer<typeof edgeCaseSuggestionSchema>;

export const edgeCasesResultSchema = z.object({ suggestions: z.array(edgeCaseSuggestionSchema).max(60) });
export type EdgeCasesResult = z.infer<typeof edgeCasesResultSchema>;

export interface AiTaskMap {
  "infer-schema": { request: InferSchemaRequest; result: InferSchemaResult };
  "synthesize-text": { request: SynthesizeTextRequest; result: SynthesizeTextResult };
  "edge-cases": { request: EdgeCasesRequest; result: EdgeCasesResult };
}

export const REQUEST_SCHEMAS = {
  "infer-schema": inferSchemaRequestSchema,
  "synthesize-text": synthesizeTextRequestSchema,
  "edge-cases": edgeCasesRequestSchema,
} as const;

export interface AiResponse<T> {
  provider: AiProviderName;
  /** Friendly message when the fallback was used (or anything else worth telling the user). */
  notice?: string;
  data: T;
}

export interface AiProvider {
  name: AiProviderName;
  inferSchema(req: InferSchemaRequest): Promise<InferSchemaResult>;
  synthesizeText(req: SynthesizeTextRequest): Promise<SynthesizeTextResult>;
  proposeEdgeCases(req: EdgeCasesRequest): Promise<EdgeCasesResult>;
}
