import {
  regions as contentRegions,
  equipmentById,
  fallbackEvents,
  starterInventory,
  starterParty,
} from "@rpgo/game-content";
import { deriveStats, type RegionDefinition, sumBonuses } from "@rpgo/game-rules";
import type { CharacterRow, InventoryRow, Repository } from "../infrastructure/database/repository";
import { draftFromFallback, persistEvent } from "./events";

export function createInventoryItem(
  repo: Repository,
  partyId: string,
  definitionId: string,
  turn: number,
  equipTo: string | null = null,
): InventoryRow {
  const definition = equipmentById[definitionId];
  if (!definition) throw new Error(`Unknown equipment definition: ${definitionId}`);
  const row: InventoryRow = {
    id: crypto.randomUUID(),
    party_id: partyId,
    definition_id: definition.id,
    name: definition.name,
    slot: definition.slot,
    rarity: definition.rarity,
    description: definition.description,
    bonuses_json: JSON.stringify(definition.bonuses),
    equipped_by: equipTo,
    acquired_turn: turn,
    created_at: new Date().toISOString(),
  };
  repo.insertInventoryItem(row);
  return row;
}

export function seedWorld(repo: Repository): void {
  if (repo.getPlayer()) return;

  repo.transaction(() => {
    const player = repo.createPlayer("Wanderer", 40);
    const world = repo.createWorld(player.id, "greenreach");

    for (const [regionIndex, region] of (contentRegions as RegionDefinition[]).entries()) {
      repo.insertRegion({
        id: region.id,
        world_id: world.id,
        name: region.name,
        description: region.description,
        level_min: region.levelRange.min,
        level_max: region.levelRange.max,
        status: region.status,
        threat_level: region.threatLevel,
        sort_order: regionIndex,
      });
      region.locations.forEach((location, locationIndex) => {
        repo.insertLocation({
          id: location.id,
          region_id: region.id,
          name: location.name,
          description: location.description,
          status: location.status,
          discovered_turn: location.status === "unknown" ? null : 1,
          sort_order: locationIndex,
        });
      });
    }

    const party = repo.createParty(world.id, "The Grey Company");
    for (const starter of starterParty) {
      const bonuses = sumBonuses(
        starter.equipment.map((entry) => equipmentById[entry.definitionId]?.bonuses ?? {}),
      );
      const derived = deriveStats(starter.attributes, 1, bonuses);
      const character: CharacterRow = {
        id: crypto.randomUUID(),
        party_id: party.id,
        name: starter.name,
        archetype: starter.archetype,
        level: 1,
        experience: 0,
        strength: starter.attributes.strength,
        agility: starter.attributes.agility,
        intelligence: starter.attributes.intelligence,
        vitality: starter.attributes.vitality,
        health: derived.maxHealth,
        mana: derived.maxMana,
        incapacitated: 0,
        ability_ids_json: JSON.stringify(starter.abilityIds),
        combat_behavior_id: starter.combatBehaviorId,
        formation: starter.formation,
        created_at: new Date().toISOString(),
      };
      repo.insertCharacter(character);
      for (const entry of starter.equipment) {
        const item = createInventoryItem(repo, party.id, entry.definitionId, 1, character.id);
        repo.equip(character.id, entry.slot, item.id);
      }
    }
    for (const definitionId of starterInventory) {
      createInventoryItem(repo, party.id, definitionId, 1);
    }

    repo.addJournal(
      world.id,
      1,
      "arrival",
      "The road to Greenreach",
      "The Grey Company arrives at Thornbury with empty purses and a guild writ. The Whispering Wood has gone quiet, and the reeve has no one else to send.",
    );

    const initialKeys = [
      "fallback_whispering_wood",
      "fallback_old_road_scout",
      "fallback_bandit_ford",
    ];
    for (const key of initialKeys) {
      const definition = fallbackEvents.find((event) => event.key === key);
      if (definition) persistEvent(repo, draftFromFallback(definition, world.id, world.turn));
    }
  });
}

export function ensureGame(repo: Repository): void {
  seedWorld(repo);
}
