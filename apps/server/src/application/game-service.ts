import type {
  CommandResponseDto,
  EventDetailDto,
  GenerationRecordDto,
  PartyWithInventoryDto,
  PlayerDto,
  SystemHealthDto,
} from "@rpgo/contracts";
import { abilityById, locationName, regionById } from "@rpgo/game-content";
import {
  DISCOVERY_RANK,
  deriveRegionStatus,
  nextLocationStatus,
  simulateBattle,
  threatLevelForOutcomes,
} from "@rpgo/game-rules";
import type { Config } from "../config";
import { ConflictError, InvalidCommandError, NotFoundError } from "../domain/errors";
import { currentSchemaVersion } from "../infrastructure/database/database";
import type { Repository, WorldRow } from "../infrastructure/database/repository";
import type { GenerationService } from "../infrastructure/llm/generation-service";
import type { BoardService } from "./board";
import { buildEncounterEnemies, buildPartyCombatants } from "./encounter";
import { eventSeed } from "./events";
import {
  battleReportDto,
  buildParty,
  eventDetail,
  eventSummary,
  gameState,
  inventoryDto,
  journalDto,
  type PartyBundle,
  parseJson,
  playerDto,
  type RewardPreviewInternal,
} from "./mappers";
import { generateNarrative, narrativeLogger } from "./narrative";
import { grantRewards, rewardSummaryText } from "./rewards";
import { ensureGame } from "./seeding";

const REST_COST = 15;

type WorldAction =
  | "event_accepted"
  | "event_completed"
  | "event_failed"
  | "location_discovered"
  | "research_completed";

interface Context {
  player: NonNullable<ReturnType<Repository["getPlayer"]>>;
  world: WorldRow;
  partyRow: NonNullable<ReturnType<Repository["getParty"]>>;
  party: PartyBundle;
}

export class GameService {
  constructor(
    private readonly repo: Repository,
    private readonly board: BoardService,
    private readonly generation: GenerationService,
    private readonly config: Config,
  ) {}

  context(): Context {
    ensureGame(this.repo);
    const player = this.repo.getPlayer();
    const world = this.repo.getWorld();
    const partyRow = this.repo.getParty();
    if (!player || !world || !partyRow) throw new Error("Game seed is incomplete");
    return { player, world, partyRow, party: buildParty(this.repo, partyRow) };
  }

  state(): CommandResponseDto["state"] {
    const context = this.context();
    return gameState(this.repo, context.player, context.world, context.party);
  }

  player(): PlayerDto {
    return playerDto(this.context().player);
  }

  getWorld(): CommandResponseDto["state"]["world"] {
    return this.state().world;
  }

  getParty(): PartyWithInventoryDto {
    const context = this.context();
    const names = new Map(
      context.party.characters.map((character) => [character.id, character.name]),
    );
    return {
      party: context.party.party,
      inventory: this.repo
        .getInventory(context.partyRow.id)
        .map((row) =>
          inventoryDto(row, row.equipped_by ? (names.get(row.equipped_by) ?? null) : null),
        ),
    };
  }

  getEvents(): CommandResponseDto["state"]["events"] {
    const context = this.context();
    return this.repo
      .getVisibleBoard(context.world.id)
      .map((row) => eventSummary(this.repo, row, context.party.party.power));
  }

  getJournal() {
    const context = this.context();
    return this.repo.getJournal(context.world.id).map(journalDto);
  }

  getEvent(id: string): EventDetailDto {
    const context = this.context();
    const row = this.repo.getEvent(id);
    if (!row) throw new NotFoundError(`Event ${id} not found`);
    return eventDetail(this.repo, row, context.party.party.power);
  }

  async acceptEvent(
    id: string,
    operationId: string,
    correlationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("accept_event", operationId);
    if (cached) return cached;
    const context = this.context();
    this.requireEvent(id);

    this.repo.transaction(() => {
      const fresh = this.requireEvent(id);
      if (fresh.status !== "available") throw new ConflictError("Event is not available");
      this.repo.acceptEvent(id, context.world.turn);
      const turn = this.advanceWorld(context.world.id, "event_accepted", operationId, {
        eventId: id,
      });
      this.repo.addJournal(
        context.world.id,
        turn,
        "event",
        `Accepted: ${fresh.title}`,
        `${fresh.hook} (${locationName(fresh.location_id ?? undefined) ?? "the road"})`,
      );
      const core: CommandResponseDto = {
        state: this.state(),
        event: this.getEvent(id),
        report: null,
      };
      this.repo.saveReceipt(operationId, "accept_event", core);
    });

    this.refreshBoard(correlationId);
    const output: CommandResponseDto = {
      state: this.state(),
      event: this.getEvent(id),
      report: null,
    };
    this.repo.saveReceipt(operationId, "accept_event", output);
    return output;
  }

