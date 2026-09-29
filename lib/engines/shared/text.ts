import type { Rng } from "./rng";

/**
 * Rule-based free-text synthesis. Used when no AI text pool is available,
 * and by the AI fallback provider.
 */

export const TEXT_KINDS = ["product", "memo", "sentence"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

/** Products with materials and benefits that make sense together. */
const PRODUCTS: Array<{ noun: string; adjectives: string[]; materials: string[]; benefits: string[] }> = [
  {
    noun: "tote bag",
    adjectives: ["Hand-stitched", "Everyday", "Recycled"],
    materials: ["canvas", "linen", "leather"],
    benefits: ["with a reinforced base", "built for daily commutes", "that folds flat for storage"],
  },
  {
    noun: "water bottle",
    adjectives: ["Insulated", "Lightweight", "Leak-proof"],
    materials: ["stainless steel", "aluminium"],
    benefits: ["that keeps drinks cold for 24 hours", "with a one-hand flip lid", "that fits standard cup holders"],
  },
  {
    noun: "travel mug",
    adjectives: ["Insulated", "Compact", "Everyday"],
    materials: ["stainless steel", "ceramic-lined steel", "bamboo-wrapped steel"],
    benefits: ["that keeps coffee hot for 6 hours", "that is dishwasher safe", "with a spill-proof lid"],
  },
  {
    noun: "desk organiser",
    adjectives: ["Minimalist", "Modular", "Compact"],
    materials: ["oak", "bamboo", "cork", "powder-coated steel"],
    benefits: ["sized for small desks", "with a hidden cable slot", "that keeps pens and notes in reach"],
  },
  {
    noun: "laptop sleeve",
    adjectives: ["Padded", "Water-resistant", "Slim"],
    materials: ["merino wool felt", "recycled polyester", "leather"],
    benefits: ["designed to fit a 14-inch laptop", "with a front pocket for chargers", "finished with a soft-touch lining"],
  },
  {
    noun: "plant pot",
    adjectives: ["Glazed", "Minimalist", "Self-watering"],
    materials: ["ceramic", "terracotta", "recycled plastic"],
    benefits: ["with a drainage tray", "sized for windowsill herbs", "that hides a nursery pot"],
  },
  {
    noun: "backpack",
    adjectives: ["Heavy-duty", "Lightweight", "Water-resistant"],
    materials: ["waxed canvas", "ripstop nylon", "recycled polyester"],
    benefits: ["with a padded laptop compartment", "built for daily commutes", "with a lifetime repair promise"],
  },
  {
    noun: "phone stand",
    adjectives: ["Adjustable", "Compact", "Weighted"],
    materials: ["aluminium", "walnut", "silicone-padded steel"],
    benefits: ["that folds flat for travel", "angled for video calls", "that works with most cases"],
  },
];

const MEMO = {
  lead: ["Payment for", "Reimbursement:", "Refund for", "Deposit for", "Transfer for", "Monthly fee:", "Adjustment:", "Invoice settlement:"],
  subject: [
    "March consulting hours",
    "team offsite travel",
    "office supplies order",
    "Q2 support retainer",
    "conference registration",
    "software licence renewal",
    "catering for client workshop",
    "courier and shipping costs",
    "equipment rental",
    "annual maintenance plan",
  ],
};

const SENTENCE = {
  subject: ["Customer", "Account manager", "Support agent", "Warehouse team", "Finance", "The client", "Our partner", "Operations"],
  verb: ["requested", "confirmed", "flagged", "approved", "scheduled", "reported", "updated", "reviewed"],
  object: [
    "a follow-up call about delivery times",
    "the revised quote for next quarter",
    "a duplicate charge on the last invoice",
    "the change to the shipping address",
    "an extension to the trial period",
    "the missing item from the order",
    "the new onboarding checklist",
    "a callback before Friday",
  ],
};

export function synthesizeText(kind: TextKind, rng: Rng): string {
  switch (kind) {
    case "product": {
      const p = rng.pick(PRODUCTS);
      return `${rng.pick(p.adjectives)} ${rng.pick(p.materials)} ${p.noun} ${rng.pick(p.benefits)}.`;
    }
    case "memo":
      return `${rng.pick(MEMO.lead)} ${rng.pick(MEMO.subject)}`;
    case "sentence":
      return `${rng.pick(SENTENCE.subject)} ${rng.pick(SENTENCE.verb)} ${rng.pick(SENTENCE.object)}.`;
  }
}

/** A pool of distinct texts, in the same shape an AI provider returns. */
export function synthesizeTextPool(kind: TextKind, count: number, rng: Rng): string[] {
  const out = new Set<string>();
  let attempts = 0;
  while (out.size < count && attempts < count * 20) {
    out.add(synthesizeText(kind, rng));
    attempts++;
  }
  return [...out];
}
