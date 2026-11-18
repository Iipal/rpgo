import { createRng, type Rng } from "./rng";
import type {
  AbilityDefinition,
  BattleLogEntry,
  BattleOutcome,
  BattleResult,
  CombatantInput,
  CombatantResult,
  Row,
} from "./types";

interface StatusEffect {
  type: "poison" | "defense_down" | "defense_up";
  rounds: number;
  amount: number;
  damage: number;
}

interface CombatantState {
  input: CombatantInput;
  hp: number;
  cooldowns: Record<string, number>;
  statuses: StatusEffect[];
}

export interface BattleInput {
  party: CombatantInput[];
  enemies: CombatantInput[];
  abilities: Record<string, AbilityDefinition>;
  seed: number;
  turnLimit?: number;
}

const DEFAULT_TURN_LIMIT = 30;

/**
 * Deterministic automatic combat. The only source of randomness is the seeded RNG,
 * and iteration order is always stable, so identical input produces an identical log.
 */
export function simulateBattle(input: BattleInput): BattleResult {
  const rng = createRng(input.seed);
  const abilities = input.abilities;
  const states: CombatantState[] = [...input.party, ...input.enemies].map((combatant) => ({
    input: combatant,
    hp: Math.max(0, Math.min(combatant.hp, combatant.maxHp)),
    cooldowns: {},
    statuses: [],
  }));
  const log: BattleLogEntry[] = [];
  const turnLimit = input.turnLimit ?? DEFAULT_TURN_LIMIT;

  const living = (side: "party" | "enemy") =>
    states.filter((s) => s.input.side === side && s.hp > 0);

  if (living("party").length === 0) {
    return finalize("defeat", 0, states, log, input.seed);
  }
  if (living("enemy").length === 0) {
    return finalize("victory", 0, states, log, input.seed);
  }

  let round = 1;
  let outcome: BattleOutcome | null = null;

  while (round <= turnLimit && !outcome) {
    const order = states
      .filter((s) => s.hp > 0)
      .sort((a, b) => {
        if (b.input.speed !== a.input.speed) return b.input.speed - a.input.speed;
        return a.input.id.localeCompare(b.input.id);
      });

    for (const actor of order) {
      if (actor.hp <= 0) continue;
      if (living("party").length === 0 || living("enemy").length === 0) break;

      const choice = chooseAction(actor, states, abilities, round);
      if (!choice) {
        actor.hp = 0;
        log.push(
          event(
            round,
            actor,
            "exhausted",
            "Exhausted",
            "status",
            [],
            [],
            "no_action",
            `${actor.input.name} falters.`,
          ),
        );
        continue;
      }
      const ability = abilities[choice.abilityId] ?? abilities.basic_strike;
      if (!ability) {
        actor.hp = 0;
        continue;
      }
      const targets = resolveTargets(actor, ability, states);
      actor.cooldowns[ability.id] = round + ability.cooldownRounds;
      applyAbility(round, actor, ability, targets, log, rng);
    }

    tickStatuses(round, states, log);

    if (living("enemy").length === 0) outcome = "victory";
    else if (living("party").length === 0) outcome = "defeat";
    else if (round >= turnLimit) outcome = "draw";
    round += 1;
  }

  return finalize(outcome ?? "draw", Math.max(1, round - 1), states, log, input.seed);
}

function finalize(
  outcome: BattleOutcome,
  rounds: number,
  states: CombatantState[],
  log: BattleLogEntry[],
  seed: number,
): BattleResult {
  const toResult = (state: CombatantState): CombatantResult => ({
    id: state.input.id,
    name: state.input.name,
    side: state.input.side,
    hp: Math.max(0, state.hp),
    maxHp: state.input.maxHp,
    alive: state.hp > 0,
  });
  return {
    outcome,
    rounds,
    seed,
    log,
    party: states.filter((s) => s.input.side === "party").map(toResult),
    enemies: states.filter((s) => s.input.side === "enemy").map(toResult),
  };
}

