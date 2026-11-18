import type { CharacterDto } from "@rpgo/contracts";
import { applyExperience, deriveStats, leveledAttributes } from "@rpgo/game-rules";
import type { CharacterRow, Repository } from "../infrastructure/database/repository";
import type { RewardPreviewInternal } from "./mappers";
import { createInventoryItem } from "./seeding";

export interface RewardGrant {
  gold: number;
  experience: number;
  researchPoints: number;
  equipment: string[];
}

export interface RewardContext {
  eventId: string;
  turn: number;
  playerId: string;
  partyId: string;
  characters: CharacterDto[];
  rows: CharacterRow[];
  preview: RewardPreviewInternal;
}

/**
 * Rewards are granted inside the caller's transaction. Each grant has a unique
 * key so replaying a completion cannot duplicate currency, XP, or items.
 */
export function grantRewards(repo: Repository, context: RewardContext): RewardGrant {
  const grant: RewardGrant = { gold: 0, experience: 0, researchPoints: 0, equipment: [] };
  const { preview } = context;

  if (preview.gold > 0) {
    const inserted = repo.insertResourceTransaction({
      id: crypto.randomUUID(),
      worldId: repo.getWorld()?.id ?? "",
      grantKey: `${context.eventId}:gold`,
      kind: "gold",
      amount: preview.gold,
      targetId: context.playerId,
      turn: context.turn,
    });
    if (inserted) {
      repo.addGold(context.playerId, preview.gold);
      grant.gold = preview.gold;
    }
  }

  if (preview.researchPoints > 0) {
    const inserted = repo.insertResourceTransaction({
      id: crypto.randomUUID(),
      worldId: repo.getWorld()?.id ?? "",
      grantKey: `${context.eventId}:research`,
      kind: "research",
      amount: preview.researchPoints,
      targetId: context.playerId,
      turn: context.turn,
    });
    if (inserted) {
      repo.addResearch(context.playerId, preview.researchPoints);
      grant.researchPoints = preview.researchPoints;
    }
  }

  for (const [index, item] of preview.equipment.entries()) {
    const inserted = repo.insertResourceTransaction({
      id: crypto.randomUUID(),
      worldId: repo.getWorld()?.id ?? "",
      grantKey: `${context.eventId}:equipment:${index}`,
      kind: "equipment",
      amount: 1,
      targetId: context.partyId,
      detail: { definitionId: item.definitionId },
      turn: context.turn,
    });
    if (inserted) {
      createInventoryItem(repo, context.partyId, item.definitionId, context.turn);
      grant.equipment.push(item.name);
    }
  }

  if (preview.experiencePerCharacter > 0) {
    const rowsById = new Map(context.rows.map((row) => [row.id, row]));
    for (const character of context.characters) {
      const row = rowsById.get(character.id);
      if (!row) continue;
      const inserted = repo.insertResourceTransaction({
        id: crypto.randomUUID(),
        worldId: repo.getWorld()?.id ?? "",
        grantKey: `${context.eventId}:xp:${character.id}`,
        kind: "experience",
        amount: preview.experiencePerCharacter,
        targetId: character.id,
        turn: context.turn,
      });
      if (!inserted) continue;
      const result = applyExperience(row.level, row.experience, preview.experiencePerCharacter);
      const attributes = leveledAttributes(
        {
          strength: row.strength,
          agility: row.agility,
          intelligence: row.intelligence,
          vitality: row.vitality,
        },
        row.archetype,
        result.levelsGained,
      );
      repo.updateCharacterProgress(character.id, result.level, result.experience, attributes);
      if (result.levelsGained > 0) {
        const oldStats = deriveStats(
          {
            strength: row.strength,
            agility: row.agility,
            intelligence: row.intelligence,
            vitality: row.vitality,
          },
          row.level,
          character.bonuses,
        );
        const newStats = deriveStats(attributes, result.level, character.bonuses);
        const health = Math.min(
          newStats.maxHealth,
          row.health + (newStats.maxHealth - oldStats.maxHealth),
        );
        const mana = Math.min(newStats.maxMana, row.mana + (newStats.maxMana - oldStats.maxMana));
        repo.updateCharacterVitals(character.id, health, mana, row.incapacitated === 1);
      }
      grant.experience += preview.experiencePerCharacter;
    }
  }

  return grant;
}

export function rewardSummaryText(grant: RewardGrant): string {
  const parts: string[] = [];
  if (grant.gold > 0) parts.push(`${grant.gold} gold`);
  if (grant.experience > 0) parts.push(`${grant.experience} experience`);
  if (grant.researchPoints > 0) parts.push(`${grant.researchPoints} research`);
  if (grant.equipment.length > 0) parts.push(grant.equipment.join(", "));
  return parts.length > 0 ? parts.join(", ") : "No material reward";
}
