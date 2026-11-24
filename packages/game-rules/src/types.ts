/** Shared, framework-free game types and formulas. */

export type Archetype = "warrior" | "ranger" | "mage" | "cleric";
export type DiscoveryStatus = "unknown" | "discovered" | "accessible";
export type EventType = "dungeon" | "scout" | "research" | "attack";
export type EventCategory = "storyline" | "opportunity";
export type EventStatus = "available" | "active" | "completed" | "failed" | "expired";
export type DifficultyBand = "easy" | "normal" | "hard";
export type ObjectiveKind = "defeat_enemies" | "discover_location" | "complete_research";
export type RewardKind = "gold" | "experience" | "equipment" | "research";
export type Rarity = "common" | "uncommon" | "rare";
export type Row = "front" | "back";

export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
}

export interface EquipmentBonuses {
  attack?: number;
  magicAttack?: number;
  defense?: number;
  speed?: number;
  health?: number;
  mana?: number;
  critChance?: number;
}

export interface CharacterForStats {
  attributes: Attributes;
  level: number;
  bonuses?: EquipmentBonuses;
}

export interface DerivedStats {
  maxHealth: number;
  maxMana: number;
  attack: number;
  magicAttack: number;
  defense: number;
  speed: number;
  critChance: number;
}

export type AbilityKind = "physical" | "magic" | "heal" | "buff";
export type AbilityTarget = "enemy" | "lowest_enemy" | "ally_lowest" | "all_enemies" | "self";

export interface AbilityEffect {
  type: "poison" | "defense_down" | "defense_up";
  amount?: number;
  damage?: number;
  rounds: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  power: number;
  target: AbilityTarget;
  cooldownRounds: number;
  effect?: AbilityEffect;
}

export interface CombatantInput {
  id: string;
  name: string;
  side: "party" | "enemy";
  archetype?: Archetype | string;
  behaviorId: string;
  row: Row;
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  magicAttack: number;
  defense: number;
  speed: number;
  critChance: number;
  abilityIds: string[];
}

export interface CombatantResult {
  id: string;
  name: string;
  side: "party" | "enemy";
  hp: number;
  maxHp: number;
  alive: boolean;
}

export type BattleOutcome = "victory" | "defeat" | "draw";

export interface BattleLogEntry {
  round: number;
  actorId: string;
  actorName: string;
  actionId: string;
  actionName: string;
  type: "damage" | "heal" | "buff" | "debuff" | "status" | "defeat";
  targetIds: string[];
  targetNames: string[];
  amount?: number;
  crit?: boolean;
  reason: string;
  text: string;
}

export interface BattleResult {
  outcome: BattleOutcome;
  rounds: number;
  seed: number;
  log: BattleLogEntry[];
  party: CombatantResult[];
  enemies: CombatantResult[];
}

export interface RewardIntent {
  kind: RewardKind;
  rarity?: Rarity;
  target?: "party" | "character";
}

export interface RewardPlan {
  gold: number;
  experiencePerCharacter: number;
  researchPoints: number;
  equipment: Array<{ rarity: Rarity }>;
}

export interface EnemyTemplate {
  id: string;
  name: string;
  description: string;
  level: number;
  /** Broad content family used for region allowlists. */
  family: string;
  behaviorId: string;
  attributes: Attributes;
  abilityIds: string[];
  row: Row;
}

export type RegionConnectionStatus = "unknown" | "known" | "open" | "blocked";

export interface RegionConnectionDefinition {
  toRegionId: string;
  status: RegionConnectionStatus;
}

export type RegionAccessCondition =
  | { kind: "start" }
  | { kind: "scout"; fromRegionId: string; targetLocationId: string };

export interface LocationDefinition {
  id: string;
  version: number;
  tags: string[];
  name: string;
  description: string;
  status: DiscoveryStatus;
  /** Bidirectional location adjacency within the same region. */
  connections: string[];
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: "weapon" | "armor" | "accessory";
  rarity: Rarity;
  description: string;
  bonuses: EquipmentBonuses;
}

export interface RegionDefinition {
  id: string;
  version: number;
  tags: string[];
  name: string;
  description: string;
  levelRange: { min: number; max: number };
  status: DiscoveryStatus;
  threatLevel: number;
  eventTypes: EventType[];
  enemyFamilies: string[];
  accessCondition: RegionAccessCondition;
  connections: RegionConnectionDefinition[];
  locations: LocationDefinition[];
}
