import type { ColumnKind, RelCell, RelationalDataset, TableDef } from "@/lib/engines/relational/schema";

const SQL_TYPES: Record<ColumnKind, string> = {
  int: "integer",
  text: "text",
  date: "date",
  bool: "boolean",
  money: "bigint",
};

const INSERT_BATCH = 500;

export function quoteIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

/** Postgres literal with standard_conforming_strings (the default since 9.1). */
export function sqlLiteral(value: RelCell, kind: ColumnKind): string {
  if (value === null || value === undefined) return "NULL";
  if (kind === "bool" || typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (kind === "int" || kind === "money") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "NULL";
    return String(Math.trunc(n));
  }
  // Postgres text cannot contain NUL bytes.
  const text = String(value).replace(/\u0000/g, "");
  return `'${text.replace(/'/g, "''")}'`;
}

export function createTableSql(def: TableDef): string {
  const lines = def.columns.map((c) => {
    const fk = def.foreignKeys.find((f) => f.column === c.name);
    const parts = [`  ${quoteIdent(c.name)} ${SQL_TYPES[c.kind]}`];
    if (!c.nullable) parts.push("NOT NULL");
    if (fk) parts.push(`REFERENCES ${quoteIdent(fk.table)}(${quoteIdent(fk.references)})`);
    return parts.join(" ");
  });
  lines.push(`  PRIMARY KEY (${def.primaryKey.map(quoteIdent).join(", ")})`);
  for (const unique of def.unique) lines.push(`  UNIQUE (${unique.map(quoteIdent).join(", ")})`);
  return `CREATE TABLE ${quoteIdent(def.name)} (\n${lines.join(",\n")}\n);`;
}

/** A complete, re-runnable Postgres dump: drop, create (with constraints), insert, in one transaction. */
export function toPostgresDump(dataset: RelationalDataset, header: { seed: number; generatedFor: string }): string {
  const out: string[] = [];
  out.push("-- Zero Real — SYNTHETIC TEST DATA, not real records.");
  out.push(`-- Seed ${header.seed} · ${header.generatedFor} · money columns (*_minor) are integer minor units in ${dataset.currency}.`);
  out.push("");
  out.push("BEGIN;");
  out.push("");
  for (const table of [...dataset.tables].reverse()) out.push(`DROP TABLE IF EXISTS ${quoteIdent(table.def.name)} CASCADE;`);
  out.push("");
  for (const table of dataset.tables) {
    out.push(createTableSql(table.def));
    out.push("");
  }
  for (const table of dataset.tables) {
    if (table.rows.length === 0) continue;
    const cols = table.def.columns.map((c) => quoteIdent(c.name)).join(", ");
    for (let start = 0; start < table.rows.length; start += INSERT_BATCH) {
      const batch = table.rows.slice(start, start + INSERT_BATCH);
      const values = batch
        .map((row) => `  (${row.map((v, i) => sqlLiteral(v, table.def.columns[i].kind)).join(", ")})`)
        .join(",\n");
      out.push(`INSERT INTO ${quoteIdent(table.def.name)} (${cols}) VALUES\n${values};`);
    }
    out.push("");
  }
  out.push("COMMIT;");
  return out.join("\n") + "\n";
}

export const SQL_MIME = "application/sql;charset=utf-8";
