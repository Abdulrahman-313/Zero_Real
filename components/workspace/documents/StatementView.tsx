import type { Statement } from "@/lib/engines/documents/schema";
import { formatDay, isoToDay } from "@/lib/engines/shared/dates";
import type { LocaleId } from "@/lib/engines/shared/locales";
import { formatMoney } from "@/lib/engines/shared/money";
import { DocumentPaper, Monogram } from "./DocumentChrome";

const ROUTING_LABEL: Record<LocaleId, string> = {
  "en-US": "Routing no.",
  "en-GB": "Sort code",
  "de-DE": "BIC",
  "en-PK": "Branch code",
};

export function StatementView({ statement, locale }: { statement: Statement; locale: LocaleId }) {
  const money = (minor: number) => formatMoney(minor, statement.currency, locale);
  const date = (iso: string) => formatDay(isoToDay(iso), locale);

  const summary = [
    { label: "Opening balance", value: statement.openingBalanceMinor },
    { label: "Money in", value: statement.totalCreditsMinor },
    { label: "Money out", value: statement.totalDebitsMinor },
    { label: "Closing balance", value: statement.closingBalanceMinor },
  ];

  return (
    <DocumentPaper label={`Bank statement ${date(statement.periodStart)} to ${date(statement.periodEnd)}`}>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <Monogram name={statement.bank.name} />
          <div>
            <p className="font-display text-base font-semibold text-navy print:text-black">{statement.bank.name}</p>
            {statement.bank.address.map((line) => (
              <p key={line} className="text-xs text-muted print:text-black">
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="text-right">
          <h2 className="font-display text-xl font-bold tracking-tight text-navy print:text-black">STATEMENT OF ACCOUNT</h2>
          <p className="text-xs">
            {date(statement.periodStart)} – {date(statement.periodEnd)}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase print:text-black">Account holder</h3>
          <p className="mt-1 font-medium">{statement.accountHolder.name}</p>
          {statement.accountHolder.address.map((line) => (
            <p key={line} className="text-xs text-muted print:text-black">
              {line}
            </p>
          ))}
        </section>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-0.5 text-xs sm:justify-self-end">
          <dt className="text-muted print:text-black">Account no.</dt>
          <dd className="font-mono">{statement.accountNumber}</dd>
          <dt className="text-muted print:text-black">{ROUTING_LABEL[locale]}</dt>
          <dd className="font-mono">{statement.routingCode}</dd>
          <dt className="text-muted print:text-black">Currency</dt>
          <dd>{statement.currency}</dd>
        </dl>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl bg-cream/70 px-3 py-2 print:border print:border-black print:bg-white">
            <dt className="text-[11px] text-muted print:text-black">{s.label}</dt>
            <dd className="font-display text-sm font-semibold text-navy tabular-nums print:text-black">{money(s.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted print:text-black">
        Lowest balance {money(statement.lowestBalanceMinor)} · highest {money(statement.highestBalanceMinor)} ·{" "}
        {statement.transactions.length} transactions
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b-2 border-navy text-navy print:border-black print:text-black">
              <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Debit</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Credit</th>
              <th scope="col" className="py-2 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line text-muted print:text-black">
              <td className="py-1.5 pr-3">{date(statement.periodStart)}</td>
              <td className="py-1.5 pr-3 italic">Opening balance</td>
              <td className="py-1.5 pr-3" />
              <td className="py-1.5 pr-3" />
              <td className="py-1.5 text-right">{money(statement.openingBalanceMinor)}</td>
            </tr>
            {statement.transactions.map((t, i) => (
              <tr key={i} className="border-b border-line/70 break-inside-avoid">
                <td className="py-1.5 pr-3 whitespace-nowrap">{date(t.date)}</td>
                <td className="py-1.5 pr-3">{t.description}</td>
                <td className="py-1.5 pr-3 text-right">{t.debitMinor !== null ? money(t.debitMinor) : ""}</td>
                <td className="py-1.5 pr-3 text-right text-teal-dark print:text-black">
                  {t.creditMinor !== null ? money(t.creditMinor) : ""}
                </td>
                <td className="py-1.5 text-right font-medium">{money(t.balanceMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-navy font-semibold text-navy print:border-black print:text-black">
              <td className="py-2 pr-3" colSpan={2}>
                Closing balance
              </td>
              <td className="py-2 pr-3 text-right">{money(statement.totalDebitsMinor)}</td>
              <td className="py-2 pr-3 text-right">{money(statement.totalCreditsMinor)}</td>
              <td className="py-2 text-right">{money(statement.closingBalanceMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DocumentPaper>
  );
}
