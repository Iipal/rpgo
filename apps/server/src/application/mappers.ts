import type {
  BattleLogEntryDto,
  BattleReportDto,
  CharacterDto,
  CombatantResultDto,
  EquipmentItemDto,
  EventDetailDto,
  EventEncounterDto,
  EventSummaryDto,
  GameStateDto,
  InventoryItemDto,
  JournalEntryDto,
  LocationDto,
  PartyDto,
  PlayerDto,
  Rarity,
  RegionDto,
  RewardPreviewDto,
  WorldDto,
} from "@rpgo/contracts";
import { enemyById, equipmentById, locationName, regionById } from "@rpgo/game-content";
import {
  type Attributes,
  type DifficultyBand,
  deriveCharacterStats,
  type EquipmentBonuses,
  hashSeed,
  partyPower,
  type RewardPlan,
  xpToNextLevel,
} from "@rpgo/game-rules";
import type {
  BattleRow,
  CharacterRow,
  EncounterRow,
  EquipmentRow,
  EventRow,
  InventoryRow,
  JournalRow,
  LocationRow,
  PlayerRow,
  RegionRow,
  Repository,
  WorldRow,
} from "../infrastructure/database/repository";

export interface RewardPreviewInternal {
  gold: number;
  experiencePerCharacter: number;
  researchPoints: number;
  equipment: Array<{ definitionId: string; name: string; rarity: Rarity }>;
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function bonusesFromJson(text: string): EquipmentBonuses {
  return parseJson<EquipmentBonuses>(text, {});
}

export function inventoryItemDto(row: InventoryRow): EquipmentItemDto {
  return {
    instanceId: row.id,
    definitionId: row.definition_id,
    name: row.name,
    slot: row.slot,
    rarity: row.rarity,
    description: row.description,
    bonuses: bonusesFromJson(row.bonuses_json),
  };
}

export function inventoryDto(row: InventoryRow, equippedByName: string | null): InventoryItemDto {
  return {
    ...inventoryItemDto(row),
    equippedBy: row.equipped_by,
    equippedByName,
    acquiredTurn: row.acquired_turn,
  };
}

function equipmentMap(rows: EquipmentRow[]): Map<string, EquipmentRow> {
  return new Map(rows.map((row) => [row.equip_slot, row]));
}

export function characterDto(row: CharacterRow, equipped: EquipmentRow[]): CharacterDto {
  const bySlot = equipmentMap(equipped);
  const bonuses = equipped.reduce<Required<EquipmentBonuses>>(
    (total, item) => {
      const value = bonusesFromJson(item.bonuses_json);
      total.attack += value.attack ?? 0;
      total.magicAttack += value.magicAttack ?? 0;
      total.defense += value.defense ?? 0;
      total.speed += value.speed ?? 0;
      total.health += value.health ?? 0;
      total.mana += value.mana ?? 0;
      total.critChance += value.critChance ?? 0;
      return total;
    },
    { attack: 0, magicAttack: 0, defense: 0, speed: 0, health: 0, mana: 0, critChance: 0 },
  );
  const attributes: Attributes = {
    strength: row.strength,
    agility: row.agility,
    intelligence: row.intelligence,
    vitality: row.vitality,
  };
  const derived = deriveCharacterStats({ attributes, level: row.level, bonuses });
  const health = Math.min(row.health, derived.maxHealth);
  const mana = Math.min(row.mana, derived.maxMana);
  const weapon = bySlot.get("weapon");
  const armor = bySlot.get("armor");
  const accessory = bySlot.get("accessory");
  return {
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    level: row.level,
    experience: row.experience,
    xpToNext: xpToNextLevel(row.level),
    attributes,
    bonuses,
    derived,
    health,
    maxHealth: derived.maxHealth,
    mana,
    maxMana: derived.maxMana,
    equipment: {
      weapon: weapon ? inventoryItemDto(weapon) : null,
      armor: armor ? inventoryItemDto(armor) : null,
      accessory: accessory ? inventoryItemDto(accessory) : null,
    },
    abilityIds: parseJson<string[]>(row.ability_ids_json, []),
    combatBehaviorId: row.combat_behavior_id,
    formation: row.formation,
    incapacitated: row.incapacitated === 1 || health <= 0,
    power:
      derived.attack +
      derived.magicAttack +
      derived.defense +
      derived.speed +
      Math.floor(derived.maxHealth / 4) +
      Math.floor(derived.maxMana / 4),
  };
}

export interface PartyBundle {
  party: PartyDto;
  characters: CharacterDto[];
  rows: CharacterRow[];
  equipped: EquipmentRow[];
}

export function buildParty(repo: Repository, partyRow: { id: string; name: string }): PartyBundle {
  const rows = repo.getCharacters(partyRow.id);
  const allEquipped = repo.getAllEquipped(partyRow.id);
  const characters = rows.map((row) =>
    characterDto(
      row,
      allEquipped.filter((item) => item.character_id === row.id),
    ),
  );
  const power = partyPower(
    rows.map((row) => ({
      attributes: {
        strength: row.strength,
        agility: row.agility,
        intelligence: row.intelligence,
        vitality: row.vitality,
      },
      level: row.level,
      bonuses: allEquipped
        .filter((item) => item.character_id === row.id)
        .reduce<EquipmentBonuses>((total, item) => {
          const value = bonusesFromJson(item.bonuses_json);
          return {
            attack: (total.attack ?? 0) + (value.attack ?? 0),
            magicAttack: (total.magicAttack ?? 0) + (value.magicAttack ?? 0),
            defense: (total.defense ?? 0) + (value.defense ?? 0),
            speed: (total.speed ?? 0) + (value.speed ?? 0),
            health: (total.health ?? 0) + (value.health ?? 0),
            mana: (total.mana ?? 0) + (value.mana ?? 0),
            critChance: (total.critChance ?? 0) + (value.critChance ?? 0),
          };
        }, {}),
    })),
  );
  return {
    party: { id: partyRow.id, name: partyRow.name, members: characters, power },
    characters,
    rows,
    equipped: allEquipped,
  };
}

export function playerDto(row: PlayerRow): PlayerDto {
  return {
    id: row.id,
    name: row.name,
    gold: row.gold,
    researchPoints: row.research_points,
  };
}

export function worldDto(
  world: WorldRow,
  regions: RegionRow[],
  locations: LocationRow[],
): WorldDto {
  const regionDtos: RegionDto[] = regions.map((region) => ({
    id: region.id,
    name: region.name,
    description: region.description,
    levelRange: { min: region.level_min, max: region.level_max },
    status: region.status,
    threatLevel: region.threat_level,
    locations: locations
      .filter((location) => location.region_id === region.id)
      .map<LocationDto>((location) => ({
        id: location.id,
        regionId: location.region_id,
        name: location.name,
        description: location.description,
        status: location.status,
        discoveredTurn: location.discovered_turn,
      })),
  }));
  return {
    id: world.id,
    turn: world.turn,
    currentRegionId: world.current_region_id,
    regions: regionDtos,
  };
}

export function recommendedPower(band: DifficultyBand, currentPower: number): number {
  if (band === "easy") return Math.round(currentPower * 0.7);
  if (band === "hard") return Math.round(currentPower * 1.25);
  return Math.round(currentPower * 0.95);
}

export function eventSummary(
  repo: Repository,
  row: EventRow,
  currentPower: number,
): EventSummaryDto {
  const region = repo.getRegion(row.region_id);
  const location = row.location_id ? repo.getLocation(row.location_id) : null;
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    hook: row.hook,
    status: row.status,
    difficultyBand: row.difficulty_band,
    regionId: row.region_id,
    regionName: region?.name ?? regionById[row.region_id]?.name ?? row.region_id,
    locationId: row.location_id,
    locationName: location?.name ?? locationName(row.location_id ?? undefined) ?? null,
    expiresOnTurn: row.expires_on_turn,
    encounterCount: repo.getEncounters(row.id).length,
    encountersCompleted: row.encounters_completed,
    objectiveKind: row.objective_kind,
    source: row.source,
    createdTurn: row.created_turn,
    recommendedPower: recommendedPower(row.difficulty_band, currentPower),
  };
}

