import type { EventConcept, GeneratedEvent } from "@rpgo/contracts";
import { ENEMY_TEMPLATE_IDS, enemyById, regionById } from "@rpgo/game-content";
import type {
  DifficultyBand,
  EventCategory,
  ObjectiveKind,
  Rarity,
  RewardIntent,
} from "@rpgo/game-rules";
import { clampDifficultyBand, isDifficultyAllowed } from "@rpgo/game-rules";
import type { Repository } from "../infrastructure/database/repository";

export const ALLOWED_BEHAVIORS = [
  "enemy_brute",
  "enemy_skirmisher",
  "enemy_caster",
  "enemy_support",
] as const;

export const MAX_ENCOUNTERS: Record<"dungeon" | "scout" | "research" | "attack", number> = {
  dungeon: 2,
  scout: 0,
  research: 0,
  attack: 1,
};

export interface NormalizedConcept extends EventConcept {
  locationId: string;
  difficultyBand: DifficultyBand;
  expiresOnTurn: number | null;
  targetLocationId: string | null;
}

export interface ConceptValidation {
  concept?: NormalizedConcept;
  error?: string;
}

const OBJECTIVE_FOR_TYPE: Record<string, ObjectiveKind> = {
  dungeon: "defeat_enemies",
  attack: "defeat_enemies",
  scout: "discover_location",
  research: "complete_research",
};

/**
 * Domain validation happens after schema validation. It decides whether a
 * model proposal is playable; nothing from the model is trusted as rules data.
 */
export function validateConcept(
  repo: Repository,
  raw: EventConcept,
  desiredCategory: EventCategory,
  turn: number,
  partyLevel: number,
): ConceptValidation {
  if (raw.category !== desiredCategory) {
    return { error: `expected category ${desiredCategory}` };
  }
  const region = repo.getRegion(raw.regionId);
  if (!region) return { error: `unknown region ${raw.regionId}` };
  if (region.status !== "accessible") return { error: `region ${raw.regionId} is locked` };
  const definition = regionById[region.id];
  if (!definition) return { error: `unknown content region ${raw.regionId}` };
  if (!definition.eventTypes.includes(raw.type)) {
    return { error: `event type ${raw.type} is not allowed in ${raw.regionId}` };
  }

  const locations = repo.getLocations().filter((location) => location.region_id === region.id);
  const eligible = locations.filter((location) => location.status !== "unknown");
  if (eligible.length === 0) return { error: "region has no eligible locations" };

  const eventLocation = raw.locationId
    ? eligible.find((location) => location.id === raw.locationId)
    : eligible[0];
  if (!eventLocation) return { error: `location ${raw.locationId} is not eligible` };

  if (OBJECTIVE_FOR_TYPE[raw.type] !== raw.objectiveKind) {
    return { error: `objective ${raw.objectiveKind} does not match type ${raw.type}` };
  }

  let targetLocationId: string | null = null;
  if (raw.objectiveKind === "discover_location") {
    const target = locations.find(
      (location) =>
        location.id !== eventLocation.id &&
        (location.status === "unknown" || location.status === "discovered"),
    );
    if (!target) return { error: "no location left to discover in this region" };
    targetLocationId = target.id;
  }

  if (
    raw.category === "storyline" &&
    raw.storylineKey &&
    !/^[a-z0-9_-]{1,64}$/.test(raw.storylineKey)
  ) {
    return { error: "invalid storyline key" };
  }
  if (repo.hasDuplicateConcept(region.world_id, raw.title, raw.storylineKey)) {
    return { error: "duplicate title or storyline" };
  }

  const band = clampDifficultyBand(raw.difficultyBand, partyLevel);
  if (!isDifficultyAllowed(band, partyLevel)) return { error: "difficulty not allowed" };
  const expires = raw.category === "opportunity" ? turn + (raw.expiresInWorldTurns ?? 4) : null;

  return {
    concept: {
      ...raw,
      locationId: eventLocation.id,
      difficultyBand: band,
      expiresOnTurn: expires,
      targetLocationId,
    },
  };
}

export interface GeneratedValidation {
  error?: string;
}

export function validateGenerated(
  generated: GeneratedEvent,
  concept: NormalizedConcept,
): GeneratedValidation {
  if (generated.objectives.length === 0) return { error: "missing objectives" };
  if (generated.objectives[0]?.kind !== concept.objectiveKind) {
    return { error: "first objective does not match concept" };
  }
  if (generated.encounters.length > MAX_ENCOUNTERS[concept.type]) {
    return { error: "too many encounters for event type" };
  }
  if (concept.objectiveKind === "defeat_enemies" && generated.encounters.length === 0) {
    return { error: "combat event requires an encounter" };
  }
  if (concept.objectiveKind !== "defeat_enemies" && generated.encounters.length > 0) {
    return { error: "non-combat event cannot have encounters" };
  }
  const allowedFamilies = regionById[concept.regionId]?.enemyFamilies ?? [];
  for (const encounter of generated.encounters) {
    if (encounter.enemies.length === 0) return { error: "empty encounter" };
    for (const enemy of encounter.enemies) {
      if (!ENEMY_TEMPLATE_IDS.includes(enemy.templateId)) {
        return { error: `unknown enemy template ${enemy.templateId}` };
      }
      if (!ALLOWED_BEHAVIORS.includes(enemy.behaviorId as (typeof ALLOWED_BEHAVIORS)[number])) {
        return { error: `unknown behavior ${enemy.behaviorId}` };
      }
      const template = enemyById[enemy.templateId];
      if (!template) return { error: "unknown enemy template" };
      if (!allowedFamilies.includes(template.family)) {
        return { error: `enemy family ${template.family} is not allowed in ${concept.regionId}` };
      }
    }
  }
  const rarityAllowed = (rarity: Rarity | undefined): boolean =>
    rarity === undefined || ["common", "uncommon", "rare"].includes(rarity);
  if (!generated.rewardIntent.every((reward) => rarityAllowed(reward.rarity))) {
    return { error: "invalid reward rarity" };
  }
  return {};
}

export function rewardIntentPreview(intents: GeneratedEvent["rewardIntent"]): RewardIntent[] {
  return intents.map((intent) => ({
    kind: intent.kind,
    rarity: intent.rarity,
    target: intent.target,
  }));
}
