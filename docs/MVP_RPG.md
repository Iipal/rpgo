# MVP_RPG.md

> **Purpose:** Build the smallest playable, testable, LLM-driven text RPG that proves the complete game loop and establishes a disciplined, well-documented codebase.
>
> **Status:** Implementation specification
> **Scope:** MVP only. Full-production expansion is specified separately in `RPG_IMPLEMENTATION.md`.
> **Core rule:** The MVP must be small in content, not careless in architecture. It must prove that local LLM generation can produce safe, valid, playable RPG content without making the LLM authoritative over game state.

---

## 1. Product Goal

Build a browser-based, single-player, text-only fantasy RPG. The player leads a small party, discovers a compact world, chooses generated adventures, watches deterministic automatic battles, receives rewards, and sees the world respond to meaningful actions.

The MVP exists to answer these questions:

1. Can a small local model reliably generate varied event concepts and complete event definitions?
2. Can generated content be converted into valid, balanced, playable encounters?
3. Can the deterministic game engine execute those encounters and persist their outcomes?
4. Can the game remain playable when the LLM is slow, unavailable, or returns invalid output?
5. Can an agentic coding workflow maintain a documented, understandable codebase as it changes?

The MVP is successful when a player can complete the loop below repeatedly, and a developer can understand, test, and extend every important subsystem.

### 1.1 MVP gameplay loop

1. Open the game and load the player's world.
2. View the discovered region and current location.
3. View the Event Board.
4. Select one available event.
5. Review the event, party, difficulty, and expected objective.
6. Start the event.
7. Resolve one or more automatic, deterministic battles or non-combat objectives.
8. Receive a victory, partial-defeat, or failure result.
9. Apply valid rewards and persist the outcome.
10. Advance the world by the defined action rules.
11. Refresh the Event Board using the current world context.
12. Repeat.

### 1.2 Explicit non-goals

Do not implement these in the MVP:

- Multiplayer, accounts shared across players, PvP, guilds, chat, or social features.
- Real-time or offline world progression.
- Multiple controllable parties.
- Tactical grid combat, manual combat commands, movement simulation, or pathfinding.
- Large procedural maps, line-of-sight, physics, or spatial simulation.
- Complex crafting, trading economy, player housing, or market simulation.
- Faction diplomacy, deep NPC relationship simulation, or branching dialogue trees.
- Permadeath.
- Arbitrary LLM-defined formulas, executable code, SQL, or unrestricted item/stat generation.
- Images, generated portraits, voice, audio, or animation systems.
- Cloud LLM dependencies. The initial target is a local OpenAI-compatible inference server.
- Premature microservices, message brokers, distributed orchestration, or event sourcing.

---

## 2. Locked MVP Decisions

These are deliberate constraints, not suggestions to revisit during implementation without an ADR.

| Area                 | MVP decision                                                           |
| -------------------- | ---------------------------------------------------------------------- |
| Game type            | Single-player, browser-based, text-only fantasy RPG                    |
| World model          | Small region-based world                                               |
| World progression    | Action-based; only defined meaningful actions advance world turns      |
| Combat               | Automatic, deterministic, turn-based simulation                        |
| Party                | One party, up to four characters                                       |
| Party archetypes     | Warrior, Ranger, Mage, Cleric                                          |
| Defeat               | Partial defeat; completed encounter progress remains recorded          |
| Event Board          | Mixed persistent storyline events and temporary opportunities          |
| Event types          | Dungeon, Scout, Research, Attack                                       |
| LLM                  | One local model, accessed through one provider abstraction             |
| LLM responsibilities | Event concepts, event details, narrative text, limited world proposals |
| Game authority       | Deterministic domain/application code                                  |
| Frontend             | React 19+ with UI SDK                                                  |
| Icons                | `react-icons`, primarily the `gi` Game Icons set                       |
| Backend              | TypeScript + Bun + Hono                                                |
| Persistence          | SQLite                                                                 |
| Validation           | Zod at API and model-output boundaries                                 |
| Tests                | Bun test; deterministic seeded combat                                  |
| Architecture         | Modular monolith                                                       |

### 2.1 Model selection

The initial model is configurable, not hard-coded. Use a small local instruct model such as Qwen3.5 2B as the first candidate, provided the selected quantization and inference server can follow the required JSON schema reliably enough.

Do not make correctness depend on one model name or quantization. The LLM provider must accept a model identifier from configuration and record the actual model identifier on each generation.

### 2.2 LLM generation modes

The MVP uses a small number of logical generation tasks, not multiple agents or independently deployed services:

- **Event Director:** proposes event concepts for the board.
- **Event Generator:** expands one approved concept into a complete playable event.
- **Narrative Generator:** creates short descriptions, introductions, and outcome summaries.

A minimal **World Director** can be added only after the basic loop works. Initially, world changes should be mostly deterministic rules triggered by player actions. The MVP must not become a multi-agent simulation project.

---

## 3. MVP Architecture

### 3.1 Architecture principles

