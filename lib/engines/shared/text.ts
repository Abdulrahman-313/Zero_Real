import type { Rng } from "./rng";

/**
 * Rule-based free-text synthesis. Used when no AI text pool is available,
 * and by the AI fallback provider.
 */

export const TEXT_KINDS = ["product", "memo", "sentence"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

const PRODUCT = {
  adjective: ["Hand-stitched", "Lightweight", "Recycled", "Compact", "Heavy-duty", "Minimalist", "Water-resistant", "Insulated", "Modular", "Everyday"],
  material: ["canvas", "oak", "stainless steel", "merino wool", "ceramic", "bamboo", "aluminium", "linen", "leather", "cork"],
  noun: ["tote bag", "desk organiser", "water bottle", "travel mug", "notebook cover", "laptop sleeve", "plant pot", "lunch box", "phone stand", "backpack"],
  benefit: [
    "built for daily commutes",
    "that keeps drinks cold for 24 hours",
    "with a reinforced base",
    "designed to fit a 14-inch laptop",
    "that folds flat for storage",
    "finished with a soft-touch coating",
    "made to last for years",
    "with a lifetime repair promise",
    "that is dishwasher safe",
    "sized for small desks",
  ],
};

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
    case "product":
      return `${rng.pick(PRODUCT.adjective)} ${rng.pick(PRODUCT.material)} ${rng.pick(PRODUCT.noun)} ${rng.pick(PRODUCT.benefit)}.`;
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
