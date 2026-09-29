import "server-only";
import { clientKey, RateLimiter } from "./rateLimit";
import { MAX_BODY_BYTES, REQUEST_SCHEMAS, type AiTask, type AiTaskMap } from "./schemas";
import { runAiTask } from "./service";

/** 8 requests per minute per client, bursting to 8 — below the free-tier project quota. */
const limiter = new RateLimiter(8, 8);

function error(status: number, message: string, headers?: Record<string, string>): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Builds a POST handler for one AI task: size cap → JSON → zod → rate limit → cached AI with fallback. */
export function createAiHandler<T extends AiTask>(task: T) {
  return async function POST(request: Request): Promise<Response> {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) return error(413, `Request is too large (max ${MAX_BODY_BYTES / 1024} KB).`);

    let text: string;
    try {
      text = await request.text();
    } catch {
      return error(400, "Could not read the request body.");
    }
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, `Request is too large (max ${MAX_BODY_BYTES / 1024} KB).`);

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return error(400, "Request body must be valid JSON.");
    }

    const parsed = REQUEST_SCHEMAS[task].safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error(400, issue?.message ?? "Invalid request.");
    }

    const retryAfter = limiter.take(clientKey(request.headers));
    if (retryAfter > 0) {
      return error(429, `Too many AI requests. Try again in ${retryAfter}s.`, { "Retry-After": String(retryAfter) });
    }

    try {
      const result = await runAiTask(task, parsed.data as AiTaskMap[T]["request"]);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      // Only reachable for input the rule-based provider rejects (e.g. an unparseable sample).
      return error(422, e instanceof Error ? e.message : "Could not process this request.");
    }
  };
}
