import { z } from "zod";
import { AIProvider, CompletionResult } from "./provider";
import { MockProvider } from "./providers/mock";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { GoogleProvider } from "./providers/google";
import { buildStructuredPrompt, safeParseJson } from "./prompt";

const mock = new MockProvider();
const anthropic = new AnthropicProvider();
const openai = new OpenAIProvider();
const google = new GoogleProvider();

function preferredProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  switch (configured) {
    case "anthropic":
      return anthropic;
    case "openai":
      return openai;
    case "google":
      return google;
    default:
      return mock;
  }
}

/** Provider fallback chain (spec section 34): preferred -> other configured providers -> mock. */
function fallbackChain(): AIProvider[] {
  const preferred = preferredProvider();
  const rest = [anthropic, openai, google].filter((p) => p !== preferred && p.isConfigured);
  return [preferred, ...rest, mock];
}

export interface RunAgentOptions<T> {
  task: string;
  instructions: string;
  data: Record<string, unknown>;
  schema: z.ZodType<T>;
  fallback: T;
}

export interface AgentRunResult<T> {
  output: T;
  usedFallback: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
}

/**
 * Runs one agent task through the provider fallback chain, validating
 * output against `schema`. If every provider fails, or a response can't
 * be parsed as valid JSON matching `schema`, returns `fallback` with
 * `usedFallback: true` rather than letting malformed AI output reach a
 * caller (spec section 33/34) — this function never throws.
 */
export async function runAgent<T>(options: RunAgentOptions<T>): Promise<AgentRunResult<T>> {
  const { system, prompt } = buildStructuredPrompt({
    task: options.task,
    instructions: options.instructions,
    data: options.data,
  });

  const chain = fallbackChain();
  const start = Date.now();
  let lastError: string | undefined;

  for (const provider of chain) {
    if (!provider.isConfigured) continue;
    let result: CompletionResult;
    try {
      result = await provider.complete({ system, prompt });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logAIEvent({ task: options.task, provider: provider.name, success: false, error: lastError });
      continue;
    }

    const parsed = safeParseJson(result.text, options.schema);
    if (parsed) {
      logAIEvent({
        task: options.task,
        provider: provider.name,
        model: result.model,
        success: true,
        latencyMs: Date.now() - start,
      });
      return {
        output: parsed,
        usedFallback: false,
        provider: result.provider,
        model: result.model,
        latencyMs: Date.now() - start,
      };
    }

    lastError = `${provider.name} returned output that failed schema validation`;
    logAIEvent({ task: options.task, provider: provider.name, success: false, error: lastError });
  }

  // Every provider failed or returned unvalidatable output — never
  // propagate malformed AI output; always fall back to a safe default.
  return {
    output: options.fallback,
    usedFallback: true,
    provider: "none",
    model: "none",
    latencyMs: Date.now() - start,
    error: lastError,
  };
}

export interface AIEventLog {
  task: string;
  provider: string;
  model?: string;
  success: boolean;
  latencyMs?: number;
  error?: string;
}

const recentAIEvents: (AIEventLog & { at: string })[] = [];

function logAIEvent(event: AIEventLog) {
  recentAIEvents.unshift({ ...event, at: new Date().toISOString() });
  if (recentAIEvents.length > 200) recentAIEvents.length = 200;
  // Structured console log per spec section 32 (model/provider/task/latency/success).
  console.log("[ai]", JSON.stringify(event));
}

/** In-memory recent AI call log for the observability page. Not durable across restarts. */
export function getRecentAIEvents() {
  return recentAIEvents;
}