function chooseAction(
  actor: CombatantState,
  states: CombatantState[],
  abilities: Record<string, AbilityDefinition>,
  round: number,
): { abilityId: string; reason: string } | null {
  const available = actor.input.abilityIds
    .map((id) => abilities[id])
    .filter((ability): ability is AbilityDefinition => Boolean(ability))
    .filter((ability) => (actor.cooldowns[ability.id] ?? 0) <= round);
  if (available.length === 0) return null;

  const damaging = available.filter((a) => a.kind === "physical" || a.kind === "magic");
  const heal = available.find((a) => a.kind === "heal");
  const buff = available.find((a) => a.kind === "buff");
  const behavior = actor.input.behaviorId;
  const allies = states.filter((s) => s.input.side === actor.input.side && s.hp > 0);
  const foes = states.filter((s) => s.input.side !== actor.input.side && s.hp > 0);
  const hpRatio = actor.hp / actor.input.maxHp;
  const hurtAlly = allies
    .filter((ally) => ally.hp / ally.input.maxHp < 0.65)
    .sort((a, b) => a.hp / a.input.maxHp - b.hp / b.input.maxHp)[0];
  const backlineThreatened = allies.some(
    (ally) => ally.input.row === "back" && ally.hp / ally.input.maxHp < 0.5,
  );

  if (behavior === "party_warrior") {
    if (buff && hpRatio < 0.45) return { abilityId: buff.id, reason: "own_hp_low" };
    if (buff && backlineThreatened) return { abilityId: buff.id, reason: "backline_threatened" };
    return firstDamage(damaging, ["basic_strike"]) ?? firstOf(available);
  }

  if (behavior === "party_ranger") {
    const powerShot = damaging.find((a) => a.id === "power_shot");
    if (powerShot) return { abilityId: powerShot.id, reason: "vulnerable_target" };
    return firstDamage(damaging, ["basic_strike"]) ?? firstOf(available);
  }

  if (behavior === "party_mage") {
    const aoe = damaging.find((a) => a.target === "all_enemies");
    if (aoe && foes.length >= 2) return { abilityId: aoe.id, reason: "multiple_enemies" };
    return firstDamage(damaging, ["arcane_bolt", "firebolt", "basic_strike"]) ?? firstOf(available);
  }

  if (behavior === "party_cleric") {
    if (heal && hurtAlly) return { abilityId: heal.id, reason: "ally_wounded" };
    return firstDamage(damaging, ["smite", "basic_strike"]) ?? firstOf(available);
  }

  if (behavior === "enemy_support") {
    if (heal && hurtAlly) return { abilityId: heal.id, reason: "ally_wounded" };
    return firstDamage(damaging, ["enemy_bolt", "enemy_claw"]) ?? firstOf(available);
  }

  if (behavior === "enemy_caster") {
    const bolt = damaging.find((a) => a.kind === "magic");
    if (bolt) return { abilityId: bolt.id, reason: "spell_priority" };
    return firstDamage(damaging, ["enemy_claw"]) ?? firstOf(available);
  }

  if (behavior === "enemy_brute") {
    const heavy = damaging.find((a) => a.id === "enemy_heavy" || a.id === "enemy_sunder");
    if (heavy) return { abilityId: heavy.id, reason: "heavy_attack_priority" };
    return firstDamage(damaging, ["enemy_claw"]) ?? firstOf(available);
  }

  if (behavior === "enemy_skirmisher") {
    return firstDamage(damaging, ["enemy_envenom", "enemy_claw"]) ?? firstOf(available);
  }

  return firstDamage(damaging, ["basic_strike", "enemy_claw"]) ?? firstOf(available);
}

function firstDamage(
  abilities: AbilityDefinition[],
  preferred: string[],
): { abilityId: string; reason: string } | null {
  for (const id of preferred) {
    const found = abilities.find((ability) => ability.id === id);
    if (found) return { abilityId: found.id, reason: "damage_priority" };
  }
  const any = abilities[0];
  return any ? { abilityId: any.id, reason: "fallback_attack" } : null;
}

function firstOf(abilities: AbilityDefinition[]): { abilityId: string; reason: string } | null {
  const ability = abilities[0];
  return ability ? { abilityId: ability.id, reason: "only_available_action" } : null;
}

function resolveTargets(
  actor: CombatantState,
  ability: AbilityDefinition,
  states: CombatantState[],
): CombatantState[] {
  const allies = states.filter((s) => s.input.side === actor.input.side && s.hp > 0);
  const foes = states.filter((s) => s.input.side !== actor.input.side && s.hp > 0);
  if (ability.target === "self") return [actor];
  if (ability.target === "all_enemies") return foes;
  if (ability.target === "ally_lowest") {
    const sorted = [...allies].sort((a, b) => a.hp / a.input.maxHp - b.hp / b.input.maxHp);
    return sorted[0] ? [sorted[0]] : [];
  }
  if (ability.target === "lowest_enemy") {
    const sorted = [...foes].sort((a, b) => a.hp / a.input.maxHp - b.hp / b.input.maxHp);
    return sorted[0] ? [sorted[0]] : [];
  }
  const behavior = actor.input.behaviorId;
  if (behavior === "enemy_skirmisher") {
    const sorted = [...foes].sort((a, b) => a.hp / a.input.maxHp - b.hp / b.input.maxHp);
    return sorted[0] ? [sorted[0]] : [];
  }
  if (behavior === "enemy_caster") {
    const sorted = [...foes].sort((a, b) => effectiveDefense(a) - effectiveDefense(b));
    return sorted[0] ? [sorted[0]] : [];
  }
  const front = foes.filter((foe) => foe.input.row === "front");
  const pool = front.length > 0 ? front : foes;
  const sorted = [...pool].sort((a, b) => a.input.id.localeCompare(b.input.id));
  return sorted[0] ? [sorted[0]] : [];
}

