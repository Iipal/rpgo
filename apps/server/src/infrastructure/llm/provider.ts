export interface StructuredGenerationRequest {
  task: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  temperature?: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface StructuredGenerationResponse {
  text: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  latencyMs: number;
}

export interface LlmProvider {
  readonly model: string;
  generateStructured(request: StructuredGenerationRequest): Promise<StructuredGenerationResponse>;
  health(): Promise<boolean>;
}
