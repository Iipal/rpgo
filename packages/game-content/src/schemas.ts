import { z } from "zod";

const IdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "use lowercase snake_case ids");

const TagSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9_-]*$/, "use lowercase tag names");

const DiscoveryStatusSchema = z.enum(["unknown", "discovered", "accessible"]);
const EventTypeSchema = z.enum(["dungeon", "scout", "research", "attack"]);
const RowSchema = z.enum(["front", "back"]);
const RaritySchema = z.enum(["common", "uncommon", "rare"]);
const AbilityKindSchema = z.enum(["physical", "magic", "heal", "buff"]);
const AbilityTargetSchema = z.enum(["enemy", "lowest_enemy", "ally_lowest", "all_enemies", "self"]);

export const AttributesSchema = z.object({
  strength: z.number().int().min(0),
  agility: z.number().int().min(0),
  intelligence: z.number().int().min(0),
  vitality: z.number().int().min(0),
});

export const LocationDefinitionSchema = z.object({
  id: IdSchema,
  version: z.number().int().positive(),
  tags: z.array(TagSchema).min(1),
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(400),
  status: DiscoveryStatusSchema,
  connections: z.array(IdSchema),
});

export const RegionAccessConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start") }),
  z.object({
    kind: z.literal("scout"),
    fromRegionId: IdSchema,
    targetLocationId: IdSchema,
  }),
]);

export const RegionConnectionSchema = z.object({
  toRegionId: IdSchema,
  status: z.enum(["unknown", "known", "open", "blocked"]),
});

export const RegionDefinitionSchema = z.object({
  id: IdSchema,
  version: z.number().int().positive(),
  tags: z.array(TagSchema).min(1),
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(400),
  levelRange: z.object({
    min: z.number().int().min(1).max(20),
    max: z.number().int().min(1).max(20),
  }),
  status: DiscoveryStatusSchema,
  threatLevel: z.number().int().min(1).max(10),
  eventTypes: z.array(EventTypeSchema).min(1),
  enemyFamilies: z.array(TagSchema).min(1),
  accessCondition: RegionAccessConditionSchema,
  connections: z.array(RegionConnectionSchema),
  locations: z.array(LocationDefinitionSchema).min(4).max(8),
});

export const RegionFileSchema = z.object({
  contentVersion: z.number().int().positive(),
  regions: z.array(RegionDefinitionSchema).min(4).max(8),
});

export const EnemyTemplateSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(400),
  level: z.number().int().min(1).max(20),
  family: TagSchema,
  behaviorId: z.string().min(2).max(64),
  attributes: AttributesSchema,
  abilityIds: z.array(IdSchema).min(1),
  row: RowSchema,
});

export const EnemyFileSchema = z.object({
  enemies: z.array(EnemyTemplateSchema),
});

export const AbilityDefinitionSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(80),
  description: z.string().min(5).max(400),
  kind: AbilityKindSchema,
  power: z.number().min(0).max(10),
  target: AbilityTargetSchema,
  cooldownRounds: z.number().int().min(0).max(20),
  effect: z
    .object({
      type: z.enum(["poison", "defense_down", "defense_up"]),
      amount: z.number().min(0).max(10).optional(),
      damage: z.number().min(0).max(1000).optional(),
      rounds: z.number().int().min(1).max(20),
    })
    .optional(),
});

export const AbilityFileSchema = z.object({
  abilities: z.array(AbilityDefinitionSchema),
});

export const EquipmentDefinitionSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(80),
  slot: z.enum(["weapon", "armor", "accessory"]),
  rarity: RaritySchema,
  description: z.string().min(5).max(400),
  bonuses: z.object({
    attack: z.number().optional(),
    magicAttack: z.number().optional(),
    defense: z.number().optional(),
    speed: z.number().optional(),
    health: z.number().optional(),
    mana: z.number().optional(),
    critChance: z.number().optional(),
  }),
});

export const EquipmentFileSchema = z.object({
  equipment: z.array(EquipmentDefinitionSchema),
});