1. **The game engine is authoritative.** The LLM cannot directly write to the database or alter player state.
2. **LLM output is untrusted input.** Parse, validate, normalize, and constrain it.
3. **Content and state are different things.** Templates/definitions describe what something is; instances describe what the player owns or what happened.
4. **Generation is outside database transactions.** Never hold a transaction open while waiting for inference.
5. **State changes are atomic and idempotent.** A retry must not award rewards twice or advance the world twice.
6. **Completed battles are immutable results.** Reloading a page must never simulate a finished battle again.
7. **The game works without the LLM.** Existing content remains playable; deterministic fallback content is available.
8. **Domain logic does not depend on React, Hono, SQLite, or the LLM SDK.**
9. **Every meaningful system has tests and documentation.**
10. **Prefer explicit modules and contracts over generic frameworks.**

### 3.2 High-level dependency flow

```text
React Web App
    |
    v
Hono API / DTO validation
    |
    v
Application Use Cases
    |
    +---- Domain rules (world, events, party, combat, rewards)
    |
    +---- Repositories (SQLite)
    |
    +---- LLM orchestration
              |
              v
        Local OpenAI-compatible server

Application layer coordinates operations.
Domain layer owns rules.
Infrastructure implements persistence and external integrations.
LLM proposes content; application/domain code decides what is accepted.
```

### 3.3 Suggested monorepo

```text
rpg/
├── AGENTS.md
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── package.json
├── bun.lock
├── tsconfig.json
├── biome.json
├── .env.example
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_GLOSSARY.md
│   ├── GAME_DESIGN.md
│   ├── LLM_PIPELINE.md
│   ├── DATA_MODEL.md
│   ├── TESTING.md
│   ├── OPERATIONS.md
│   ├── decisions/
│   │   ├── ADR-0001-modular-monolith.md
│   │   ├── ADR-0002-llm-is-not-authoritative.md
│   │   ├── ADR-0003-action-based-world-time.md
│   │   ├── ADR-0004-deterministic-combat.md
│   │   ├── ADR-0005-ui-sdk-and-react.md
│   │   └── ADR-0006-sqlite-persistence.md
│   └── prompts/
│       ├── event-director.md
│       ├── event-generator.md
│       └── narrative-generator.md
├── apps/
│   ├── web/
│   │   ├── AGENTS.md
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       │   ├── world/
│   │       │   ├── party/
│   │       │   ├── events/
│   │       │   ├── combat/
│   │       │   ├── inventory/
│   │       │   └── journal/
│   │       ├── lib/
│   │       └── styles/
│   └── server/
│       ├── AGENTS.md
│       └── src/
│           ├── api/
│           ├── application/
│           ├── domain/
│           │   ├── world/
│           │   ├── events/
│           │   ├── party/
│           │   ├── characters/
│           │   ├── combat/
│           │   ├── inventory/
│           │   └── progression/
│           ├── infrastructure/
│           │   ├── database/
│           │   ├── llm/
│           │   ├── random/
│           │   └── logging/
│           └── shared/
├── packages/
│   ├── contracts/
│   ├── game-content/
│   └── game-rules/
├── data/
│   ├── regions/
│   ├── enemies/
│   ├── equipment/
│   └── abilities/
├── migrations/
└── tests/
    ├── integration/
    └── fixtures/
```

This is a starting structure. Do not create empty directories or abstractions without an actual first use. Keep the module boundaries even if the initial implementation is physically smaller.

### 3.4 Package responsibilities

- `apps/web`: React application, routes, screen composition, client-side state and presentation.
- `apps/server`: HTTP API, application orchestration, domain implementation, infrastructure wiring.
- `packages/contracts`: shared API request/response and domain-facing DTO schemas/types. Avoid leaking database models.
- `packages/game-rules`: pure formulas and deterministic rules that are useful to share or test independently.
- `packages/game-content`: static, versioned content definitions and content schemas.
- `data`: human-authored starter data; validate it in tests/startup.
- `docs`: architectural, design, operations, and prompt documentation.

Do not move domain code into shared packages merely to make the folder tree look sophisticated.

---

## 4. Frontend Specification

### 4.1 Required stack

- React 19+
- TypeScript
- Vite
- `@ui-sdk/react`
- `@ui-sdk/core`
- `react-icons`
- CSS Modules or a deliberately small styling system; Tailwind is optional, not mandatory
- A typed API client generated from or aligned with shared contracts

Install UI SDK according to its React documentation:

```bash
bun add @ui-sdk/react @ui-sdk/core
bun add react-icons
```

Use React 19 or newer. Import UI SDK components from their individual entry points; do not assume a root package export. Read the installed package documentation at `node_modules/@ui-sdk/react/docs/llms.txt` before using it. For custom primitives, consult the installed `docs/core.md` and `docs/rendering.md`.

UI SDK is beta. Pin dependency versions, isolate it behind application-owned UI components, and record meaningful upgrades in the changelog/ADR process.

### 4.2 Icons

Use `react-icons/gi` for fantasy/game-specific symbols:

```tsx
import { GiBroadsword, GiShield, GiSpellBook, GiTreasureMap, GiPotionBall } from "react-icons/gi";
```

The exact export names must be verified against the installed package. Do not invent icon exports. Prefer importing individual icons so bundling can tree-shake unused symbols.

Use icons as supplementary cues. Every important icon-only control must have an accessible name and tooltip/label. Check the upstream Game Icons license and attribution requirements before release.

### 4.3 Visual design

Target a readable fantasy journal / adventurer's guild interface:

- Warm parchment-like surfaces, dark ink text, muted forest/bronze accents.
- Strong contrast and clear typography; do not sacrifice readability for theme.
- Compact cards for events, party members, enemies, and rewards.
- Consistent icon treatment and status colors.
- Responsive layout, but desktop-first is acceptable for the first test build.
- No fake 3D game UI, image-heavy layouts, or decorative animations that obscure state.

### 4.4 MVP screens

1. **Game shell:** navigation, world turn, player resources, loading/error states.
2. **World:** current region, discovered locations, short descriptions, available actions.
3. **Event Board:** storyline and opportunity sections, event status, type, difficulty, location, expiration turn where relevant.
4. **Event detail:** objectives, encounter outline, reward preview, recommended party power, accept/start action.
5. **Party:** four member slots, archetype, level, HP, XP, equipment, formation.
6. **Character detail:** attributes, derived stats, equipment, abilities, combat behavior summary.
7. **Battle report:** encounter result, turn summary, action log, casualties/incapacitated characters.
8. **Inventory:** owned equipment and consumables; equip/unequip.
9. **Journal:** completed/failed events and short world history.
10. **Settings/dev diagnostics:** API status, LLM status, model identifier, last generation result, correlation ID. Do not expose secrets.

### 4.5 UI behavior rules

- Never optimistically show rewards before the server confirms them.
- Disable duplicate submission while an action is in progress.
- Display generation state distinctly from game action state.
- If LLM generation is unavailable, explain that fallback content is being used.
- Keep battle logs readable and collapsible.
- All state-changing actions go through server commands.
- The client may cache read models but must not calculate authoritative rewards or combat outcomes.

---

## 5. MVP Game Design

### 5.1 World

Use two predefined regions:

- **Greenreach:** starting region; village, forest, old road.
- **Ashen March:** initially locked or undiscovered; ruins and hostile frontier.

For the smallest vertical slice, the player starts in Greenreach with one accessible location and one discoverable adjacent location. Expand to the second region only after the first loop works.

A region contains locations. A location can host multiple events over time. Do not implement physical movement or pathfinding.

```ts
type DiscoveryStatus = "unknown" | "discovered" | "accessible";

interface Region {
  id: string;
  name: string;
  description: string;
  levelRange: { min: number; max: number };
  status: DiscoveryStatus;
  threatLevel: number;
  locationIds: string[];
}

interface Location {
  id: string;
  regionId: string;
  name: string;
  description: string;
  status: DiscoveryStatus;
}
```

### 5.2 World turns

World time advances only after explicitly defined meaningful actions. Viewing screens, opening inventory, equipping gear, or refreshing a page does not advance time.

MVP world-advancing actions:

- `event_accepted`
- `event_completed`
- `event_failed`
- `location_discovered`
- `research_completed`

An event with several battles should not accidentally advance the world multiple times because of internal encounter processing. Define one event-level progression policy and test it.

Each accepted world action:

1. Validates the player command.
2. Applies its domain result.
3. Records a unique action ID.
4. Advances the world turn exactly once if the action type requires it.
5. Evaluates simple world rules.
6. Refreshes the Event Board if required.
7. Returns the updated read model.

### 5.3 Party and characters

One party, maximum four active characters. Provide four starter characters or allow the player to select from four archetypes.

| Archetype | Role            | Primary strengths                        |
| --------- | --------------- | ---------------------------------------- |
| Warrior   | Frontline tank  | Vitality, defense, threat control        |
| Ranger    | Physical damage | Agility, critical chance, focused damage |
| Mage      | Magic damage    | Intelligence, area damage, mana          |
| Cleric    | Support         | Healing, defensive buffs, recovery       |

Character fields:

```ts
interface Character {
  id: string;
  name: string;
  archetype: "warrior" | "ranger" | "mage" | "cleric";
  level: number;
  experience: number;
  attributes: {
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
  };
  resources: { health: number; mana: number };
  equipment: {
    weaponId?: string;
    armorId?: string;
    accessoryId?: string;
  };
  abilityIds: string[];
  combatBehaviorId: string;
}
```

MVP character systems:

- Level and XP.
- Four core attributes.
- Derived HP, mana, attack, magic attack, defense, speed, crit chance.
- Weapon, armor, accessory slots.
- A small number of abilities.
- Simple preset combat behavior.
- Incapacitated state and recovery.

Do not implement a complex talent tree or respec system.

### 5.4 Formation

Use two rows: front and back. Melee attacks prefer front-row targets when valid. Ranged/magic targeting follows ability rules. The formation is a simple combat rule, not a spatial simulation.

### 5.5 Combat

Combat is automatic, turn-based, deterministic given the same initial state and RNG seed.

MVP combat supports:

- Turn order based on speed.
- Basic attacks.
- Physical and magical damage.
- Defense mitigation.
- Critical hits.
- Healing.
- A small set of status effects (at minimum poison or defense reduction only if needed by starter abilities).
- Enemy behavior presets.
- Party behavior presets.
- Victory, defeat, and turn-limit draw.
- Battle report and action log.

Combat loop:

```text
Initialize battle from immutable encounter definition
    -> assign seeded RNG
    -> build combatants
    -> determine turn order
    -> each living combatant chooses legal action
    -> resolve action and effects
    -> check victory / defeat / turn limit
    -> persist final result and action log
```

