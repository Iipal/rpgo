import { describe, expect, test } from "bun:test";
import { buildParty } from "../apps/server/src/application/mappers";
import { FakeLlmProvider, fakeResponse } from "./fake-provider";
import { createTestService } from "./helpers";

const concept = {
  type: "dungeon",
  category: "storyline",
  title: "The Sunken Chapel",
  hook: "Bells ring under the marsh at every midnight.",
  regionId: "greenreach",
  locationId: "whispering_wood",
  difficultyBand: "normal",
  objectiveKind: "defeat_enemies",
  storylineKey: "sunken_chapel",
};

const generatedEvent = {
  title: "The Sunken Chapel",
  description: "A drowned chapel waits beneath the marsh, its bell still swinging.",
  introduction: "The company follows the bell into the reeds and finds a stair beneath the water.",
  objectives: [
    {
      kind: "defeat_enemies",
      description: "Silence the chapel bell.",
      targetCount: 1,
    },
  ],
  encounters: [
    {
      title: "The flooded nave",
      description: "A pale shape moves between the pews.",
      enemies: [{ templateId: "goblin_brute", count: 1, behaviorId: "enemy_brute" }],
    },
  ],
  rewardIntent: [{ kind: "gold", target: "party" }],
  completionText: "The bell falls silent and the marsh settles.",
  failureText: "The company retreats with the bell still ringing behind them.",
};

function narrativeProvider(text: string) {
  return new FakeLlmProvider((request) => {
    if (request.task === "event_director") return fakeResponse(JSON.stringify(concept));
    if (request.task === "event_generator") return fakeResponse(JSON.stringify(generatedEvent));
    if (request.task === "narrative_generator") {
      return fakeResponse(JSON.stringify({ text }));
    }
    throw new Error(`Unexpected task ${request.task}`);
  });
}

async function waitFor(check: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for narrative");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("narrative enrichment", () => {
  test("generated events receive teaser and introduction text after refresh", async () => {
    const text = "A cold bell sounds once beneath the marsh and is answered by nothing.";
    const provider = narrativeProvider(text);
    const harness = createTestService({ llmEnabled: true, provider });
    try {
      const world = harness.repo.getWorld();
      const partyRow = harness.repo.getParty();
      if (!world || !partyRow) throw new Error("Seed failed");

      await harness.board.refresh(world, buildParty(harness.repo, partyRow), "corr-narrative");
      const generated = harness.repo
        .getVisibleBoard(world.id)
        .find((event) => event.source === "generated");
      expect(generated).toBeDefined();

      await waitFor(() => harness.repo.getEvent(generated?.id ?? "")?.hook === text);
      const stored = harness.repo.getEvent(generated?.id ?? "");
      expect(stored?.introduction).toBe(text);
      expect(provider.calls.filter((call) => call.task === "narrative_generator")).toHaveLength(2);
    } finally {
      harness.close();
    }
  });

  test("fallback refresh with generation disabled keeps authored narrative", () => {
    const harness = createTestService({ llmEnabled: false });
    try {
      const world = harness.repo.getWorld();
      const partyRow = harness.repo.getParty();
      if (!world || !partyRow) throw new Error("Seed failed");
      const before = harness.repo
        .getVisibleBoard(world.id)
        .map((event) => ({ id: event.id, hook: event.hook }));

      harness.board.refreshFallback(world, buildParty(harness.repo, partyRow));

      for (const { id, hook } of before) {
        expect(harness.repo.getEvent(id)?.hook).toBe(hook);
      }
    } finally {
      harness.close();
    }
  });
});
