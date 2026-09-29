import { createAiHandler } from "@/lib/ai/route";

export const runtime = "nodejs";
export const maxDuration = 15;

export const POST = createAiHandler("infer-schema");