The combat simulator must be a pure or near-pure domain service. Persistence happens around it, not inside its turn-resolution functions.

### 5.6 Combat AI presets

Use deterministic priority rules; do not call an LLM during combat.

- **Warrior:** use defensive/taunt ability when a backline ally is threatened or own HP is low; otherwise attack.
- **Ranger:** prioritize low-health or vulnerable enemies; use a special attack when available.
- **Mage:** use area damage when multiple enemies are alive; otherwise single-target spell/basic attack.
- **Cleric:** heal the most injured ally under a threshold; otherwise apply a defensive buff if available; otherwise attack.
- **Enemies:** simple archetype-specific priorities (attack, heavy attack, support/heal if applicable).

All choices must be logged with reason codes suitable for debugging.

### 5.7 Defeat and recovery

Partial defeat rules:

- Completed encounters remain completed.
- The failed encounter is recorded as failed.
- Surviving characters retain remaining HP.
- Defeated characters become incapacitated.
- Consumables already used remain consumed.
- Unclaimed event completion rewards are not granted.
- No rewards are granted twice.
- The player can retreat or use a basic rest action.
- MVP rest may cost gold and restore the party; define its cost and recovery behavior in game rules.

### 5.8 Event system

Four event types:

| Type     | Primary purpose                      | Typical reward emphasis          |
| -------- | ------------------------------------ | -------------------------------- |
| Dungeon  | Multi-encounter challenge            | Gold and equipment               |
| Scout    | Explore and discover                 | XP, discovery, modest gold       |
| Research | Complete a research objective        | Research points / ability unlock |
| Attack   | Defend or assault a dangerous target | Gold and rare equipment          |

Two event categories:

- **Storyline:** persistent until completed, failed terminally, or invalidated by explicit rules.
- **Opportunity:** temporary; expires after a defined number of world turns.

Event status:

`available | active | completed | failed | expired`

MVP objective types:

- `defeat_enemies`
- `discover_location`
- `complete_research`

An event can contain one or more encounters. A dungeon can contain two encounters in the MVP; use a fixed small cap.

### 5.9 Event Board

Target a small board, not a content firehose:

- One or two storyline events.
- One or two temporary opportunities.
- Maximum four visible events.
- Fewer events are acceptable if valid content cannot be generated.
- Storyline events are not silently removed by opportunity refresh.
- Temporary opportunities expire by world turn, not wall-clock time.
- Existing active/accepted events are not regenerated.

### 5.10 Rewards and progression

MVP reward types:

- Gold.
- Character XP.
- Equipment.
- Research points (only if the research event is implemented).

The engine computes actual reward quantities from validated reward intents and difficulty rules. The LLM may suggest reward categories within an allowlist, but cannot choose arbitrary values.

For every reward grant:

- Validate ownership and target character.
- Enforce configured min/max bounds.
- Record a resource transaction.
- Apply within a database transaction.
- Enforce unique grant ID to prevent duplication.

---

## 6. LLM Generation System

### 6.1 The LLM's role

The model is a creative author operating inside a constrained game-design interface. It does not:

- Choose actual damage calculations.
- Decide whether an attack hits.
- Set player or enemy stats without templates and bounds.
- Award resources.
- Change world turns.
- Create database records directly.
- Execute code, SQL, shell commands, or arbitrary tool calls.
- Decide whether validation can be bypassed.

### 6.2 Generation pipeline

```text
Current persisted game state
        |
        v
Build compact, sanitized generation context
        |
        v
Select task + versioned prompt
        |
        v
Call local model
        |
        v
Capture raw response + metadata
        |
        v
Parse structured JSON
        |
        v
Zod schema validation
        |
        v
Semantic/domain validation
        |
        v
Normalize and clamp allowed fields
        |
        v
Persist accepted content + generation metadata
        |
        v
Expose playable event to player
```

Use a bounded retry policy. A failed generation must not create a half-valid event.

### 6.3 Event Director output

The Event Director proposes concepts, not full event definitions.

```ts
interface EventConcept {
  type: "dungeon" | "scout" | "research" | "attack";
  category: "storyline" | "opportunity";
  title: string;
  hook: string;
  regionId: string;
  locationId?: string;
  difficultyBand: "easy" | "normal" | "hard";
  objectiveKind: "defeat_enemies" | "discover_location" | "complete_research";
  expiresInWorldTurns?: number;
  storylineKey?: string;
}
```

The engine checks that:

- Region and location IDs exist and are eligible.
- The board is not already full.
- The proposal does not duplicate an active event.
- The event category/type combination is allowed.
- Expiration is present only for temporary opportunities.
- Difficulty is appropriate for party level/power.
- Storyline references are valid.

### 6.4 Event Generator output

The Event Generator turns one accepted concept into a complete definition.

```ts
interface GeneratedEvent {
  title: string;
  description: string;
  introduction: string;
  objectives: Array<{
    kind: "defeat_enemies" | "discover_location" | "complete_research";
    description: string;
    targetCount?: number;
  }>;
  encounters: Array<{
    title: string;
    description: string;
    enemies: Array<{
      templateId: string;
      count: number;
      behaviorId: string;
    }>;
  }>;
  rewardIntent: Array<{
    kind: "gold" | "experience" | "equipment" | "research";
    rarity?: "common" | "uncommon" | "rare";
    target?: "party" | "character";
  }>;
  completionText: string;
  failureText: string;
}
```

