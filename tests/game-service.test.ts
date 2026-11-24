import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  EncounterRow,
  EventRow,
  ObjectiveRow,
} from "../apps/server/src/infrastructure/database/repository";
import { Repository } from "../apps/server/src/infrastructure/database/repository";
import { deriveCharacterStats } from "../packages/game-rules/src";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;

beforeEach(() => {
  harness = createTestService();
});

afterEach(() => {
  harness.close();
});

function insertAuthoredEvent(options: {
  title: string;
  type?: EventRow["type"];
  category?: EventRow["category"];
  objectiveKind?: EventRow["objective_kind"];
  encounters?: Array<Array<{ templateId: string; count: number; behaviorId: string }>>;
  expiresOnTurn?: number | null;
  targetRef?: string | null;
  rewardGold?: number;
}): string {
  const { repo } = harness;
  const world = repo.getWorld();
  const party = repo.getParty();
  if (!world || !party) throw new Error("seed missing");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const encounters = options.encounters ?? [];
  const event: EventRow = {
    id,
    world_id: world.id,
    type: options.type ?? "dungeon",
    category: options.category ?? "opportunity",
    title: options.title,
    hook: "A test contract written for the deterministic engine.",
    description: "A controlled contract used to prove persistence and partial defeat.",
    introduction: "The company steps into a controlled testing ground.",
    status: "available",
    difficulty_band: "easy",
    region_id: "greenreach",
    location_id: "whispering_wood",
    objective_kind: options.objectiveKind ?? "defeat_enemies",
    reward_intent_json: JSON.stringify([{ kind: "gold", target: "party" }]),
    reward_preview_json: JSON.stringify({
      gold: options.rewardGold ?? 25,
      experiencePerCharacter: 20,
      researchPoints: 0,
      equipment: [],
    }),
    completion_text: "The test contract is complete.",
    failure_text: "The test contract failed, but progress remains recorded.",
    result_text: null,
    source: "authored",
    expires_on_turn: options.expiresOnTurn ?? null,
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

  const objective: ObjectiveRow = {
    id: crypto.randomUUID(),
    event_id: id,
    position: 0,
    kind: event.objective_kind,
    description:
      event.objective_kind === "defeat_enemies" ? "Defeat every wave." : "Reach the marked site.",
    target_count: encounters.length > 0 ? encounters.length : 1,
    target_ref: options.targetRef ?? null,
    progress: 0,
    completed: 0,
  };
  repo.insertObjective(objective);

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

function boostParty(): void {
  const { repo } = harness;
  const party = repo.getParty();
  if (!party) throw new Error("seed missing");
  for (const row of repo.getCharacters(party.id)) {
    const attributes = { strength: 35, agility: 30, intelligence: 30, vitality: 35 };
    repo.updateCharacterProgress(row.id, 8, 0, attributes);
    const stats = deriveCharacterStats({ attributes, level: 8, bonuses: {} });
    repo.updateCharacterVitals(row.id, stats.maxHealth, stats.maxMana, false);
  }
}

function weakenParty(): void {
  const { repo } = harness;
  const party = repo.getParty();
  if (!party) throw new Error("seed missing");
  for (const row of repo.getCharacters(party.id)) {
    repo.updateCharacterProgress(row.id, 1, 0, {
      strength: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
    });
    repo.updateCharacterVitals(row.id, 1, 0, false);
  }
}

describe("seeded game state", () => {
  test("creates a persisted world, four-member party and fallback board", () => {
    const state = harness.service.state();
    expect(state.player.gold).toBeGreaterThan(0);
    expect(state.world.turn).toBe(1);
    expect(state.party.members).toHaveLength(4);
    expect(state.events.length).toBeGreaterThanOrEqual(3);
    expect(state.events.some((event) => event.category === "storyline")).toBe(true);
    expect(state.events.some((event) => event.category === "opportunity")).toBe(true);
    expect(state.events.every((event) => event.source === "fallback")).toBe(true);
    expect(state.journal.length).toBeGreaterThan(0);
  });

  test("equipment is owned, persisted and restricted", async () => {
    const party = harness.service.getParty();
    const warrior = party.party.members.find((member) => member.archetype === "warrior");
    const chainMail = party.inventory.find((item) => item.definitionId === "chain_mail");
    if (!warrior || !chainMail) throw new Error("starter fixtures missing");

    await harness.service.equip(warrior.id, chainMail.instanceId, "equip-op-0001");
    const updated = harness.service
      .getParty()
      .party.members.find((member) => member.id === warrior.id);
    expect(updated?.equipment.armor?.definitionId).toBe("chain_mail");

    await expect(
      harness.service.equip(warrior.id, "does-not-exist", "equip-op-0002"),
    ).rejects.toThrow(/not owned|not found/i);
  });

  test("rest costs gold, restores the party and never advances the world", async () => {
    const { repo } = harness;
    const party = repo.getParty();
    const world = repo.getWorld();
    if (!party || !world) throw new Error("seed missing");
    for (const row of repo.getCharacters(party.id)) {
      repo.updateCharacterVitals(row.id, 1, 0, true);
    }
    const goldBefore = harness.service.state().player.gold;
    const turnBefore = world.turn;

    const response = await harness.service.rest("rest-op-0001", "corr");
    expect(response.state.player.gold).toBe(goldBefore - 15);
    expect(response.state.world.turn).toBe(turnBefore);
    const after = harness.service.getParty();
    for (const member of after.party.members) {
      expect(member.health).toBe(member.maxHealth);
      expect(member.mana).toBe(member.maxMana);
      expect(member.incapacitated).toBe(false);
    }
  });
});

describe("event lifecycle", () => {
  test("accepting advances the world exactly once per operation", async () => {
    const scout = harness.service
      .getEvents()
      .find((event) => event.type === "scout" && event.status === "available");
    if (!scout) throw new Error("no scout event");

    const before = harness.service.state().world.turn;
    const first = await harness.service.acceptEvent(scout.id, "accept-op-0001", "corr");
    expect(first.state.world.turn).toBe(before + 1);
    expect(first.event?.status).toBe("active");

    const replay = await harness.service.acceptEvent(scout.id, "accept-op-0001", "corr");
    expect(replay.state.world.turn).toBe(before + 1);
  });

  test("scout objective discovers a location and grants rewards once", async () => {
    const { repo } = harness;
    const scout = harness.service
      .getEvents()
      .find((event) => event.type === "scout" && event.status === "available");
    if (!scout) throw new Error("no scout event");
    const preview = harness.service.getEvent(scout.id).rewardPreview;

    await harness.service.acceptEvent(scout.id, "accept-scout-0001", "corr");
    const goldBefore = harness.service.state().player.gold;
    const targetBefore = repo.getLocation("whispering_wood");
    expect(targetBefore?.status).toBe("discovered");

    const resolved = await harness.service.resolveEvent(scout.id, "resolve-scout-0001", "corr");
    expect(resolved.event?.status).toBe("completed");
    expect(resolved.report).toBeNull();
    expect(harness.service.state().player.gold).toBe(goldBefore + preview.gold);
    expect(repo.getLocation("whispering_wood")?.status).toBe("accessible");

    const again = await harness.service.resolveEvent(scout.id, "resolve-scout-0001", "corr");
    expect(again.event?.status).toBe("completed");
    expect(harness.service.state().player.gold).toBe(goldBefore + preview.gold);
    expect(resolved.event?.resultText).toContain(
      resolved.event?.completionText.split(".")[0] ?? "",
    );
  });

  test("multi-encounter event preserves cleared progress after later defeat", async () => {
    const { repo } = harness;
    boostParty();
    const goldBefore = harness.service.state().player.gold;
    const id = insertAuthoredEvent({
      title: "The Twofold Gauntlet",
      encounters: [
        [{ templateId: "forest_wolf", count: 1, behaviorId: "enemy_skirmisher" }],
        [{ templateId: "ash_warden", count: 3, behaviorId: "enemy_brute" }],
      ],
    });
    await harness.service.acceptEvent(id, "accept-gauntlet-001", "corr");

    const first = await harness.service.resolveEvent(id, "resolve-gauntlet-001", "corr");
    expect(first.report?.outcome).toBe("victory");
    expect(repo.getBattle(id, 0)).not.toBeNull();
    expect(repo.getEvent(id)?.encounters_completed).toBe(1);

    weakenParty();
    const second = await harness.service.resolveEvent(id, "resolve-gauntlet-002", "corr");
    expect(second.report?.outcome).not.toBe("victory");
    expect(repo.getBattle(id, 0)).not.toBeNull();
    expect(repo.getBattle(id, 1)).not.toBeNull();
    expect(repo.getEvent(id)?.status).toBe("failed");
    expect(repo.getEncounters(id)[0]?.status).toBe("completed");
    expect(repo.getEncounters(id)[1]?.status).toBe("failed");
    expect(harness.service.state().player.gold).toBe(goldBefore);

    const detail = harness.service.getEvent(id);
    expect(detail.encountersCompleted).toBe(1);
  });

  test("temporary opportunities expire by world turn", () => {
    const world = harness.repo.getWorld();
    if (!world) throw new Error("seed missing");
    const id = insertAuthoredEvent({
      title: "A Fading Whisper",
      type: "scout",
      category: "opportunity",
      objectiveKind: "discover_location",
      expiresOnTurn: world.turn - 1,
      targetRef: "old_road",
    });
    const expired = harness.repo.expireOpportunities(world.id, world.turn);
    expect(expired).toBeGreaterThanOrEqual(1);
    expect(harness.repo.getEvent(id)?.status).toBe("expired");
  });

  test("world action insertion is idempotent at the database boundary", () => {
    const world = harness.repo.getWorld();
    if (!world) throw new Error("seed missing");
    const row = {
      id: crypto.randomUUID(),
      worldId: world.id,
      actionType: "event_accepted" as const,
      operationId: "same-action-0001",
      turn: world.turn,
      detail: { eventId: "x" },
    };
    expect(harness.repo.insertWorldAction(row)).toBe(true);
    expect(harness.repo.insertWorldAction({ ...row, id: crypto.randomUUID() })).toBe(false);
  });

  test("completed battles are immutable across retries and reloads", async () => {
    const { repo } = harness;
    boostParty();
    const id = insertAuthoredEvent({
      title: "The Sealed Report",
      encounters: [[{ templateId: "forest_wolf", count: 1, behaviorId: "enemy_skirmisher" }]],
    });
    await harness.service.acceptEvent(id, "sealed-accept-0001", "corr");
    const first = await harness.service.resolveEvent(id, "sealed-resolve-0001", "corr");
    expect(first.report?.outcome).toBe("victory");

    const battle = repo.getBattle(id, 0);
    if (!battle) throw new Error("battle missing");
    const snapshot = JSON.stringify(battle);

    await expect(harness.service.resolveEvent(id, "sealed-resolve-0002", "corr")).rejects.toThrow(
      /not active/i,
    );

    expect(JSON.stringify(repo.getBattle(id, 0))).toBe(snapshot);
    expect(repo.listBattles(id)).toHaveLength(1);
    const reloaded = new Repository(harness.db);
    expect(JSON.stringify(reloaded.getBattle(id, 0))).toBe(snapshot);
  });

  test("equipment persists when the read model is rebuilt", async () => {
    const party = harness.service.getParty();
    const warrior = party.party.members.find((member) => member.archetype === "warrior");
    const chainMail = party.inventory.find((item) => item.definitionId === "chain_mail");
    if (!warrior || !chainMail) throw new Error("starter fixtures missing");

    await harness.service.equip(warrior.id, chainMail.instanceId, "equip-reload-0001");

    const reloaded = new Repository(harness.db);
    const partyRow = reloaded.getParty();
    if (!partyRow) throw new Error("party missing");
    const equipped = reloaded.getAllEquipped(partyRow.id);
    expect(equipped.some((item) => item.character_id === warrior.id)).toBe(true);
    expect(
      harness.service.getParty().party.members.find((member) => member.id === warrior.id)?.equipment
        .armor?.definitionId,
    ).toBe("chain_mail");
  });
});
