import {
  type EventConcept,
  EventConceptSchema,
  type GeneratedEvent,
  GeneratedEventSchema,
} from "@rpgo/contracts";
import { enemies, fallbackEvents, locationName, regionById } from "@rpgo/game-content";
import { hashSeed } from "@rpgo/game-rules";
import type { EventRow, Repository, WorldRow } from "../infrastructure/database/repository";
import type { GenerationService } from "../infrastructure/llm/generation-service";
import { eventDirectorPrompt } from "../infrastructure/llm/prompts/event-director";
import { eventGeneratorPrompt } from "../infrastructure/llm/prompts/event-generator";
import { draftFromFallback, draftFromGenerated, persistEvent } from "./events";
import {
  ALLOWED_BEHAVIORS,
  MAX_ENCOUNTERS,
  type NormalizedConcept,
  validateConcept,
  validateGenerated,
} from "./generation-validation";
import type { PartyBundle } from "./mappers";
import { generateNarrative, narrativeLogger } from "./narrative";

const MAX_BOARD = 4;

export class BoardService {
  private refreshing = false;

  constructor(
    private readonly repo: Repository,
    private readonly generation: GenerationService,
  ) {}

  /**
   * Fill the board with deterministic content only. This never waits on a model
   * and is safe to call inside a command response path.
   */
  refreshFallback(world: WorldRow, party: PartyBundle): number {
    this.repo.expireOpportunities(world.id, world.turn);
    let added = 0;
    let failures = 0;

    while (failures < 3) {
      const board = this.repo.getVisibleBoard(world.id);
      if (board.length >= MAX_BOARD) break;
      const category = this.nextCategory(board);
      if (!category) break;

      const event = this.createFallback(world, party, category, null);
      if (!event) {
        failures += 1;
        continue;
      }
      added += 1;
      failures = 0;
    }
    return added;
  }

  /** Fill the board, preferring the model, then falling back deterministically. */
  async refresh(world: WorldRow, party: PartyBundle, correlationId: string): Promise<number> {
    if (this.refreshing) return 0;
    this.refreshing = true;
    try {
      this.repo.expireOpportunities(world.id, world.turn);
      let added = 0;
      let failures = 0;

      while (failures < 3) {
        const board = this.repo.getVisibleBoard(world.id);
        if (board.length >= MAX_BOARD) break;
        const category = this.nextCategory(board);
        if (!category) break;

        const event = await this.createOne(world, party, category, correlationId);
        if (!event) {
          failures += 1;
          continue;
        }
        added += 1;
        failures = 0;
      }
      return added;
    } finally {
      this.refreshing = false;
    }
  }

  private nextCategory(board: EventRow[]): "storyline" | "opportunity" | null {
    const storylineCount = board.filter((event) => event.category === "storyline").length;
    const opportunityCount = board.filter((event) => event.category === "opportunity").length;
    if (storylineCount < 1) return "storyline";
    if (opportunityCount < 2) return "opportunity";
    if (storylineCount < 2) return "storyline";
    return null;
  }

  /** Development/diagnostics endpoint: force a generated (or fallback) event. */
  async generateForDevelopment(
    world: WorldRow,
    party: PartyBundle,
    correlationId: string,
    category: "storyline" | "opportunity" = "opportunity",
  ): Promise<EventRow> {
    const created = await this.createOne(world, party, category, correlationId);
    if (created) return created;
    throw new Error("Could not create an event");
  }

  private async createOne(
    world: WorldRow,
    party: PartyBundle,
    category: "storyline" | "opportunity",
    correlationId: string,
  ): Promise<EventRow | null> {
    const partyLevel = Math.max(...party.characters.map((character) => character.level), 1);
    if (this.generation.enabled) {
      const created = await this.tryLlm(world, party, partyLevel, category, correlationId);
      if (created) return created;
    }
    return this.createFallback(world, party, category, correlationId);
  }

