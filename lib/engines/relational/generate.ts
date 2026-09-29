import { dayToIso, isoToDay } from "../shared/dates";
import { LOCALES, type GlobalSettings } from "../shared/locales";
import { toMinor } from "../shared/money";
import { getFaker, makeEmail, makePerson } from "../shared/people";
import { createRng, deriveSeed } from "../shared/rng";
import {
  MAX_TOTAL_ROWS,
  TABLE_DEFS,
  relationalConfigSchema,
  type RelCell,
  type RelationalConfig,
  type RelationalDataset,
  type Table,
  type TableName,
} from "./schema";

const CATEGORY_NAMES = [
  "Home", "Office", "Outdoor", "Kitchen", "Garden", "Toys", "Books", "Beauty", "Sports", "Electronics",
  "Pets", "Travel", "Stationery", "Lighting", "Storage", "Bath", "Crafts", "Fitness", "Music", "Wellness",
];

const PRODUCT_ADJ = ["Classic", "Compact", "Deluxe", "Eco", "Everyday", "Nordic", "Pro", "Smart", "Studio", "Urban", "Vintage", "Travel"];
const PRODUCT_NOUN = [
  "Desk Lamp", "Water Bottle", "Notebook", "Backpack", "Plant Pot", "Coffee Mug", "Phone Stand", "Tote Bag",
  "Yoga Mat", "Storage Box", "Cutting Board", "Headphone Case", "Wall Clock", "Throw Blanket", "Pen Set", "Lunch Box",
];

const OTHER_COUNTRIES = ["United States", "United Kingdom", "Germany", "Pakistan", "Canada", "Ireland", "Netherlands", "Australia"];
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const TIER_WEIGHTS = [50, 30, 15, 5];
const STATUSES = ["delivered", "shipped", "processing", "cancelled", "refunded"];
const STATUS_WEIGHTS = [60, 15, 12, 8, 5];
const QTY = [1, 2, 3, 4, 5];
const QTY_WEIGHTS = [55, 25, 10, 6, 4];

const SIGNUP_START = isoToDay("2023-01-01");
const SIGNUP_END = isoToDay("2025-06-30");
const ORDER_END = isoToDay("2025-09-30");

/** Upper bound on rows the config can produce — used to enforce the 50k cap before generating. */
export function worstCaseRows(config: RelationalConfig): number {
  const orders = config.customers * config.ordersPerCustomer.max;
  return (
    config.customers +
    (config.profiles.enabled ? config.customers : 0) +
    config.products +
    Math.min(config.categories, CATEGORY_NAMES.length) +
    (config.productCategories.enabled ? config.products * Math.min(config.productCategories.max, config.categories) : 0) +
    orders +
    orders * config.itemsPerOrder.max
  );
}

export function validateRelationalConfig(config: RelationalConfig): string[] {
  const issues: string[] = [];
  const parsed = relationalConfigSchema.safeParse(config);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 3)) issues.push(`Invalid ${issue.path.join(".")}: ${issue.message}`);
    return issues;
  }
  if (config.ordersPerCustomer.min > config.ordersPerCustomer.max) issues.push("Orders per customer: minimum is greater than maximum.");
  if (config.itemsPerOrder.min > config.itemsPerOrder.max) issues.push("Items per order: minimum is greater than maximum.");
  if (config.productCategories.enabled && config.productCategories.min > config.productCategories.max)
    issues.push("Categories per product: minimum is greater than maximum.");
  if (config.productCategories.enabled && config.productCategories.min > config.categories)
    issues.push("Categories per product: minimum exceeds the number of categories.");
  const worst = worstCaseRows(config);
  if (worst > MAX_TOTAL_ROWS)
    issues.push(
      `This setup could produce up to ${worst.toLocaleString()} rows (limit ${MAX_TOTAL_ROWS.toLocaleString()}). Reduce customers, orders or items per order.`,
    );
  return issues;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates the relational demo model. Referential integrity and reconciled totals
 * hold by construction: children are only ever created from existing parent rows,
 * and order totals are summed from the generated line items.
 */