function applyAbility(
  round: number,
  actor: CombatantState,
  ability: AbilityDefinition,
  targets: CombatantState[],
  log: BattleLogEntry[],
  rng: Rng,
): void {
  if (targets.length === 0) return;

  if (ability.kind === "buff") {
    for (const target of targets) {
      applyStatus(target, {
        type: "defense_up",
        amount: ability.effect?.amount ?? 0.25,
        rounds: ability.effect?.rounds ?? 2,
        damage: 0,
      });
      log.push(
        event(
          round,
          actor,
          ability.id,
          ability.name,
          "buff",
          [target],
          [target],
          "defensive_buff",
          `${actor.input.name} uses ${ability.name}. ${target.input.name}'s defense rises.`,
        ),
      );
    }
    return;
  }

  if (ability.kind === "heal") {
    for (const target of targets) {
      const amount = Math.round(actor.input.magicAttack * ability.power + 4);
      const healed = Math.min(target.input.maxHp - target.hp, amount);
      target.hp += healed;
      log.push(
        event(
          round,
          actor,
          ability.id,
          ability.name,
          "heal",
          [target],
          [target],
          "ally_wounded",
          `${actor.input.name} heals ${target.input.name} for ${healed}.`,
        ),
      );
    }
    return;
  }

  const isPhysical = ability.kind === "physical";
  for (const target of targets) {
    const attack = isPhysical ? actor.input.attack : actor.input.magicAttack;
    const variance = 0.9 + rng.next() * 0.2;
    const mitigation = effectiveDefense(target) * (isPhysical ? 0.6 : 0.3);
    const crit = rng.next() < actor.input.critChance;
    const raw = attack * ability.power * variance - mitigation;
    const amount = Math.max(1, Math.round(raw * (crit ? 1.5 : 1)));
    target.hp = Math.max(0, target.hp - amount);
    log.push(
      event(
        round,
        actor,
        ability.id,
        ability.name,
        "damage",
        [target],
        [target],
        target.hp === 0 ? "target_defeated" : "attack_priority",
        `${actor.input.name} hits ${target.input.name} with ${ability.name} for ${amount}${crit ? " (critical)" : ""}.`,
        amount,
        crit,
      ),
    );
    if (target.hp === 0) {
      log.push(
        event(
          round,
          actor,
          "defeat",
          "Defeat",
          "defeat",
          [target],
          [target],
          "target_defeated",
          `${target.input.name} is down.`,
        ),
      );
    } else if (ability.effect) {
      applyStatus(target, {
        type: ability.effect.type,
        amount: ability.effect.amount ?? 0,
        damage: ability.effect.damage ?? 0,
        rounds: ability.effect.rounds,
      });
      log.push(
        event(
          round,
          actor,
          `${ability.id}:effect`,
          ability.effect.type.replaceAll("_", " "),
          ability.effect.type === "defense_up" ? "buff" : "debuff",
          [target],
          [target],
          `apply_${ability.effect.type}`,
          `${target.input.name} is affected by ${ability.effect.type.replaceAll("_", " ")}.`,
        ),
      );
    }
  }
}

function effectiveDefense(state: CombatantState): number {
  let multiplier = 1;
  for (const status of state.statuses) {
    if (status.type === "defense_up") multiplier += status.amount;
    if (status.type === "defense_down") multiplier -= status.amount;
  }
  return Math.max(1, Math.floor(state.input.defense * Math.max(0.25, multiplier)));
}

function applyStatus(state: CombatantState, effect: StatusEffect): void {
  const existing = state.statuses.find((status) => status.type === effect.type);
  if (existing) {
    existing.rounds = Math.max(existing.rounds, effect.rounds);
    existing.amount = Math.max(existing.amount, effect.amount);
    existing.damage = Math.max(existing.damage, effect.damage);
  } else {
    state.statuses.push({ ...effect });
  }
}

function tickStatuses(round: number, states: CombatantState[], log: BattleLogEntry[]): void {
  for (const state of states) {
    if (state.hp <= 0) continue;
    for (const status of state.statuses) {
      if (status.type === "poison" && status.damage > 0) {
        state.hp = Math.max(0, state.hp - status.damage);
        log.push(
          event(
            round,
            state,
            "poison",
            "Poison",
            "status",
            [state],
            [state],
            "status_tick",
            `${state.input.name} suffers ${status.damage} poison damage.`,
            status.damage,
          ),
        );
        if (state.hp === 0) {
          log.push(
            event(
              round,
              state,
              "defeat",
              "Defeat",
              "defeat",
              [state],
              [state],
              "status_defeated",
              `${state.input.name} succumbs.`,
            ),
          );
        }
      }
    }
    for (const status of state.statuses) status.rounds -= 1;
    state.statuses = state.statuses.filter((status) => status.rounds > 0);
  }
}

function event(
  round: number,
  actor: CombatantState,
  actionId: string,
  actionName: string,
  type: BattleLogEntry["type"],
  targetIds: CombatantState[],
  targetNames: CombatantState[],
  reason: string,
  text: string,
  amount?: number,
  crit?: boolean,
): BattleLogEntry {
  return {
    round,
    actorId: actor.input.id,
    actorName: actor.input.name,
    actionId,
    actionName,
    type,
    targetIds: targetIds.map((t) => t.input.id),
    targetNames: targetNames.map((t) => t.input.name),
    amount,
    crit,
    reason,
    text,
  };
}

export function enemyRowsFor(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => (index < 2 ? "front" : "back"));
}