  async startEvent(
    id: string,
    operationId: string,
    _correlationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("start_event", operationId);
    if (cached) return cached;
    const context = this.context();
    const event = this.requireEvent(id);
    if (event.status !== "active") throw new ConflictError("Event must be accepted first");
    const encounters = this.repo.getEncounters(id);
    if (encounters.length === 0) {
      const output: CommandResponseDto = {
        state: this.state(),
        event: this.getEvent(id),
        report: null,
      };
      this.repo.saveReceipt(operationId, "start_event", output);
      return output;
    }
    const index = event.current_encounter_index;
    const encounter = encounters[index];
    if (!encounter) throw new ConflictError("No encounter remains");
    this.repo.transaction(() => {
      if (encounter.status === "pending") {
        this.repo.setEncounterStatus(id, index, "active");
      }
      const output: CommandResponseDto = {
        state: this.state(),
        event: this.getEvent(id),
        report: null,
      };
      this.repo.saveReceipt(operationId, "start_event", output);
    });
    void context;
    return { state: this.state(), event: this.getEvent(id), report: null };
  }

  async resolveEvent(
    id: string,
    operationId: string,
    correlationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("resolve_event", operationId);
    if (cached) return cached;
    const context = this.context();
    const event = this.requireEvent(id);
    if (event.status !== "active") throw new ConflictError("Event is not active");

    const encounters = this.repo.getEncounters(id);
    if (encounters.length === 0) {
      return this.resolveNonCombat(event, operationId, correlationId);
    }

    const index = event.current_encounter_index;
    const encounter = encounters[index];
    if (!encounter) throw new ConflictError("No encounter remains to resolve");

    const existing = this.repo.getBattle(id, index);
    if (existing) {
      const output: CommandResponseDto = {
        state: this.state(),
        event: this.getEvent(id),
        report: battleReportDto(existing),
      };
      this.repo.saveReceipt(operationId, "resolve_event", output);
      return output;
    }

    const partyLevel = Math.max(...context.party.characters.map((character) => character.level), 1);
    const combatants = buildPartyCombatants(context.party);
    const enemies = buildEncounterEnemies(encounter, id, index, partyLevel, event.difficulty_band);
    const seed = eventSeed(id, index, this.config.gameSeed);
    const result = simulateBattle({
      party: combatants,
      enemies,
      abilities: abilityById,
      seed,
    });
    const battleId = crypto.randomUUID();
    const preview = this.rewardPreview(event);
    let completed = false;
    let failed = false;

    this.repo.transaction(() => {
      this.repo.insertBattle({
        id: battleId,
        event_id: id,
        encounter_index: index,
        seed,
        outcome: result.outcome,
        rounds: result.rounds,
        party_result_json: JSON.stringify(result.party),
        enemy_result_json: JSON.stringify(result.enemies),
        action_log_json: JSON.stringify({
          encounterTitle: encounter.title,
          entries: result.log,
        }),
        operation_id: operationId,
        created_at: new Date().toISOString(),
      });
      this.repo.insertBattleActions(
        battleId,
        result.log as unknown as Array<Record<string, unknown>>,
      );

      const manaById = new Map(
        context.party.characters.map((character) => [character.id, character.mana]),
      );
      for (const member of result.party) {
        this.repo.updateCharacterVitals(
          member.id,
          member.hp,
          manaById.get(member.id) ?? 0,
          !member.alive,
        );
      }

      if (result.outcome === "victory") {
        this.repo.setEncounterStatus(id, index, "completed");
        this.repo.updateEventProgress(id, index + 1, index + 1);
        for (const objective of this.repo.getObjectives(id)) {
          if (objective.kind === "defeat_enemies") {
            this.repo.setObjectiveProgress(objective.id, index + 1, index + 1 >= encounters.length);
          }
        }
        if (index + 1 >= encounters.length) {
          const turn = this.advanceWorld(context.world.id, "event_completed", operationId, {
            eventId: id,
            battleId,
          });
          this.repo.updateEventStatus(id, "completed", {
            resultText: event.completion_text,
            completedTurn: turn,
          });
          this.applyWorldRules(event.region_id);
          const grant = grantRewards(this.repo, {
            eventId: id,
            turn,
            playerId: context.player.id,
            partyId: context.partyRow.id,
            characters: context.party.characters,
            rows: context.party.rows,
            preview,
          });
          this.repo.addJournal(
            context.world.id,
            turn,
            "event",
            `Completed: ${event.title}`,
            rewardSummaryText(grant),
          );
          completed = true;
        } else {
          this.repo.addJournal(
            context.world.id,
            context.world.turn,
            "battle",
            `Encounter cleared: ${encounter.title}`,
            `The party presses deeper into ${locationName(event.location_id ?? undefined) ?? "the wilds"}.`,
          );
        }
      } else {
        this.repo.setEncounterStatus(id, index, "failed");
        const turn = this.advanceWorld(context.world.id, "event_failed", operationId, {
          eventId: id,
          battleId,
          outcome: result.outcome,
        });
        this.repo.updateEventStatus(id, "failed", {
          resultText: event.failure_text,
          completedTurn: turn,
        });
        this.applyWorldRules(event.region_id);
        this.repo.addJournal(
          context.world.id,
          turn,
          "event",
          `Failed: ${event.title}`,
          result.outcome === "draw"
            ? "The fight stalls; the company withdraws before it is too late."
            : "The company is driven back and carries its wounded home.",
        );
        failed = true;
      }

      this.repo.saveReceipt(operationId, "resolve_event", {
        state: this.state(),
        report: null,
      } satisfies CommandResponseDto);
    });

    if (completed || failed) {
      this.scheduleResultNarrative(id, completed ? "victory" : "defeat", correlationId);
      this.refreshBoard(correlationId);
    }

    const report = this.repo.getBattle(id, index);
    const output: CommandResponseDto = {
      state: this.state(),
      event: this.getEvent(id),
      report: report ? battleReportDto(report) : null,
    };
    this.repo.saveReceipt(operationId, "resolve_event", output);
    return output;
  }

