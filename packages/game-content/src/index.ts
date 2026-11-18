import type {
  AbilityDefinition,
  Archetype,
  EnemyTemplate,
  EquipmentDefinition,
  EventCategory,
  EventType,
  ObjectiveKind,
  RegionDefinition,
  RewardIntent,
} from "@rpgo/game-rules";
import abilitiesData from "../../../data/abilities.json";
import enemiesData from "../../../data/enemies.json";
import equipmentData from "../../../data/equipment.json";
import regionsData from "../../../data/regions.json";

export const regions = regionsData.regions as RegionDefinition[];
export const abilities = abilitiesData.abilities as AbilityDefinition[];
export const enemies = enemiesData.enemies as EnemyTemplate[];
export const equipment = equipmentData.equipment as EquipmentDefinition[];

export const abilityById: Record<string, AbilityDefinition> = Object.fromEntries(
  abilities.map((ability) => [ability.id, ability]),
);
export const enemyById: Record<string, EnemyTemplate> = Object.fromEntries(
  enemies.map((enemy) => [enemy.id, enemy]),
);
export const equipmentById: Record<string, EquipmentDefinition> = Object.fromEntries(
  equipment.map((item) => [item.id, item]),
);
export const regionById: Record<string, RegionDefinition> = Object.fromEntries(
  regions.map((region) => [region.id, region]),
);

export const ABILITY_IDS = abilities.map((ability) => ability.id);
export const ENEMY_TEMPLATE_IDS = enemies.map((enemy) => enemy.id);
export const EQUIPMENT_IDS = equipment.map((item) => item.id);

export interface StarterCharacterDefinition {
  key: string;
  name: string;
  archetype: Archetype;
  attributes: { strength: number; agility: number; intelligence: number; vitality: number };
  abilityIds: string[];
  combatBehaviorId: string;
  formation: "front" | "back";
  equipment: Array<{ slot: "weapon" | "armor" | "accessory"; definitionId: string }>;
}

export const starterParty: StarterCharacterDefinition[] = [
  {
    key: "warrior",
    name: "Aurelia Vane",
    archetype: "warrior",
    attributes: { strength: 8, agility: 4, intelligence: 2, vitality: 8 },
    abilityIds: ["basic_strike", "guard_stance"],
    combatBehaviorId: "party_warrior",
    formation: "front",
    equipment: [
      { slot: "weapon", definitionId: "iron_sword" },
      { slot: "armor", definitionId: "leather_armor" },
      { slot: "accessory", definitionId: "charm_of_vigor" },
    ],
  },
  {
    key: "ranger",
    name: "Kaelen Reed",
    archetype: "ranger",
    attributes: { strength: 5, agility: 8, intelligence: 3, vitality: 5 },
    abilityIds: ["basic_strike", "power_shot"],
    combatBehaviorId: "party_ranger",
    formation: "back",
    equipment: [
      { slot: "weapon", definitionId: "hunting_bow" },
      { slot: "armor", definitionId: "leather_armor" },
      { slot: "accessory", definitionId: "wolf_fang_charm" },
    ],
  },
  {
    key: "mage",
    name: "Mira Sol",
    archetype: "mage",
    attributes: { strength: 3, agility: 4, intelligence: 9, vitality: 4 },
    abilityIds: ["arcane_bolt", "firestorm"],
    combatBehaviorId: "party_mage",
    formation: "back",
    equipment: [
      { slot: "weapon", definitionId: "oak_staff" },
      { slot: "armor", definitionId: "apprentice_robe" },
      { slot: "accessory", definitionId: "sage_ring" },
    ],
  },
  {
    key: "cleric",
    name: "Brother Oren",
    archetype: "cleric",
    attributes: { strength: 4, agility: 4, intelligence: 6, vitality: 6 },
    abilityIds: ["smite", "mend"],
    combatBehaviorId: "party_cleric",
    formation: "back",
    equipment: [
      { slot: "weapon", definitionId: "blessed_mace" },
      { slot: "armor", definitionId: "leather_armor" },
    ],
  },
];

export const starterInventory = ["scout_dagger", "chain_mail"];

export interface FallbackEncounterDefinition {
  title: string;
  description: string;
  enemies: Array<{ templateId: string; count: number; behaviorId: string }>;
}

export interface FallbackEventDefinition {
  key: string;
  type: EventType;
  category: EventCategory;
  title: string;
  hook: string;
  description: string;
  introduction: string;
  regionId: string;
  locationId?: string;
  difficultyBand: "easy" | "normal" | "hard";
  objectiveKind: ObjectiveKind;
  targetLocationId?: string;
  encounters: FallbackEncounterDefinition[];
  rewardIntent: RewardIntent[];
  completionText: string;
  failureText: string;
  expiresInWorldTurns?: number;
  storylineKey?: string;
}

