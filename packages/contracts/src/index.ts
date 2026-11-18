import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums and primitives                                                */
/* ------------------------------------------------------------------ */

export const ArchetypeSchema = z.enum(["warrior", "ranger", "mage", "cleric"]);
export const DiscoveryStatusSchema = z.enum(["unknown", "discovered", "accessible"]);
export const EventTypeSchema = z.enum(["dungeon", "scout", "research", "attack"]);
export const EventCategorySchema = z.enum(["storyline", "opportunity"]);
export const EventStatusSchema = z.enum(["available", "active", "completed", "failed", "expired"]);
export const DifficultyBandSchema = z.enum(["easy", "normal", "hard"]);
export const ObjectiveKindSchema = z.enum([
  "defeat_enemies",
  "discover_location",
  "complete_research",
]);
export const RewardKindSchema = z.enum(["gold", "experience", "equipment", "research"]);
export const RaritySchema = z.enum(["common", "uncommon", "rare"]);
export const RowSchema = z.enum(["front", "back"]);
export const BattleOutcomeSchema = z.enum(["victory", "defeat", "draw"]);
export const EventSourceSchema = z.enum(["generated", "fallback", "authored"]);

export type Archetype = z.infer<typeof ArchetypeSchema>;
export type DiscoveryStatus = z.infer<typeof DiscoveryStatusSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type EventCategory = z.infer<typeof EventCategorySchema>;
export type EventStatus = z.infer<typeof EventStatusSchema>;
export type DifficultyBand = z.infer<typeof DifficultyBandSchema>;
export type ObjectiveKind = z.infer<typeof ObjectiveKindSchema>;
export type RewardKind = z.infer<typeof RewardKindSchema>;
export type Row = z.infer<typeof RowSchema>;
export type BattleOutcome = z.infer<typeof BattleOutcomeSchema>;
export type EventSource = z.infer<typeof EventSourceSchema>;

export const AttributesSchema = z.object({
  strength: z.number().int(),
  agility: z.number().int(),
  intelligence: z.number().int(),
  vitality: z.number().int(),
});

export const DerivedStatsSchema = z.object({
  maxHealth: z.number().int(),
  maxMana: z.number().int(),
  attack: z.number().int(),
  magicAttack: z.number().int(),
  defense: z.number().int(),
  speed: z.number().int(),
  critChance: z.number(),
});

export const EquipmentBonusesSchema = z.object({
  attack: z.number().optional(),
  magicAttack: z.number().optional(),
  defense: z.number().optional(),
  speed: z.number().optional(),
  health: z.number().optional(),
  mana: z.number().optional(),
  critChance: z.number().optional(),
});

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

export const EquipmentItemDtoSchema = z.object({
  instanceId: z.string(),
  definitionId: z.string(),
  name: z.string(),
  slot: z.enum(["weapon", "armor", "accessory"]),
  rarity: RaritySchema,
  description: z.string(),
  bonuses: EquipmentBonusesSchema,
});
export type Rarity = z.infer<typeof RaritySchema>;

export type EquipmentItemDto = z.infer<typeof EquipmentItemDtoSchema>;

export const CharacterDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  archetype: ArchetypeSchema,
  level: z.number().int(),
  experience: z.number().int(),
  xpToNext: z.number().int(),
  attributes: AttributesSchema,
  bonuses: EquipmentBonusesSchema,
  derived: DerivedStatsSchema,
  health: z.number().int(),
  maxHealth: z.number().int(),
  mana: z.number().int(),
  maxMana: z.number().int(),
  equipment: z.object({
    weapon: EquipmentItemDtoSchema.nullable(),
    armor: EquipmentItemDtoSchema.nullable(),
    accessory: EquipmentItemDtoSchema.nullable(),
  }),
  abilityIds: z.array(z.string()),
  combatBehaviorId: z.string(),
  formation: RowSchema,
  incapacitated: z.boolean(),
  power: z.number().int(),
});
export type CharacterDto = z.infer<typeof CharacterDtoSchema>;

export const LocationDtoSchema = z.object({
  id: z.string(),
  regionId: z.string(),
  name: z.string(),
  description: z.string(),
  status: DiscoveryStatusSchema,
  discoveredTurn: z.number().int().nullable(),
});
export type LocationDto = z.infer<typeof LocationDtoSchema>;

export const RegionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  levelRange: z.object({ min: z.number().int(), max: z.number().int() }),
  status: DiscoveryStatusSchema,
  threatLevel: z.number().int(),
  locations: z.array(LocationDtoSchema),
});
export type RegionDto = z.infer<typeof RegionDtoSchema>;

export const WorldDtoSchema = z.object({
  id: z.string(),
  turn: z.number().int(),
  currentRegionId: z.string(),
  regions: z.array(RegionDtoSchema),
});
export type WorldDto = z.infer<typeof WorldDtoSchema>;

export const PartyDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(CharacterDtoSchema),
  power: z.number().int(),
});
export type PartyDto = z.infer<typeof PartyDtoSchema>;

