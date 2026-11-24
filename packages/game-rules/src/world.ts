import { deriveStats } from "./character";
import type { DifficultyBand, DiscoveryStatus, EnemyTemplate } from "./types";

export const WORLD_ADVANCING_ACTIONS = [
  "event_accepted",
  "event_completed",
  "event_failed",
  "location_discovered",
  "research_completed",
] as const;

export type WorldActionType = (typeof WORLD_ADVANCING_ACTIONS)[number];

/**
 * Action-based world time. Only these action types advance the world turn.
 * One command records at most one world action, so a multi-encounter event
 * cannot advance the world once per encounter.
 */
export function advancesWorld(actionType: WorldActionType): boolean {
  return (WORLD_ADVANCING_ACTIONS as readonly string[]).includes(actionType);
}

export interface ScaledEnemyStats {
  maxHp: number;
  attack: number;
  magicAttack: number;
  defense: number;
  speed: number;
  critChance: number;
}

const DIFFICULTY_MULTIPLIER: Record<DifficultyBand, number> = {
  easy: 0.82,
  normal: 1,
  hard: 1.25,
};

export function buildEnemyStats(
  template: EnemyTemplate,
  partyLevel: number,
  band: DifficultyBand,
): ScaledEnemyStats {
  const level = template.level + Math.max(0, Math.floor((partyLevel - template.level) / 2));
  const base = deriveStats(template.attributes, Math.max(template.level, level));
  const multiplier = DIFFICULTY_MULTIPLIER[band];
  return {
    maxHp: Math.max(12, Math.round(base.maxHealth * multiplier)),
    attack: Math.max(4, Math.round(base.attack * multiplier)),
    magicAttack: Math.max(4, Math.round(base.magicAttack * multiplier)),
    defense: Math.max(1, Math.round(base.defense * multiplier)),
    speed: Math.max(1, Math.round(base.speed * multiplier)),
    critChance: base.critChance,
  };
}

export function nextLocationStatus(
  current: "unknown" | "discovered" | "accessible",
): "discovered" | "accessible" | null {
  if (current === "unknown") return "discovered";
  if (current === "discovered") return "accessible";
  return null;
}

export const DISCOVERY_RANK: Record<DiscoveryStatus, number> = {
  unknown: 0,
  discovered: 1,
  accessible: 2,
};

/**
 * A region follows its locations: knowing one location makes the region known,
 * and an accessible location opens the region. The result may be lower than the
 * current status; callers must only move a status forward.
 */
export function deriveRegionStatus(locationStatuses: DiscoveryStatus[]): DiscoveryStatus {
  if (locationStatuses.some((status) => status === "accessible")) return "accessible";
  if (locationStatuses.some((status) => status === "discovered")) return "discovered";
  return "unknown";
}

/** Threat rises with activity in a region. Recomputed from totals so it is idempotent. */
export const THREAT_COMPLETIONS_PER_STEP = 3;
export const THREAT_FAILURES_PER_STEP = 2;
export const MAX_THREAT = 10;

export function threatLevelForOutcomes(
  completed: number,
  failed: number,
  baseThreat: number,
): number {
  const base = Math.max(0, Math.min(MAX_THREAT, Math.floor(baseThreat)));
  const steps =
    Math.floor(Math.max(0, completed) / THREAT_COMPLETIONS_PER_STEP) +
    Math.floor(Math.max(0, failed) / THREAT_FAILURES_PER_STEP);
  return Math.min(MAX_THREAT, base + steps);
}
