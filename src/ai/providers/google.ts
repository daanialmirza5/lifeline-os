import { AIProvider, CompletionRequest, CompletionResult, ProviderError, withTimeout } from "../provider";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GoogleProvider implements AIProvider {
  readonly name = "google";

  constructor(private apiKey: string | undefined = process.env.GOOGLE_API_KEY) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new ProviderError(this.name, "GOOGLE_API_KEY is not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${this.apiKey}`;
    const call = fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: { maxOutputTokens: request.maxTokens ?? 1024 },
      }),
    });

    const res = await withTimeout(call, request.timeoutMs ?? 15000, this.name);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(this.name, `HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new ProviderError(this.name, "Response contained no candidate text");

    return { text, provider: this.name, model: DEFAULT_MODEL };
  }
}
