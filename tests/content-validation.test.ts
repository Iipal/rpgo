import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  abilities,
  contentVersion,
  enemies,
  equipment,
  fallbackEvents,
  findContentErrors,
  regions,
  starterInventory,
  starterParty,
} from "../packages/game-content/src";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;

beforeEach(() => {
  harness = createTestService();
});

afterEach(() => {
  harness.close();
});

const baseInput = {
  regions,
  enemies,
  abilities,
  equipment,
  fallbackEvents,
  starterParty,
  starterInventory,
};

describe("static content model", () => {
  test("authored content has no reference errors", () => {
    expect(findContentErrors(baseInput)).toEqual([]);
    expect(contentVersion).toBeGreaterThanOrEqual(2);
  });

  test("world contains six regions with four to eight locations each", () => {
    expect(regions.length).toBe(6);
    for (const region of regions) {
      expect(region.tags.length).toBeGreaterThan(0);
      expect(region.eventTypes.length).toBeGreaterThan(0);
      expect(region.enemyFamilies.length).toBeGreaterThan(0);
      expect(region.locations.length).toBeGreaterThanOrEqual(4);
      expect(region.locations.length).toBeLessThanOrEqual(8);
      for (const location of region.locations) {
        expect(location.tags.length).toBeGreaterThan(0);
        for (const connected of location.connections) {
          expect(region.locations.some((candidate) => candidate.id === connected)).toBe(true);
        }
      }
    }
  });

  test("every region beyond the start has an explicit scout route", () => {
    const start = regions.filter((region) => region.accessCondition.kind === "start");
    expect(start).toHaveLength(1);
    for (const region of regions) {
      if (region.accessCondition.kind !== "scout") continue;
      const condition = region.accessCondition;
      const route = fallbackEvents.find(
        (event) =>
          event.regionId === condition.fromRegionId &&
          event.targetLocationId === condition.targetLocationId,
      );
      expect(route).toBeDefined();
      expect(route?.objectiveKind).toBe("discover_location");
    }
  });

  test("reports broken reciprocal connections and missing route events", () => {
    const broken = structuredClone(baseInput);
    const frostmere = broken.regions.find((region) => region.id === "frostmere");
    if (!frostmere) throw new Error("fixture region missing");
    frostmere.connections = frostmere.connections.filter(
      (connection) => connection.toRegionId !== "ashen_march",
    );
    const errors = findContentErrors(broken);
    expect(errors.some((error) => error.includes("not reciprocal"))).toBe(true);

    const noRoute = structuredClone(baseInput);
    noRoute.fallbackEvents = noRoute.fallbackEvents.filter(
      (event) => event.key !== "fallback_frostmere_scout",
    );
    expect(
      findContentErrors(noRoute).some((error) =>
        error.includes("no fallback event from ashen_march"),
      ),
    ).toBe(true);
  });

  test("rejects an enemy from a family outside the region allowlist", () => {
    const broken = structuredClone(baseInput);
    const event = broken.fallbackEvents.find(
      (candidate) => candidate.key === "fallback_whispering_wood",
    );
    if (!event) throw new Error("fixture event missing");
    event.encounters[0]!.enemies[0]!.templateId = "ash_warden";
    expect(findContentErrors(broken).some((error) => error.includes("enemy family undead"))).toBe(
      true,
    );
  });

  test("world read model exposes tags, routes and location adjacency", () => {
    const world = harness.service.getWorld();
    const greenreach = world.regions.find((region) => region.id === "greenreach");
    expect(greenreach?.tags).toContain("starter");
    expect(
      greenreach?.connections.some((connection) => connection.regionId === "ashen_march"),
    ).toBe(true);
    const oldRoad = greenreach?.locations.find((location) => location.id === "old_road");
    expect(oldRoad?.connectedLocationIds).toContain("thornbury");
    expect(oldRoad?.tags).toContain("road");
  });
});