Important: the model selects from known enemy templates and reward categories. The game engine derives enemy stats, exact reward amounts, equipment stats, and experience from authoritative tables/formulas.

### 6.5 Narrative Generator

Generate short text for:

- Event board teaser.
- Event introduction.
- Encounter flavor text.
- Victory summary.
- Defeat summary.
- Discovery notification.

Narrative output must never be required to execute a game action. Use fallback strings when generation fails.

### 6.6 Model integration

Use a provider interface around an OpenAI-compatible local inference endpoint:

```ts
interface LlmProvider {
  generateStructured<T>(request: {
    task: string;
    systemPrompt: string;
    userPrompt: string;
    schema: unknown;
    temperature?: number;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<{
    text: string;
    model: string;
    usage?: { inputTokens?: number; outputTokens?: number };
    latencyMs: number;
  }>;
}
```

The provider returns raw text and metadata. Parsing/validation belongs in the generation application service, not hidden inside a provider-specific SDK.

Configuration:

```env
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_API_KEY=local-development
LLM_MODEL=qwen3.5-2b-instruct
LLM_TIMEOUT_MS=60000
LLM_MAX_RETRIES=1
```

Never commit real credentials. The API key may be a dummy value for local servers that require a non-empty field.

### 6.7 Prompt management

Prompts are versioned files under `docs/prompts/` or a dedicated prompt directory. Each prompt must define:

- Task and role.
- Input contract.
- Output contract.
- Allowed IDs and enum values.
- Explicit prohibitions.
- Content style rules.
- A valid example.
- Prompt version.
- Expected schema version.

Store prompt version and schema version with every generation.

### 6.8 Failure handling and fallback

Handle at least:

- Server unavailable.
- Request timeout.
- Empty response.
- Invalid JSON.
- Schema mismatch.
- Unknown template ID.
- Out-of-range difficulty/reward intent.
- Duplicate concept.
- Model refusal or unrelated output.

Policy:

1. Retry once only for transient failures or parse/schema failures where retry is useful.
2. Do not retry indefinitely.
3. Record a sanitized failure record and correlation ID.
4. Use deterministic fallback content for board replenishment.
5. Keep accepted and active events intact.
6. Do not block unrelated game actions on an LLM call.
7. Surface model health and fallback usage in diagnostics.

---

## 7. Data Model

Use SQLite with migrations. Keep the MVP schema small, but avoid putting unrelated state into one JSON blob.

Core tables:

- `players`
- `worlds`
- `regions`
- `locations`
- `parties`
- `characters`
- `party_members`
- `character_equipment`
- `inventory_items`
- `events`
- `event_objectives`
- `event_encounters`
- `battle_sessions`
- `battle_actions`
- `world_actions`
- `resource_transactions`
- `llm_generations`

Add `storylines` only when the MVP implements sequential storyline stages; otherwise represent the initial storyline relationship minimally and document the intended expansion.

### 7.1 Persistence rules

- Use foreign keys.
- Use explicit migration files.
- Use integer IDs or stable text IDs consistently; do not mix casually.
- Store timestamps in UTC.
- Store world turn as an integer.
- Store battle seed and final result.
- Store generation metadata separately from accepted event content.
- Store enough action history to debug why a state changed.
- Avoid storing secrets in logs or generation records.

### 7.2 Idempotency

Every mutating command must carry or derive an operation ID. A repeated command must return the previous result or a safe conflict, never apply the result twice.

Examples:

- `start_event`
- `complete_event`
- `grant_reward`
- `advance_world`
- `discover_location`

Use database unique constraints as a final defense, not only application-level checks.

---

## 8. API Contract

Use command/query separation at the application boundary. Avoid a generic endpoint that accepts arbitrary game-state patches.

Suggested endpoints:

| Method | Route                       | Purpose                         |
| ------ | --------------------------- | ------------------------------- |
| GET    | `/api/game/state`           | Initial game read model         |
| GET    | `/api/world`                | Regions and locations           |
| GET    | `/api/party`                | Party and character details     |
| GET    | `/api/events`               | Event Board                     |
| GET    | `/api/events/:id`           | Event detail                    |
| POST   | `/api/events/:id/accept`    | Accept event                    |
| POST   | `/api/events/:id/start`     | Start current encounter         |
| POST   | `/api/events/:id/resolve`   | Resolve deterministic encounter |
| POST   | `/api/world/discover`       | Discover a location             |
| POST   | `/api/party/rest`           | Recover party                   |
| POST   | `/api/characters/:id/equip` | Equip an owned item             |
| GET    | `/api/journal`              | World and event history         |
| GET    | `/api/system/health`        | API/database/LLM health         |

The exact route shape may change through ADRs, but each command must have a typed request/response schema and a single application use case.

The implemented route set is recorded in
[ADR-0007](decisions/ADR-0007-http-route-shape.md). It groups routes by aggregate (`/api/world`,
`/api/party`, `/api/events`) and is asserted by `tests/http.test.ts`.

Do not expose internal database rows as public API contracts.

---