  private async resolveNonCombat(
    event: NonNullable<ReturnType<Repository["getEvent"]>>,
    operationId: string,
    correlationId: string,
  ): Promise<CommandResponseDto> {
    const context = this.context();
    let newTurn = context.world.turn;
    let discovered: string | null = null;

    this.repo.transaction(() => {
      const objectives = this.repo.getObjectives(event.id);
      for (const objective of objectives) {
        if (objective.kind === "discover_location" && objective.target_ref) {
          const target = this.repo.getLocation(objective.target_ref);
          if (target) {
            const next = nextLocationStatus(target.status);
            if (next) {
              this.repo.setLocationStatus(target.id, next, context.world.turn);
              this.refreshRegionStatus(target.region_id, context.world.turn);
              discovered = target.name;
            }
          }
        }
        this.repo.setObjectiveProgress(objective.id, objective.target_count ?? 1, true);
      }

      const action = event.type === "research" ? "research_completed" : "event_completed";
      newTurn = this.advanceWorld(context.world.id, action, operationId, {
        eventId: event.id,
      });
      this.repo.updateEventStatus(event.id, "completed", {
        resultText: event.completion_text,
        completedTurn: newTurn,
      });
      this.applyWorldRules(event.region_id);
      const grant = grantRewards(this.repo, {
        eventId: event.id,
        turn: newTurn,
        playerId: context.player.id,
        partyId: context.partyRow.id,
        characters: context.party.characters,
        rows: context.party.rows,
        preview: this.rewardPreview(event),
      });
      this.repo.addJournal(
        context.world.id,
        newTurn,
        "event",
        `Completed: ${event.title}`,
        discovered
          ? `${discovered} is now marked on the guild map. ${rewardSummaryText(grant)}`
          : rewardSummaryText(grant),
      );
      this.repo.saveReceipt(operationId, "resolve_event", {
        state: this.state(),
        report: null,
      } satisfies CommandResponseDto);
    });

    this.scheduleResultNarrative(event.id, "victory", correlationId);
    this.refreshBoard(correlationId);
    const output: CommandResponseDto = {
      state: this.state(),
      event: this.getEvent(event.id),
      report: null,
    };
    this.repo.saveReceipt(operationId, "resolve_event", output);
    return output;
  }

