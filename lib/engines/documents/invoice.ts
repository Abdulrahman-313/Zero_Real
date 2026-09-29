import { dayToIso, isoToDay } from "../shared/dates";
import type { GlobalSettings } from "../shared/locales";
import { applyRateBps, toMinor } from "../shared/money";
import { getFaker, makePerson } from "../shared/people";
import { createRng, deriveSeed, type Rng } from "../shared/rng";
import { BUYER_COMPANIES, CITIES_BY_REGION, INVOICE_CATALOG, SELLER_COMPANIES, STREETS, SYNTHETIC_NOTICE } from "./pools";
import { PRICE_SCALE, invoiceConfigSchema, type Invoice, type InvoiceConfig, type InvoiceLine, type Party, type TaxLine } from "./schema";
import { PK_GST_BPS, REGION_TEMPLATES, UK_VAT_BPS, US_STATE_RATES, formatRate, type Region } from "./tax";

function digits(rng: Rng, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += rng.int(0, 9);
  return out;
}

/** Obviously fake tax identifiers — always contain "TEST". */
function fakeTaxId(region: Region, rng: Rng): string {
  switch (region) {
    case "US":
      return `TEST-00-${digits(rng, 7)}`;
    case "UK":
      return `GB TEST ${digits(rng, 4)} ${digits(rng, 2)}`;
    case "PK":
      return `TEST-NTN-${digits(rng, 7)}`;
  }
}

function makeAddress(region: Region, rng: Rng): string[] {
  const [city, area, postcode] = rng.pick(CITIES_BY_REGION[region]);
  const street = `${rng.int(2, 480)} ${rng.pick(STREETS)}`;
  if (region === "US") return [street, `${city}, ${area} ${postcode}`];
  if (region === "UK") return [street, city, `${area} ${postcode}`];
  return [street, `${city}, ${area} ${postcode}`, "Pakistan"];
}

function party(name: string, region: Region, rng: Rng): Party {
  const slug =
    name
      .toLowerCase()
      .replace(/(ltd|llc|co|inc|group|services|partners|trust)\.?/g, "")
      .replace(/[^a-z0-9]+/g, "") || "company";
  return { name, address: makeAddress(region, rng), taxId: fakeTaxId(region, rng), email: `billing@${slug}.example` };
}

function lineRate(region: Region, config: InvoiceConfig, band: (typeof INVOICE_CATALOG)[number]["ukBand"]): number {
  if (region === "US") return US_STATE_RATES[config.usState].bps;
  if (region === "UK") return UK_VAT_BPS[band];
  return PK_GST_BPS;
}

/**
 * Totals reconcile exactly by construction: amount = qty × unit price, subtotal = Σ amounts,
 * tax is computed per rate bucket with half-up rounding, total = subtotal + Σ tax.
 */
export function computeTotals(lines: InvoiceLine[], taxLabel: string): { subtotalMinor: number; taxLines: TaxLine[]; taxTotalMinor: number; totalMinor: number } {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const buckets = new Map<number, number>();
  for (const l of lines) buckets.set(l.taxRateBps, (buckets.get(l.taxRateBps) ?? 0) + l.amountMinor);
  const taxLines: TaxLine[] = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rateBps, baseMinor]) => ({
      label: `${taxLabel} ${formatRate(rateBps)}`,
      rateBps,
      baseMinor,
      taxMinor: applyRateBps(baseMinor, rateBps),
    }));
  const taxTotalMinor = taxLines.reduce((sum, t) => sum + t.taxMinor, 0);
  return { subtotalMinor, taxLines, taxTotalMinor, totalMinor: subtotalMinor + taxTotalMinor };
}

export function generateInvoice(config: InvoiceConfig, settings: GlobalSettings, asOf: string, index: number): Invoice {
  const region = config.region;
  const template = REGION_TEMPLATES[region];
  const currency = settings.currency;
  const rng = createRng(deriveSeed(settings.seed, "invoice", index));
  const numberBase = 10000 + createRng(deriveSeed(settings.seed, "invoice-number")).int(0, 899) * 10;

  const issueDay = isoToDay(asOf) - rng.int(0, 60);
  const dueDay = issueDay + config.paymentTermsDays;

  const sellerName = SELLER_COMPANIES[createRng(deriveSeed(settings.seed, "seller")).int(0, SELLER_COMPANIES.length - 1)];
  const seller = party(sellerName, region, createRng(deriveSeed(settings.seed, "seller-address")));
  const buyer = party(rng.pick(BUYER_COMPANIES), region, rng);
  const faker = getFaker(settings.locale);
  faker.seed(deriveSeed(settings.seed, "invoice-contact", index));
  const contact = makePerson(settings.locale, faker, rng);
  buyer.address = [`Attn: ${contact.first} ${contact.last}`, ...buyer.address];

  const lineCount = rng.int(Math.min(config.lines.min, config.lines.max), Math.max(config.lines.min, config.lines.max));
  const items = rng.sample(INVOICE_CATALOG, Math.min(lineCount, INVOICE_CATALOG.length));
  const scale = PRICE_SCALE[currency];
  const lines: InvoiceLine[] = items.map((item) => {
    const qty = rng.int(item.qty[0], item.qty[1]);
    // Round unit prices to a "price-list" feel: whole units above 100, else .x5/.x0.
    const raw = rng.float(item.min, item.max) * scale;
    const unitPriceMinor = raw >= 100 ? toMinor(Math.round(raw), currency) : toMinor(Math.round(raw * 20) / 20, currency);
    return { description: item.description, qty, unitPriceMinor, amountMinor: qty * unitPriceMinor, taxRateBps: lineRate(region, config, item.ukBand) };
  });

  const totals = computeTotals(lines, template.taxLabel);
  const number = `INV-${numberBase + index}`;
  return {
    _notice: SYNTHETIC_NOTICE,
    number,
    region,
    currency,
    issueDate: dayToIso(issueDay),
    dueDate: dayToIso(dueDay),
    seller,
    buyer,
    lines,
    ...totals,
    paymentTerms: `Net ${config.paymentTermsDays}`,
    paymentReference: `${number}-TEST`,
  };
}

export function generateInvoices(config: InvoiceConfig, settings: GlobalSettings, asOf: string, limit?: number): Invoice[] {
  const parsed = invoiceConfigSchema.safeParse(config);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid invoice settings");
  const count = Math.min(config.count, limit ?? config.count);
  return Array.from({ length: count }, (_, i) => generateInvoice(config, settings, asOf, i));
}