## 9. Documentation and Agent Workflow

Documentation is a first-class MVP deliverable. The codebase must remain understandable to both humans and coding agents.

### 9.1 Required documentation

At repository root:

- `AGENTS.md`
- `README.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_DESIGN.md`
- `docs/DOMAIN_GLOSSARY.md`
- `docs/DATA_MODEL.md`
- `docs/LLM_PIPELINE.md`
- `docs/TESTING.md`
- `docs/OPERATIONS.md`
- `docs/decisions/ADR-*.md`

At each app:

- `apps/web/AGENTS.md`
- `apps/server/AGENTS.md`

Add package-level `AGENTS.md` only when the package has meaningful independent conventions or constraints.

### 9.2 Root AGENTS.md requirements

The root `AGENTS.md` must tell every coding agent:

1. Read the root instructions before editing.
2. Read the relevant app/package `AGENTS.md`.
3. Read the architecture/domain docs relevant to the task.
4. Search for existing code and patterns before adding abstractions.
5. Do not bypass domain/application boundaries.
6. Do not let LLM output mutate authoritative state.
7. Add/update tests with behavior changes.
8. Update all relevant docs in the same change.
9. Add an ADR for material architectural decisions.
10. Update `CHANGELOG.md` for user-visible or operationally significant changes.
11. Run the required formatting, type-check, tests, and build.
12. Report changed docs and verification results in the completion summary.

### 9.3 Documentation auto-update rule

This is a mandatory development rule, not a promise of automatic magical synchronization.

Whenever implementation changes, the contributor/agent must:

1. Identify affected domain concepts, API contracts, data structures, prompts, configuration, and workflows.
2. Update the relevant documentation in the same pull request/change.
3. Update root or app-level `AGENTS.md` if instructions, conventions, commands, or boundaries changed.
4. Update ADRs when a decision changes; do not silently rewrite history. Supersede an ADR with a new one.
5. Update prompt documentation and prompt/schema version metadata when prompt contracts change.
6. Update `CHANGELOG.md` where appropriate.
7. Add a documentation checklist to the PR/agent completion template.

Add a lightweight local documentation check for broken internal Markdown links and required documentation files. Do not attempt to infer all documentation changes automatically with fragile scripts. A human/agent checklist is the source of truth; the check provides guardrails.

### 9.4 ADR format

```md
# ADR-NNNN: Short decision title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Owners: Project

## Context

What problem or constraint requires a decision?

## Decision

What are we choosing?

## Consequences

Benefits, costs, constraints, and follow-up work.

## Alternatives considered

What else was considered and why was it rejected?
```

### 9.5 Definition of done for every milestone

- Code is implemented and reviewed against existing architecture.
- Relevant unit/integration tests pass.
- Type-check, lint/format, and build pass.
- Database migrations are tested from an empty database.
- API contracts and examples are updated.
- Relevant documentation and `AGENTS.md` instructions are updated.
- ADR added/updated if a material decision changed.
- No secrets, temporary debug artifacts, or unexplained TODOs remain.
- Milestone acceptance criteria are demonstrably met.

---

## 10. Milestone Plan

Build a vertical slice early. Do not spend several milestones creating infrastructure without a playable result.

### M0 — Repository, Toolchain, and Documentation Foundation

**Goal:** Create a clean, reproducible monorepo and establish the documentation/agent workflow before feature implementation.

Steps:

1. Initialize Bun workspace and TypeScript configuration.
2. Add React 19 + Vite web app and Bun + Hono server app.
3. Add shared contracts and content/rules package boundaries.
4. Add formatter/linter and scripts for dev, test, type-check, build, and migrations.
5. Add SQLite migration runner and a test database setup.
6. Add root and app-level `AGENTS.md`.
7. Create architecture, game design, glossary, data model, LLM pipeline, testing, and operations docs.
8. Create the initial ADR set from the locked decisions.
9. Add documentation-update checklist and Markdown-link validation.
10. Add `.env.example`; verify no secrets are committed.
11. Write setup instructions from a clean checkout and test them.

Deliverables:

- Running web shell and API health endpoint.
- Reproducible install and development commands.
- Required docs and ADRs.
- Documented dependency boundaries.

Acceptance:

- A new developer can clone, install, run, test, and build the project using README instructions.
- Root and app `AGENTS.md` are clear and non-contradictory.
- Empty database migrations run successfully.
- Local verification catches missing docs and broken internal links.

### M1 — Game Foundation and Starter Party

**Goal:** Create a persisted player world, starter party, character sheets, and inventory.

Steps:

1. Define domain IDs, errors, and shared primitives.
2. Create player/world/region/location/party/character/inventory migrations.
3. Seed the starter world and four archetype definitions.
4. Implement player/world creation use case.
5. Create a starter party of up to four characters.
6. Implement character attributes and derived-stat calculations.
7. Implement equipment definitions and owned item instances.
8. Implement equip/unequip validation and persistence.
9. Expose read endpoints for game state, party, character, and inventory.
10. Build the web shell, party screen, character detail, and inventory screen.
11. Add domain unit tests and API integration tests.
12. Update data model, API, setup, and game design docs.

Acceptance:

- A fresh player can load a persisted world and party.
- Character stats are derived from documented formulas.
- Equipment changes persist and cannot equip an item the player does not own.
- Reloading the browser preserves the same party and equipment.

