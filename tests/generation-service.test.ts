import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { LlmUnavailableError } from "../apps/server/src/domain/errors";
import {
  type GenerationOptions,
  GenerationService,
} from "../apps/server/src/infrastructure/llm/generation-service";
import { NarrativeResponseSchema } from "../packages/contracts/src";
import { FakeLlmProvider, fakeResponse } from "./fake-provider";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;

beforeEach(() => {
  harness = createTestService();
});

afterEach(() => {
  harness.close();
});

function options(overrides: Partial<GenerationOptions<unknown>> = {}) {
  return {
    task: "narrative_generator",
    promptVersion: "narrative-generator@test",
    schemaVersion: "NarrativeResponse@test",
    schemaName: "NarrativeResponse",
    systemPrompt: "system",
    userPrompt: "user",
    schema: NarrativeResponseSchema,
    correlationId: "corr-test",
    maxAttempts: 2,
    ...overrides,
  } as GenerationOptions<{ text: string }>;
}

function service(provider: FakeLlmProvider, enabled = true): GenerationService {
  return new GenerationService(provider, harness.repo, { ...harness.config.llm, enabled });
}

describe("generation service", () => {
  test("returns validated data and records generation metadata", async () => {
    const provider = new FakeLlmProvider(() => fakeResponse('{"text":"A cold wind rises."}'));
    const generation = service(provider);

    const result = await generation.generate(options());

    expect(result?.data.text).toBe("A cold wind rises.");
    expect(result?.model).toBe("fake-model");
    expect(provider.calls).toHaveLength(1);

    const [row] = harness.repo.listGenerations(1);
    expect(row?.status).toBe("success");
    expect(row?.task).toBe("narrative_generator");
    expect(row?.prompt_version).toBe("narrative-generator@test");
    expect(row?.schema_version).toBe("NarrativeResponse@test");
    expect(row?.model).toBe("fake-model");
    expect(row?.correlation_id).toBe("corr-test");
  });

  test("retries once after malformed JSON and records the failed attempt", async () => {
    const provider = new FakeLlmProvider((_request, call) =>
      fakeResponse(call === 1 ? "not json at all" : '{"text":"Recovered."}'),
    );

    const result = await service(provider).generate(options());

    expect(result?.data.text).toBe("Recovered.");
    expect(provider.calls).toHaveLength(2);
    const rows = harness.repo.listGenerations(10);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === "invalid")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "success")).toHaveLength(1);
  });

  test("returns null after exhausting attempts on schema mismatch", async () => {
    const provider = new FakeLlmProvider(() => fakeResponse('{"text":""}'));

    const result = await service(provider).generate(options({ maxAttempts: 1 }));

    expect(result).toBeNull();
    const [row] = harness.repo.listGenerations(1);
    expect(row?.status).toBe("invalid");
    expect(row?.error_code).toBe("schema_mismatch");
  });

  test("does not retry provider timeouts and records the timeout status", async () => {
    let calls = 0;
    const provider = new FakeLlmProvider(() => {
      calls += 1;
      throw new LlmUnavailableError("timed out", "timeout");
    });

    const result = await service(provider).generate(options());

    expect(result).toBeNull();
    expect(calls).toBe(1);
    const [row] = harness.repo.listGenerations(1);
    expect(row?.status).toBe("timeout");
    expect(row?.error_code).toBe("timeout");
  });

  test("records an unavailable provider without throwing", async () => {
    const provider = new FakeLlmProvider(() => {
      throw new LlmUnavailableError("connection refused", "unavailable");
    });

    const result = await service(provider).generate(options());

    expect(result).toBeNull();
    const [row] = harness.repo.listGenerations(1);
    expect(row?.status).toBe("unavailable");
  });

  test("handles oversized and unrelated output without crashing", async () => {
    const provider = new FakeLlmProvider(() => fakeResponse("x".repeat(250_000)));

    const result = await service(provider).generate(options({ maxAttempts: 1 }));

    expect(result).toBeNull();
    const [row] = harness.repo.listGenerations(1);
    expect(row?.status).toBe("invalid");
    expect(row?.response_text?.length ?? 0).toBeLessThanOrEqual(4000);
  });

  test("does nothing when generation is disabled", async () => {
    const provider = new FakeLlmProvider(() => fakeResponse('{"text":"unused"}'));

    const result = await service(provider, false).generate(options());

    expect(result).toBeNull();
    expect(provider.calls).toHaveLength(0);
    expect(harness.repo.listGenerations(1)).toHaveLength(0);
  });

  test("accepts JSON wrapped in a markdown fence", async () => {
    const provider = new FakeLlmProvider(() =>
      fakeResponse('Here you go:\n```json\n{"text":"Fenced."}\n```'),
    );

    const result = await service(provider).generate(options({ maxAttempts: 1 }));

    expect(result?.data.text).toBe("Fenced.");
  });
});
