# Architecture

## 1. Shape

RPGO is a modular monolith. One Bun process serves the Hono API, one Vite build serves the React client, and one SQLite file stores state. The local inference server is a separate process and can be restarted independently.

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ React 19 · Vite · @ui-sdk/react · react-icons/gi            │
└───────────────────────┬─────────────────────────────────────┘
                        │ typed JSON, operation IDs, correlation IDs
┌───────────────────────▼─────────────────────────────────────┐
│ Hono API (apps/server/src/http)                             │
│ route parsing · Zod request validation · response envelope  │
└───────────────────────┬─────────────────────────────────────┘
                        │ use cases
┌───────────────────────▼─────────────────────────────────────┐
│ Application (apps/server/src/application)                   │
│ game service · board service · rewards · event persistence  │
│ generation validation · read-model mappers                  │
└───────────┬───────────────────────────┬─────────────────────┘
            │                           │
┌───────────▼───────────┐   ┌───────────▼─────────────────────┐
│ Domain rules          │   │ Infrastructure                  │
│ packages/game-rules   │   │ SQLite repository · migrations  │
│ stats · RNG · combat  │   │ LLM provider · prompts · logs   │
│ rewards · world       │   └───────────┬─────────────────────┘
└───────────────────────┘               │ HTTP
                            ┌───────────▼─────────────────────┐
                            │ Local OpenAI-compatible server  │
                            └─────────────────────────────────┘
```

## 2. Dependency rules

1. `packages/game-rules` is pure TypeScript. It imports no framework, database or network module.
2. `packages/contracts` defines shared Zod schemas and DTOs. It does not import application, database or UI code.
3. `packages/game-content` imports static JSON and pure rules. It does not read the database.
4. `apps/server/src/domain` contains errors only and must not import infrastructure.
5. `apps/server/src/application` coordinates domain rules, repositories and generation. It must not import Hono.
6. `apps/server/src/infrastructure` implements persistence and the model client. Only this layer knows SQL and HTTP wire formats.
7. `apps/server/src/http` validates transport input and delegates to application services.
8. `apps/web` depends on `packages/contracts` for types but never imports server or rules code that would make the browser authoritative.

## 3. Request lifecycle

### Query

```text
GET /api/game
→ Hono route
→ GameService.state()
→ ensureGame (seed if empty)
→ load player, world, party, inventory, events, journal
→ map rows to DTOs
→ { data, correlationId }
```

Queries never advance world time and never call the model.

### Mutating command

```text
POST /api/events/:id/accept
→ parse OperationRequestSchema
→ resolve operationId (body or x-operation-id header)
→ GameService.acceptEvent
   → replay receipt if this operation was already applied
   → validate state
   → transaction:
       accept event
       insert world_action (unique per world/action/operation)
       increment world turn once
       append journal
       save receipt
   → after transaction: refresh board (scheduled; fallback when generation is off or fails)
   → return fresh read model + event detail
```

No model call occurs inside a database transaction. A repeated operation returns the stored receipt with a fresh read model and never double-applies rewards or world turns.

Board refresh and post-command narrative are never awaited by the HTTP response. When generation is
disabled the board is filled synchronously from fallback definitions. When generation is enabled the
model-backed refresh and teaser, introduction, discovery and result narratives are scheduled as
background tasks, and each event falls back deterministically if generation fails. A slow or
unavailable model therefore cannot delay or block a game action.

## 4. Key modules

| Module                                     | Responsibility                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `application/game-service.ts`              | Use cases, transactions, receipts, world advancement, health/diagnostics.           |
| `application/board.ts`                     | Board limits, category mix, expiry, LLM director/generator flow, fallback.          |
| `application/narrative.ts`                 | Non-blocking narrative helper shared by board and event use cases.                  |
| `application/events.ts`                    | Event draft persistence, reward preview, deterministic event seed.                  |
| `application/encounter.ts`                 | Convert party rows and encounter definitions to combatants.                         |
| `application/rewards.ts`                   | Transactional reward grants with stable grant keys.                                 |
| `application/mappers.ts`                   | Row → DTO mapping; no SQL in this file.                                             |
| `application/generation-validation.ts`     | Semantic checks after Zod validation: IDs, objectives, caps, duplicates.            |
| `infrastructure/llm/generation-service.ts` | Attempt loop, JSON extraction, Zod parsing, attempt metadata.                       |
| `infrastructure/llm/openai-provider.ts`    | OpenAI-compatible HTTP, timeout, retry, response-size limit, health.                |
| `infrastructure/database/repository.ts`    | All SQL, transactions and row mapping.                                              |
| `packages/game-content`                    | Versioned static content, Zod schemas, cross-reference validation, fallback events. |
| `packages/game-rules`                      | Pure world, character, reward and deterministic combat rules.                       |

## 5. Game loop sequence

```text
Player opens app
  → GET /api/game, /api/party, /api/journal, /api/health
  → board read model

