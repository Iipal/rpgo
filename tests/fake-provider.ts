import type {
  LlmProvider,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
} from "../apps/server/src/infrastructure/llm/provider";

export type FakeHandler = (
  request: StructuredGenerationRequest,
  call: number,
) => StructuredGenerationResponse | Promise<StructuredGenerationResponse>;

/**
 * Deterministic provider used to exercise generation orchestration without a
 * local model server. Every call is recorded so tests can assert prompts,
 * retry counts, and timeout configuration.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly model: string;
  readonly calls: StructuredGenerationRequest[] = [];

  constructor(
    private readonly handler: FakeHandler,
    model = "fake-model",
  ) {
    this.model = model;
  }

  async generateStructured(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResponse> {
    this.calls.push(request);
    return this.handler(request, this.calls.length);
  }

  async health(): Promise<boolean> {
    return true;
  }
}

export function fakeResponse(
  text: string,
  overrides: Partial<StructuredGenerationResponse> = {},
): StructuredGenerationResponse {
  return { text, model: "fake-model", latencyMs: 5, ...overrides };
}