  async discover(
    locationId: string,
    operationId: string,
    correlationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("discover_location", operationId);
    if (cached) return cached;
    const context = this.context();
    const location = this.repo.getLocation(locationId);
    if (!location) throw new NotFoundError(`Location ${locationId} not found`);
    const region = this.repo.getRegion(location.region_id);
    if (region?.status === "unknown") {
      throw new ConflictError("The region is not known yet");
    }
    if (location.status === "accessible") {
      const output: CommandResponseDto = { state: this.state(), event: null, report: null };
      this.repo.saveReceipt(operationId, "discover_location", output);
      return output;
    }
    let turn = context.world.turn;
    this.repo.transaction(() => {
      const next = nextLocationStatus(location.status);
      if (next) {
        this.repo.setLocationStatus(location.id, next, context.world.turn);
        this.refreshRegionStatus(location.region_id, context.world.turn);
      }
      turn = this.advanceWorld(context.world.id, "location_discovered", operationId, {
        locationId,
      });
      this.repo.addJournal(
        context.world.id,
        turn,
        "discovery",
        `Discovered: ${location.name}`,
        location.description,
      );
      this.repo.saveReceipt(operationId, "discover_location", {
        state: this.state(),
        event: null,
        report: null,
      } satisfies CommandResponseDto);
    });
    this.refreshBoard(correlationId);
    this.scheduleDiscoveryNarrative(location, turn, correlationId);
    const output: CommandResponseDto = { state: this.state(), event: null, report: null };
    this.repo.saveReceipt(operationId, "discover_location", output);
    return output;
  }

  async rest(operationId: string, _correlationId: string): Promise<CommandResponseDto> {
    const cached = this.replay("rest", operationId);
    if (cached) return cached;
    const context = this.context();
    if (context.player.gold < REST_COST) {
      throw new InvalidCommandError(`Resting costs ${REST_COST} gold`);
    }
    this.repo.transaction(() => {
      this.repo.addGold(context.player.id, -REST_COST);
      this.repo.insertResourceTransaction({
        id: crypto.randomUUID(),
        worldId: context.world.id,
        grantKey: `rest:${operationId}`,
        kind: "rest",
        amount: -REST_COST,
        targetId: context.player.id,
        turn: context.world.turn,
      });
      for (const character of context.party.characters) {
        this.repo.updateCharacterVitals(
          character.id,
          character.maxHealth,
          character.maxMana,
          false,
        );
      }
      this.repo.addJournal(
        context.world.id,
        context.world.turn,
        "rest",
        "A night at the guild house",
        `Beds, bandages, and a hot meal. The company recovers for ${REST_COST} gold.`,
      );
      this.repo.saveReceipt(operationId, "rest", {
        state: this.state(),
        event: null,
        report: null,
      } satisfies CommandResponseDto);
    });
    const output: CommandResponseDto = { state: this.state(), event: null, report: null };
    this.repo.saveReceipt(operationId, "rest", output);
    return output;
  }

  async equip(
    characterId: string,
    itemId: string,
    operationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("equip_item", operationId);
    if (cached) return cached;
    const context = this.context();
    const character = this.repo.getCharacter(characterId);
    if (!character || character.party_id !== context.partyRow.id) {
      throw new NotFoundError("Character not found in this party");
    }
    const item = this.repo.getInventoryItem(itemId);
    if (!item || item.party_id !== context.partyRow.id) {
      throw new NotFoundError("Item not found in this inventory");
    }
    if (item.equipped_by && item.equipped_by !== characterId) {
      throw new ConflictError("Item is equipped by another character");
    }
    this.repo.transaction(() => {
      if (item.equipped_by !== characterId) {
        this.repo.unequip(characterId, item.slot);
        this.repo.equip(characterId, item.slot, item.id);
        this.clampVitals(characterId, context.partyRow.id);
      }
      this.repo.saveReceipt(operationId, "equip_item", {
        state: this.state(),
        event: null,
        report: null,
      } satisfies CommandResponseDto);
    });
    const output: CommandResponseDto = { state: this.state(), event: null, report: null };
    this.repo.saveReceipt(operationId, "equip_item", output);
    return output;
  }

  async unequip(
    characterId: string,
    slot: "weapon" | "armor" | "accessory",
    operationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("unequip_item", operationId);
    if (cached) return cached;
    const context = this.context();
    const character = this.repo.getCharacter(characterId);
    if (!character || character.party_id !== context.partyRow.id) {
      throw new NotFoundError("Character not found in this party");
    }
    this.repo.transaction(() => {
      this.repo.unequip(characterId, slot);
      this.clampVitals(characterId, context.partyRow.id);
      this.repo.saveReceipt(operationId, "unequip_item", {
        state: this.state(),
        event: null,
        report: null,
      } satisfies CommandResponseDto);
    });
    const output: CommandResponseDto = { state: this.state(), event: null, report: null };
    this.repo.saveReceipt(operationId, "unequip_item", output);
    return output;
  }

