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
import {
  AbilityFileSchema,
  EnemyFileSchema,
  EquipmentFileSchema,
  RegionFileSchema,
} from "./schemas";

const parsedRegions = RegionFileSchema.parse(regionsData);
export const contentVersion = parsedRegions.contentVersion;
export const regions = parsedRegions.regions as RegionDefinition[];
export const abilities = AbilityFileSchema.parse(abilitiesData).abilities as AbilityDefinition[];
export const enemies = EnemyFileSchema.parse(enemiesData).enemies as EnemyTemplate[];
export const equipment = EquipmentFileSchema.parse(equipmentData)
  .equipment as EquipmentDefinition[];

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
  {
    key: "fallback_ashen_gate_scout",
    type: "scout",
    category: "opportunity",
    title: "Smoke Beyond the Marches",
    hook: "A column of ash rises where the old boundary stones used to stand.",
    description:
      "Travellers on the old road speak of a blackened gatehouse beyond the boundary stones. Someone should map the approach before the guild commits armed men.",
    introduction:
      "The boundary stones lean in the grass, their carvings worn smooth. Beyond them the ground turns grey, and the air tastes of cold iron.",
    regionId: "greenreach",
    locationId: "old_road",
    difficultyBand: "normal",
    objectiveKind: "discover_location",
    targetLocationId: "ashen_gate",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText:
      "The Ashen Gate stands at the end of the trail. You sketch its outline and hurry back before dark.",
    failureText: "The trail fades among the boundary stones, and you turn back.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_ashen_gate_assault",
    type: "attack",
    category: "opportunity",
    title: "The Gatehouse Watch",
    hook: "Something keeps watch at the Ashen Gate, and it has seen you.",
    description:
      "Charred plate and old bone hold the gatehouse. If the guild means to use the march road, this watch must be broken.",
    introduction:
      "Ember light spills between the gate's broken teeth. A figure in charred plate turns its head, and the bones at its feet begin to rise.",
    regionId: "ashen_march",
    locationId: "ashen_gate",
    difficultyBand: "hard",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "Charred Plate",
        description: "An ash warden and its skeleton escort block the gate.",
        enemies: [
          { templateId: "ash_warden", count: 1, behaviorId: "enemy_brute" },
          { templateId: "skeleton_warrior", count: 1, behaviorId: "enemy_brute" },
          { templateId: "cultist", count: 1, behaviorId: "enemy_caster" },
        ],
      },
    ],
    rewardIntent: [{ kind: "gold" }, { kind: "experience" }, { kind: "equipment", rarity: "rare" }],
    completionText:
      "The warden comes apart in a shower of embers. The gate is quiet, and the march road is open.",
    failureText: "The ember light drives you back through the boundary stones.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_frostmere_scout",
    type: "scout",
    category: "opportunity",
    title: "The Cold Road North",
    hook: "A frozen pass opens beyond the Ashen Gate, and something is moving on it.",
    description:
      "The guild wants the northern approach charted before any company risks the highland lake country.",
    introduction:
      "Beyond the gate the ash gives way to frost. A line of old waystones points north toward grey water.",
    regionId: "ashen_march",
    locationId: "ashen_gate",
    difficultyBand: "normal",
    objectiveKind: "discover_location",
    targetLocationId: "frostmere_shore",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText: "The waystones lead to a cold shore. You mark the route and turn back.",
    failureText: "The pass closes in snow before you can chart it.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_frostmere_watch",
    type: "attack",
    category: "opportunity",
    title: "Wolves on the Shingle",
    hook: "Pale wolves have been pulling down travellers at the Frostmere shore.",
    description:
      "The first company to reach the lake found fresh kills and a frozen revenant standing guard over them.",
    introduction:
      "The wolves are waiting among the reeds. Behind them, something in rusted mail rises stiffly from the shingle.",
    regionId: "frostmere",
    locationId: "frostmere_shore",
    difficultyBand: "hard",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "The Frozen Shore",
        description: "Frost wolves circle while a rime revenant blocks the way inland.",
        enemies: [
          { templateId: "frost_wolf", count: 2, behaviorId: "enemy_skirmisher" },
          { templateId: "rime_revenant", count: 1, behaviorId: "enemy_brute" },
        ],
      },
    ],
    rewardIntent: [{ kind: "gold" }, { kind: "experience" }, { kind: "equipment", rarity: "rare" }],
    completionText: "The shore is quiet. The waystones are safe to follow again.",
    failureText: "You retreat across the shingle with the wolves still calling.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_sunken_scout",
    type: "scout",
    category: "opportunity",
    title: "The Tide Road",
    hook: "When the water pulls back, a road of drowned stone leads south.",
    description:
      "Frostmere's fishers say the old harbour lights are burning again. The guild wants the coast mapped.",
    introduction:
      "At low tide the lakebed opens into a causeway. Salt crusts the stones, and green light moves beneath the water.",
    regionId: "frostmere",
    locationId: "frostmere_shore",
    difficultyBand: "hard",
    objectiveKind: "discover_location",
    targetLocationId: "tidewreck_harbor",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText:
      "The causeway reaches a ruined harbour. You chart the landing before the tide returns.",
    failureText: "The tide turns early, and the causeway vanishes under grey water.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_sunken_raid",
    type: "attack",
    category: "opportunity",
    title: "What the Tide Left",
    hook: "Drowned sailors are unloading cargo that was never meant to surface.",
    description:
      "The harbour is occupied. Barnacled figures work the quays under the direction of a brine-soaked witch.",
    introduction:
      "The corsairs turn as one. Water spills from their boots, and the witch begins to sing.",
    regionId: "sunken_coast",
    locationId: "tidewreck_harbor",
    difficultyBand: "hard",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "The Ruined Quay",
        description: "Drowned corsairs hold the landing while a tide witch calls the water.",
        enemies: [
          { templateId: "drowned_corsair", count: 2, behaviorId: "enemy_skirmisher" },
          { templateId: "tide_witch", count: 1, behaviorId: "enemy_support" },
        ],
      },
    ],
    rewardIntent: [{ kind: "gold" }, { kind: "experience" }, { kind: "equipment", rarity: "rare" }],
    completionText: "The last corsair falls. The harbour lights gutter out, and the tide is still.",
    failureText: "The water rises behind you, and the company abandons the quay.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_ember_scout",
    type: "scout",
    category: "opportunity",
    title: "The Warm Road",
    hook: "A stair in the smugglers' cove breathes heat from below.",
    description:
      "The coast smugglers have been trading with something under the hills. The guild wants the descent mapped.",
    introduction:
      "The stair is cut from black basalt. Warm air rises in slow pulses, carrying the ring of distant hammers.",
    regionId: "sunken_coast",
    locationId: "tidewreck_harbor",
    difficultyBand: "hard",
    objectiveKind: "discover_location",
    targetLocationId: "ember_gate",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText:
      "The stair ends at a basalt gate. You sketch the approach and climb back into the light.",
    failureText: "The heat grows unbearable, and you turn back before the gate.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_ember_forge",
    type: "attack",
    category: "opportunity",
    title: "The Bellows Never Stop",
    hook: "A forge below the hills is still working, though its smiths are long dead.",
    description:
      "Cinder hounds patrol the gate while a forge golem keeps the old bellows moving. The guild wants the works silenced.",
    introduction:
      "Sparks drift through the basalt arch. A hound lifts its head, embers waking along its spine.",
    regionId: "emberdeep",
    locationId: "ember_gate",
    difficultyBand: "hard",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "The Ember Gate",
        description: "Cinder hounds and a forge golem guard the entrance to the deep works.",
        enemies: [
          { templateId: "cinder_hound", count: 2, behaviorId: "enemy_skirmisher" },
          { templateId: "forge_golem", count: 1, behaviorId: "enemy_brute" },
        ],
      },
    ],
    rewardIntent: [{ kind: "gold" }, { kind: "experience" }, { kind: "equipment", rarity: "rare" }],
    completionText:
      "The golem folds in on itself. The bellows fall silent for the first time in years.",
    failureText: "The heat and the hounds drive you back through the gate.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_crown_scout",
    type: "scout",
    category: "opportunity",
    title: "The Glass Road",
    hook: "Beyond the magma core, a white road crosses a plain of shattered glass.",
    description:
      "The guild believes the road leads to the seat of the old kingdom. Someone must walk it first.",
    introduction:
      "The road is unnaturally smooth. Every step rings across the glass fields, and far off a palace waits.",
    regionId: "emberdeep",
    locationId: "ember_gate",
    difficultyBand: "hard",
    objectiveKind: "discover_location",
    targetLocationId: "crown_threshold",
    encounters: [],
    rewardIntent: [{ kind: "experience" }, { kind: "gold" }],
    completionText:
      "The white road reaches a dark threshold. You mark the way and return before nightfall.",
    failureText: "The glass fields shift underfoot, and you lose the road.",
    expiresInWorldTurns: 6,
  },
  {
    key: "fallback_crown_court",
    type: "attack",
    category: "opportunity",
    title: "The Court Expects You",
    hook: "A masked herald waits at the threshold with an invitation no one remembers accepting.",
    description:
      "The Hollow Crown's court has kept its watch for a very long time. The guild wants the palace approach cleared.",
    introduction:
      "The herald bows without bending. Behind him, a knight of glass draws a blade full of reflected sky.",
    regionId: "hollow_crown",
    locationId: "crown_threshold",
    difficultyBand: "hard",
    objectiveKind: "defeat_enemies",
    encounters: [
      {
        title: "The Crown Threshold",
        description: "A glass knight, a crown wraith, and a hollow herald hold the palace road.",
        enemies: [
          { templateId: "glass_knight", count: 1, behaviorId: "enemy_brute" },
          { templateId: "crown_wraith", count: 1, behaviorId: "enemy_caster" },
          { templateId: "hollow_herald", count: 1, behaviorId: "enemy_support" },
        ],
      },
    ],
    rewardIntent: [{ kind: "gold" }, { kind: "experience" }, { kind: "equipment", rarity: "rare" }],
    completionText: "The court falls silent. The road to the empty throne lies open.",
    failureText: "The herald's laughter follows you back across the glass.",
    expiresInWorldTurns: 6,
  },
];

