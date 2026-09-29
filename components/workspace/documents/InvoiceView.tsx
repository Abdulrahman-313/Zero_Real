import type { Invoice } from "@/lib/engines/documents/schema";
import { REGION_TEMPLATES, formatRate } from "@/lib/engines/documents/tax";
import { formatDayPattern, isoToDay } from "@/lib/engines/shared/dates";
import type { LocaleId } from "@/lib/engines/shared/locales";
import { formatMoney } from "@/lib/engines/shared/money";
import { DocumentPaper, Monogram } from "./DocumentChrome";

export function InvoiceView({ invoice, locale }: { invoice: Invoice; locale: LocaleId }) {
  const template = REGION_TEMPLATES[invoice.region];
  const money = (minor: number) => formatMoney(minor, invoice.currency, locale);
  const date = (iso: string) => formatDayPattern(isoToDay(iso), template.datePattern);

  return (
    <DocumentPaper label={`Invoice ${invoice.number}`}>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <Monogram name={invoice.seller.name} />
          <div>
            <p className="font-display text-base font-semibold text-navy print:text-black">{invoice.seller.name}</p>
            {invoice.seller.address.map((line) => (
              <p key={line} className="text-xs text-muted print:text-black">
                {line}
              </p>
            ))}
            <p className="text-xs text-muted print:text-black">
              {template.taxIdLabel}: {invoice.seller.taxId}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="font-display text-2xl font-bold tracking-tight text-navy print:text-black">INVOICE</h2>
          <p className="font-mono text-sm font-semibold">#{invoice.number}</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 text-xs">
            <dt className="text-muted print:text-black">Issue date</dt>
            <dd>{date(invoice.issueDate)}</dd>
            <dt className="text-muted print:text-black">Due date</dt>
            <dd>{date(invoice.dueDate)}</dd>
            <dt className="text-muted print:text-black">Terms</dt>
            <dd>{invoice.paymentTerms}</dd>
          </dl>
        </div>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase print:text-black">Billed to</h3>
          <p className="mt-1 font-medium">{invoice.buyer.name}</p>
          {invoice.buyer.address.map((line) => (
            <p key={line} className="text-xs text-muted print:text-black">
              {line}
            </p>
          ))}
          <p className="text-xs text-muted print:text-black">
            {template.taxIdLabel}: {invoice.buyer.taxId}
          </p>
        </section>
        <section>
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase print:text-black">From</h3>
          <p className="mt-1 font-medium">{invoice.seller.name}</p>
          <p className="text-xs text-muted print:text-black">{invoice.seller.email}</p>
          <p className="text-xs text-muted print:text-black">Payment reference: {invoice.paymentReference}</p>
        </section>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b-2 border-navy text-navy print:border-black print:text-black">
              <th scope="col" className="py-2 pr-3 font-semibold">Item</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Qty</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Unit price</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">{template.taxLabel}</th>
              <th scope="col" className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2 pr-3">{line.description}</td>
                <td className="py-2 pr-3 text-right">{line.qty}</td>
                <td className="py-2 pr-3 text-right">{money(line.unitPriceMinor)}</td>
                <td className="py-2 pr-3 text-right">{formatRate(line.taxRateBps)}</td>
                <td className="py-2 text-right">{money(line.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-xs tabular-nums">
        <dt className="text-muted print:text-black">Subtotal</dt>
        <dd className="text-right">{money(invoice.subtotalMinor)}</dd>
        {invoice.taxLines.map((t) => (
          <div key={t.rateBps} className="contents">
            <dt className="text-muted print:text-black">
              {t.label} <span className="text-[10px]">on {money(t.baseMinor)}</span>
            </dt>
            <dd className="text-right">{money(t.taxMinor)}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t-2 border-navy pt-1.5 font-display text-sm font-bold text-navy print:border-black print:text-black">
          Total due
        </dt>
        <dd className="mt-1 border-t-2 border-navy pt-1.5 text-right font-display text-sm font-bold text-navy print:border-black print:text-black">
          {money(invoice.totalMinor)}
        </dd>
      </dl>
    </DocumentPaper>
  );
}
