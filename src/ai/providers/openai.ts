import { AIProvider, CompletionRequest, CompletionResult, ProviderError, withTimeout } from "../provider";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(private apiKey: string | undefined = process.env.OPENAI_API_KEY) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new ProviderError(this.name, "OPENAI_API_KEY is not configured");
    }

    const call = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: request.maxTokens ?? 1024,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      }),
    });

    const res = await withTimeout(call, request.timeoutMs ?? 15000, this.name);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(this.name, `HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError(this.name, "Response contained no message content");

    return { text, provider: this.name, model: json.model ?? DEFAULT_MODEL };
  }
}