export interface ContentValidationInput {
  regions: RegionDefinition[];
  enemies: EnemyTemplate[];
  abilities: AbilityDefinition[];
  equipment: EquipmentDefinition[];
  fallbackEvents: FallbackEventDefinition[];
  starterParty: StarterCharacterDefinition[];
  starterInventory: string[];
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

/** Cross-file reference checks that a per-file Zod schema cannot express. */
export function findContentErrors(input: ContentValidationInput): string[] {
  const errors: string[] = [];
  const regionById = new Map(input.regions.map((region) => [region.id, region]));
  const locationById = new Map<string, { region: RegionDefinition; id: string }>();
  const abilityIds = new Set(input.abilities.map((ability) => ability.id));
  const equipmentIds = new Set(input.equipment.map((item) => item.id));

  const regionIds = input.regions.map((region) => region.id);
  for (const id of duplicates(regionIds)) errors.push(`duplicate region id: ${id}`);
  for (const region of input.regions) {
    const localIds = region.locations.map((location) => location.id);
    for (const id of duplicates(localIds))
      errors.push(`region ${region.id}: duplicate location ${id}`);
    for (const location of region.locations) {
      if (locationById.has(location.id)) {
        errors.push(`duplicate location id across regions: ${location.id}`);
      }
      locationById.set(location.id, { region, id: location.id });
    }
    if (region.levelRange.min > region.levelRange.max) {
      errors.push(`region ${region.id}: level range is inverted`);
    }
    if (new Set(region.eventTypes).size !== region.eventTypes.length) {
      errors.push(`region ${region.id}: duplicate event type allowlist entry`);
    }
    for (const family of region.enemyFamilies) {
      if (!input.enemies.some((enemy) => enemy.family === family)) {
        errors.push(`region ${region.id}: enemy family ${family} has no templates`);
      }
    }
    if (region.status === "unknown") {
      for (const location of region.locations) {
        if (location.status !== "unknown") {
          errors.push(`region ${region.id}: unknown region contains a known location`);
        }
      }
    }
    if (
      region.status === "accessible" &&
      !region.locations.some((l) => l.status === "accessible")
    ) {
      errors.push(`region ${region.id}: accessible region has no accessible location`);
    }

    const connectedRegions = new Set(region.connections.map((connection) => connection.toRegionId));
    if (connectedRegions.size !== region.connections.length) {
      errors.push(`region ${region.id}: duplicate region connection`);
    }
    for (const connection of region.connections) {
      if (connection.toRegionId === region.id) {
        errors.push(`region ${region.id}: cannot connect to itself`);
        continue;
      }
      const target = regionById.get(connection.toRegionId);
      if (!target) {
        errors.push(`region ${region.id}: unknown connection target ${connection.toRegionId}`);
        continue;
      }
      if (!target.connections.some((reciprocal) => reciprocal.toRegionId === region.id)) {
        errors.push(`region ${region.id}: connection to ${target.id} is not reciprocal`);
      }
    }

    const localConnections = new Set(localIds);
    for (const location of region.locations) {
      if (new Set(location.connections).size !== location.connections.length) {
        errors.push(`location ${location.id}: duplicate location connection`);
      }
      for (const targetId of location.connections) {
        if (targetId === location.id) {
          errors.push(`location ${location.id}: cannot connect to itself`);
          continue;
        }
        if (!localConnections.has(targetId)) {
          errors.push(`location ${location.id}: connection ${targetId} is outside its region`);
          continue;
        }
        const target = region.locations.find((candidate) => candidate.id === targetId);
        if (!target?.connections.includes(location.id)) {
          errors.push(`location ${location.id}: connection to ${targetId} is not reciprocal`);
        }
      }
    }

    if (region.accessCondition.kind === "scout") {
      const condition = region.accessCondition;
      if (!regionById.has(condition.fromRegionId)) {
        errors.push(`region ${region.id}: access condition references unknown region`);
      }
      if (!region.locations.some((location) => location.id === condition.targetLocationId)) {
        errors.push(`region ${region.id}: access condition target is not in the region`);
      }
      const routeEvent = input.fallbackEvents.find(
        (event) =>
          event.regionId === condition.fromRegionId &&
          event.targetLocationId === condition.targetLocationId,
      );
      if (!routeEvent) {
        errors.push(
          `region ${region.id}: no fallback event from ${condition.fromRegionId} targets ${condition.targetLocationId}`,
        );
      }
    }
  }

  const startRegions = input.regions.filter((region) => region.accessCondition.kind === "start");
  if (startRegions.length !== 1) {
    errors.push(`expected exactly one starting region, found ${startRegions.length}`);
  } else {
    const reached = new Set<string>([startRegions[0]!.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const region of input.regions) {
        if (region.accessCondition.kind !== "scout") continue;
        if (reached.has(region.accessCondition.fromRegionId) && !reached.has(region.id)) {
          reached.add(region.id);
          changed = true;
        }
      }
    }
    for (const region of input.regions) {
      if (!reached.has(region.id)) errors.push(`region ${region.id}: not reachable from the start`);
    }
  }

  for (const enemy of input.enemies) {
    for (const abilityId of enemy.abilityIds) {
      if (!abilityIds.has(abilityId)) {
        errors.push(`enemy ${enemy.id}: unknown ability ${abilityId}`);
      }
    }
  }
  for (const item of input.equipment) {
    if (item.bonuses.critChance !== undefined && Math.abs(item.bonuses.critChance) > 1) {
      errors.push(`equipment ${item.id}: crit chance must be a fraction`);
    }
  }
  for (const starter of input.starterParty) {
    for (const abilityId of starter.abilityIds) {
      if (!abilityIds.has(abilityId)) {
        errors.push(`starter ${starter.key}: unknown ability ${abilityId}`);
      }
    }
    for (const entry of starter.equipment) {
      if (!equipmentIds.has(entry.definitionId)) {
        errors.push(`starter ${starter.key}: unknown equipment ${entry.definitionId}`);
      }
    }
  }
  for (const definitionId of input.starterInventory) {
    if (!equipmentIds.has(definitionId)) {
      errors.push(`starter inventory: unknown equipment ${definitionId}`);
    }
  }

  const fallbackKeys = input.fallbackEvents.map((event) => event.key);
  for (const key of duplicates(fallbackKeys)) errors.push(`duplicate fallback event key: ${key}`);
  for (const event of input.fallbackEvents) {
    const region = regionById.get(event.regionId);
    if (!region) {
      errors.push(`fallback ${event.key}: unknown region ${event.regionId}`);
      continue;
    }
    if (!region.eventTypes.includes(event.type)) {
      errors.push(`fallback ${event.key}: event type not allowed in ${region.id}`);
    }
    if (event.locationId) {
      const location = region.locations.find((candidate) => candidate.id === event.locationId);
      if (!location) {
        errors.push(`fallback ${event.key}: location does not belong to ${region.id}`);
      }
    }
    if (event.targetLocationId && !locationById.has(event.targetLocationId)) {
      errors.push(`fallback ${event.key}: unknown target location ${event.targetLocationId}`);
    }
    for (const encounter of event.encounters) {
      for (const enemy of encounter.enemies) {
        const template = input.enemies.find((candidate) => candidate.id === enemy.templateId);
        if (!template) {
          errors.push(`fallback ${event.key}: unknown enemy ${enemy.templateId}`);
          continue;
        }
        if (!region.enemyFamilies.includes(template.family)) {
          errors.push(
            `fallback ${event.key}: enemy family ${template.family} is not allowed in ${region.id}`,
          );
        }
      }
    }
  }

  return errors;
}

export function assertContentValid(): void {
  const errors = findContentErrors({
    regions,
    enemies,
    abilities,
    equipment,
    fallbackEvents,
    starterParty,
    starterInventory,
  });
  if (errors.length > 0) {
    throw new Error(`Invalid static content:\n- ${errors.join("\n- ")}`);
  }
}

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

// Fail fast on invalid authored content rather than serving a broken world.
assertContentValid();