export const PlayerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  gold: z.number().int(),
  researchPoints: z.number().int(),
});
export type PlayerDto = z.infer<typeof PlayerDtoSchema>;

export const EventObjectiveDtoSchema = z.object({
  kind: ObjectiveKindSchema,
  description: z.string(),
  targetCount: z.number().int().nullable(),
  progress: z.number().int(),
  completed: z.boolean(),
});
export type EventObjectiveDto = z.infer<typeof EventObjectiveDtoSchema>;

export const EventEncounterDtoSchema = z.object({
  index: z.number().int(),
  title: z.string(),
  description: z.string(),
  enemies: z.array(z.object({ name: z.string(), count: z.number().int() })),
  status: z.enum(["pending", "active", "completed", "failed"]),
});
export type EventEncounterDto = z.infer<typeof EventEncounterDtoSchema>;

export const RewardPreviewDtoSchema = z.object({
  gold: z.number().int(),
  experiencePerCharacter: z.number().int(),
  researchPoints: z.number().int(),
  equipment: z.array(z.object({ name: z.string(), rarity: RaritySchema })),
});
export type RewardPreviewDto = z.infer<typeof RewardPreviewDtoSchema>;

export const EventSummaryDtoSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  category: EventCategorySchema,
  title: z.string(),
  hook: z.string(),
  status: EventStatusSchema,
  difficultyBand: DifficultyBandSchema,
  regionId: z.string(),
  regionName: z.string(),
  locationId: z.string().nullable(),
  locationName: z.string().nullable(),
  expiresOnTurn: z.number().int().nullable(),
  encounterCount: z.number().int(),
  encountersCompleted: z.number().int(),
  objectiveKind: ObjectiveKindSchema,
  source: EventSourceSchema,
  createdTurn: z.number().int(),
  recommendedPower: z.number().int(),
});
export type EventSummaryDto = z.infer<typeof EventSummaryDtoSchema>;

export const EventDetailDtoSchema = EventSummaryDtoSchema.extend({
  description: z.string(),
  introduction: z.string(),
  objectives: z.array(EventObjectiveDtoSchema),
  encounters: z.array(EventEncounterDtoSchema),
  rewardPreview: RewardPreviewDtoSchema,
  completionText: z.string(),
  failureText: z.string(),
  resultText: z.string().nullable(),
  currentEncounterIndex: z.number().int(),
  partyPower: z.number().int(),
  canAccept: z.boolean(),
  canStart: z.boolean(),
  canResolve: z.boolean(),
  generation: z
    .object({
      model: z.string().nullable(),
      promptVersion: z.string().nullable(),
      schemaVersion: z.string().nullable(),
    })
    .nullable(),
});
export type EventDetailDto = z.infer<typeof EventDetailDtoSchema>;

export const BattleLogEntryDtoSchema = z.object({
  round: z.number().int(),
  actorId: z.string(),
  actorName: z.string(),
  actionId: z.string(),
  actionName: z.string(),
  type: z.enum(["damage", "heal", "buff", "debuff", "status", "defeat"]),
  targetIds: z.array(z.string()),
  targetNames: z.array(z.string()),
  amount: z.number().optional(),
  crit: z.boolean().optional(),
  reason: z.string(),
  text: z.string(),
});
export type BattleLogEntryDto = z.infer<typeof BattleLogEntryDtoSchema>;

export const CombatantResultDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  side: z.enum(["party", "enemy"]),
  hp: z.number().int(),
  maxHp: z.number().int(),
  alive: z.boolean(),
});

export type CombatantResultDto = z.infer<typeof CombatantResultDtoSchema>;

export const BattleReportDtoSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  encounterIndex: z.number().int(),
  encounterTitle: z.string(),
  outcome: BattleOutcomeSchema,
  rounds: z.number().int(),
  seed: z.number().int(),
  actionLog: z.array(BattleLogEntryDtoSchema),
  partyAfter: z.array(CombatantResultDtoSchema),
  enemiesAfter: z.array(CombatantResultDtoSchema),
  createdAt: z.string(),
});
export type BattleReportDto = z.infer<typeof BattleReportDtoSchema>;

export const InventoryItemDtoSchema = EquipmentItemDtoSchema.extend({
  equippedBy: z.string().nullable(),
  equippedByName: z.string().nullable(),
  acquiredTurn: z.number().int(),
});
export type InventoryItemDto = z.infer<typeof InventoryItemDtoSchema>;

export const JournalEntryDtoSchema = z.object({
  id: z.string(),
  turn: z.number().int(),
  kind: z.string(),
  title: z.string(),
  detail: z.string(),
  createdAt: z.string(),
});
export type JournalEntryDto = z.infer<typeof JournalEntryDtoSchema>;

export const GenerationRecordDtoSchema = z.object({
  id: z.string(),
  task: z.string(),
  status: z.string(),
  model: z.string(),
  promptVersion: z.string().nullable(),
  schemaVersion: z.string().nullable(),
  latencyMs: z.number().int(),
  errorCode: z.string().nullable(),
  createdAt: z.string(),
});
export type GenerationRecordDto = z.infer<typeof GenerationRecordDtoSchema>;

