import { fallbackProvider } from "./fallback";
import { REQUEST_SCHEMAS, type AiResponse, type AiTask, type AiTaskMap } from "./schemas";

/** Slightly above the server's 8 s provider timeout so the server can fall back first. */
const CLIENT_TIMEOUT_MS = 10_000;

const cache = new Map<string, AiResponse<unknown>>();

function runFallback<T extends AiTask>(task: T, request: AiTaskMap[T]["request"]): Promise<AiTaskMap[T]["result"]> {
  switch (task) {
    case "infer-schema":
      return fallbackProvider.inferSchema(request as AiTaskMap["infer-schema"]["request"]) as Promise<AiTaskMap[T]["result"]>;
    case "synthesize-text":
      return fallbackProvider.synthesizeText(request as AiTaskMap["synthesize-text"]["request"]) as Promise<AiTaskMap[T]["result"]>;
    default:
      return fallbackProvider.proposeEdgeCases(request as AiTaskMap["edge-cases"]["request"]) as Promise<AiTaskMap[T]["result"]>;
  }
}

export class AiInputError extends Error {}

/**
 * Calls an AI route. Never hangs and never fails for availability reasons:
 * network errors, timeouts, rate limits and server errors all fall back to the
 * rule-based provider in the browser. Only invalid input raises AiInputError.
 */
export async function callAi<T extends AiTask>(task: T, request: AiTaskMap[T]["request"]): Promise<AiResponse<AiTaskMap[T]["result"]>> {
  const valid = REQUEST_SCHEMAS[task].safeParse(request);
  if (!valid.success) throw new AiInputError(valid.error.issues[0]?.message ?? "Invalid input.");

  const key = `${task}|${JSON.stringify(request)}`;
  const cached = cache.get(key) as AiResponse<AiTaskMap[T]["result"]> | undefined;
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let notice = "The AI service could not be reached, so built-in rules were used instead.";
  try {
    const res = await fetch(`/api/ai/${task}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (res.ok) {
      const body = (await res.json()) as AiResponse<AiTaskMap[T]["result"]>;
      if (body.provider === "gemini") cache.set(key, body);
      return body;
    }
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 400 || res.status === 413 || res.status === 422) {
      throw new AiInputError(payload?.error ?? "The AI could not process this input.");
    }
    notice =
      res.status === 429
        ? "You're sending AI requests quickly, so built-in rules were used for this one."
        : "The AI service had a problem, so built-in rules were used instead.";
  } catch (error) {
    if (error instanceof AiInputError) throw error;
    if (controller.signal.aborted) notice = "The AI took too long, so built-in rules were used instead.";
  } finally {
    clearTimeout(timer);
  }

  try {
    return { provider: "fallback", notice, data: await runFallback(task, request) };
  } catch (error) {
    throw new AiInputError(error instanceof Error ? error.message : "Could not process this input.");
  }
}

export async function fetchAiStatus(): Promise<{ configured: boolean; model: string } | null> {
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as { configured: boolean; model: string }) : null;
  } catch {
    return null;
  }
}
