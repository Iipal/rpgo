import type { SQLQueryBindings } from "bun:sqlite";
import type { Db } from "./database";

export interface PlayerRow {
  id: string;
  name: string;
  gold: number;
  research_points: number;
  created_at: string;
}

export interface WorldRow {
  id: string;
  player_id: string;
  turn: number;
  current_region_id: string;
  created_at: string;
  updated_at: string;
}

export interface RegionRow {
  id: string;
  world_id: string;
  name: string;
  description: string;
  level_min: number;
  level_max: number;
  status: "unknown" | "discovered" | "accessible";
  threat_level: number;
  sort_order: number;
}

export interface LocationRow {
  id: string;
  region_id: string;
  name: string;
  description: string;
  status: "unknown" | "discovered" | "accessible";
  discovered_turn: number | null;
  sort_order: number;
}

export interface PartyRow {
  id: string;
  world_id: string;
  name: string;
  created_at: string;
}

export interface CharacterRow {
  id: string;
  party_id: string;
  name: string;
  archetype: "warrior" | "ranger" | "mage" | "cleric";
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  health: number;
  mana: number;
  incapacitated: number;
  ability_ids_json: string;
  combat_behavior_id: string;
  formation: "front" | "back";
  created_at: string;
}

export interface InventoryRow {
  id: string;
  party_id: string;
  definition_id: string;
  name: string;
  slot: "weapon" | "armor" | "accessory";
  rarity: "common" | "uncommon" | "rare";
  description: string;
  bonuses_json: string;
  equipped_by: string | null;
  acquired_turn: number;
  created_at: string;
}

export interface EquipmentRow extends InventoryRow {
  character_id: string;
  equip_slot: "weapon" | "armor" | "accessory";
}

export interface EventRow {
  id: string;
  world_id: string;
  type: "dungeon" | "scout" | "research" | "attack";
  category: "storyline" | "opportunity";
  title: string;
  hook: string;
  description: string;
  introduction: string;
  status: "available" | "active" | "completed" | "failed" | "expired";
  difficulty_band: "easy" | "normal" | "hard";
  region_id: string;
  location_id: string | null;
  objective_kind: "defeat_enemies" | "discover_location" | "complete_research";
  reward_intent_json: string;
  reward_preview_json: string;
  completion_text: string;
  failure_text: string;
  result_text: string | null;
  source: "generated" | "fallback" | "authored";
  expires_on_turn: number | null;
  storyline_key: string | null;
  created_turn: number;
  current_encounter_index: number;
  encounters_completed: number;
  accepted_turn: number | null;
  completed_turn: number | null;
  generation_id: string | null;
  created_at: string;
}

export interface ObjectiveRow {
  id: string;
  event_id: string;
  position: number;
  kind: "defeat_enemies" | "discover_location" | "complete_research";
  description: string;
  target_count: number | null;
  target_ref: string | null;
  progress: number;
  completed: number;
}

export interface EncounterRow {
  id: string;
  event_id: string;
  position: number;
  title: string;
  description: string;
  enemies_json: string;
  status: "pending" | "active" | "completed" | "failed";
}

export interface BattleRow {
  id: string;
  event_id: string;
  encounter_index: number;
  seed: number;
  outcome: "victory" | "defeat" | "draw";
  rounds: number;
  party_result_json: string;
  enemy_result_json: string;
  action_log_json: string;
  operation_id: string;
  created_at: string;
}

export interface GenerationRow {
  id: string;
  task: string;
  model: string;
  prompt_version: string | null;
  schema_version: string | null;
  status: "success" | "invalid" | "timeout" | "unavailable" | "refused";
  error_code: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  response_text: string | null;
  correlation_id: string;
  created_at: string;
}

export interface JournalRow {
  id: string;
  world_id: string;
  turn: number;
  kind: string;
  title: string;
  detail: string;
  created_at: string;
}

function now(): string {
  return new Date().toISOString();
}

export class Repository {
  constructor(readonly db: Db) {}

  private get<T>(sql: string, ...params: SQLQueryBindings[]): T | null {
    return (this.db.query(sql).get(...params) as T | null) ?? null;
  }