### M2 — Deterministic Automatic Combat

**Goal:** Make the party fight a fixed, human-authored encounter without an LLM.

Steps:

1. Define combatant, battle, turn, action, status, and result types.
2. Implement seeded RNG abstraction.
3. Implement turn-order calculation.
4. Implement legal-action selection for party behavior presets.
5. Implement enemy behavior presets.
6. Implement basic attacks, damage, defense, critical hits, healing, and death/incapacitation.
7. Implement battle termination and turn limit.
8. Produce structured battle action logs and final reports.
9. Persist battle session and result exactly once.
10. Build a battle report screen using a fixed test encounter.
11. Add deterministic simulation tests and edge-case tests.
12. Document combat formulas, action priority, and seed behavior.

Acceptance:

- The same battle input and seed produce the same result and action log.
- No dead/incapacitated unit acts.
- Combat always terminates within the configured turn limit.
- Refreshing a completed battle never reruns it.
- The UI can render the battle report without knowing combat rules.

### M3 — First Playable Event Loop (Human-Authored Content)

**Goal:** Complete one playable event end-to-end before connecting the LLM.

Steps:

1. Define event type, category, status, objective, encounter, and reward contracts.
2. Create event and encounter migrations.
3. Add a small human-authored Scout event and a small two-encounter Dungeon event.
4. Implement event board query and event detail query.
5. Implement event acceptance and event start commands.
6. Connect event encounters to the combat simulator.
7. Implement event objective progress.
8. Implement victory, failure, and partial-defeat handling.
9. Persist encounter progress and event history.
10. Implement reward calculation and transactional grant records.
11. Implement basic rest/recovery.
12. Build Event Board, event detail, and battle report navigation.
13. Test duplicate commands, reloads, partial defeat, and reward idempotency.
14. Update game design, API, data model, and testing docs.

Acceptance:

- Player can accept and complete a fixed event.
- A multi-encounter event preserves completed encounters after a later defeat.
- Rewards are granted once, only after the correct completion condition.
- Partial defeat leaves survivors' health and incapacitated state consistent.
- The game loop works without an LLM.

### M4 — Action-Based World and Mixed Event Board

**Goal:** Make world state respond to player actions and manage persistent and temporary events.

Steps:

1. Implement world turn and `world_actions`.
2. Define exactly which commands advance a turn.
3. Make world advancement idempotent per operation ID.
4. Implement region/location discovery states.
5. Implement simple region connections as data, without pathfinding.
6. Implement storyline event persistence.
7. Implement temporary opportunity expiration by world turn.
8. Implement board limits and deterministic prioritization.
9. Implement basic world rules, such as a threat-level increase after repeated failures or completions.
10. Add journal/history read model.
11. Build world and journal screens.
12. Test that view-only actions never advance time and a multi-battle event does not over-advance.
13. Update world progression and event lifecycle docs.

Acceptance:

- Meaningful actions advance the world exactly as specified.
- Temporary opportunities expire on the correct turn.
- Storyline events persist until explicitly resolved or invalidated.
- Existing active events are never overwritten by board refresh.
- Region discovery is persisted and visible in the UI.

### M5 — Local LLM Provider and Generation Observability

**Goal:** Connect the local model safely before asking it to create gameplay content.

Steps:

1. Define the provider interface and configuration schema.
2. Implement an OpenAI-compatible HTTP client.
3. Add timeout, cancellation where supported, bounded retry, and response-size limits.
4. Add prompt registry and prompt versioning.
5. Add generation metadata persistence.
6. Add correlation IDs and structured logs.
7. Add a developer-only generation test endpoint/command.
8. Add a small prompt test harness with stored input fixtures.
9. Test unavailable server, timeout, empty response, malformed response, and oversized output.
10. Build a diagnostics panel for provider health and recent generation attempts.
11. Document model server setup, context/output limits, and troubleshooting.

Acceptance:

- Server can query the configured local model.
- Provider is replaceable without changing domain code.
- Generation requests and failures are observable.
- No LLM output can mutate game state through this milestone.
- Secrets are not exposed in diagnostics or logs.

### M6 — LLM Event Director and Event Generator

**Goal:** Generate valid event concepts and playable events using the local model.

Steps:

1. Define Zod schemas for Event Director and Event Generator output.
2. Build compact, bounded context from player, party, region, event history, and board state.
3. Implement Event Director orchestration.
4. Validate concept IDs, category/type combinations, duplication, and difficulty.
5. Implement Event Generator orchestration.
6. Restrict generated enemies to known templates and allowed behavior IDs.
7. Restrict reward intents to allowed reward categories and rarity bands.
8. Let the engine derive all actual stats and reward quantities.
9. Add bounded repair/retry for malformed output.
10. Add deterministic fallback event concepts and definitions.
11. Persist accepted generated content and its model/prompt/schema metadata.
12. Add golden fixtures and model-output contract tests.
13. Connect generated events to the existing M3 event execution pipeline.
14. Add UI labels distinguishing generated content from fallback content where useful.
15. Update prompts, schemas, LLM pipeline docs, and changelog.

Acceptance:

- A local model can generate a concept and a valid event that the player can actually complete.
- Unknown enemy IDs, impossible objectives, invalid regions, and reward abuse are rejected.
- LLM failure falls back to playable content.
- Active events remain stable across refreshes and model restarts.
- Generated events use the same deterministic combat engine as authored events.

### M7 — Narrative Generation and MVP Balance

**Goal:** Improve the feeling of a living RPG without adding more game systems.

Steps:

1. Implement narrative tasks for event teasers, introductions, discovery, victory, and defeat.
2. Keep narrative schemas separate from gameplay schemas.
3. Add length limits and sanitization for all player-visible text.
4. Add deterministic fallback text.
5. Tune party/enemy templates and event difficulty bands using repeatable simulations.
6. Define reward bands per event type and difficulty.
7. Add a small content set: enough enemy, ability, and equipment templates to create variety.
8. Add generation regression fixtures and a manual playtest checklist.
9. Run multiple full-loop playtests with LLM enabled and disabled.
10. Fix UX issues, state inconsistencies, and balance outliers.
11. Update the game design, prompts, operations, and changelog.

Acceptance:

- The player can play multiple loops without seeing obvious duplicate or nonsensical content.
- Generated narrative never changes gameplay outcomes.
- Difficulty and reward ranges are bounded and documented.
- The MVP remains playable with the LLM switched off.

### M8 — MVP Release Candidate and Handoff

**Goal:** Stabilize, document, and demonstrate the MVP as the foundation for full production.

Steps:

1. Run the complete clean-install procedure.
2. Run migrations from an empty database and verify backup/restore.
3. Run unit, integration, deterministic combat, and generation contract suites.
4. Test LLM-offline behavior and fallback content.
5. Test duplicate API requests and reward idempotency.
6. Test browser refresh/reconnect during and after an event.
7. Verify all app and root `AGENTS.md` instructions.
8. Audit docs against implementation; fix stale contracts and links.
9. Review all ADR statuses and add superseding ADRs if needed.
10. Add a concise architecture diagram and end-to-end sequence diagram.
11. Record known limitations and production expansion points.
12. Record dependency and model versions for the MVP baseline.

Acceptance:

- All core MVP loop acceptance criteria pass.
- No critical data-loss, reward-duplication, or state-corruption issues remain.
- A developer can explain the system from the docs without reverse-engineering the code.
- `RPG_IMPLEMENTATION.md` can begin from this exact baseline without repeating MVP work.

---

## 11. Testing Strategy

### 11.1 Unit tests

- Stat derivation.
- Damage and mitigation.
- Critical chance bounds.
- Healing and incapacitation.
- Combat action selection.
- Turn-order determinism.
- Event objective progress.
- Event lifecycle transitions.
- Reward calculation and bounds.
- World-turn policy.
- Discovery transitions.
- LLM schema and semantic validation.

### 11.2 Integration tests

- Create player and starter party.
- Equip and unequip item.
- Start and resolve battle.
- Accept and complete event.
- Partial defeat in a multi-encounter event.
- Grant reward exactly once.
- Advance world exactly once.
- Expire temporary opportunity.
- Generate event using a mocked provider.
- Reject invalid model output.
- Use fallback when provider fails.

### 11.3 Model evaluation

Do not rely on one successful manual generation. Maintain a fixture/evaluation set containing representative game states and expected schema constraints.

Track:

- Valid JSON rate.
- Schema-valid rate.
- Semantic acceptance rate.
- Duplicate concept rate.
- Average generation latency.
- Input/output token counts when available.
- Fallback rate.
- Human-rated narrative quality.

A model evaluation failure should be visible; it must not silently weaken validation.

### 11.4 End-to-end scenarios

1. New player → starter party → accept Scout → discover location → receive XP.
2. New player → accept Dungeon → win first battle → lose second → retain first encounter progress.
3. Complete event → receive gold/equipment once → reload → no duplicate rewards.
4. Advance several world turns → temporary opportunity expires.
5. Stop local LLM → continue playing existing event and fallback event.
6. Return malformed JSON → reject generation → fallback board remains usable.

---

## 12. Operational Requirements

- One command to start web and server in development.
- One command to run tests.
- One command to run migrations.
- `.env.example` documents all configuration.
- Health endpoint distinguishes API/database health from LLM health.
- Structured logs include request/correlation IDs.
- Never log API keys or sensitive environment values.
- Generation requests have timeout and maximum output size.
- SQLite database can be backed up and restored.
- Store model identifier, prompt version, schema version, and generation outcome.
- Local inference server is external to the application process and can be restarted independently.

---

## 13. MVP Definition of Success

The MVP is done when:

- A player can repeatedly explore, choose generated events, fight, receive rewards, and see world progression.
- At least the Event Director and Event Generator use the configured local model.
- Narrative generation adds flavor but is not required for game correctness.
- Generated content is validated against strict schemas and domain rules.
- Combat, rewards, progression, and persistence are deterministic and authoritative.
- The game remains usable when the model is unavailable.
- The React frontend uses UI SDK for interaction primitives and a consistent RPG icon system.
- Tests cover the critical state transitions and failure paths.
- Documentation, ADRs, root/app `AGENTS.md`, and the documentation-update workflow are established and maintained.

**The MVP is not a mockup. It is a small complete game loop and the architectural foundation for the full RPG.**