export function rewardPreviewDto(preview: RewardPreviewInternal): RewardPreviewDto {
  return {
    gold: preview.gold,
    experiencePerCharacter: preview.experiencePerCharacter,
    researchPoints: preview.researchPoints,
    equipment: preview.equipment.map((item) => ({ name: item.name, rarity: item.rarity })),
  };
}

export function buildRewardPreview(plan: RewardPlan, seed: string): RewardPreviewInternal {
  const equipment = plan.equipment.map((entry, index) => {
    const pool = Object.values(equipmentById).filter((item) => item.rarity === entry.rarity);
    const fallbackPool = Object.values(equipmentById);
    const chosen = (pool.length > 0 ? pool : fallbackPool)[
      hashSeed(`${seed}:${index}:${entry.rarity}`) %
        (pool.length > 0 ? pool.length : fallbackPool.length)
    ];
    return {
      definitionId: chosen?.id ?? "scout_dagger",
      name: chosen?.name ?? "Scout Dagger",
      rarity: chosen?.rarity ?? "common",
    };
  });
  return {
    gold: plan.gold,
    experiencePerCharacter: plan.experiencePerCharacter,
    researchPoints: plan.researchPoints,
    equipment,
  };
}

export function encounterDto(row: EncounterRow): EventEncounterDto {
  const enemies = parseJson<Array<{ templateId: string; count: number; behaviorId: string }>>(
    row.enemies_json,
    [],
  );
  return {
    index: row.position,
    title: row.title,
    description: row.description,
    enemies: enemies.map((enemy) => ({
      name: enemyById[enemy.templateId]?.name ?? enemy.templateId,
      count: enemy.count,
    })),
    status: row.status,
  };
}

