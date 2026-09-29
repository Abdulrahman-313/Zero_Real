import type { Rng } from "../shared/rng";
import type { ColumnType, EdgeCaseKind } from "./schema";

export interface EdgeCaseInfo {
  kind: EdgeCaseKind;
  label: string;
  description: string;
  types: readonly ColumnType[];
}

const STRING_TYPES: readonly ColumnType[] = ["name", "text", "category"];

export const EDGE_CASES: Record<EdgeCaseKind, EdgeCaseInfo> = {
  empty_string: {
    kind: "empty_string",
    label: "Empty strings",
    description: "Blank values that are not null.",
    types: [...STRING_TYPES, "email"],
  },
  long_string: {
    kind: "long_string",
    label: "Very long strings",
    description: "Values longer than 255 characters.",
    types: STRING_TYPES,
  },
  unicode: {
    kind: "unicode",
    label: "Unicode names",
    description: "Accents and non-Latin scripts: Zoë, 李雷, Ольга, محمد.",
    types: STRING_TYPES,
  },
  emoji: {
    kind: "emoji",
    label: "Emoji",
    description: "Multi-byte emoji inside text.",
    types: ["text", "category"],
  },
  quotes: {
    kind: "quotes",
    label: "Quotes & apostrophes",
    description: "Values like O'Brien and \"quoted\" that break naive escaping.",
    types: STRING_TYPES,
  },
  whitespace: {
    kind: "whitespace",
    label: "Stray whitespace",
    description: "Leading and trailing spaces.",
    types: STRING_TYPES,
  },
  boundary_numbers: {
    kind: "boundary_numbers",
    label: "Boundary numbers",
    description: "0, −0.01 and very large values.",
    types: ["number", "currency"],
  },
  boundary_dates: {
    kind: "boundary_dates",
    label: "Boundary dates",
    description: "Leap day 2024-02-29, 1970-01-01, 2038-01-19, 9999-12-31.",
    types: ["date"],
  },
  plus_email: {
    kind: "plus_email",
    label: "Plus-addressed emails",
    description: "Addresses like a+test@example.com.",
    types: ["email"],
  },
};

const UNICODE_NAMES = ["Zoë Ångström", "李雷", "Ольга Смирнова", "محمد علي", "José Núñez", "Øyvind Ærø", "Łucja Żak", "Nguyễn Thị Hà"];
const EMOJI_TEXT = ["Great service 👍", "Shipped 📦 on time", "Loved it ❤️🔥", "Needs review ⚠️", "Launch 🚀 ready"];
const QUOTED = ["O'Brien", "\"quoted\" value", "D'Angelo, Jr.", "It's \"fine\"", "semi;colon,comma"];
const BOUNDARY_DATES = ["2024-02-29", "1970-01-01", "2038-01-19", "9999-12-31", "2000-01-01"];

export type EdgeValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; iso: string };

/** Produces an edge-case value for a column type, or null if the kind does not apply. */
export function edgeValue(kind: EdgeCaseKind, type: ColumnType, rng: Rng): EdgeValue | null {
  if (!EDGE_CASES[kind].types.includes(type)) return null;
  switch (kind) {
    case "empty_string":
      return { kind: "string", value: "" };
    case "long_string":
      return { kind: "string", value: "Lorem-ipsum-".repeat(24) + "END" };
    case "unicode":
      return { kind: "string", value: rng.pick(UNICODE_NAMES) };
    case "emoji":
      return { kind: "string", value: rng.pick(EMOJI_TEXT) };
    case "quotes":
      return { kind: "string", value: rng.pick(QUOTED) };
    case "whitespace":
      return { kind: "string", value: `  ${rng.pick(["padded", "trailing space", "tab\tinside"])}  ` };
    case "boundary_numbers":
      return { kind: "number", value: rng.pick([0, -0.01, 99_999_999.99, Number.MAX_SAFE_INTEGER]) };
    case "boundary_dates":
      return { kind: "date", iso: rng.pick(BOUNDARY_DATES) };
    case "plus_email":
      return { kind: "string", value: `${rng.pick(["a", "qa", "test.user", "dev"])}+${rng.pick(["test", "filter", "2025"])}@example.com` };
  }
}

export function edgeCasesForType(type: ColumnType): EdgeCaseKind[] {
  return (Object.keys(EDGE_CASES) as EdgeCaseKind[]).filter((k) => EDGE_CASES[k].types.includes(type));
}