/**
 * Deterministic fallback content keeps the board playable with the LLM disabled.
 * The engine treats these exactly like generated events (source: "fallback").
 */
export const fallbackEvents: FallbackEventDefinition[] = [
  {
    key: "fallback_whispering_wood",
    type: "dungeon",
    category: "storyline",
    title: "Beneath the Whispering Wood",
    hook: "The wood has gone quiet, and the village wants to know why.",
    description:
      "Something has driven the game from the Whispering Wood. Thornbury's hunters speak of grey shapes between the birches and a goblin camp deeper in.",
    introduction:
      "You follow the old charcoal burners' path until the birches close overhead. Grey shapes move in the undergrowth, and further in, firelight flickers against a mossy bank.",
    regionId: "greenreach",
    locationId: "whispering_wood",
    difficultyBand: "normal",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "Grey Shapes in the Birches",
        description: "Lean wolves circle the trail, ribs showing beneath matted fur.",
        enemies: [{ templateId: "forest_wolf", count: 2, behaviorId: "enemy_skirmisher" }],
      },
      {
        title: "The Goblin Fire",
        description: "A scout camp hides behind a wall of brambles and old roots.",
        enemies: [
          { templateId: "goblin_scout", count: 2, behaviorId: "enemy_skirmisher" },
          { templateId: "goblin_brute", count: 1, behaviorId: "enemy_brute" },
        ],
      },
    ],
    rewardIntent: [
      { kind: "gold" },
      { kind: "experience" },
      { kind: "equipment", rarity: "uncommon" },
    ],
    completionText:
      "The fire is out and the wood is quiet again. Thornbury's hunters will have stories to tell.",
    failureText:
      "You drag the wounded back to the charcoal path. The wood keeps its secrets a little longer.",
    storylineKey: "whispering_wood",
  },
  {
    key: "fallback_old_road_scout",
    type: "scout",
    category: "opportunity",
    title: "Tracks on the Old Road",
    hook: "Fresh tracks leave the trade road and vanish into the birches.",
    description:
      "A merchant reports missing crates and a trail of boot prints heading toward the Whispering Wood. A quick scout could map the way.",
    introduction:
      "The prints are fresh, and they do not double back. Following them means finding whatever has been using the old road.",
    regionId: "greenreach",
    locationId: "old_road",
    difficultyBand: "easy",
    objectiveKind: "discover_location",
    targetLocationId: "whispering_wood",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText: "The trail leads into the Whispering Wood. You mark the path for the guild.",
    failureText: "The trail goes cold at the treeline.",
    expiresInWorldTurns: 4,
  },
  {
    key: "fallback_mossbarrow_research",
    type: "research",
    category: "opportunity",
    title: "Mossbarrow Fragments",
    hook: "A fallen stone carries script older than Thornbury itself.",
    description:
      "The village elder wants the mossbarrow stone copied and compared against the guild's older records.",
    introduction:
      "The stone lies half-buried beneath a hawthorn. Its letters are worn, but not gone.",
    regionId: "greenreach",
    locationId: "old_road",
    difficultyBand: "easy",
    objectiveKind: "complete_research",
    encounters: [],
    rewardIntent: [{ kind: "research" }, { kind: "experience" }],
    completionText:
      "You copy the fragments into the guild ledger. The elder will want to see these.",
    failureText: "The rubbing smudges before it can be finished.",
    expiresInWorldTurns: 5,
  },
  {
    key: "fallback_bandit_ford",
    type: "attack",
    category: "opportunity",
    title: "Bandits at the Ford",
    hook: "Toll collectors have set up at the shallow crossing.",
    description:
      "Armed men demand coin from every cart crossing the ford. The village has had enough.",
    introduction: "Three figures wait by the crossing, one with a bow. They have seen you coming.",
    regionId: "greenreach",
    locationId: "old_road",
    difficultyBand: "normal",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "The Ford",
        description: "Bandits spread across the shallow water, bows and blades ready.",
        enemies: [
          { templateId: "bandit_thug", count: 2, behaviorId: "enemy_brute" },
          { templateId: "bandit_archer", count: 1, behaviorId: "enemy_skirmisher" },
        ],
      },
    ],
    rewardIntent: [
      { kind: "gold" },
      { kind: "experience" },
      { kind: "equipment", rarity: "uncommon" },
    ],
    completionText: "The ford is clear. The next cart crosses without paying a toll.",
    failureText: "You fall back from the ford, leaving the bandits to their business.",
    expiresInWorldTurns: 4,
  },
];

export function locationName(locationId: string | undefined): string | undefined {
  if (!locationId) return undefined;
  for (const region of regions) {
    const found = region.locations.find((location) => location.id === locationId);
    if (found) return found.name;
  }
  return undefined;
}

export function locationRegion(locationId: string): RegionDefinition | undefined {
  return regions.find((region) => region.locations.some((location) => location.id === locationId));
}
