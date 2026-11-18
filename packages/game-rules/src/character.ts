import type {
  Archetype,
  Attributes,
  CharacterForStats,
  DerivedStats,
  EquipmentBonuses,
} from "./types";

export function baseAttributes(archetype: Archetype): Attributes {
  switch (archetype) {
    case "warrior":
      return { strength: 8, agility: 4, intelligence: 2, vitality: 8 };
    case "ranger":
      return { strength: 5, agility: 8, intelligence: 3, vitality: 5 };
    case "mage":
      return { strength: 3, agility: 4, intelligence: 9, vitality: 4 };
    case "cleric":
      return { strength: 4, agility: 4, intelligence: 6, vitality: 6 };
  }
}

export function levelGrowth(archetype: Archetype): Attributes {
  switch (archetype) {
    case "warrior":
      return { strength: 2, agility: 1, intelligence: 0, vitality: 2 };
    case "ranger":
      return { strength: 1, agility: 2, intelligence: 0, vitality: 1 };
    case "mage":
      return { strength: 0, agility: 1, intelligence: 2, vitality: 1 };
    case "cleric":
      return { strength: 1, agility: 1, intelligence: 1, vitality: 2 };
  }
}

export function baseEquipmentBonuses(): Required<EquipmentBonuses> {
  return { attack: 0, magicAttack: 0, defense: 0, speed: 0, health: 0, mana: 0, critChance: 0 };
}

export function sumBonuses(items: EquipmentBonuses[]): Required<EquipmentBonuses> {
  const total = baseEquipmentBonuses();
  for (const item of items) {
    total.attack += item.attack ?? 0;
    total.magicAttack += item.magicAttack ?? 0;
    total.defense += item.defense ?? 0;
    total.speed += item.speed ?? 0;
    total.health += item.health ?? 0;
    total.mana += item.mana ?? 0;
    total.critChance += item.critChance ?? 0;
  }
  return total;
}

/**
 * Derived stats are deterministic and documented in docs/GAME_DESIGN.md.
 * Equipment bonuses are applied after the base formulas.
 */
export function deriveStats(
  attributes: Attributes,
  level: number,
  bonuses: EquipmentBonuses = {},
): DerivedStats {
  const b = sumBonuses([bonuses]);
  return {
    maxHealth: 30 + attributes.vitality * 6 + level * 4 + b.health,
    maxMana: 10 + attributes.intelligence * 4 + level * 2 + b.mana,
    attack: attributes.strength * 2 + level + b.attack,
    magicAttack: attributes.intelligence * 2 + level + b.magicAttack,
    defense: Math.floor(attributes.vitality * 1.2 + level) + b.defense,
    speed: attributes.agility * 2 + level + b.speed,
    critChance: clamp(0.05 + attributes.agility * 0.01 + b.critChance, 0.05, 0.5),
  };
}

export function deriveCharacterStats(character: CharacterForStats): DerivedStats {
  return deriveStats(character.attributes, character.level, character.bonuses);
}

export function xpToNextLevel(level: number): number {
  return 60 + (level - 1) * 40;
}

export interface ExperienceResult {
  level: number;
  experience: number;
  levelsGained: number;
}

export function applyExperience(level: number, experience: number, gain: number): ExperienceResult {
  let nextLevel = level;
  let nextXp = experience + Math.max(0, Math.round(gain));
  let levelsGained = 0;
  while (nextXp >= xpToNextLevel(nextLevel) && nextLevel < 20) {
    nextXp -= xpToNextLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }
  return { level: nextLevel, experience: nextXp, levelsGained };
}

export function leveledAttributes(
  attributes: Attributes,
  archetype: Archetype,
  levelsGained: number,
): Attributes {
  const growth = levelGrowth(archetype);
  return {
    strength: attributes.strength + growth.strength * levelsGained,
    agility: attributes.agility + growth.agility * levelsGained,
    intelligence: attributes.intelligence + growth.intelligence * levelsGained,
    vitality: attributes.vitality + growth.vitality * levelsGained,
  };
}

export function partyPower(members: CharacterForStats[]): number {
  return members.reduce((total, member) => {
    const stats = deriveCharacterStats(member);
    return (
      total +
      stats.attack +
      stats.magicAttack +
      stats.defense +
      stats.speed +
      Math.floor(stats.maxHealth / 4) +
      Math.floor(stats.maxMana / 4)
    );
  }, 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
