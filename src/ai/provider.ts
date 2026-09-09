/**
 * Provider abstraction. Every provider (mock, Anthropic, OpenAI, Google)
 * implements this same narrow interface: take a system prompt + user
 * prompt, return plain text. Agents are responsible for parsing/validating
 * that text against a schema — the provider itself never touches
 * healthcare workflow state.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Hard timeout in ms before this provider is considered failed. */
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
