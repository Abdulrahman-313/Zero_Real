import "server-only";
import { ApiError } from "@google/genai";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { LruCache } from "./cache";
import { fallbackProvider } from "./fallback";
import { AiTimeoutError, createGeminiProvider } from "./gemini";
import type { AiProvider, AiResponse, AiTask, AiTaskMap } from "./schemas";

/** Default model; override with GEMINI_MODEL. Free-tier eligible per Google's model docs. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const cache = new LruCache<AiResponse<unknown>>(200, 60 * 60 * 1000);
let geminiProvider: { key: string; model: string; provider: AiProvider } | null = null;

export function aiStatus(): { configured: boolean; model: string } {
  return { configured: Boolean(process.env.GEMINI_API_KEY?.trim()), model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL };
}

function getGemini(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!geminiProvider || geminiProvider.key !== key || geminiProvider.model !== model) {
    geminiProvider = { key, model, provider: createGeminiProvider(key, model) };
  }
  return geminiProvider.provider;
}

function run<T extends AiTask>(provider: AiProvider, task: T, request: AiTaskMap[T]["request"]): Promise<AiTaskMap[T]["result"]> {
  switch (task) {
    case "infer-schema":
      return provider.inferSchema(request as AiTaskMap["infer-schema"]["request"]) as Promise<AiTaskMap[T]["result"]>;
    case "synthesize-text":
      return provider.synthesizeText(request as AiTaskMap["synthesize-text"]["request"]) as Promise<AiTaskMap[T]["result"]>;
    case "edge-cases":
      return provider.proposeEdgeCases(request as AiTaskMap["edge-cases"]["request"]) as Promise<AiTaskMap[T]["result"]>;
    default:
      throw new Error(`Unknown AI task ${String(task)}`);
  }
}

export function fallbackNotice(error: unknown): string {
  if (error instanceof AiTimeoutError) return "The AI took too long, so built-in rules were used instead.";
  if (error instanceof ApiError && error.status === 429) return "The free AI quota is busy right now, so built-in rules were used instead.";
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return "The AI key was rejected, so built-in rules were used instead.";
  if (error instanceof ApiError && error.status === 404) return "The configured AI model is unavailable, so built-in rules were used instead.";
  return "The AI was unavailable, so built-in rules were used instead.";
}

/**
 * Runs an AI task with caching and automatic fallback. Never throws for provider
 * failures: any error, timeout, 429 or missing key yields the rule-based result
 * plus a friendly notice. Only invalid input (from the fallback itself) throws.
 */
export async function runAiTask<T extends AiTask>(task: T, request: AiTaskMap[T]["request"]): Promise<AiResponse<AiTaskMap[T]["result"]>> {
  const gemini = getGemini();
  const cacheKey = bytesToHex(sha256(utf8ToBytes(`${task}|${gemini ? aiStatus().model : "fallback"}|${JSON.stringify(request)}`)));
  const cached = cache.get(cacheKey) as AiResponse<AiTaskMap[T]["result"]> | undefined;
  if (cached) return cached;

  if (!gemini) {
    const data = await run(fallbackProvider, task, request);
    const response = { provider: "fallback" as const, notice: "No AI key is configured, so built-in rules were used.", data };
    cache.set(cacheKey, response);
    return response;
  }

  try {
    const data = await run(gemini, task, request);
    const response = { provider: "gemini" as const, data };
    cache.set(cacheKey, response);
    return response;
  } catch (error) {
    console.warn(`[ai] ${task} fell back to rules:`, error instanceof Error ? `${error.name}: ${error.message}` : error);
    const data = await run(fallbackProvider, task, request);
    // Fallback results after transient errors are not cached, so the AI is retried next time.
    return { provider: "fallback", notice: fallbackNotice(error), data };
  }
}