export function generateRelational(config: RelationalConfig, settings: GlobalSettings): RelationalDataset {
  const issues = validateRelationalConfig(config);
  if (issues.length > 0) throw new Error(issues[0]);

  const { seed, locale, currency } = settings;
  const faker = getFaker(locale);
  const homeCountry = LOCALES[locale].country;
  const rows: Record<TableName, RelCell[][]> = {
    categories: [],
    products: [],
    product_categories: [],
    customers: [],
    customer_profiles: [],
    orders: [],
    order_items: [],
  };

  // Categories
  const categoryCount = Math.min(config.categories, CATEGORY_NAMES.length);
  const categoryIds: number[] = [];
  const categoryOrder = createRng(deriveSeed(seed, "categories")).shuffle(CATEGORY_NAMES).slice(0, categoryCount);
  categoryOrder.forEach((name, i) => {
    categoryIds.push(i + 1);
    rows.categories.push([i + 1, name]);
  });

  // Products (+ N:N product_categories)
  const productPrice = new Map<number, number>();
  const productSku = new Map<number, string>();
  const productIds: number[] = [];
  for (let p = 1; p <= config.products; p++) {
    const rng = createRng(deriveSeed(seed, "product", p));
    const sku = `SKU-${String(p).padStart(5, "0")}-${String.fromCharCode(65 + rng.int(0, 25))}${String.fromCharCode(65 + rng.int(0, 25))}`;
    const name = titleCase(`${rng.pick(PRODUCT_ADJ)} ${rng.pick(PRODUCT_NOUN)}`);
    const major = 3 + 297 * Math.min(1, 0.12 * Math.exp(0.9 * rng.normal()));
    const price = Math.max(1, toMinor(major, currency));
    productIds.push(p);
    productPrice.set(p, price);
    productSku.set(p, sku);
    rows.products.push([p, sku, name, price, currency]);

    if (config.productCategories.enabled) {
      const k = rng.int(config.productCategories.min, Math.min(config.productCategories.max, categoryCount));
      const picks = rng.sample(categoryIds, k).sort((a, b) => a - b);
      for (const categoryId of picks) rows.product_categories.push([p, categoryId]);
    }
  }

  // Customers (+ 1:1 profiles) and 1:N orders → order_items
  const seenEmails = new Set<string>();
  let profileId = 0;
  let orderId = 100000;
  let itemId = 1;
  const coverage = config.profiles.coverage / 100;

  for (let c = 1; c <= config.customers; c++) {
    const rng = createRng(deriveSeed(seed, "customer", c));
    faker.seed(deriveSeed(seed, "customer-faker", c));
    const person = makePerson(locale, faker, rng);
    let email = makeEmail(person, rng);
    for (let suffix = c; seenEmails.has(email); suffix += config.customers) email = email.replace(/(\d*)@/, `${suffix}@`);
    seenEmails.add(email);
    const signup = rng.int(SIGNUP_START, SIGNUP_END);
    const country = rng.chance(0.85) ? homeCountry : rng.pick(OTHER_COUNTRIES);
    rows.customers.push([c, `${person.first} ${person.last}`, email, dayToIso(signup), country]);

    if (config.profiles.enabled && createRng(deriveSeed(seed, "profile", c)).next() < coverage) {
      profileId++;
      const prng = createRng(deriveSeed(seed, "profile-data", c));
      rows.customer_profiles.push([profileId, c, prng.weighted(TIERS, TIER_WEIGHTS), prng.chance(0.4)]);
    }

    const orng = createRng(deriveSeed(seed, "orders", c));
    const orderCount = orng.int(config.ordersPerCustomer.min, config.ordersPerCustomer.max);
    const orderDays = Array.from({ length: orderCount }, () => orng.int(signup, Math.max(signup, ORDER_END))).sort((a, b) => a - b);

    for (const day of orderDays) {
      orderId++;
      const irng = createRng(deriveSeed(seed, "items", orderId));
      const itemCount = irng.int(config.itemsPerOrder.min, config.itemsPerOrder.max);
      // Distinct products per order where possible; repeat only if the catalog is smaller.
      const picks = itemCount <= productIds.length ? irng.sample(productIds, itemCount) : Array.from({ length: itemCount }, () => irng.pick(productIds));
      let total = 0;
      for (const productId of picks) {
        const qty = irng.weighted(QTY, QTY_WEIGHTS);
        const unit = productPrice.get(productId)!;
        const line = qty * unit;
        total += line;
        rows.order_items.push([itemId++, orderId, productId, productSku.get(productId)!, qty, unit, line]);
      }
      rows.orders.push([orderId, c, dayToIso(day), orng.weighted(STATUSES, STATUS_WEIGHTS), total]);
    }
  }

  const order: TableName[] = ["categories", "products", "product_categories", "customers", "customer_profiles", "orders", "order_items"];
  const tables: Table[] = order
    .filter((name) => (name === "customer_profiles" ? config.profiles.enabled : name === "product_categories" ? config.productCategories.enabled : true))
    .map((name) => ({ def: TABLE_DEFS[name], rows: rows[name] }));

  return { tables, currency };
}

export function totalRows(dataset: RelationalDataset): number {
  return dataset.tables.reduce((sum, t) => sum + t.rows.length, 0);
}