  private all<T>(sql: string, ...params: SQLQueryBindings[]): T[] {
    return this.db.query(sql).all(...params) as T[];
  }

  private run(sql: string, ...params: SQLQueryBindings[]): void {
    this.db.run(sql, params);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /* ---------------- player / world ---------------- */

  getPlayer(): PlayerRow | null {
    return this.get<PlayerRow>("SELECT * FROM players LIMIT 1");
  }

  createPlayer(name: string, gold = 40): PlayerRow {
    const row: PlayerRow = {
      id: crypto.randomUUID(),
      name,
      gold,
      research_points: 0,
      created_at: now(),
    };
    this.run(
      "INSERT INTO players (id, name, gold, research_points, created_at) VALUES (?, ?, ?, ?, ?)",
      row.id,
      row.name,
      row.gold,
      row.research_points,
      row.created_at,
    );
    return row;
  }

  addGold(playerId: string, amount: number): void {
    this.run("UPDATE players SET gold = MAX(0, gold + ?) WHERE id = ?", amount, playerId);
  }

  addResearch(playerId: string, amount: number): void {
    this.run(
      "UPDATE players SET research_points = MAX(0, research_points + ?) WHERE id = ?",
      amount,
      playerId,
    );
  }

  getWorld(): WorldRow | null {
    return this.get<WorldRow>("SELECT * FROM worlds LIMIT 1");
  }

  createWorld(playerId: string, currentRegionId: string): WorldRow {
    const timestamp = now();
    const row: WorldRow = {
      id: crypto.randomUUID(),
      player_id: playerId,
      turn: 1,
      current_region_id: currentRegionId,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.run(
      "INSERT INTO worlds (id, player_id, turn, current_region_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      row.id,
      row.player_id,
      row.turn,
      row.current_region_id,
      row.created_at,
      row.updated_at,
    );
    return row;
  }

  setWorldTurn(worldId: string, turn: number): void {
    this.run("UPDATE worlds SET turn = ?, updated_at = ? WHERE id = ?", turn, now(), worldId);
  }

  getRegions(): RegionRow[] {
    return this.all<RegionRow>("SELECT * FROM regions ORDER BY sort_order, name");
  }

  getLocations(): LocationRow[] {
    return this.all<LocationRow>("SELECT * FROM locations ORDER BY sort_order, name");
  }

  getRegion(id: string): RegionRow | null {
    return this.get<RegionRow>("SELECT * FROM regions WHERE id = ?", id);
  }

  getLocation(id: string): LocationRow | null {
    return this.get<LocationRow>("SELECT * FROM locations WHERE id = ?", id);
  }

  insertRegion(row: Omit<RegionRow, "world_id"> & { world_id: string }): void {
    this.run(
      "INSERT INTO regions (id, world_id, name, description, level_min, level_max, status, threat_level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      row.id,
      row.world_id,
      row.name,
      row.description,
      row.level_min,
      row.level_max,
      row.status,
      row.threat_level,
      row.sort_order,
    );
  }

  insertLocation(row: LocationRow): void {
    this.run(
      "INSERT INTO locations (id, region_id, name, description, status, discovered_turn, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      row.id,
      row.region_id,
      row.name,
      row.description,
      row.status,
      row.discovered_turn,
      row.sort_order,
    );
  }

  setLocationStatus(id: string, status: LocationRow["status"], turn: number | null): void {
    this.run(
      "UPDATE locations SET status = ?, discovered_turn = COALESCE(discovered_turn, ?) WHERE id = ?",
      status,
      turn,
      id,
    );
  }

  setRegionStatus(id: string, status: RegionRow["status"]): void {
    this.run("UPDATE regions SET status = ? WHERE id = ?", status, id);
  }

  setRegionThreat(id: string, threat: number): void {
    this.run("UPDATE regions SET threat_level = ? WHERE id = ?", threat, id);
  }

  /* ---------------- party / characters ---------------- */

  getParty(): PartyRow | null {
    return this.get<PartyRow>("SELECT * FROM parties LIMIT 1");
  }

  createParty(worldId: string, name: string): PartyRow {
    const row: PartyRow = {
      id: crypto.randomUUID(),
      world_id: worldId,
      name,
      created_at: now(),
    };
    this.run(
      "INSERT INTO parties (id, world_id, name, created_at) VALUES (?, ?, ?, ?)",
      row.id,
      row.world_id,
      row.name,
      row.created_at,
    );
    return row;
  }

  getCharacters(partyId: string): CharacterRow[] {
    return this.all<CharacterRow>(
      "SELECT * FROM characters WHERE party_id = ? ORDER BY rowid",
      partyId,
    );
  }

  getCharacter(id: string): CharacterRow | null {
    return this.get<CharacterRow>("SELECT * FROM characters WHERE id = ?", id);
  }

  insertCharacter(row: CharacterRow): void {
    this.run(
      `INSERT INTO characters (
        id, party_id, name, archetype, level, experience, strength, agility, intelligence,
        vitality, health, mana, incapacitated, ability_ids_json, combat_behavior_id, formation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.party_id,
      row.name,
      row.archetype,
      row.level,
      row.experience,
      row.strength,
      row.agility,
      row.intelligence,
      row.vitality,
      row.health,
      row.mana,
      row.incapacitated,
      row.ability_ids_json,
      row.combat_behavior_id,
      row.formation,
      row.created_at,
    );
  }

  updateCharacterVitals(id: string, health: number, mana: number, incapacitated: boolean): void {
    this.run(
      "UPDATE characters SET health = ?, mana = ?, incapacitated = ? WHERE id = ?",
      Math.max(0, Math.round(health)),
      Math.max(0, Math.round(mana)),
      incapacitated ? 1 : 0,
      id,
    );
  }

  updateCharacterProgress(
    id: string,
    level: number,
    experience: number,
    attributes: { strength: number; agility: number; intelligence: number; vitality: number },
  ): void {
    this.run(
      "UPDATE characters SET level = ?, experience = ?, strength = ?, agility = ?, intelligence = ?, vitality = ? WHERE id = ?",
      level,
      experience,
      attributes.strength,
      attributes.agility,
      attributes.intelligence,
      attributes.vitality,
      id,
    );
  }

  updateFormation(id: string, formation: "front" | "back"): void {
    this.run("UPDATE characters SET formation = ? WHERE id = ?", formation, id);
  }

  /* ---------------- inventory ---------------- */

  getInventory(partyId: string): InventoryRow[] {
    return this.all<InventoryRow>(
      "SELECT * FROM inventory_items WHERE party_id = ? ORDER BY acquired_turn DESC, rowid",
      partyId,
    );
  }

  getInventoryItem(id: string): InventoryRow | null {
    return this.get<InventoryRow>("SELECT * FROM inventory_items WHERE id = ?", id);
  }

  insertInventoryItem(row: InventoryRow): void {
    this.run(
      `INSERT INTO inventory_items (
        id, party_id, definition_id, name, slot, rarity, description, bonuses_json,
        equipped_by, acquired_turn, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.party_id,
      row.definition_id,
      row.name,
      row.slot,
      row.rarity,
      row.description,
      row.bonuses_json,
      row.equipped_by,
      row.acquired_turn,
      row.created_at,
    );
  }

  getEquippedItems(characterId: string): EquipmentRow[] {
    return this.all<EquipmentRow>(
      `SELECT i.*, ce.character_id, ce.slot AS equip_slot
       FROM character_equipment ce
       JOIN inventory_items i ON i.id = ce.item_id
       WHERE ce.character_id = ?`,
      characterId,
    );
  }

  getAllEquipped(partyId: string): EquipmentRow[] {
    return this.all<EquipmentRow>(
      `SELECT i.*, ce.character_id, ce.slot AS equip_slot
       FROM character_equipment ce
       JOIN inventory_items i ON i.id = ce.item_id
       JOIN characters c ON c.id = ce.character_id
       WHERE c.party_id = ?`,
      partyId,
    );
  }

  equip(characterId: string, slot: string, itemId: string): void {
    this.run(
      "DELETE FROM character_equipment WHERE character_id = ? AND slot = ?",
      characterId,
      slot,
    );
    this.run("UPDATE inventory_items SET equipped_by = ? WHERE id = ?", characterId, itemId);
    this.run(
      "INSERT INTO character_equipment (character_id, slot, item_id) VALUES (?, ?, ?)",
      characterId,
      slot,
      itemId,
    );
  }

  unequip(characterId: string, slot: string): string | null {
    const existing = this.get<{ item_id: string }>(
      "SELECT item_id FROM character_equipment WHERE character_id = ? AND slot = ?",
      characterId,
      slot,
    );
    if (!existing) return null;
    this.run(
      "DELETE FROM character_equipment WHERE character_id = ? AND slot = ?",
      characterId,
      slot,
    );
    this.run("UPDATE inventory_items SET equipped_by = NULL WHERE id = ?", existing.item_id);
    return existing.item_id;
  }

  /* ---------------- events ---------------- */

  insertEvent(row: EventRow): void {
    this.run(
      `INSERT INTO events (
        id, world_id, type, category, title, hook, description, introduction, status,
        difficulty_band, region_id, location_id, objective_kind, reward_intent_json,
        reward_preview_json, completion_text, failure_text, result_text, source,
        expires_on_turn, storyline_key, created_turn, current_encounter_index,
        encounters_completed, accepted_turn, completed_turn, generation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.world_id,
      row.type,
      row.category,
      row.title,
      row.hook,
      row.description,
      row.introduction,
      row.status,
      row.difficulty_band,
      row.region_id,
      row.location_id,
      row.objective_kind,
      row.reward_intent_json,
      row.reward_preview_json,
      row.completion_text,
      row.failure_text,
      row.result_text,
      row.source,
      row.expires_on_turn,
      row.storyline_key,
      row.created_turn,
      row.current_encounter_index,
      row.encounters_completed,
      row.accepted_turn,
      row.completed_turn,
      row.generation_id,
      row.created_at,
    );
  }

  insertObjective(row: ObjectiveRow): void {
    this.run(
      "INSERT INTO event_objectives (id, event_id, position, kind, description, target_count, target_ref, progress, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      row.id,
      row.event_id,
      row.position,
      row.kind,
      row.description,
      row.target_count,
      row.target_ref,
      row.progress,
      row.completed,
    );
  }

  insertEncounter(row: EncounterRow): void {
    this.run(
      "INSERT INTO event_encounters (id, event_id, position, title, description, enemies_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      row.id,
      row.event_id,
      row.position,
      row.title,
      row.description,
      row.enemies_json,
      row.status,
    );
  }

  getEvent(id: string): EventRow | null {
    return this.get<EventRow>("SELECT * FROM events WHERE id = ?", id);
  }

  getEvents(worldId: string, statuses: EventRow["status"][]): EventRow[] {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => "?").join(",");
    return this.all<EventRow>(
      `SELECT * FROM events WHERE world_id = ? AND status IN (${placeholders}) ORDER BY created_turn DESC, rowid DESC`,
      worldId,
      ...statuses,
    );
  }

  getVisibleBoard(worldId: string): EventRow[] {
    return this.getEvents(worldId, ["available", "active"]);
  }

  getObjectives(eventId: string): ObjectiveRow[] {
    return this.all<ObjectiveRow>(
      "SELECT * FROM event_objectives WHERE event_id = ? ORDER BY position",
      eventId,
    );
  }

  getEncounters(eventId: string): EncounterRow[] {
    return this.all<EncounterRow>(
      "SELECT * FROM event_encounters WHERE event_id = ? ORDER BY position",
      eventId,
    );
  }

  updateEventStatus(
    id: string,
    status: EventRow["status"],
    options: { resultText?: string | null; completedTurn?: number | null } = {},
  ): void {
    this.run(
      "UPDATE events SET status = ?, result_text = COALESCE(?, result_text), completed_turn = COALESCE(?, completed_turn) WHERE id = ?",
      status,
      options.resultText ?? null,
      options.completedTurn ?? null,
      id,
    );
  }

  acceptEvent(id: string, turn: number): void {
    this.run(
      "UPDATE events SET status = 'active', accepted_turn = ? WHERE id = ? AND status = 'available'",
      turn,
      id,
    );
  }

  setEventResultText(id: string, text: string): void {
    this.run("UPDATE events SET result_text = ? WHERE id = ?", text, id);
  }

  updateEventProgress(
    id: string,
    currentEncounterIndex: number,
    encountersCompleted: number,
  ): void {
    this.run(
      "UPDATE events SET current_encounter_index = ?, encounters_completed = ? WHERE id = ?",
      currentEncounterIndex,
      encountersCompleted,
      id,
    );
  }

  setObjectiveProgress(id: string, progress: number, completed: boolean): void {
    this.run(
      "UPDATE event_objectives SET progress = ?, completed = ? WHERE id = ?",
      progress,
      completed ? 1 : 0,
      id,
    );
  }

  setEncounterStatus(eventId: string, position: number, status: EncounterRow["status"]): void {
    this.run(
      "UPDATE event_encounters SET status = ? WHERE event_id = ? AND position = ?",
      status,
      eventId,
      position,
    );
  }

  expireOpportunities(worldId: string, turn: number): number {
    const rows = this.all<{ id: string }>(
      `SELECT id FROM events WHERE world_id = ? AND category = 'opportunity'
       AND status = 'available' AND expires_on_turn IS NOT NULL AND expires_on_turn < ?`,
      worldId,
      turn,
    );
    for (const row of rows) this.updateEventStatus(row.id, "expired");
    return rows.length;
  }

  countBoard(worldId: string, category?: "storyline" | "opportunity"): number {
    const row = category
      ? this.get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM events WHERE world_id = ? AND status IN ('available','active') AND category = ?",
          worldId,
          category,
        )
      : this.get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM events WHERE world_id = ? AND status IN ('available','active')",
          worldId,
        );
    return row?.count ?? 0;
  }

  hasDuplicateConcept(worldId: string, title: string, storylineKey?: string | null): boolean {
    const byTitle = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM events
       WHERE world_id = ? AND status IN ('available','active') AND lower(title) = lower(?)`,
      worldId,
      title,
    );
    if ((byTitle?.count ?? 0) > 0) return true;
    if (storylineKey) {
      const byKey = this.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM events
         WHERE world_id = ? AND status IN ('available','active') AND storyline_key = ?`,
        worldId,
        storylineKey,
      );
      return (byKey?.count ?? 0) > 0;
    }
    return false;
  }

  listCompletedEvents(worldId: string, limit = 20): EventRow[] {
    return this.all<EventRow>(
      "SELECT * FROM events WHERE world_id = ? AND status IN ('completed','failed','expired') ORDER BY completed_turn DESC, rowid DESC LIMIT ?",
      worldId,
      limit,
    );
  }

  /* ---------------- battles ---------------- */

  insertBattle(row: BattleRow): void {
    this.run(
      `INSERT INTO battle_sessions (
        id, event_id, encounter_index, seed, outcome, rounds, party_result_json,
        enemy_result_json, action_log_json, operation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.event_id,
      row.encounter_index,
      row.seed,
      row.outcome,
      row.rounds,
      row.party_result_json,
      row.enemy_result_json,
      row.action_log_json,
      row.operation_id,
      row.created_at,
    );
  }

  getBattle(eventId: string, encounterIndex: number): BattleRow | null {
    return this.get<BattleRow>(
      "SELECT * FROM battle_sessions WHERE event_id = ? AND encounter_index = ?",
      eventId,
      encounterIndex,
    );
  }

  listBattles(eventId: string): BattleRow[] {
    return this.all<BattleRow>(
      "SELECT * FROM battle_sessions WHERE event_id = ? ORDER BY encounter_index",
      eventId,
    );
  }

  insertBattleActions(battleId: string, entries: Array<Record<string, unknown>>): void {
    const statement = this.db.prepare(
      "INSERT INTO battle_actions (battle_id, round, actor_id, action_name, type, target_names, amount, crit, reason, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const entry of entries) {
      statement.run(
        battleId,
        Number(entry.round ?? 0),
        String(entry.actorId ?? ""),
        String(entry.actionName ?? ""),
        String(entry.type ?? ""),
        Array.isArray(entry.targetNames) ? entry.targetNames.join(", ") : "",
        typeof entry.amount === "number" ? entry.amount : null,
        entry.crit ? 1 : null,
        String(entry.reason ?? ""),
        String(entry.text ?? ""),
      );
    }
  }

  /* ---------------- world actions / transactions / journal ---------------- */

  findWorldAction(worldId: string, actionType: string, operationId: string): boolean {
    return Boolean(
      this.get<{ id: string }>(
        "SELECT id FROM world_actions WHERE world_id = ? AND action_type = ? AND operation_id = ?",
        worldId,
        actionType,
        operationId,
      ),
    );
  }

  insertWorldAction(row: {
    id: string;
    worldId: string;
    actionType: string;
    operationId: string;
    turn: number;
    detail: unknown;
  }): boolean {
    const result = this.db.run(
      "INSERT OR IGNORE INTO world_actions (id, world_id, action_type, operation_id, turn, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        row.id,
        row.worldId,
        row.actionType,
        row.operationId,
        row.turn,
        JSON.stringify(row.detail ?? {}),
        now(),
      ],
    );
    return result.changes > 0;
  }

  insertResourceTransaction(row: {
    id: string;
    worldId: string;
    grantKey: string;
    kind: string;
    amount: number;
    targetId?: string | null;
    detail?: unknown;
    turn: number;
  }): boolean {
    const result = this.db.run(
      "INSERT OR IGNORE INTO resource_transactions (id, world_id, grant_key, kind, amount, target_id, detail_json, turn, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        row.id,
        row.worldId,
        row.grantKey,
        row.kind,
        row.amount,
        row.targetId ?? null,
        JSON.stringify(row.detail ?? {}),
        row.turn,
        now(),
      ],
    );
    return result.changes > 0;
  }

  addJournal(worldId: string, turn: number, kind: string, title: string, detail: string): void {
    this.run(
      "INSERT INTO journal_entries (id, world_id, turn, kind, title, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      worldId,
      turn,
      kind,
      title,
      detail,
      now(),
    );
  }

  getJournal(worldId: string, limit = 50): JournalRow[] {
    return this.all<JournalRow>(
      "SELECT * FROM journal_entries WHERE world_id = ? ORDER BY turn DESC, created_at DESC LIMIT ?",
      worldId,
      limit,
    );
  }

  /* ---------------- generations ---------------- */

  insertGeneration(row: GenerationRow): void {
    this.run(
      `INSERT INTO llm_generations (
        id, task, model, prompt_version, schema_version, status, error_code, latency_ms,
        input_tokens, output_tokens, response_text, correlation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.task,
      row.model,
      row.prompt_version,
      row.schema_version,
      row.status,
      row.error_code,
      row.latency_ms,
      row.input_tokens,
      row.output_tokens,
      row.response_text,
      row.correlation_id,
      row.created_at,
    );
  }

  listGenerations(limit = 20): GenerationRow[] {
    return this.all<GenerationRow>(
      "SELECT * FROM llm_generations ORDER BY created_at DESC LIMIT ?",
      limit,
    );
  }

  getGeneration(id: string): GenerationRow | null {
    return this.get<GenerationRow>("SELECT * FROM llm_generations WHERE id = ?", id);
  }

  /* ---------------- idempotency receipts ---------------- */

  getReceipt(operationId: string, command: string): string | null {
    const row = this.get<{ result_json: string }>(
      "SELECT result_json FROM command_receipts WHERE operation_id = ? AND command = ?",
      operationId,
      command,
    );
    return row?.result_json ?? null;
  }

  saveReceipt(operationId: string, command: string, result: unknown): void {
    this.run(
      "INSERT OR REPLACE INTO command_receipts (operation_id, command, result_json, created_at) VALUES (?, ?, ?, ?)",
      operationId,
      command,
      JSON.stringify(result),
      now(),
    );
  }
}
