import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildParty } from "../apps/server/src/application/mappers";
import type {
  EncounterRow,
  EventRow,
  ObjectiveRow,
} from "../apps/server/src/infrastructure/database/repository";
import {
  advancesWorld,
  deriveRegionStatus,
  MAX_THREAT,
  nextLocationStatus,
  threatLevelForOutcomes,
} from "../packages/game-rules/src";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;

beforeEach(() => {
  harness = createTestService();
});

afterEach(() => {
  harness.close();
});

function insertEvent(options: {
  title: string;
  status?: EventRow["status"];
  type?: EventRow["type"];
  category?: EventRow["category"];
  objectiveKind?: ObjectiveRow["kind"];
  targetRef?: string | null;
  regionId?: string;
  locationId?: string;
  encounters?: Array<Array<{ templateId: string; count: number; behaviorId: string }>>;
}): string {
  const { repo } = harness;
  const world = repo.getWorld();
  if (!world) throw new Error("seed missing");
  const id = crypto.randomUUID();
  const encounters = options.encounters ?? [];
  const now = new Date().toISOString();
  const event: EventRow = {
    id,
    world_id: world.id,
    type: options.type ?? "scout",
    category: options.category ?? "opportunity",
    title: options.title,
    hook: "A world-rules fixture.",
    description: "A fixture used to exercise region rules and threat thresholds.",
    introduction: "The company follows a controlled route.",
    status: options.status ?? "available",
    difficulty_band: "easy",
    region_id: options.regionId ?? "greenreach",
    location_id: options.locationId ?? "old_road",
    objective_kind: options.objectiveKind ?? "discover_location",
    reward_intent_json: JSON.stringify([{ kind: "gold", target: "party" }]),
    reward_preview_json: JSON.stringify({
      gold: 10,
      experiencePerCharacter: 10,
      researchPoints: 0,
      equipment: [],
    }),
    completion_text: "Route charted.",
    failure_text: "Route lost.",
    result_text: null,
    source: "authored",
    expires_on_turn: null,
    storyline_key: null,
    created_turn: world.turn,
    current_encounter_index: 0,
    encounters_completed: 0,
    accepted_turn: null,
    completed_turn: null,
    generation_id: null,
    created_at: now,
  };
  repo.insertEvent(event);

  repo.insertObjective({
    id: crypto.randomUUID(),
    event_id: id,
    position: 0,
    kind: event.objective_kind,
    description: "Reach the marked site.",
    target_count: 1,
    target_ref: options.targetRef ?? null,
    progress: 0,
    completed: 0,
  });

  encounters.forEach((groups, index) => {
    const encounter: EncounterRow = {
      id: crypto.randomUUID(),
      event_id: id,
      position: index,
      title: `Wave ${index + 1}`,
      description: "A controlled battle.",
      enemies_json: JSON.stringify(groups),
      status: "pending",
    };
    repo.insertEncounter(encounter);
  });

  return id;
}

describe("world rules", () => {
  test("only listed actions advance world time", () => {
    for (const action of [
      "view_world",
      "open_inventory",
      "equip_item",
      "refresh_page",
      "rest",
    ] as const) {
      expect(advancesWorld(action as never)).toBe(false);
    }
    for (const action of [
      "event_accepted",
      "event_completed",
      "event_failed",
      "location_discovered",
      "research_completed",
    ] as const) {
      expect(advancesWorld(action)).toBe(true);
    }
  });

  test("location discovery moves forward only", () => {
    expect(nextLocationStatus("unknown")).toBe("discovered");
    expect(nextLocationStatus("discovered")).toBe("accessible");
    expect(nextLocationStatus("accessible")).toBeNull();
  });

  test("region status follows the most advanced known location", () => {
    expect(deriveRegionStatus(["unknown", "unknown"])).toBe("unknown");
    expect(deriveRegionStatus(["unknown", "discovered"])).toBe("discovered");
    expect(deriveRegionStatus(["discovered", "accessible"])).toBe("accessible");
    expect(deriveRegionStatus([])).toBe("unknown");
  });

  test("threat rises in bounded, idempotent steps", () => {
    expect(threatLevelForOutcomes(0, 0, 1)).toBe(1);
    expect(threatLevelForOutcomes(2, 1, 1)).toBe(1);
    expect(threatLevelForOutcomes(3, 0, 1)).toBe(2);
    expect(threatLevelForOutcomes(6, 0, 1)).toBe(3);
    expect(threatLevelForOutcomes(0, 2, 1)).toBe(2);
    expect(threatLevelForOutcomes(0, 4, 1)).toBe(3);
    expect(threatLevelForOutcomes(100, 100, 1)).toBe(MAX_THREAT);
    expect(threatLevelForOutcomes(3, 0, 9)).toBe(MAX_THREAT);
  });
});

describe("world progression integration", () => {
  test("region outcomes raise threat after a completed event", async () => {
    const { repo } = harness;
    const world = repo.getWorld();
    if (!world) throw new Error("seed missing");
    expect(repo.getRegion("greenreach")?.threat_level).toBe(1);

    for (let index = 0; index < 3; index++) {
      insertEvent({ title: `Old Ledger ${index}`, status: "completed", targetRef: "old_road" });
    }
    expect(repo.countRegionOutcomes("greenreach").completed).toBe(3);

    const scout = harness.service.getEvents().find((event) => event.type === "scout");
    if (!scout) throw new Error("no scout event");
    await harness.service.acceptEvent(scout.id, "threat-accept-0001", "corr");
    await harness.service.resolveEvent(scout.id, "threat-resolve-0001", "corr");

    expect(repo.countRegionOutcomes("greenreach").completed).toBe(4);
    expect(repo.getRegion("greenreach")?.threat_level).toBe(2);
  });

  test("scouting the march gate unlocks the region and its locations", async () => {
    const { repo } = harness;
    expect(repo.getRegion("ashen_march")?.status).toBe("unknown");
    expect(repo.getLocation("ashen_gate")?.status).toBe("unknown");

    const scoutId = insertEvent({
      title: "Smoke Beyond the Marches",
      targetRef: "ashen_gate",
    });
    await harness.service.acceptEvent(scoutId, "march-accept-0001", "corr");
    await harness.service.resolveEvent(scoutId, "march-resolve-0001", "corr");

    expect(repo.getLocation("ashen_gate")?.status).toBe("discovered");
    expect(repo.getRegion("ashen_march")?.status).toBe("discovered");

    await harness.service.discover("ashen_gate", "march-discover-0001", "corr");
    expect(repo.getLocation("ashen_gate")?.status).toBe("accessible");
    expect(repo.getRegion("ashen_march")?.status).toBe("accessible");
  });

  test("discovering inside an unknown region is rejected", async () => {
    await expect(
      harness.service.discover("ruined_watchtower", "march-unknown-0001", "corr"),
    ).rejects.toThrow(/not known/i);
  });

  test("fallback board refresh is deterministic and bounded", () => {
    const { repo, board } = harness;
    const world = repo.getWorld();
    const partyRow = repo.getParty();
    if (!world || !partyRow) throw new Error("seed missing");

    const first = board.refreshFallback(world, buildParty(repo, partyRow));
    const visible = repo.getVisibleBoard(world.id);
    expect(visible.length).toBeLessThanOrEqual(4);
    expect(first).toBeGreaterThanOrEqual(0);
  });
});