Player opens an event
  → GET /api/events/:id
  → detail, objectives, encounters, reward preview, capability flags

Player accepts
  → world_action(event_accepted), turn +1
  → board refresh: expire opportunities, create missing postings
  → Event Director (optional) → concept validation
  → Event Generator (optional) → generated-event validation
  → fallback content if generation fails
  → persisted event on the same execution path as authored content

Player fights
  → start marks the current encounter active
  → resolve loads immutable encounter definition
  → eventSeed(event, encounter, worldSeed) → seeded simulation
  → battle_sessions + battle_actions persisted once
  → party vitals updated
  → victory: encounter completed; last encounter → event_completed, turn +1, rewards
  → defeat/draw: event_failed, turn +1, no completion rewards
  → battle report returned and rendered

Player completes a scout/research event
  → objective progressed, location discovered for scouts
  → event_completed or research_completed, turn +1
  → rewards granted once
```

## 6. Determinism

- Combat is a pure function of party state, enemy definitions, abilities, seed and turn limit.
- The seed is derived from `hashSeed(eventId, encounterIndex, GAME_SEED)`.
- Turn order is speed descending, then combatant ID as a stable tiebreak.
- Behavior presets use deterministic rules and reason codes. No model call occurs in combat.
- A battle row is unique on `(event_id, encounter_index)`. Resolution reads an existing row instead of simulating again.
- Region status is derived from the most advanced known location; it only moves forward.
- Region threat is recomputed from completed and failed outcomes: `min(10, base + floor(completed / 3) + floor(failed / 2))`. It is a pure function, so repeated recomputation is idempotent.

## 7. Idempotency layers

| Layer       | Mechanism                                                          |
| ----------- | ------------------------------------------------------------------ |
| API         | Client supplies or server derives `operationId`.                   |
| Application | `command_receipts` replay returns prior result.                    |
| World       | `world_actions` unique on `(world_id, action_type, operation_id)`. |
| Rewards     | `resource_transactions.grant_key` unique; `INSERT OR IGNORE`.      |
| Combat      | `battle_sessions` unique on `(event_id, encounter_index)`.         |

## 8. LLM integration

The model is a content proposal service. It receives a compact context and a versioned prompt, returns JSON text, and is then:

1. Parsed as JSON.
2. Validated by a Zod schema from `packages/contracts`.
3. Validated semantically against live world state, content allowlists and difficulty caps.
4. Normalized (difficulty clamped, location chosen, expiry computed).
5. Persisted with model/prompt/schema metadata.

Failures never mutate game state. A board refresh uses deterministic fallback definitions when the model is unavailable or invalid.

## 9. Frontend architecture

- `App.tsx` owns the read model, view routing, operation IDs, pending state and command dispatch.
- Feature folders render screens and never calculate outcomes.
- `lib/api.ts` is the only HTTP boundary; it unwraps the `{ data, correlationId }` envelope and surfaces typed errors.
- Views are read-only until the player triggers a command. Pending commands disable duplicate submission.
- Battle logs use UI SDK `Collapsible`; dialogs use UI SDK `Dialog`; progress uses native accessible progress bars styled by the app.
- Generation status is displayed separately from gameplay results.

## 10. Content model

`data/regions.json` is versioned and validated at import. Regions and locations carry stable IDs,
versions, tags and reciprocal graph connections. Each region declares:

- `eventTypes` — the events the Event Director may propose there.
- `enemyFamilies` — the enemy families the Event Generator may use there.
- `accessCondition` — the starting region or the scout route that reveals an entry location.
- `connections` — reciprocal links used by the world read model.

`packages/game-content/src/schemas.ts` validates each file with Zod. `findContentErrors` adds
cross-file checks: duplicate IDs, reciprocal region/location links, access routes, fallback content,
enemy families, abilities and equipment. Invalid content throws before the server starts.

The world read model adds `tags`, dynamic `connections` and location adjacency to the persisted
region/location rows. Persisted state remains authoritative; static content only describes the
world.

## 11. Extension points

- Add migrations and repository methods for new persisted concepts.
- Add pure rules to `packages/game-rules` with unit tests.
- Add content templates to `data/`; extend the content schemas and validation tests in the same change.
- Add generation tasks by defining a contract schema, a versioned prompt and a generation-service call.
- Add screens as feature folders; keep authoritative computation on the server.
- Introduce multi-stage storylines as a separate table and application service rather than overloading event JSON.
