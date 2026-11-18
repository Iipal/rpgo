import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  validateConcept,
  validateGenerated,
} from "../apps/server/src/application/generation-validation";
import type { EventConcept, GeneratedEvent } from "../packages/contracts/src";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;

beforeEach(() => {
  harness = createTestService();
});

afterEach(() => {
  harness.close();
});

function concept(overrides: Partial<EventConcept> = {}): EventConcept {
  return {
    type: "scout",
    category: "opportunity",
    title: "The Reed-Light Path",
    hook: "Something glints between the reeds where no path is marked.",
    regionId: "greenreach",
    difficultyBand: "easy",
    objectiveKind: "discover_location",
    expiresInWorldTurns: 3,
    ...overrides,
  };
}

function generated(overrides: Partial<GeneratedEvent> = {}): GeneratedEvent {
  return {
    title: "The Reed-Light Path",
    description: "A lantern glow leads the company off the old road and into the marsh reeds.",
    introduction:
      "The company follows a flicker of light between the reeds. The ground is soft, and the air smells of iron and rain.",
    objectives: [
      {
        kind: "discover_location",
        description: "Chart the reed path.",
        targetCount: 1,
      },
    ],
    encounters: [],
    rewardIntent: [{ kind: "gold", target: "party" }],
    completionText: "The company returns with a new route marked on the guild map.",
    failureText: "The reeds close over the trail. The company withdraws without a new route.",
    ...overrides,
  };
}

describe("model output validation", () => {
  test("accepts a coherent concept and normalizes its location and expiry", () => {
    const result = validateConcept(harness.repo, concept(), "opportunity", 4, 1);
    expect(result.error).toBeUndefined();
    expect(result.concept?.locationId).toBe("thornbury");
    expect(result.concept?.expiresOnTurn).toBe(7);
    expect(result.concept?.targetLocationId).toBeTruthy();
  });

  test("rejects unknown regions, wrong categories and impossible objectives", () => {
    expect(
      validateConcept(harness.repo, concept({ regionId: "moon_palace" }), "opportunity", 1, 1)
        .error,
    ).toContain("unknown region");
    expect(validateConcept(harness.repo, concept(), "storyline", 1, 1).error).toContain(
      "expected category",
    );
    expect(
      validateConcept(
        harness.repo,
        concept({ type: "scout", objectiveKind: "defeat_enemies" }),
        "opportunity",
        1,
        1,
      ).error,
    ).toContain("does not match");
    expect(
      validateConcept(harness.repo, concept({ regionId: "ashen_march" }), "opportunity", 1, 1)
        .error,
    ).toContain("locked");
  });

  test("rejects duplicate titles from the active board", () => {
    const result = validateConcept(
      harness.repo,
      concept({ title: "Beneath the Whispering Wood", category: "storyline" }),
      "storyline",
      1,
      1,
    );
    expect(result.error).toContain("duplicate");
  });

  test("clamps an excessive difficulty band for a level-one party", () => {
    const result = validateConcept(
      harness.repo,
      concept({ difficultyBand: "hard" }),
      "opportunity",
      1,
      1,
    );
    expect(result.concept?.difficultyBand).toBe("normal");
  });

  test("accepts a valid non-combat generated event", () => {
    const normalized = validateConcept(harness.repo, concept(), "opportunity", 1, 1).concept;
    if (!normalized) throw new Error("concept should normalize");
    expect(validateGenerated(generated(), normalized).error).toBeUndefined();
  });

  test("rejects unknown enemies, illegal behaviours and combat for a scout", () => {
    const dungeon = validateConcept(
      harness.repo,
      concept({
        type: "dungeon",
        title: "The Sunken Chapel",
        objectiveKind: "defeat_enemies",
        difficultyBand: "normal",
      }),
      "opportunity",
      1,
      1,
    ).concept;
    if (!dungeon) throw new Error("concept should normalize");

    const combat = generated({
      objectives: [{ kind: "defeat_enemies", description: "Clear the chapel.", targetCount: 1 }],
      encounters: [
        {
          title: "Chapel nave",
          description: "Something moves beneath the flooded pews.",
          enemies: [{ templateId: "moon_knight", count: 2, behaviorId: "enemy_brute" }],
        },
      ],
    });
    expect(validateGenerated(combat, dungeon).error).toContain("unknown enemy template");

    const badBehavior = generated({
      objectives: [{ kind: "defeat_enemies", description: "Clear the chapel.", targetCount: 1 }],
      encounters: [
        {
          title: "Chapel nave",
          description: "Something moves beneath the flooded pews.",
          enemies: [{ templateId: "forest_wolf", count: 2, behaviorId: "party_warrior" }],
        },
      ],
    });
    expect(validateGenerated(badBehavior, dungeon).error).toContain("unknown behavior");

    const scoutWithCombat = validateConcept(harness.repo, concept(), "opportunity", 1, 1).concept;
    if (!scoutWithCombat) throw new Error("concept should normalize");
    expect(
      validateGenerated(
        generated({
          encounters: [
            {
              title: "Reed ambush",
              description: "Wolves wait in the shallows.",
              enemies: [{ templateId: "forest_wolf", count: 1, behaviorId: "enemy_skirmisher" }],
            },
          ],
        }),
        scoutWithCombat,
      ).error,
    ).toContain("too many encounters");
  });

  test("rejects too many encounters for an attack", () => {
    const attack = validateConcept(
      harness.repo,
      concept({
        type: "attack",
        title: "The Ford Ambush",
        objectiveKind: "defeat_enemies",
        difficultyBand: "normal",
      }),
      "opportunity",
      1,
      1,
    ).concept;
    if (!attack) throw new Error("concept should normalize");
    const two = generated({
      objectives: [{ kind: "defeat_enemies", description: "Break the ambush.", targetCount: 2 }],
      encounters: [
        {
          title: "Ford",
          description: "Bandits hold the crossing.",
          enemies: [{ templateId: "bandit_thug", count: 1, behaviorId: "enemy_brute" }],
        },
        {
          title: "Camp",
          description: "The camp lies beyond the ford.",
          enemies: [{ templateId: "bandit_archer", count: 1, behaviorId: "enemy_skirmisher" }],
        },
      ],
    });
    expect(validateGenerated(two, attack).error).toContain("too many encounters");
  });
});