export function eventDetail(repo: Repository, row: EventRow, currentPower: number): EventDetailDto {
  const encounters = repo.getEncounters(row.id);
  const objectives = repo.getObjectives(row.id);
  const generation = row.generation_id ? repo.getGeneration(row.generation_id) : null;
  const summary = eventSummary(repo, row, currentPower);
  return {
    ...summary,
    description: row.description,
    introduction: row.introduction,
    objectives: objectives.map((objective) => ({
      kind: objective.kind,
      description: objective.description,
      targetCount: objective.target_count,
      progress: objective.progress,
      completed: objective.completed === 1,
    })),
    encounters: encounters.map(encounterDto),
    rewardPreview: rewardPreviewDto(
      parseJson<RewardPreviewInternal>(row.reward_preview_json, {
        gold: 0,
        experiencePerCharacter: 0,
        researchPoints: 0,
        equipment: [],
      }),
    ),
    completionText: row.completion_text,
    failureText: row.failure_text,
    resultText: row.result_text,
    currentEncounterIndex: row.current_encounter_index,
    partyPower: currentPower,
    canAccept: row.status === "available",
    canStart:
      row.status === "active" &&
      encounters.length > 0 &&
      row.current_encounter_index < encounters.length &&
      encounters[row.current_encounter_index]?.status !== "completed",
    canResolve:
      row.status === "active" &&
      (encounters.length === 0 || row.current_encounter_index < encounters.length),
    generation: generation
      ? {
          model: generation.model,
          promptVersion: generation.prompt_version,
          schemaVersion: generation.schema_version,
        }
      : null,
  };
}

export function battleReportDto(row: BattleRow): BattleReportDto {
  const file = battleLogFile(row);
  return {
    id: row.id,
    eventId: row.event_id,
    encounterIndex: row.encounter_index,
    encounterTitle: file.encounterTitle,
    outcome: row.outcome,
    rounds: row.rounds,
    seed: row.seed,
    actionLog: file.entries,
    partyAfter: parseJson<CombatantResultDto[]>(row.party_result_json, []),
    enemiesAfter: parseJson<CombatantResultDto[]>(row.enemy_result_json, []),
    createdAt: row.created_at,
  };
}

export interface BattleLogFile {
  encounterTitle: string;
  entries: BattleLogEntryDto[];
}

export function battleLogFile(row: BattleRow): BattleLogFile {
  const parsed = parseJson<{
    encounterTitle?: string;
    entries?: BattleLogEntryDto[];
  }>(row.action_log_json, {});
  return {
    encounterTitle: parsed.encounterTitle ?? "",
    entries: parsed.entries ?? [],
  };
}

export function journalDto(row: JournalRow): JournalEntryDto {
  return {
    id: row.id,
    turn: row.turn,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export function gameState(
  repo: Repository,
  player: PlayerRow,
  world: WorldRow,
  party: PartyBundle,
): GameStateDto {
  const events = repo
    .getVisibleBoard(world.id)
    .map((row) => eventSummary(repo, row, party.party.power));
  return {
    player: playerDto(player),
    world: worldDto(world, repo.getRegions(), repo.getLocations()),
    party: party.party,
    events,
    journal: repo.getJournal(world.id).map(journalDto),
  };
}
