import type { LlmConfig } from "../../config";
import { LlmUnavailableError } from "../../domain/errors";
import type {
  LlmProvider,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
} from "./provider";

const MAX_RESPONSE_BYTES = 200_000;

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly model: string;
  private cachedHealth: { value: boolean; at: number } | null = null;

  constructor(private readonly config: LlmConfig) {
    this.model = config.model;
  }

  async generateStructured(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResponse> {
    let lastError: Error | null = null;
    const attempts = this.config.maxRetries + 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.request(request, true);
      } catch (error) {
        lastError = error as Error;
        if (error instanceof LlmUnavailableError && error.kind === "timeout") throw error;
        if (error instanceof LlmUnavailableError && error.kind === "refused") throw error;
        if (attempt < attempts - 1) continue;
      }
    }
    throw lastError ?? new LlmUnavailableError("LLM request failed");
  }

  private async request(
    request: StructuredGenerationRequest,
    jsonMode: boolean,
  ): Promise<StructuredGenerationResponse> {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxOutputTokens,
        stream: false,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 400 && jsonMode) {
        // Some local servers reject response_format. Retry once without it.
        clearTimeout(timeout);
        return await this.request(request, false);
      }
      if (!response.ok) {
        const text = await response.text();
        throw new LlmUnavailableError(
          `LLM server returned ${response.status}: ${text.slice(0, 300)}`,
          response.status >= 500 ? "unavailable" : "refused",
        );
      }
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_BYTES) {
        throw new LlmUnavailableError("LLM response exceeded size limit", "invalid_response");
      }
      let parsed: ChatCompletionResponse;
      try {
        parsed = JSON.parse(raw) as ChatCompletionResponse;
      } catch {
        throw new LlmUnavailableError("LLM server returned non-JSON envelope", "invalid_response");
      }
      const content = parsed.choices?.[0]?.message?.content;
      const text = Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("")
        : (content ?? "");
      if (!text.trim()) {
        throw new LlmUnavailableError("LLM returned an empty response", "invalid_response");
      }
      return {
        text,
        model: parsed.model ?? this.config.model,
        usage: {
          inputTokens: parsed.usage?.prompt_tokens,
          outputTokens: parsed.usage?.completion_tokens,
        },
        latencyMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      if (error instanceof LlmUnavailableError) throw error;
      if ((error as Error).name === "AbortError" || (error as Error).name === "TimeoutError") {
        throw new LlmUnavailableError(
          `LLM request timed out after ${request.timeoutMs}ms`,
          "timeout",
        );
      }
      throw new LlmUnavailableError(
        `Could not reach LLM server: ${(error as Error).message}`,
        "unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedHealth && now - this.cachedHealth.at < 20_000) return this.cachedHealth.value;
    if (!this.config.enabled) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(3000),
      });
      const value = response.ok;
      this.cachedHealth = { value, at: now };
      return value;
    } catch {
      this.cachedHealth = { value: false, at: now };
      return false;
    }
  }
}

export class DisabledLlmProvider implements LlmProvider {
  readonly model: string;
  constructor(model = "disabled") {
    this.model = model;
  }
  async generateStructured(): Promise<StructuredGenerationResponse> {
    throw new LlmUnavailableError("LLM is disabled by configuration", "unavailable");
  }
  async health(): Promise<boolean> {
    return false;
  }
}