  private async tryLlm(
    world: WorldRow,
    party: PartyBundle,
    partyLevel: number,
    category: "storyline" | "opportunity",
    correlationId: string,
  ): Promise<EventRow | null> {
    const board = this.repo.getVisibleBoard(world.id);
    const director = eventDirectorPrompt.build({
      category,
      partyLevel,
      partyPower: party.party.power,
      turn: world.turn,
      boardTitles: board.map((event) => event.title),
      recentTitles: this.repo.listCompletedEvents(world.id, 10).map((event) => event.title),
      regions: this.repo.getRegions().map((region) => ({
        id: region.id,
        name: region.name,
        status: region.status,
        locations: this.repo
          .getLocations()
          .filter((location) => location.region_id === region.id)
          .map((location) => ({
            id: location.id,
            name: location.name,
            status: location.status,
          })),
      })),
    });

    const conceptResult = await this.generation.generate<EventConcept>({
      task: "event_director",
      promptVersion: eventDirectorPrompt.version,
      schemaVersion: eventDirectorPrompt.schemaVersion,
      schemaName: eventDirectorPrompt.schemaName,
      systemPrompt: director.system,
      userPrompt: director.user,
      schema: EventConceptSchema,
      correlationId,
      maxOutputTokens: 500,
      maxAttempts: 1,
    });
    if (!conceptResult) return null;

    const validation = validateConcept(
      this.repo,
      conceptResult.data,
      category,
      world.turn,
      partyLevel,
    );
    if (!validation.concept) return null;
    const concept: NormalizedConcept = validation.concept;

    const generator = eventGeneratorPrompt.build({
      concept,
      partyLevel,
      partyPower: party.party.power,
      turn: world.turn,
      enemyTemplates: enemies
        .filter((enemy) =>
          (regionById[concept.regionId]?.enemyFamilies ?? []).includes(enemy.family),
        )
        .map((enemy) => ({
          id: enemy.id,
          name: enemy.name,
          level: enemy.level,
          behaviorId: enemy.behaviorId,
        })),
      allowedBehaviors: [...ALLOWED_BEHAVIORS],
      maxEncounters: MAX_ENCOUNTERS[concept.type],
    });
    const eventResult = await this.generation.generate<GeneratedEvent>({
      task: "event_generator",
      promptVersion: eventGeneratorPrompt.version,
      schemaVersion: eventGeneratorPrompt.schemaVersion,
      schemaName: eventGeneratorPrompt.schemaName,
      systemPrompt: generator.system,
      userPrompt: generator.user,
      schema: GeneratedEventSchema,
      correlationId,
      maxOutputTokens: 1200,
      maxAttempts: 1,
    });
    if (!eventResult) return null;
    const generatedValidation = validateGenerated(eventResult.data, concept);
    if (generatedValidation.error) return null;

    const created = this.repo.transaction(() =>
      persistEvent(
        this.repo,
        draftFromGenerated(
          concept,
          eventResult.data,
          world.id,
          world.turn,
          eventResult.generationId,
        ),
      ),
    );
    const partyLevelForNarrative = Math.max(
      ...party.characters.map((character) => character.level),
      1,
    );
    this.scheduleNarrative(created, partyLevelForNarrative, correlationId);
    return created;
  }

  private createFallback(
    world: WorldRow,
    party: PartyBundle,
    category: "storyline" | "opportunity",
    correlationId: string | null,
  ): EventRow | null {
    const candidates = fallbackEvents.filter((definition) => {
      if (definition.category !== category) return false;
      const region = this.repo.getRegion(definition.regionId);
      if (region?.status !== "accessible") return false;
      if (definition.locationId) {
        const location = this.repo.getLocation(definition.locationId);
        if (!location || location.status === "unknown") return false;
      }
      return !this.repo.hasDuplicateConcept(
        world.id,
        definition.title,
        definition.storylineKey ?? null,
      );
    });
    if (candidates.length === 0) return null;
    const pick =
      candidates[
        hashSeed(`${world.id}:${world.turn}:${category}:${candidates.length}`) % candidates.length
      ] ?? candidates[0];
    if (!pick) return null;
    const event = this.repo.transaction(() =>
      persistEvent(this.repo, draftFromFallback(pick, world.id, world.turn)),
    );
    const partyLevel = Math.max(...party.characters.map((character) => character.level), 1);
    this.scheduleNarrative(event, partyLevel, correlationId);
    return event;
  }

  /**
   * Fallback text is always playable. When a model is configured we enrich the
   * hook and introduction in the background, never blocking the command.
   */
  private scheduleNarrative(
    event: EventRow,
    partyLevel: number,
    correlationId: string | null,
  ): void {
    if (!this.generation.enabled || !correlationId) return;
    void this.enrichNarrative(event, partyLevel, correlationId).catch((error) => {
      narrativeLogger(correlationId, "Narrative enrichment failed", error);
    });
  }

  private async enrichNarrative(
    event: EventRow,
    partyLevel: number,
    correlationId: string,
  ): Promise<void> {
    const location = locationName(event.location_id ?? undefined) ?? "the frontier";
    const teaser = await generateNarrative(
      this.generation,
      {
        kind: "teaser",
        title: event.title,
        location,
        partyLevel,
        extra: event.hook,
      },
      correlationId,
    );
    if (!teaser) return;
    const introduction = await generateNarrative(
      this.generation,
      {
        kind: "introduction",
        title: event.title,
        location,
        partyLevel,
        extra: event.introduction,
      },
      correlationId,
    );
    this.repo.transaction(() =>
      this.repo.setEventNarrative(event.id, teaser, introduction ?? event.introduction),
    );
  }
}
