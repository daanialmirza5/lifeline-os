import { AIProvider, CompletionRequest, CompletionResult, ProviderError, withTimeout } from "../provider";

const DEFAULT_MODEL = "claude-sonnet-5";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(private apiKey: string | undefined = process.env.ANTHROPIC_API_KEY) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new ProviderError(this.name, "ANTHROPIC_API_KEY is not configured");
    }

    const call = fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: request.maxTokens ?? 1024,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
      }),
    });

    const res = await withTimeout(call, request.timeoutMs ?? 15000, this.name);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(this.name, `HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      model?: string;
    };
    const text = json.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new ProviderError(this.name, "Response contained no text content");

    return { text, provider: this.name, model: json.model ?? DEFAULT_MODEL };
  }
}