  async setFormation(
    characterId: string,
    row: "front" | "back",
    operationId: string,
  ): Promise<CommandResponseDto> {
    const cached = this.replay("set_formation", operationId);
    if (cached) return cached;
    const context = this.context();
    const character = this.repo.getCharacter(characterId);
    if (!character || character.party_id !== context.partyRow.id) {
      throw new NotFoundError("Character not found in this party");
    }
    this.repo.transaction(() => {
      this.repo.updateFormation(characterId, row);
      this.repo.saveReceipt(operationId, "set_formation", {
        state: this.state(),
        event: null,
        report: null,
      } satisfies CommandResponseDto);
    });
    const output: CommandResponseDto = { state: this.state(), event: null, report: null };
    this.repo.saveReceipt(operationId, "set_formation", output);
    return output;
  }

  async health(correlationId: string): Promise<SystemHealthDto> {
    let databaseOk = true;
    try {
      this.repo.db.query("SELECT 1 AS ok").get();
    } catch {
      databaseOk = false;
    }
    const reachable = this.config.llm.enabled ? await this.generation.checkHealth() : null;
    const last = this.repo.listGenerations(1)[0];
    const lastGeneration: GenerationRecordDto | null = last
      ? {
          id: last.id,
          task: last.task,
          status: last.status,
          model: last.model,
          promptVersion: last.prompt_version,
          schemaVersion: last.schema_version,
          latencyMs: last.latency_ms,
          errorCode: last.error_code,
          createdAt: last.created_at,
        }
      : null;
    const fallbackActive =
      !this.config.llm.enabled ||
      reachable === false ||
      (lastGeneration !== null && lastGeneration.status !== "success");
    return {
      status: !databaseOk || (this.config.llm.enabled && reachable === false) ? "degraded" : "ok",
      api: "ok",
      database: {
        ok: databaseOk,
        schemaVersion: databaseOk ? currentSchemaVersion(this.repo.db) : null,
      },
      llm: {
        enabled: this.config.llm.enabled,
        configured: this.config.llm.enabled && this.config.llm.baseUrl.length > 0,
        reachable,
        model: this.config.llm.model,
        baseUrl: this.config.llm.baseUrl,
        lastGeneration,
        fallbackActive,
      },
      correlationId,
    };
  }

  async diagnostics(correlationId: string) {
    return {
      generations: this.repo.listGenerations(20).map((row) => ({
        id: row.id,
        task: row.task,
        status: row.status,
        model: row.model,
        promptVersion: row.prompt_version,
        schemaVersion: row.schema_version,
        latencyMs: row.latency_ms,
        errorCode: row.error_code,
        createdAt: row.created_at,
      })),
      health: await this.health(correlationId),
    };
  }

  async generateDevelopmentEvent(
    correlationId: string,
    category: "storyline" | "opportunity" = "opportunity",
  ): Promise<EventDetailDto> {
    const context = this.context();
    const row = await this.board.generateForDevelopment(
      context.world,
      context.party,
      correlationId,
      category,
    );
    return this.getEvent(row.id);
  }

  private requireEvent(id: string) {
    const row = this.repo.getEvent(id);
    if (!row) throw new NotFoundError(`Event ${id} not found`);
    return row;
  }

  private replay(command: string, operationId: string): CommandResponseDto | null {
    const raw = this.repo.getReceipt(operationId, command);
    if (!raw) return null;
    const data = parseJson<CommandResponseDto | null>(raw, null);
    if (!data) return null;
    const output: CommandResponseDto = {
      ...data,
      state: this.state(),
    };
    if (data.event?.id) {
      const row = this.repo.getEvent(data.event.id);
      output.event = row ? this.getEvent(row.id) : null;
    }
    return output;
  }

  private advanceWorld(
    worldId: string,
    action: WorldAction,
    operationId: string,
    detail: unknown,
  ): number {
    const world = this.repo.getWorld();
    if (!world) throw new Error("World not found");
    const inserted = this.repo.insertWorldAction({
      id: crypto.randomUUID(),
      worldId,
      actionType: action,
      operationId,
      turn: world.turn,
      detail,
    });
    if (!inserted) return world.turn;
    this.repo.setWorldTurn(worldId, world.turn + 1);
    return world.turn + 1;
  }

