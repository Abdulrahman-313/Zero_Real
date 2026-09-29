import { cx } from "@/components/ui/cx";

interface Row {
  id: string;
  name: string;
  email: string;
  balance: string;
  tier: string;
}

const ROWS: Row[] = [
  { id: "10231", name: "Maria Chen", email: "m.chen@example.com", balance: "$482.10", tier: "Gold" },
  { id: "10232", name: "Ahmed Raza", email: "a.raza@example.com", balance: "$129.55", tier: "Bronze" },
  { id: "10233", name: "Sofia Ivanova", email: "s.ivanova@example.com", balance: "$918.42", tier: "Silver" },
  { id: "10234", name: "Liam O'Connor", email: "liam.oc@example.com", balance: "$1,204.00", tier: "Gold" },
  { id: "10235", name: "Priya Nair", email: "p.nair@example.com", balance: "$76.20", tier: "Bronze" },
  { id: "10236", name: "Jonas Weber", email: "j.weber@example.com", balance: "$1,530.75", tier: "Silver" },
];

const TIER_TONE: Record<string, string> = {
  Gold: "bg-warn-soft text-warn",
  Silver: "bg-mint text-teal-dark",
  Bronze: "bg-cream text-muted",
};

/**
 * A static, on-brand mock of the workspace preview, reusing the app's real styling.
 * The row-fill animation is layered on in M3 (this markup stays as the reduced-motion fallback).
 */
export function WorkspaceMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-xl shadow-navy/10">
      <div className="flex items-center gap-2 border-b border-line bg-cream/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/50" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/50" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-teal/50" aria-hidden="true" />
        <span className="ml-2 font-mono text-xs text-muted">zero-real / app · tabular</span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-navy px-2 py-0.5 font-medium text-paper">1,000 rows × 5 columns</span>
          <span className="rounded-full bg-cream px-2 py-0.5 text-muted">seed 42</span>
          <span className="rounded-full bg-mint px-2 py-0.5 text-teal-dark">privacy: hash</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-paper">
              <tr className="text-muted">
                <th className="px-3 py-2 font-semibold text-navy">id</th>
                <th className="px-3 py-2 font-semibold text-navy">name</th>
                <th className="hidden px-3 py-2 font-semibold text-navy sm:table-cell">email</th>
                <th className="px-3 py-2 text-right font-semibold text-navy">balance</th>
                <th className="px-3 py-2 font-semibold text-navy">tier</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.id} className={cx("border-t border-line/70", i % 2 ? "bg-paper/60" : "bg-white")}>
                  <td className="px-3 py-1.5 text-muted">{r.id}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="hidden px-3 py-1.5 text-muted sm:table-cell">{r.email}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{r.balance}</td>
                  <td className="px-3 py-1.5">
                    <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", TIER_TONE[r.tier])}>{r.tier}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">Generated in your browser · 1,000 rows in 63 ms</p>
      </div>
    </div>
  );
}
