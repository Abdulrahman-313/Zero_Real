import { z } from "zod";
import { isValidIsoDate } from "../shared/dates";
import { TEXT_KINDS } from "../shared/text";

export const COLUMN_TYPES = ["id", "name", "email", "date", "currency", "category", "number", "boolean", "text"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const PRIVACY_RULES = ["none", "mask", "hash", "noise"] as const;
export type PrivacyRule = (typeof PRIVACY_RULES)[number];

export const DISTRIBUTIONS = ["uniform", "normal", "lognormal"] as const;
export type Distribution = (typeof DISTRIBUTIONS)[number];

export const EDGE_CASE_KINDS = [
  "empty_string",
  "long_string",
  "unicode",
  "emoji",
  "quotes",
  "whitespace",
  "boundary_numbers",
  "boundary_dates",
  "plus_email",
] as const;
export type EdgeCaseKind = (typeof EDGE_CASE_KINDS)[number];

/** Which privacy rules make sense for each column type. */
export const PRIVACY_BY_TYPE: Record<ColumnType, readonly PrivacyRule[]> = {
  id: ["none", "mask", "hash"],
  name: ["none", "mask", "hash"],
  email: ["none", "mask", "hash"],
  date: ["none", "mask", "hash", "noise"],
  currency: ["none", "hash", "noise"],
  category: ["none", "mask", "hash"],
  number: ["none", "hash", "noise"],
  boolean: ["none", "hash"],
  text: ["none", "mask", "hash"],
};

export const MAX_ROWS = 10_000;
export const MAX_COLUMNS = 40;

const isoDate = z.string().refine(isValidIsoDate, "Use a valid date (YYYY-MM-DD)");

const base = {
  id: z.string().min(1),
  name: z.string().max(64),
  nullable: z.boolean(),
  privacy: z.enum(PRIVACY_RULES),
  /** Privacy budget for Laplace noise; smaller ε means more noise. */
  noiseEpsilon: z.number().min(0.05).max(10),
};

export const columnSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("id"),
    mode: z.enum(["sequence", "uuid"]),
    start: z.number().int().min(0).max(1_000_000_000),
    step: z.number().int().min(1).max(1000),
  }),
  z.object({ ...base, type: z.literal("name"), format: z.enum(["full", "first", "last"]) }),
  z.object({ ...base, type: z.literal("email") }),
  z.object({ ...base, type: z.literal("date"), min: isoDate, max: isoDate, format: z.enum(["iso", "locale"]) }),
  z.object({
    ...base,
    type: z.literal("currency"),
    min: z.number().min(-1e9).max(1e9),
    max: z.number().min(-1e9).max(1e9),
    distribution: z.enum(DISTRIBUTIONS),
  }),
  z.object({
    ...base,
    type: z.literal("category"),
    values: z.array(z.object({ value: z.string().max(80), weight: z.number().min(0).max(1000) })).max(50),
  }),
  z.object({
    ...base,
    type: z.literal("number"),
    min: z.number().min(-1e12).max(1e12),
    max: z.number().min(-1e12).max(1e12),
    decimals: z.number().int().min(0).max(6),
    distribution: z.enum(DISTRIBUTIONS),
  }),
  z.object({ ...base, type: z.literal("boolean"), trueProbability: z.number().min(0).max(1) }),
  z.object({ ...base, type: z.literal("text"), kind: z.enum(TEXT_KINDS) }),
]);

export type Column = z.infer<typeof columnSchema>;
export type ColumnOf<T extends ColumnType> = Extract<Column, { type: T }>;

export const tabularConfigSchema = z.object({
  columns: z.array(columnSchema).max(MAX_COLUMNS),
  rowCount: z.number().int().min(1).max(MAX_ROWS),
  /** Percent of nullable, non-id cells set to null (0–50). */
  nullRate: z.number().min(0).max(50),
  /** Percent of number/currency cells turned into outliers (0–20). */
  outlierRate: z.number().min(0).max(20),
  edgeCases: z.object({
    kinds: z.array(z.enum(EDGE_CASE_KINDS)),
    /** Percent of eligible cells replaced by an edge case (0–25). */
    rate: z.number().min(0).max(25),
  }),
  /** Free-text pools per column name (from the AI layer); sampled deterministically. */
  textPools: z.record(z.string(), z.array(z.string().max(500)).max(50)),
});

export type TabularConfig = z.infer<typeof tabularConfigSchema>;

export type CellValue = string | number | boolean | null;
