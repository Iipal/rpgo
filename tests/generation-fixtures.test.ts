import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  validateConcept,
  validateGenerated,
} from "../apps/server/src/application/generation-validation";
import {
  type EventConcept,
  EventConceptSchema,
  type GeneratedEvent,
  GeneratedEventSchema,
  NarrativeResponseSchema,
} from "../packages/contracts/src";
import { createTestService, type TestService } from "./helpers";

interface FixtureCase {
  name: string;
  kind: "concept" | "event" | "narrative";
  expect: "accept" | "reject";
  value: unknown;
  concept?: unknown;
}

interface FixtureFile {
  version: number;
  note: string;
  cases: FixtureCase[];
}

interface EvaluationResult {
  name: string;
  kind: FixtureCase["kind"];
  expected: FixtureCase["expect"];
  actual: "accept" | "reject";
  stage: "schema" | "domain" | "accepted";
  reason: string | null;
}

let harness: TestService;
let fixtures: FixtureFile;

beforeEach(async () => {
  harness = createTestService();
  fixtures = (await Bun.file(
    new URL("./fixtures/generation/cases.json", import.meta.url),
  ).json()) as FixtureFile;
});

afterEach(() => {
  harness.close();
});

function evaluateConcept(value: unknown): EvaluationResult {
  const parsed = EventConceptSchema.safeParse(value);
  if (!parsed.success) {
    return {
      name: "",
      kind: "concept",
      expected: "reject",
      actual: "reject",
      stage: "schema",
      reason: parsed.error.issues[0]?.message ?? "schema mismatch",
    };
  }
  const concept = parsed.data as EventConcept;
  const result = validateConcept(harness.repo, concept, concept.category, 1, 1);
  return {
    name: "",
    kind: "concept",
    expected: "accept",
    actual: result.error ? "reject" : "accept",
    stage: result.error ? "domain" : "accepted",
    reason: result.error ?? null,
  };
}

function evaluateEvent(fixture: FixtureCase): EvaluationResult {
  const parsed = GeneratedEventSchema.safeParse(fixture.value);
  const conceptParsed = EventConceptSchema.safeParse(fixture.concept);
  const schemaError = !parsed.success
    ? (parsed.error.issues[0]?.message ?? "schema mismatch")
    : !conceptParsed.success
      ? (conceptParsed.error.issues[0]?.message ?? "schema mismatch")
      : null;
  if (schemaError || !parsed.success || !conceptParsed.success) {
    return {
      name: fixture.name,
      kind: "event",
      expected: fixture.expect,
      actual: "reject",
      stage: "schema",
      reason: schemaError ?? "schema mismatch",
    };
  }
  const concept = conceptParsed.data as EventConcept;
  const normalized = validateConcept(harness.repo, concept, concept.category, 1, 1).concept;
  if (!normalized) {
    return {
      name: fixture.name,
      kind: "event",
      expected: fixture.expect,
      actual: "reject",
      stage: "domain",
      reason: "concept was rejected",
    };
  }
  const result = validateGenerated(parsed.data as GeneratedEvent, normalized);
  return {
    name: fixture.name,
    kind: "event",
    expected: fixture.expect,
    actual: result.error ? "reject" : "accept",
    stage: result.error ? "domain" : "accepted",
    reason: result.error ?? null,
  };
}

function evaluateNarrative(fixture: FixtureCase): EvaluationResult {
  const parsed = NarrativeResponseSchema.safeParse(fixture.value);
  return {
    name: fixture.name,
    kind: "narrative",
    expected: fixture.expect,
    actual: parsed.success ? "accept" : "reject",
    stage: parsed.success ? "accepted" : "schema",
    reason: parsed.success ? null : (parsed.error.issues[0]?.message ?? "schema mismatch"),
  };
}

function evaluate(fixture: FixtureCase): EvaluationResult {
  const result =
    fixture.kind === "concept"
      ? evaluateConcept(fixture.value)
      : fixture.kind === "event"
        ? evaluateEvent(fixture)
        : evaluateNarrative(fixture);
  return { ...result, name: fixture.name, expected: fixture.expect };
}

describe("generation fixture evaluation", () => {
  test("every fixture matches its expected outcome", () => {
    const results = fixtures.cases.map(evaluate);

    for (const result of results) {
      expect({ name: result.name, actual: result.actual }).toEqual({
        name: result.name,
        actual: result.expected,
      });
    }

    const accepted = results.filter((result) => result.actual === "accept").length;
    const rejected = results.length - accepted;
    console.log(
      JSON.stringify({
        level: "info",
        message: "generation fixture evaluation",
        version: fixtures.version,
        total: results.length,
        acceptanceRate: Number((accepted / results.length).toFixed(2)),
        accepted,
        rejected,
      }),
    );

    expect(fixtures.cases.length).toBeGreaterThanOrEqual(10);
    for (const kind of ["concept", "event", "narrative"] as const) {
      expect(results.some((result) => result.kind === kind && result.actual === "accept")).toBe(
        true,
      );
      expect(results.some((result) => result.kind === kind && result.actual === "reject")).toBe(
        true,
      );
    }
  });

  test("rejects record why they failed", () => {
    const rejected = fixtures.cases.map(evaluate).filter((result) => result.actual === "reject");
    for (const result of rejected) {
      expect(result.reason).toBeTruthy();
    }
  });
});
