import { enemyById } from "@rpgo/game-content";
import type { CombatantInput } from "@rpgo/game-rules";
import { buildEnemyStats } from "@rpgo/game-rules";
import type { EncounterRow } from "../infrastructure/database/repository";
import { type PartyBundle, parseJson } from "./mappers";

const SUFFIXES = ["A", "B", "C", "D", "E", "F"];

export function buildPartyCombatants(party: PartyBundle): CombatantInput[] {
  return party.characters
    .filter((character) => !character.incapacitated && character.health > 0)
    .map((character) => ({
      id: character.id,
      name: character.name,
      side: "party" as const,
      archetype: character.archetype,
      behaviorId: character.combatBehaviorId,
      row: character.formation,
      level: character.level,
      maxHp: character.maxHealth,
      hp: Math.min(character.health, character.maxHealth),
      attack: character.derived.attack,
      magicAttack: character.derived.magicAttack,
      defense: character.derived.defense,
      speed: character.derived.speed,
      critChance: character.derived.critChance,
      abilityIds: character.abilityIds,
    }));
}

export function buildEncounterEnemies(
  encounter: EncounterRow,
  eventId: string,
  encounterIndex: number,
  partyLevel: number,
  band: "easy" | "normal" | "hard",
): CombatantInput[] {
  const groups = parseJson<Array<{ templateId: string; count: number; behaviorId: string }>>(
    encounter.enemies_json,
    [],
  );
  const result: CombatantInput[] = [];
  groups.forEach((group, groupIndex) => {
    const template = enemyById[group.templateId];
    if (!template) return;
    const count = Math.max(1, Math.min(4, group.count));
    const stats = buildEnemyStats(template, partyLevel, band);
    for (let index = 0; index < count; index++) {
      result.push({
        id: `${eventId}:enemy:${encounterIndex}:${groupIndex}:${index}`,
        name: count > 1 ? `${template.name} ${SUFFIXES[index] ?? index + 1}` : template.name,
        side: "enemy",
        archetype: template.behaviorId,
        behaviorId: group.behaviorId,
        row: template.row,
        level: template.level,
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        attack: stats.attack,
        magicAttack: stats.magicAttack,
        defense: stats.defense,
        speed: stats.speed,
        critChance: stats.critChance,
        abilityIds: template.abilityIds,
      });
    }
  });
  return result;
}
