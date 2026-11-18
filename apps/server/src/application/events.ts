import { equipmentById } from "@rpgo/game-content";
import type {
  DifficultyBand,
  EventCategory,
  EventType,
  ObjectiveKind,
  RewardIntent,
} from "@rpgo/game-rules";
import { computeRewardPlan, hashSeed } from "@rpgo/game-rules";
import type {
  EncounterRow,
  EventRow,
  ObjectiveRow,
  Repository,
} from "../infrastructure/database/repository";
import { buildRewardPreview, type RewardPreviewInternal } from "./mappers";

export interface EventDraftObjective {
  kind: ObjectiveKind;
  description: string;
  targetCount?: number | null;
  targetRef?: string | null;
}

export interface EventDraftEncounter {
  title: string;
  description: string;
  enemies: Array<{ templateId: string; count: number; behaviorId: string }>;
}

export interface EventDraft {
  worldId: string;
  type: EventType;
  category: EventCategory;
  title: string;
  hook: string;
  description: string;
  introduction: string;
  difficultyBand: DifficultyBand;
  regionId: string;
  locationId: string | null;
  objectives: EventDraftObjective[];
  encounters: EventDraftEncounter[];
  rewardIntent: RewardIntent[];
  completionText: string;
  failureText: string;
  source: "generated" | "fallback" | "authored";
  expiresOnTurn: number | null;
  storylineKey: string | null;
  createdTurn: number;
  generationId: string | null;
}

export function rewardPreviewFor(draft: EventDraft, eventId: string): RewardPreviewInternal {
  const plan = computeRewardPlan(draft.rewardIntent, draft.difficultyBand, draft.type);
  return buildRewardPreview(plan, `${eventId}:${draft.title}`);
}

export function persistEvent(repo: Repository, draft: EventDraft): EventRow {
  const eventId = crypto.randomUUID();
  const preview = rewardPreviewFor(draft, eventId);
  const rewardIntent = draft.rewardIntent.filter((intent) => {
    if (intent.kind !== "equipment") return true;
    return Object.values(equipmentById).length > 0;
  });
  const row: EventRow = {
    id: eventId,
    world_id: draft.worldId,
    type: draft.type,
    category: draft.category,
    title: draft.title,
    hook: draft.hook,
    description: draft.description,
    introduction: draft.introduction,
    status: "available",
    difficulty_band: draft.difficultyBand,
    region_id: draft.regionId,
    location_id: draft.locationId,
    objective_kind: draft.objectives[0]?.kind ?? "defeat_enemies",
    reward_intent_json: JSON.stringify(rewardIntent),
    reward_preview_json: JSON.stringify(preview),
    completion_text: draft.completionText,
    failure_text: draft.failureText,
    result_text: null,
    source: draft.source,
    expires_on_turn: draft.expiresOnTurn,
    storyline_key: draft.storylineKey,
    created_turn: draft.createdTurn,
    current_encounter_index: 0,
    encounters_completed: 0,
    accepted_turn: null,
    completed_turn: null,
    generation_id: draft.generationId,
    created_at: new Date().toISOString(),
  };
  repo.insertEvent(row);
  draft.objectives.forEach((objective, index) => {
    const objectiveRow: ObjectiveRow = {
      id: crypto.randomUUID(),
      event_id: eventId,
      position: index,
      kind: objective.kind,
      description: objective.description,
      target_count: objective.targetCount ?? null,
      target_ref: objective.targetRef ?? null,
      progress: 0,
      completed: 0,
    };
    repo.insertObjective(objectiveRow);
  });
  draft.encounters.forEach((encounter, index) => {
    const encounterRow: EncounterRow = {
      id: crypto.randomUUID(),
      event_id: eventId,
      position: index,
      title: encounter.title,
      description: encounter.description,
      enemies_json: JSON.stringify(encounter.enemies),
      status: "pending",
    };
    repo.insertEncounter(encounterRow);
  });
  return row;
}

export function eventSeed(
  eventId: string,
  encounterIndex: number,
  worldSeed: number | null,
): number {
  return hashSeed(`${eventId}:${encounterIndex}:${worldSeed ?? "default"}`);
}

export function draftFromFallback(
  definition: import("@rpgo/game-content").FallbackEventDefinition,
  worldId: string,
  turn: number,
): EventDraft {
  return {
    worldId,
    type: definition.type,
    category: definition.category,
    title: definition.title,
    hook: definition.hook,
    description: definition.description,
    introduction: definition.introduction,
    difficultyBand: definition.difficultyBand,
    regionId: definition.regionId,
    locationId: definition.locationId ?? null,
    objectives: [
      {
        kind: definition.objectiveKind,
        description:
          definition.objectiveKind === "defeat_enemies"
            ? "Defeat the enemies standing in the way."
            : definition.objectiveKind === "discover_location"
              ? "Find and map the trail."
              : "Finish the research and copy your notes.",
        targetCount:
          definition.objectiveKind === "defeat_enemies" ? definition.encounters.length : 1,
        targetRef: definition.targetLocationId ?? null,
      },
    ],
    encounters: definition.encounters,
    rewardIntent: definition.rewardIntent,
    completionText: definition.completionText,
    failureText: definition.failureText,
    source: "fallback",
    expiresOnTurn:
      definition.category === "opportunity" && definition.expiresInWorldTurns
        ? turn + definition.expiresInWorldTurns
        : null,
    storylineKey: definition.storylineKey ?? null,
    createdTurn: turn,
    generationId: null,
  };
}

export function draftFromGenerated(
  concept: import("./generation-validation").NormalizedConcept,
  generated: import("@rpgo/contracts").GeneratedEvent,
  worldId: string,
  turn: number,
  generationId: string,
): EventDraft {
  return {
    worldId,
    type: concept.type,
    category: concept.category,
    title: concept.title,
    hook: concept.hook,
    description: generated.description,
    introduction: generated.introduction,
    difficultyBand: concept.difficultyBand,
    regionId: concept.regionId,
    locationId: concept.locationId,
    objectives: [
      {
        kind: concept.objectiveKind,
        description: generated.objectives[0]?.description ?? "Complete the objective.",
        targetCount: concept.objectiveKind === "defeat_enemies" ? generated.encounters.length : 1,
        targetRef: concept.targetLocationId,
      },
    ],
    encounters: generated.encounters,
    rewardIntent: generated.rewardIntent,
    completionText: generated.completionText,
    failureText: generated.failureText,
    source: "generated",
    expiresOnTurn: concept.expiresOnTurn,
    storylineKey: concept.storylineKey ?? null,
    createdTurn: turn,
    generationId,
  };
}
