import { Card, Chip } from "@/components/ui/controls";
import type { RelationalConfig, Table, TableName } from "@/lib/engines/relational/schema";

interface Relation {
  from: TableName;
  to: TableName;
  label: string;
  detail: string;
}

function relations(config: RelationalConfig): Relation[] {
  const list: Relation[] = [];
  if (config.profiles.enabled)
    list.push({ from: "customers", to: "customer_profiles", label: "1 : 1", detail: `${config.profiles.coverage}% of customers` });
  list.push({
    from: "customers",
    to: "orders",
    label: "1 : N",
    detail: `${config.ordersPerCustomer.min}–${config.ordersPerCustomer.max} per customer`,
  });
  list.push({
    from: "orders",
    to: "order_items",
    label: "1 : N",
    detail: `${config.itemsPerOrder.min}–${config.itemsPerOrder.max} per order`,
  });
  list.push({ from: "products", to: "order_items", label: "1 : N", detail: "referenced by SKU and id" });
  if (config.productCategories.enabled)
    list.push({
      from: "products",
      to: "categories",
      label: "N : N",
      detail: `via product_categories, ${config.productCategories.min}–${config.productCategories.max} each`,
    });
  return list;
}

export function SchemaDiagram({
  tables,
  config,
  selected,
  onSelect,
}: {
  tables: Table[];
  config: RelationalConfig;
  selected: TableName;
  onSelect: (name: TableName) => void;
}) {
  return (
    <Card title="Schema" description="Primary keys, foreign keys and configured cardinalities. Select a table to preview it.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tables.map((t) => {
          const fks = new Set(t.def.foreignKeys.map((f) => f.column));
          const active = t.def.name === selected;
          return (
            <button
              key={t.def.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t.def.name)}
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                active ? "border-teal bg-mint/60 ring-2 ring-teal/30" : "border-line bg-white hover:border-teal/50"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-navy">{t.def.name}</span>
                <span className="text-[11px] text-muted tabular-nums">{t.rows.length.toLocaleString()} rows</span>
              </span>
              <span className="mt-1.5 block space-y-0.5">
                {t.def.columns.map((c) => {
                  const pk = t.def.primaryKey.includes(c.name);
                  return (
                    <span key={c.name} className="flex items-center gap-1.5 font-mono text-[11px] text-ink/80">
                      {c.name}
                      {pk && <span className="rounded bg-navy px-1 text-[9px] font-semibold text-paper">PK</span>}
                      {fks.has(c.name) && <span className="rounded bg-teal px-1 text-[9px] font-semibold text-white">FK</span>}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Relationships">
        {relations(config).map((r) => (
          <li key={`${r.from}-${r.to}`} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs">
            <span className="font-mono">{r.from}</span>
            <Chip tone="navy" className="!px-1.5 !py-0">
              {r.label}
            </Chip>
            <span className="font-mono">{r.to}</span>
            <span className="text-muted">· {r.detail}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
