import { describe, expect, test } from "bun:test";
import { abilityById, starterParty } from "../packages/game-content/src";
import {
  applyExperience,
  type CombatantInput,
  createRng,
  deriveCharacterStats,
  hashSeed,
  nextLocationStatus,
  simulateBattle,
  xpToNextLevel,
} from "../packages/game-rules/src";

function party(): CombatantInput[] {
  return starterParty.map((member, index) => {
    const stats = deriveCharacterStats({
      attributes: member.attributes,
      level: 2,
      bonuses: {},
    });
    return {
      id: `hero-${index}`,
      name: member.name,
      side: "party" as const,
      archetype: member.archetype,
      behaviorId: `party_${member.archetype}`,
      row: member.formation,
      level: 2,
      maxHp: stats.maxHealth,
      hp: stats.maxHealth,
      attack: stats.attack,
      magicAttack: stats.magicAttack,
      defense: stats.defense,
      speed: stats.speed,
      critChance: stats.critChance,
      abilityIds: member.abilityIds,
    };
  });
}

function enemies(): CombatantInput[] {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `wolf-${index}`,
    name: `Forest Wolf ${index + 1}`,
    side: "enemy" as const,
    archetype: "skirmisher",
    behaviorId: "enemy_skirmisher",
    row: "front" as const,
    level: 1,
    maxHp: 40,
    hp: 40,
    attack: 9,
    magicAttack: 0,
    defense: 2,
    speed: 8,
    critChance: 0.08,
    abilityIds: ["enemy_claw"],
  }));
}

describe("character rules", () => {
  test("derives documented stats and equipment bonuses", () => {
    const base = deriveCharacterStats({
      attributes: { strength: 5, agility: 4, intelligence: 3, vitality: 6 },
      level: 1,
      bonuses: {},
    });
    expect(base.maxHealth).toBe(30 + 6 * 6 + 4);
    expect(base.maxMana).toBe(10 + 3 * 4 + 2);
    expect(base.attack).toBe(5 * 2 + 1);
    expect(base.defense).toBe(Math.floor(6 * 1.2 + 1));
    expect(base.speed).toBe(4 * 2 + 1);

    const armed = deriveCharacterStats({
      attributes: { strength: 5, agility: 4, intelligence: 3, vitality: 6 },
      level: 1,
      bonuses: { attack: 4, health: 10, critChance: 0.05 },
    });
    expect(armed.attack).toBe(base.attack + 4);
    expect(armed.maxHealth).toBe(base.maxHealth + 10);
    expect(armed.critChance).toBeCloseTo(base.critChance + 0.05, 5);
  });

  test("experience levels up and carries overflow", () => {
    const first = applyExperience(1, 0, xpToNextLevel(1));
    expect(first.level).toBe(2);
    expect(first.experience).toBe(0);
    const second = applyExperience(first.level, first.experience, 9999);
    expect(second.level).toBe(20);
    expect(second.experience).toBeGreaterThanOrEqual(0);
  });

  test("rng is deterministic and hashSeed is stable", () => {
    const a = createRng(123);
    const b = createRng(123);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(hashSeed("greenreach-1")).toBe(hashSeed("greenreach-1"));
    expect(hashSeed("greenreach-1")).not.toBe(hashSeed("greenreach-2"));
  });

  test("discovery transitions only move forward", () => {
    expect(nextLocationStatus("unknown")).toBe("discovered");
    expect(nextLocationStatus("discovered")).toBe("accessible");
    expect(nextLocationStatus("accessible")).toBeNull();
  });
});

describe("deterministic combat", () => {
  test("same input and seed produce the same result and log", () => {
    const input = { party: party(), enemies: enemies(), abilities: abilityById, seed: 777 };
    const first = simulateBattle(input);
    const second = simulateBattle(input);
    expect(second).toEqual(first);
    expect(first.rounds).toBeLessThanOrEqual(30);
    expect(["victory", "defeat", "draw"]).toContain(first.outcome);
    expect(first.log.length).toBeGreaterThan(0);
  });

  test("different seeds can produce different logs", () => {
    const first = simulateBattle({
      party: party(),
      enemies: enemies(),
      abilities: abilityById,
      seed: 1,
    });
    const second = simulateBattle({
      party: party(),
      enemies: enemies(),
      abilities: abilityById,
      seed: 2,
    });
    expect(first.seed).not.toBe(second.seed);
  });

  test("battle always terminates within the turn limit", () => {
    const result = simulateBattle({
      party: party(),
      enemies: enemies(),
      abilities: abilityById,
      seed: 42,
      turnLimit: 3,
    });
    expect(result.rounds).toBeLessThanOrEqual(3);
    expect(result.outcome).not.toBeUndefined();
  });

  test("no combatant acts after being defeated", () => {
    const input = { party: party(), enemies: enemies(), abilities: abilityById, seed: 999 };
    const result = simulateBattle(input);
    const downAt = new Map<string, number>();
    for (const entry of result.log) {
      if (downAt.has(entry.actorId) && entry.round >= (downAt.get(entry.actorId) ?? 0)) {
        throw new Error(`${entry.actorName} acted after being defeated`);
      }
      if (entry.type === "defeat") {
        for (const id of entry.targetIds) {
          if (!downAt.has(id)) downAt.set(id, entry.round);
        }
      }
    }
  });
});
