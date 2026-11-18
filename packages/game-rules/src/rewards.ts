import type { DifficultyBand, EventType, Rarity, RewardIntent, RewardPlan } from "./types";

const GOLD_BASE: Record<DifficultyBand, number> = { easy: 30, normal: 55, hard: 95 };
const XP_BASE: Record<DifficultyBand, number> = { easy: 25, normal: 45, hard: 75 };
const RESEARCH_BASE: Record<DifficultyBand, number> = { easy: 8, normal: 14, hard: 22 };

const EVENT_GOLD_MULTIPLIER: Record<EventType, number> = {
  dungeon: 1.4,
  scout: 0.7,
  research: 0.5,
  attack: 1.2,
};

const EVENT_XP_MULTIPLIER: Record<EventType, number> = {
  dungeon: 0.9,
  scout: 1,
  research: 0.8,
  attack: 1,
};

/**
 * The engine derives all concrete rewards. Intent only selects categories.
 * Equipment count is capped and rarity is clamped to the difficulty band.
 */
export function computeRewardPlan(
  intents: RewardIntent[],
  band: DifficultyBand,
  type: EventType,
): RewardPlan {
  const wantsGold = intents.some((intent) => intent.kind === "gold");
  const wantsXp = intents.some((intent) => intent.kind === "experience");
  const wantsResearch = intents.some((intent) => intent.kind === "research");
  const equipmentIntents = intents.filter((intent) => intent.kind === "equipment");
  const maxEquipment = band === "hard" ? 2 : 1;
  const equipment = equipmentIntents
    .slice(0, maxEquipment)
    .map((intent) => ({ rarity: clampRarity(intent.rarity ?? "common", band) }));

  const goldWanted = wantsGold || type === "dungeon" || type === "attack";
  const xpWanted = wantsXp || type === "dungeon" || type === "attack" || type === "scout";

  return {
    gold: goldWanted ? Math.round(GOLD_BASE[band] * EVENT_GOLD_MULTIPLIER[type]) : 0,
    experiencePerCharacter: xpWanted ? Math.round(XP_BASE[band] * EVENT_XP_MULTIPLIER[type]) : 0,
    researchPoints: wantsResearch || type === "research" ? Math.round(RESEARCH_BASE[band]) : 0,
    equipment,
  };
}

export function clampRarity(rarity: Rarity, band: DifficultyBand): Rarity {
  if (band === "easy") return "common";
  if (band === "normal") return rarity === "rare" ? "uncommon" : rarity;
  return rarity === "common" ? "uncommon" : rarity;
}

export function isDifficultyAllowed(band: DifficultyBand, partyLevel: number): boolean {
  if (band === "hard") return partyLevel >= 2;
  return true;
}

export function clampDifficultyBand(band: DifficultyBand, partyLevel: number): DifficultyBand {
  if (band === "hard" && partyLevel < 2) return "normal";
  return band;
}
