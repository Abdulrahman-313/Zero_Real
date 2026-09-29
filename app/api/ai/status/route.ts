import { aiStatus } from "@/lib/ai/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether a Gemini key is configured (never exposes the key itself). */
export function GET() {
  return Response.json(aiStatus(), { headers: { "Cache-Control": "no-store" } });
}
