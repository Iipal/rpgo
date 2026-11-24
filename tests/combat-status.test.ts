import { describe, expect, test } from "bun:test";
import { simulateBattle } from "../packages/game-rules/src";
import type { AbilityDefinition, CombatantInput } from "../packages/game-rules/src/types";

function combatant(overrides: Partial<CombatantInput> & { id: string }): CombatantInput {
  return {
    name: overrides.id,
    side: "party",
    behaviorId: "party_warrior",
    row: "front",
    level: 1,
    maxHp: 500,
    hp: 500,
    attack: 10,
    magicAttack: 10,
    defense: 5,
    speed: 5,
    critChance: 0,
    abilityIds: ["basic_strike"],
    ...overrides,
  };
}

const strike: AbilityDefinition = {
  id: "basic_strike",
  name: "Strike",
  description: "A basic attack.",
  kind: "physical",
  power: 0.01,
  target: "enemy",
  cooldownRounds: 0,
};

describe("combat status effects", () => {
  test("applies poison damage on later rounds and then expires", () => {
    const venom: AbilityDefinition = {
      id: "enemy_envenom",
      name: "Venom",
      description: "A poisoned cut.",
      kind: "physical",
      power: 0.01,
      target: "enemy",
      cooldownRounds: 0,
      effect: { type: "poison", damage: 7, rounds: 2 },
    };

    const result = simulateBattle({
      party: [combatant({ id: "hero", speed: 1 })],
      enemies: [
        combatant({
          id: "spider",
          side: "enemy",
          behaviorId: "enemy_skirmisher",
          row: "front",
          speed: 9,
          abilityIds: ["enemy_envenom"],
        }),
      ],
      abilities: { basic_strike: strike, enemy_envenom: venom },
      seed: 7,
      turnLimit: 4,
    });

    const poisonEntries = result.log.filter((entry) => entry.actionId === "poison");
    expect(poisonEntries.length).toBeGreaterThan(0);
    expect(poisonEntries[0]?.text).toContain("poison damage");
    expect(poisonEntries[0]?.amount).toBe(7);
  });

  test("applies a defense debuff that increases later physical damage", () => {
    const sunder: AbilityDefinition = {
      id: "enemy_sunder",
      name: "Sunder",
      description: "Splits armour.",
      kind: "physical",
      power: 1,
      target: "enemy",
      cooldownRounds: 0,
      effect: { type: "defense_down", amount: 0.5, rounds: 3 },
    };

    const result = simulateBattle({
      party: [combatant({ id: "hero", attack: 0, defense: 200, maxHp: 100_000, hp: 100_000 })],
      enemies: [
        combatant({
          id: "raider",
          side: "enemy",
          behaviorId: "enemy_brute",
          speed: 9,
          attack: 200,
          maxHp: 5000,
          hp: 5000,
          abilityIds: ["enemy_sunder"],
        }),
      ],
      abilities: { basic_strike: { ...strike, power: 0.01 }, enemy_sunder: sunder },
      seed: 11,
      turnLimit: 4,
    });

    const debuffs = result.log.filter((entry) => entry.type === "debuff");
    expect(debuffs.length).toBeGreaterThan(0);
    expect(debuffs[0]?.text).toContain("defense");

    const hits = result.log.filter(
      (entry) => entry.type === "damage" && entry.actorId === "raider",
    );
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.at(-1)?.amount ?? 0).toBeGreaterThan(hits[0]?.amount ?? 0);
  });

  test("returns a draw when the turn limit is reached", () => {
    const result = simulateBattle({
      party: [combatant({ id: "hero", attack: 0, maxHp: 9999, hp: 9999, defense: 9999 })],
      enemies: [
        combatant({
          id: "wall",
          side: "enemy",
          attack: 0,
          maxHp: 9999,
          hp: 9999,
          defense: 9999,
        }),
      ],
      abilities: { basic_strike: { ...strike, power: 0 } },
      seed: 3,
      turnLimit: 2,
    });

    expect(result.outcome).toBe("draw");
    expect(result.rounds).toBe(2);
    expect(result.party.every((unit) => unit.alive)).toBe(true);
    expect(result.enemies.every((unit) => unit.alive)).toBe(true);
  });
});
