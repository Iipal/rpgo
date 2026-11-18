import {
  type EventConcept,
  EventConceptSchema,
  type GeneratedEvent,
  GeneratedEventSchema,
} from "@rpgo/contracts";
import { enemies, fallbackEvents } from "@rpgo/game-content";
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

const MAX_BOARD = 4;

export class BoardService {
  constructor(
    private readonly repo: Repository,
    private readonly generation: GenerationService,
  ) {}

  async refresh(world: WorldRow, party: PartyBundle, correlationId: string): Promise<number> {
    this.repo.expireOpportunities(world.id, world.turn);
    let added = 0;
    let failures = 0;

    while (failures < 3) {
      const board = this.repo.getVisibleBoard(world.id);
      if (board.length >= MAX_BOARD) break;
      const storylineCount = board.filter((event) => event.category === "storyline").length;
      const opportunityCount = board.filter((event) => event.category === "opportunity").length;
      const category =
        storylineCount < 1
          ? "storyline"
          : opportunityCount < 2
            ? "opportunity"
            : storylineCount < 2
              ? "storyline"
              : null;
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
    return this.createFallback(world, category);
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
      enemyTemplates: enemies.map((enemy) => ({
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

    return this.repo.transaction(() =>
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
  }

  private createFallback(world: WorldRow, category: "storyline" | "opportunity"): EventRow | null {
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
    return this.repo.transaction(() =>
      persistEvent(this.repo, draftFromFallback(pick, world.id, world.turn)),
    );
  }
}
