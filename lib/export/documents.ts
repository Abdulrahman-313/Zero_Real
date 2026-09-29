import { SYNTHETIC_NOTICE } from "@/lib/engines/documents/pools";
import type { Invoice, Statement } from "@/lib/engines/documents/schema";
import { minorToDecimalString } from "@/lib/engines/shared/money";
import { CSV_BOM, toCsv } from "./csv";
import { createZip } from "./zip";

const NOTICE_COMMENTS = [SYNTHETIC_NOTICE, "Invented names, numbers and addresses — for software testing only."];

/** invoices.csv (one row per invoice) + invoice_lines.csv (one row per line item), zipped. */
export function invoicesCsvZip(invoices: Invoice[]): Uint8Array<ArrayBuffer> {
  const dec = (minor: number, inv: Invoice) => minorToDecimalString(minor, inv.currency);
  const header = toCsv(
    ["invoice_number", "issue_date", "due_date", "region", "currency", "seller", "seller_tax_id", "buyer", "buyer_tax_id", "subtotal", "tax_total", "total", "payment_terms"],
    invoices.map((inv) => [
      inv.number,
      inv.issueDate,
      inv.dueDate,
      inv.region,
      inv.currency,
      inv.seller.name,
      inv.seller.taxId,
      inv.buyer.name,
      inv.buyer.taxId,
      dec(inv.subtotalMinor, inv),
      dec(inv.taxTotalMinor, inv),
      dec(inv.totalMinor, inv),
      inv.paymentTerms,
    ]),
    { comments: NOTICE_COMMENTS },
  );
  const lines = toCsv(
    ["invoice_number", "line_no", "description", "qty", "unit_price", "tax_rate_percent", "amount", "currency"],
    invoices.flatMap((inv) =>
      inv.lines.map((l, i) => [inv.number, i + 1, l.description, l.qty, dec(l.unitPriceMinor, inv), l.taxRateBps / 100, dec(l.amountMinor, inv), inv.currency]),
    ),
    { comments: NOTICE_COMMENTS },
  );
  return createZip([
    { name: "invoices.csv", content: CSV_BOM + header },
    { name: "invoice_lines.csv", content: CSV_BOM + lines },
  ]);
}

export function statementCsv(st: Statement): string {
  const dec = (minor: number | null) => (minor === null ? null : minorToDecimalString(minor, st.currency));
  return (
    CSV_BOM +
    toCsv(
      ["date", "description", "category", "debit", "credit", "balance", "currency"],
      [
        [st.periodStart, "Opening balance", "opening", null, null, dec(st.openingBalanceMinor), st.currency],
        ...st.transactions.map((t) => [t.date, t.description, t.category, dec(t.debitMinor), dec(t.creditMinor), dec(t.balanceMinor), st.currency]),
      ],
      {
        comments: [
          ...NOTICE_COMMENTS,
          `${st.bank.name} · account ${st.accountNumber} · ${st.periodStart} to ${st.periodEnd}`,
        ],
      },
    )
  );
}

/** JSON-friendly copies with decimal strings next to exact minor units. */
export function statementJson(st: Statement) {
  return {
    ...st,
    openingBalance: minorToDecimalString(st.openingBalanceMinor, st.currency),
    closingBalance: minorToDecimalString(st.closingBalanceMinor, st.currency),
  };
}
