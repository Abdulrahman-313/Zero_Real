/**
 * Curated, invented names for document generation. None of these are meant to
 * reference real organisations; banks carry "Test"/"Sample" in the name so they
 * are unmistakably fictional. No logos are ever used — only generic monograms.
 */

export const SYNTHETIC_NOTICE = "SYNTHETIC TEST DATA — NOT A REAL DOCUMENT";

export const SELLER_COMPANIES = [
  "Synth Data Co.",
  "Quillmere Analytics Ltd.",
  "Harrowby Cloud Services",
  "Tessaline Software LLC",
  "Orrinford Consulting Group",
  "Pellucid Systems Ltd.",
  "Vantrell Digital Studio",
  "Cobbleway Data Works",
];

export const BUYER_COMPANIES = [
  "Northbrook Supplies Ltd.",
  "Fernhollow Retail Group",
  "Ambermoor Logistics",
  "Kittering & Vale Partners",
  "Sallowmere Foods Co.",
  "Brackenridge Outfitters",
  "Lumenfold Health Clinics",
  "Wrenfield Property Services",
  "Oakhurst Learning Trust",
  "Marlowe Street Bakery",
  "Thistledown Engineering",
  "Glimmerbrook Hotels",
];

export const BANK_NAMES = [
  "Harbourline Sample Bank",
  "Cedarpoint Test Savings",
  "Meridale Test Bank",
  "Stonebridge Sample Credit Union",
];

export const STREETS = ["Juniper Lane", "Quarry Road", "Lantern Street", "Old Mill Way", "Heron Court", "Fairview Avenue", "Copper Row", "Willow Crescent"];

export const CITIES_BY_REGION: Record<"US" | "UK" | "PK", ReadonlyArray<readonly [city: string, area: string, postcode: string]>> = {
  US: [
    ["Springfield", "IL", "62701"],
    ["Riverton", "WY", "82501"],
    ["Fairview", "OR", "97024"],
    ["Madison", "WI", "53703"],
  ],
  UK: [
    ["Ashford", "Kent", "TN23 1AA"],
    ["Harrogate", "North Yorkshire", "HG1 1AA"],
    ["Bath", "Somerset", "BA1 1AA"],
    ["Stockport", "Cheshire", "SK1 1AA"],
  ],
  PK: [
    ["Lahore", "Punjab", "54000"],
    ["Karachi", "Sindh", "74200"],
    ["Islamabad", "ICT", "44000"],
    ["Peshawar", "KP", "25000"],
  ],
};

export type UkVatBand = "standard" | "reduced" | "zero";

export interface CatalogItem {
  description: string;
  /** Unit price range in major units (before currency scaling). */
  min: number;
  max: number;
  qty: [number, number];
  ukBand: UkVatBand;
}

export const INVOICE_CATALOG: CatalogItem[] = [
  { description: "API access — Pro tier (monthly)", min: 400, max: 1200, qty: [1, 1], ukBand: "standard" },
  { description: "Onboarding support", min: 90, max: 250, qty: [1, 3], ukBand: "standard" },
  { description: "Data pipeline audit", min: 800, max: 2400, qty: [1, 1], ukBand: "standard" },
  { description: "Consulting hours", min: 80, max: 180, qty: [2, 24], ukBand: "standard" },
  { description: "Dashboard seat licence", min: 15, max: 45, qty: [3, 40], ukBand: "standard" },
  { description: "Cloud storage (per TB)", min: 20, max: 60, qty: [1, 12], ukBand: "standard" },
  { description: "Printed training manuals", min: 12, max: 35, qty: [5, 60], ukBand: "zero" },
  { description: "Staff canteen vouchers", min: 5, max: 12, qty: [10, 80], ukBand: "zero" },
  { description: "Energy-saving materials install", min: 150, max: 600, qty: [1, 2], ukBand: "reduced" },
  { description: "Mobility aid equipment", min: 60, max: 300, qty: [1, 4], ukBand: "reduced" },
  { description: "Hardware security key", min: 25, max: 70, qty: [2, 20], ukBand: "standard" },
  { description: "Priority support add-on", min: 150, max: 400, qty: [1, 1], ukBand: "standard" },
];

export type MerchantCategory =
  | "groceries"
  | "dining"
  | "transport"
  | "shopping"
  | "utilities"
  | "subscriptions"
  | "rent"
  | "payroll"
  | "transfer"
  | "atm"
  | "health";

export const MERCHANTS: Record<MerchantCategory, string[]> = {
  groceries: ["Greenleaf Market", "Harvest Lane Grocers", "Corner Basket Foods", "Fresh Acre Market"],
  dining: ["Copper Kettle Café", "Saffron Table", "Little Fig Bistro", "Driftwood Diner", "Night Owl Noodles"],
  transport: ["Metroline Transit Card", "Quickride Taxis", "Fuelpoint Station", "Parkwise Parking"],
  shopping: ["Wickerworks Home", "Threadline Apparel", "Pagebound Books", "Gadget Grove"],
  utilities: ["Riverside Utilities", "Brightspark Energy", "Clearwater Water Co.", "Linkwave Broadband"],
  subscriptions: ["Streamnest Video", "Tunebox Music", "CloudLocker Storage", "Dailyread News"],
  rent: ["Hollins Lettings — Rent"],
  payroll: ["Payroll deposit — Synth Data Co."],
  transfer: ["Transfer to savings", "Transfer from savings", "Faster payment received"],
  atm: ["ATM withdrawal"],
  health: ["Wellbrook Pharmacy", "Calmwater Dental"],
};