export const LlmStatusDtoSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  reachable: z.boolean().nullable(),
  model: z.string(),
  baseUrl: z.string(),
  lastGeneration: GenerationRecordDtoSchema.nullable(),
  fallbackActive: z.boolean(),
});
export type LlmStatusDto = z.infer<typeof LlmStatusDtoSchema>;

export const SystemHealthDtoSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  api: z.literal("ok"),
  database: z.object({ ok: z.boolean(), schemaVersion: z.string().nullable() }),
  llm: LlmStatusDtoSchema,
  correlationId: z.string(),
});
export type SystemHealthDto = z.infer<typeof SystemHealthDtoSchema>;

export const GameStateDtoSchema = z.object({
  player: PlayerDtoSchema,
  world: WorldDtoSchema,
  party: PartyDtoSchema,
  events: z.array(EventSummaryDtoSchema),
  journal: z.array(JournalEntryDtoSchema),
});
export type GameStateDto = z.infer<typeof GameStateDtoSchema>;

export const EventListDtoSchema = z.object({
  turn: z.number().int(),
  events: z.array(EventSummaryDtoSchema),
});
export type EventListDto = z.infer<typeof EventListDtoSchema>;

export const CommandResponseDtoSchema = z.object({
  state: GameStateDtoSchema,
  event: EventDetailDtoSchema.nullable().optional(),
  report: BattleReportDtoSchema.nullable().optional(),
});
export type CommandResponseDto = z.infer<typeof CommandResponseDtoSchema>;

export const PartyWithInventoryDtoSchema = z.object({
  party: PartyDtoSchema,
  inventory: z.array(InventoryItemDtoSchema),
});
export type PartyWithInventoryDto = z.infer<typeof PartyWithInventoryDtoSchema>;

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

export const OperationRequestSchema = z.object({
  operationId: z.string().min(8).max(120).optional(),
});
export type OperationRequest = z.infer<typeof OperationRequestSchema>;

export const DiscoverRequestSchema = OperationRequestSchema.extend({
  locationId: z.string().min(1),
});
export type DiscoverRequest = z.infer<typeof DiscoverRequestSchema>;

export const RestRequestSchema = OperationRequestSchema;
export const EquipRequestSchema = OperationRequestSchema.extend({
  characterId: z.string().min(1),
  itemId: z.string().min(1),
});
export const UnequipRequestSchema = OperationRequestSchema.extend({
  characterId: z.string().min(1),
  slot: z.enum(["weapon", "armor", "accessory"]),
});
export const FormationRequestSchema = OperationRequestSchema.extend({
  characterId: z.string().min(1),
  row: RowSchema,
});

export interface CommandResult<T> {
  data: T;
  replayed: boolean;
  correlationId: string;
}

export const ApiErrorDtoSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorDto = z.infer<typeof ApiErrorDtoSchema>;

/* ------------------------------------------------------------------ */
/* LLM output contracts (untrusted input)                              */
/* ------------------------------------------------------------------ */

export const EventConceptSchema = z.object({
  type: EventTypeSchema,
  category: EventCategorySchema,
  title: z.string().min(4).max(80),
  hook: z.string().min(10).max(240),
  regionId: z.string().min(1).max(64),
  locationId: z.string().min(1).max(64).optional(),
  difficultyBand: DifficultyBandSchema,
  objectiveKind: ObjectiveKindSchema,
  expiresInWorldTurns: z.number().int().min(1).max(10).optional(),
  storylineKey: z.string().min(1).max(64).optional(),
});
export type EventConcept = z.infer<typeof EventConceptSchema>;

export const GeneratedEventSchema = z.object({
  title: z.string().min(4).max(90),
  description: z.string().min(20).max(600),
  introduction: z.string().min(20).max(900),
  objectives: z
    .array(
      z.object({
        kind: ObjectiveKindSchema,
        description: z.string().min(4).max(200),
        targetCount: z.number().int().min(1).max(10).optional(),
      }),
    )
    .min(1)
    .max(2),
  encounters: z
    .array(
      z.object({
        title: z.string().min(3).max(90),
        description: z.string().min(10).max(400),
        enemies: z
          .array(
            z.object({
              templateId: z.string().min(1).max(64),
              count: z.number().int().min(1).max(4),
              behaviorId: z.string().min(1).max(64),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .max(2),
  rewardIntent: z
    .array(
      z.object({
        kind: RewardKindSchema,
        rarity: RaritySchema.optional(),
        target: z.enum(["party", "character"]).optional(),
      }),
    )
    .min(1)
    .max(4),
  completionText: z.string().min(10).max(500),
  failureText: z.string().min(10).max(500),
});
export type GeneratedEvent = z.infer<typeof GeneratedEventSchema>;

export const NarrativeResponseSchema = z.object({
  text: z.string().min(1).max(600),
});
export type NarrativeResponse = z.infer<typeof NarrativeResponseSchema>;

export const NarrativeRequestSchema = z.object({
  kind: z.enum(["teaser", "introduction", "discovery", "victory", "defeat"]),
  context: z.string().min(1).max(400),
});