  private rewardPreview(
    event: NonNullable<ReturnType<Repository["getEvent"]>>,
  ): RewardPreviewInternal {
    return parseJson<RewardPreviewInternal>(event.reward_preview_json, {
      gold: 0,
      experiencePerCharacter: 0,
      researchPoints: 0,
      equipment: [],
    });
  }

  private clampVitals(characterId: string, partyId: string): void {
    const party = buildParty(this.repo, { id: partyId, name: "party" });
    const character = party.characters.find((member) => member.id === characterId);
    const row = party.rows.find((member) => member.id === characterId);
    if (!character || !row) return;
    this.repo.updateCharacterVitals(
      character.id,
      Math.min(row.health, character.maxHealth),
      Math.min(row.mana, character.maxMana),
      row.incapacitated === 1 || row.health <= 0,
    );
  }

  private scheduleResultNarrative(
    eventId: string,
    kind: "victory" | "defeat",
    correlationId: string,
  ): void {
    if (!this.generation.enabled) return;
    void this.finishEventStory(eventId, kind, correlationId).catch((error) => {
      narrativeLogger(correlationId, "Result narrative failed", error);
    });
  }

  private async finishEventStory(
    eventId: string,
    kind: "victory" | "defeat",
    correlationId: string,
  ): Promise<void> {
    const row = this.repo.getEvent(eventId);
    if (!row) return;
    const partyLevel = Math.max(
      ...this.context().party.characters.map((character) => character.level),
      1,
    );
    const text = await generateNarrative(
      this.generation,
      {
        kind,
        title: row.title,
        location: locationName(row.location_id ?? undefined) ?? "the frontier",
        partyLevel,
        extra: kind === "victory" ? row.completion_text : row.failure_text,
      },
      correlationId,
    );
    if (text) {
      this.repo.setEventResultText(eventId, `${row.result_text ?? ""}\n\n${text}`.trim());
    }
  }

  private scheduleDiscoveryNarrative(
    location: NonNullable<ReturnType<Repository["getLocation"]>>,
    turn: number,
    correlationId: string,
  ): void {
    if (!this.generation.enabled) return;
    void (async () => {
      const world = this.repo.getWorld();
      const partyRow = this.repo.getParty();
      if (!world || !partyRow) return;
      const party = buildParty(this.repo, partyRow);
      const text = await generateNarrative(
        this.generation,
        {
          kind: "discovery",
          title: location.name,
          location: location.name,
          partyLevel: Math.max(...party.characters.map((character) => character.level), 1),
          extra: location.description,
        },
        correlationId,
      );
      if (text) this.repo.addJournal(world.id, turn, "discovery", location.name, text);
    })().catch((error) => {
      narrativeLogger(correlationId, "Discovery narrative failed", error);
    });
  }

  /**
   * Board replenishment never waits on the model in a command response.
   * Without a model it runs synchronously from deterministic content; with a
   * model it runs in the background and leaves the current board intact.
   */
  private refreshBoard(correlationId: string): void {
    try {
      const world = this.repo.getWorld();
      const partyRow = this.repo.getParty();
      if (!world || !partyRow) return;
      const party = buildParty(this.repo, partyRow);
      if (!this.generation.enabled) {
        this.board.refreshFallback(world, party);
        return;
      }
      void this.board.refresh(world, party, correlationId).catch((error) => {
        narrativeLogger(correlationId, "Board refresh failed", error);
      });
    } catch (error) {
      narrativeLogger(correlationId, "Board refresh failed", error);
    }
  }

  private applyWorldRules(regionId: string): void {
    const region = this.repo.getRegion(regionId);
    if (!region) return;
    const outcomes = this.repo.countRegionOutcomes(regionId);
    const baseThreat = regionById[regionId]?.threatLevel ?? region.threat_level;
    const nextThreat = threatLevelForOutcomes(outcomes.completed, outcomes.failed, baseThreat);
    if (nextThreat !== region.threat_level) this.repo.setRegionThreat(regionId, nextThreat);
  }

  private refreshRegionStatus(regionId: string, turn: number): void {
    const region = this.repo.getRegion(regionId);
    const world = this.repo.getWorld();
    if (!region || !world) return;
    const statuses = this.repo
      .getLocations()
      .filter((location) => location.region_id === regionId)
      .map((location) => location.status);
    const target = deriveRegionStatus(statuses);
    if (DISCOVERY_RANK[target] <= DISCOVERY_RANK[region.status]) return;
    this.repo.setRegionStatus(regionId, target);
    this.repo.addJournal(world.id, turn, "discovery", `${region.name} opened`, region.description);
  }
}
