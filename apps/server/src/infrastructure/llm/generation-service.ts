import type { ZodType } from "zod";
import type { LlmConfig } from "../../config";
import { LlmUnavailableError } from "../../domain/errors";
import type { Repository } from "../database/repository";
import type { LlmProvider } from "./provider";

export interface GenerationOptions<T> {
  task: string;
  promptVersion: string;
  schemaVersion: string;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  correlationId: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface GenerationResult<T> {
  data: T;
  generationId: string;
  model: string;
}

function sanitize(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip control characters from model output before it is stored or rendered
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 4000);
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) return candidate.slice(first, last + 1);
  return candidate;
}

function attemptParse<T>(text: string, schema: ZodType<T>): { data: T } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return { error: "invalid_json" };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      error: `schema_mismatch: ${result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")}`,
    };
  }
  return { data: result.data };
}

/**
 * Generation is deliberately outside database transactions. Every attempt is
 * recorded with model, prompt/schema version, latency, and outcome.
 */
export class GenerationService {
  constructor(
    private readonly provider: LlmProvider,
    private readonly repo: Repository,
    private readonly config: LlmConfig,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  async generate<T>(options: GenerationOptions<T>): Promise<GenerationResult<T> | null> {
    if (!this.config.enabled) return null;
    const maxAttempts = Math.min(2, Math.max(1, options.maxAttempts ?? 2));

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const started = performance.now();
      try {
        const response = await this.provider.generateStructured({
          task: options.task,
          systemPrompt: options.systemPrompt,
          userPrompt: options.userPrompt,
          schemaName: options.schemaName,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens ?? this.config.maxOutputTokens,
          timeoutMs: options.timeoutMs ?? this.config.timeoutMs,
        });
        const parsed = attemptParse(response.text, options.schema);
        const generationId = crypto.randomUUID();
        if ("error" in parsed) {
          this.record({
            id: generationId,
            task: options.task,
            model: response.model,
            promptVersion: options.promptVersion,
            schemaVersion: options.schemaVersion,
            status: "invalid",
            errorCode: parsed.error.split(":")[0] ?? "invalid",
            latencyMs: response.latencyMs,
            inputTokens: response.usage?.inputTokens ?? null,
            outputTokens: response.usage?.outputTokens ?? null,
            responseText: sanitize(response.text),
            correlationId: options.correlationId,
          });
          continue;
        }
        this.record({
          id: generationId,
          task: options.task,
          model: response.model,
          promptVersion: options.promptVersion,
          schemaVersion: options.schemaVersion,
          status: "success",
          errorCode: null,
          latencyMs: response.latencyMs,
          inputTokens: response.usage?.inputTokens ?? null,
          outputTokens: response.usage?.outputTokens ?? null,
          responseText: this.config.debug ? sanitize(response.text) : null,
          correlationId: options.correlationId,
        });
        return { data: parsed.data, generationId, model: response.model };
      } catch (error) {
        const latency = Math.round(performance.now() - started);
        const unavailable =
          error instanceof LlmUnavailableError
            ? error
            : new LlmUnavailableError((error as Error).message, "unavailable");
        const status =
          unavailable.kind === "timeout"
            ? "timeout"
            : unavailable.kind === "refused"
              ? "refused"
              : unavailable.kind === "invalid_response"
                ? "invalid"
                : "unavailable";
        this.record({
          id: crypto.randomUUID(),
          task: options.task,
          model: this.provider.model,
          promptVersion: options.promptVersion,
          schemaVersion: options.schemaVersion,
          status,
          errorCode: unavailable.kind,
          latencyMs: latency,
          inputTokens: null,
          outputTokens: null,
          responseText: null,
          correlationId: options.correlationId,
        });
        if (unavailable.kind === "invalid_response" && attempt < maxAttempts - 1) continue;
        return null;
      }
    }
    return null;
  }

  private record(row: {
    id: string;
    task: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    status: "success" | "invalid" | "timeout" | "unavailable" | "refused";
    errorCode: string | null;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    responseText: string | null;
    correlationId: string;
  }): void {
    this.repo.insertGeneration({
      id: row.id,
      task: row.task,
      model: row.model,
      prompt_version: row.promptVersion,
      schema_version: row.schemaVersion,
      status: row.status,
      error_code: row.errorCode,
      latency_ms: row.latencyMs,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      response_text: row.responseText,
      correlation_id: row.correlationId,
      created_at: new Date().toISOString(),
    });
  }

  async checkHealth(): Promise<boolean> {
    if (!this.config.enabled) return false;
    return this.provider.health();
  }
}
