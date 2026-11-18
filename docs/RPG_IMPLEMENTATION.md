# RPG_IMPLEMENTATION.md

> **Purpose:** Full-production implementation roadmap for the text-based, LLM-driven RPG.
>
> **Prerequisite:** `MVP_RPG.md` has been completed, tested, documented, and tagged as the stable baseline. This plan starts from that completed MVP and extends it. It must not recreate MVP milestones or replace working systems without an explicit migration plan and ADR.
>
> **Core principle:** Expand the deterministic RPG engine and content model while keeping the LLM constrained to creative generation and bounded proposals.

---

## 1. Starting Point and Scope

### 1.1 Assumed completed baseline

The following are already implemented by the MVP and are prerequisites, not work items to repeat:

- Bun + TypeScript monorepo.
- React 19 + Vite frontend using `@ui-sdk/react` and `@ui-sdk/core`.
- RPG-themed icons via `react-icons/gi` or the selected documented equivalent.
- Hono API and SQLite persistence/migrations.
- Modular monolith with domain/application/infrastructure boundaries.
- Root and app-level `AGENTS.md`.
- ADR and documentation-update workflow.
- Player/world/region/location persistence.
- One party with up to four characters and four starter archetypes.
- Equipment/inventory foundation.
- Deterministic automatic turn-based combat.
- Seeded RNG and persisted battle reports.
- Event lifecycle, objectives, encounters, partial defeat, recovery.
- Action-based world turns.
- Mixed Event Board with storyline and temporary opportunities.
- Local OpenAI-compatible LLM provider abstraction.
- Event Director, Event Generator, and Narrative Generator.
- Zod validation, bounded retries, generation metadata, and deterministic fallback.
- Basic journal, diagnostics, and operational documentation.
- MVP test suite and clean-install workflow.

Before beginning, run the MVP test suite, inspect current ADRs, and record the baseline commit, database schema version, prompt versions, model configuration, and known limitations.

### 1.2 Full-production goal

Evolve the MVP into a replayable, content-rich single-player RPG with:

- A larger interconnected world of regions and locations.
- Meaningful world threats, discoveries, and consequences.
- Multi-stage storylines and event chains.
- Deeper character progression, abilities, equipment, and party strategies.
- More enemy families, encounter patterns, bosses, and event mechanics.
- Stronger LLM-directed world development and narrative continuity.
- More sophisticated event scheduling and generation quality controls.
- A polished, accessible, responsive React experience.
- Save management, recovery, diagnostics, balancing tools, and robust operations.
- A documented, maintainable content pipeline.

### 1.3 Still out of scope unless separately approved

- Multiplayer or shared persistent worlds.
- PvP, guilds, chat, social graph.
- Real-time/offline progression.
- Tactical grid movement or action combat.
- Physics, pathfinding simulation, or visual 3D world.
- Player-to-player trading or auction house.
- Unrestricted LLM-generated code or game rules.
- Cloud-only mandatory AI dependency.
- Microservices as a default architecture.

---

## 2. Full-Production Design Principles

1. **Preserve the MVP authority boundary.** LLMs propose; the game engine validates and applies.
2. **Preserve save compatibility.** Every schema change has a migration and rollback/backup strategy.
3. **Expand by vertical slices.** Each milestone should deliver a playable improvement.
4. **Separate authored content from generated instances.** Definitions, templates, generated content, and player-owned instances have distinct lifecycles.
5. **Keep world progression explicit.** Every action that advances the world is defined and tested.
6. **Use deterministic simulation where outcomes matter.** Combat, rewards, progression, and world rules are reproducible.
7. **Make generation observable and evaluable.** Quality is measured, not assumed.
8. **Keep prompts and schemas versioned.** Generated content must remain interpretable after model upgrades.
9. **Keep UI SDK behind application-owned primitives.** The UI library is an implementation detail, not the product's component API.
10. **Documentation changes with code.** Root/app `AGENTS.md`, ADRs, API docs, domain docs, and prompt docs remain current.
11. **Do not introduce complexity without a gameplay or operational reason.**
12. **The game must still work when the LLM is unavailable.**

---

## 3. Target Full-Production Architecture

### 3.1 Logical layers

```text
React Web Client
  ├── App shell and navigation
  ├── Feature screens and application-owned UI primitives
  ├── Query/cache layer
  └── Typed API client
          |
          v
Hono API
  ├── Authentication/session boundary (if needed for local profiles)
  ├── Request validation
  ├── Query handlers
  └── Command handlers
          |
          v
Application layer
  ├── World action orchestration
  ├── Event lifecycle orchestration
  ├── Storyline orchestration
  ├── Battle orchestration
  ├── Progression/reward orchestration
  ├── Recovery and inventory orchestration
  ├── Generation orchestration
  └── Save/backup orchestration
          |
          +------------------+
          |                  |
          v                  v
Domain model             Infrastructure
  ├── World                ├── SQLite repositories
  ├── Storylines            ├── LLM provider adapters
  ├── Events                ├── Prompt registry
  ├── Party/characters      ├── Generation evaluator
  ├── Combat                ├── Seeded RNG
  ├── Progression           ├── Logging/metrics
  ├── Inventory             ├── Backup/export
  └── Rewards               └── Content loading
```

Keep the modular monolith. Split into processes only when a measured need justifies it, for example a separate inference worker to prevent slow generation from consuming API capacity.

### 3.2 Application modules

Recommended responsibilities:

- `WorldActionHandler`: validates and records meaningful world actions.
- `WorldSimulationService`: applies deterministic world rules after an action.
- `StorylineOrchestrator`: evaluates storyline stage prerequisites and transitions.
- `EventBoardService`: composes persistent and temporary board entries.
- `EventGenerationOrchestrator`: selects generation tasks and invokes the LLM pipeline.
- `EventLifecycleService`: accepts, starts, progresses, completes, fails, expires events.
- `BattleOrchestrator`: creates and persists battle sessions/results.
- `ProgressionService`: XP, levels, attribute growth, ability unlocks.
- `RewardService`: calculates, validates, and applies reward grants.
- `InventoryService`: ownership, equip rules, item modifications.
- `RecoveryService`: rest, healing, incapacitation recovery.
- `SaveService`: backup/export/import and integrity validation.

Avoid one giant `GameService`. Keep each use case explicit and transaction boundaries visible.

### 3.3 Domain boundaries

- `world`: world turn, regions, locations, discovery, threats, world facts.
- `storylines`: storyline definitions, stages, prerequisites, transitions, outcomes.
- `events`: event definitions, generated event instances, objectives, encounters, lifecycle.
- `party`: party membership, formation, active roster.
- `characters`: attributes, resources, levels, archetypes, abilities.
- `combat`: combat simulation, action selection, effects, results.
- `inventory`: item definitions, instances, equipment slots, consumables.
- `progression`: XP curves, level-up, research, unlocks.
- `rewards`: reward intents, reward calculation, grant ledger.

Domain modules should communicate through explicit contracts or application services. Avoid direct repository access from arbitrary domain modules.

---

## 4. Expanded World Design

### 4.1 Hierarchy

```text
World
├── Region
│   ├── Location
│   │   ├── Event opportunities
│   │   ├── Discoveries
│   │   ├── Threat presence
│   │   └── Storyline references
│   ├── Region connections
│   ├── Active threats
│   └── Region facts/history
└── Global storylines and world facts
```

Definitions:

- **World:** complete persistent game state.
- **Region:** large geographic and thematic area.
- **Location:** named place within a region.
- **Activity:** a player-facing action available at a location.
- **Threat:** a persistent hostile pressure or problem that can evolve.
- **Discovery:** a known fact, place, resource, clue, or capability.
- **World fact:** a compact, durable statement used by game rules and LLM context.

Do not simulate coordinates or physical movement unless a later gameplay feature requires it. The world map can remain a graph of connected locations.

### 4.2 Region states and progression

Use explicit states such as:

- `unknown`
- `discovered`
- `accessible`
- `contested`
- `secured`

State transitions must have domain rules. For example, a region can become accessible after a scout event reveals a pass, and contested after a threat reaches a configured pressure threshold.

### 4.3 Region content

Each region definition should include:

- Stable ID and display name.
- Theme and concise lore.
- Recommended level range.
- Region connections.
- Location definitions.
- Enemy family allowlist.
- Event type allowlist.
- Threat rules.
- Discovery conditions.
- Content tags for LLM context.
- Version and source metadata.

### 4.4 World facts and history

Introduce compact world facts rather than sending a giant chronological log to the LLM.

Example:

```ts
interface WorldFact {
  id: string;
  key: string;
  value: string;
  regionId?: string;
  source: "authored" | "player_action" | "world_rule" | "llm_proposal";
  createdAtWorldTurn: number;
  expiresAtWorldTurn?: number;
  confidence?: number;
}
```

Facts that affect mechanics must be created or confirmed by deterministic game rules. LLM-authored facts may be narrative-only unless validated and promoted by a domain rule.

### 4.5 Region connections

Use a graph:

```ts
interface RegionConnection {
  fromRegionId: string;
  toRegionId: string;
  status: "unknown" | "known" | "open" | "blocked";
  unlockConditionId?: string;
}
```

For locations, use the same simple adjacency model. No pathfinding or movement costs are required. Travel is an explicit player action if the game design needs it.

---

## 5. World Simulation and Threat System

### 5.1 Action-driven world simulation

Continue using world turns, not real-time simulation.

World action pipeline:

```text
Player command
  -> validate command and expected version
  -> apply primary domain result
  -> append world action record
  -> increment world turn if action policy says so
  -> evaluate deterministic world rules
  -> evaluate storyline prerequisites
  -> update threats/discoveries/region states
  -> refresh board if required
  -> persist transaction
  -> return updated read model
```

Use an explicit `WorldActionPolicy` table to determine which commands advance time. Do not let each endpoint increment the turn independently.

### 5.2 Threat model

A threat represents a persistent problem that evolves through stages.

```ts
interface WorldThreat {
  id: string;
  regionId: string;
  key: string;
  name: string;
  description: string;
  stage: number;
  pressure: number;
  status: "dormant" | "active" | "escalating" | "resolved";
  lastChangedAtWorldTurn: number;
  sourceEventId?: string;
}
```

Example progression:

```text
Wolf sightings
  -> livestock attacks
  -> alpha wolf discovered
  -> village threatened
  -> alpha defeated / threat resolved
```

Threat stage transitions must be deterministic, bounded, and driven by explicit conditions. The LLM may propose the narrative framing or candidate consequence; the engine decides whether the condition is satisfied.

### 5.3 World rule definitions

Use data-driven rules where useful, but avoid building a generic rule engine prematurely.

A rule should define:

- Stable ID and version.
- Trigger action or world condition.
- Preconditions.
- Deterministic effects.
- Cooldown/once-only policy.
- A test fixture.
- Optional narrative task to describe the result.

### 5.4 Consequences

World consequences may include:

- Location becomes threatened or secured.
- New event becomes available.
- Temporary opportunity expires.
- Region access changes.
- Enemy family presence increases.
- Storyline stage unlocks.
- NPC/location service becomes unavailable or available.

Each consequence must be persisted and visible in the journal.

---

## 6. Storyline System

### 6.1 Goals

Support multi-stage narratives that remain coherent across many world turns and event completions.

A storyline consists of:

- Storyline definition.
- Ordered or conditionally branching stages.
- Prerequisites.
- Associated events.
- Stage completion conditions.
- Outcome effects.
- Optional narrative context and character/NPC references.

### 6.2 Example model

```ts
interface StorylineDefinition {
  id: string;
  title: string;
  summary: string;
  stages: StorylineStageDefinition[];
}

interface StorylineStageDefinition {
  id: string;
  order: number;
  prerequisites: StorylineCondition[];
  eventTemplateKeys: string[];
  completionConditions: StorylineCondition[];
  outcomeEffects: WorldEffect[];
}
```

Persist player-specific storyline progress separately from static definitions.

### 6.3 Stage transitions

A stage transition is a deterministic application use case:

1. Read current storyline state.
2. Evaluate prerequisite/completion conditions.
3. Verify transition is legal and not already applied.
4. Apply outcome effects transactionally.
5. Record transition history.
6. Queue narrative generation if needed.
7. Refresh the Event Board.

### 6.4 Branching

Start with sequential stages and a small number of explicit branches. Do not support arbitrary graph editing or unconstrained LLM-authored branches initially.

Branch conditions should be explicit, testable predicates such as:

- Threat resolved.
- Location discovered.
- Event completed.
- Specific item acquired.
- Research unlocked.
- Choice recorded.

If player choices are introduced, persist them as immutable decision records.

---

## 7. Full Event System

### 7.1 Event taxonomy

Keep the four base event types and expand their mechanics:

- **Dungeon:** sequential encounters, hazards, boss, optional side objectives.
- **Scout:** discovery, investigation, exploration, survival.
- **Research:** clues, experiments, resources, unlocks.
- **Attack:** defend, assault, ambush, counterattack, eliminate a threat.

Add subtypes through content tags rather than multiplying top-level event types without need.

### 7.2 Event lifecycle

Possible states:

`draft | generated | available | accepted | active | completed | failed | expired | invalidated | archived`

Use legal state-transition functions. Do not allow arbitrary status updates.

### 7.3 Objectives

Expand objective types:

- Defeat enemy group.
- Defeat named target.
- Discover location.
- Investigate clue.
- Collect resource.
- Protect target.
- Survive encounter.
- Complete research.
- Activate mechanism.
- Reach event outcome/choice.

Every objective must have deterministic completion semantics. The LLM can write the display text but cannot invent an unsupported objective kind.

### 7.4 Encounter structure

Support:

- Multiple enemy groups.
- Boss encounter.
- Optional encounters.
- Encounter modifiers.
- Pre-battle narrative.
- Objective-linked encounter outcomes.
- Partial progress persistence.

Keep encounter resolution deterministic and bounded.

### 7.5 Event generation quality

Before accepting a generated event, validate:

- Event type and category.
- Region/location compatibility.
- Objective support.
- Enemy template availability.
- Encounter size limits.
- Difficulty budget.
- Reward intent bounds.
- Storyline linkage.
- Duplicate similarity against recent events.
- Narrative length and style.
- No contradictory requirements.
- No impossible or circular objectives.

### 7.6 Event history and replayability

Persist enough structured data to answer:

- Why was this event generated?
- Which world context was used?
- Which prompt/model/schema version produced it?
- Why did validation accept/reject it?
- What happened during the event?
- Which world effects were applied?

Never regenerate an accepted event when loading it.

---

## 8. Advanced LLM Architecture

### 8.1 Logical generation roles

Use one provider abstraction and several task-specific orchestrators. They can use the same model or different configured models.

1. **World Director:** proposes possible world developments, threat narratives, and candidate consequences.
2. **Event Director:** selects event concepts suitable for the current world and board.
3. **Event Generator:** produces playable event structures.
4. **Narrative Generator:** produces player-facing prose.
5. **Lore/Continuity Assistant:** summarizes or retrieves relevant established lore and facts.
6. **Content Evaluator:** scores generated content against quality rules; it does not approve domain-invalid content.

These are logical roles, not autonomous agents with unrestricted tools.

### 8.2 Generation task contract

Every task should declare:

- Task ID and version.
- Input schema.
- Output schema.
- Context builder.
- Prompt version.
- Model policy.
- Token/time budget.
- Validation pipeline.
- Retry policy.
- Fallback behavior.
- Persistence policy.
- Evaluation metrics.

### 8.3 Context construction

Do not send the entire database or event log to the model.

Build task-specific context from:

- Current world turn.
- Relevant region/location facts.
- Party level and composition.
- Active threats.
- Current storyline stages.
- Current board events.
- Recent event history.
- Content allowlists.
- Relevant lore summaries.

Context builders must be deterministic and tested. Redact internal IDs or operational metadata from narrative prompts where not needed.

### 8.4 Structured output

Prefer JSON schema/grammar constrained decoding where the local inference server supports it. Still validate output in application code. Constrained decoding is not a replacement for semantic validation.

Use:

1. Parse.
2. Schema validation.
3. Semantic validation.
4. Domain validation.
5. Normalization.
6. Quality evaluation.
7. Persistence.

### 8.5 Model routing

Introduce configuration-based routing only when multiple models are available and evaluated.

Possible routing:

- Small/fast model: short narrative and event teaser.
- Stronger model: event concept and event structure.
- Embedding model: optional retrieval of lore/history.

The application must remain functional with one model. Avoid adding model routing before metrics demonstrate a benefit.

### 8.6 Generation queue

If inference latency begins to affect API responsiveness, introduce a durable local generation job table and worker loop.

A job should have:

- ID and idempotency key.
- Task type/version.
- Input/context snapshot or stable reference.
- Status: queued/running/succeeded/failed/cancelled.
- Attempts and next retry.
- Model/prompt/schema version.
- Started/completed timestamps.
- Error classification.
- Result reference.

Do not add Redis or a message broker by default. SQLite-backed jobs are sufficient for a single-user/local deployment until measured limits prove otherwise.

### 8.7 Prompt and model upgrades

- Prompts are version-controlled.
- Schema changes are versioned.
- Model changes are recorded in generation metadata.
- Keep regression fixtures from prior models.
- Re-evaluate before changing defaults.
- Do not silently regenerate old content after a model update.
- Existing saves must remain playable even if a prompt or model is removed.

### 8.8 Quality evaluation

Track:

- Valid JSON rate.
- Schema-valid rate.
- Semantic acceptance rate.
- Event playability rate.
- Duplicate event rate.
- Objective completion rate.
- Difficulty deviation.
- Reward deviation.
- Narrative consistency rating.
- Average latency and token usage.
- Fallback and retry rate.

Use a blend of automated checks and human playtest review. The evaluator can flag quality but cannot override hard domain validation.

---

## 9. Expanded Party and Character Progression

### 9.1 Party management

Retain one party and four active slots initially. Full production may add:

- Reserve roster.
- Character recruitment.
- Party formation presets.
- Archetype synergies.
- Character-specific traits.
- Party-wide passive bonuses.

Do not add multiple simultaneously active parties without a separate design milestone.

### 9.2 Character progression

Expand from basic XP/levels to:

- Level-up attribute choices or deterministic growth profiles.
- Ability unlocks.
- Ability upgrades.
- Passive traits.
- Equipment requirements.
- Research-based unlocks.
- Character specialization paths.

All progression must be deterministic and testable. The LLM may propose narrative framing for an unlock but cannot grant it.

### 9.3 Ability system

An ability definition should include:

```ts
interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  kind: "damage" | "heal" | "buff" | "debuff" | "control";
  targetRule: string;
  resourceCost: number;
  cooldownTurns: number;
  effects: AbilityEffectDefinition[];
  tags: string[];
}
```

The `targetRule` should be a validated enum or registered rule ID, not executable model-generated code.

Ability effects should be data-driven and drawn from a small, typed effect vocabulary:

- Damage.
- Healing.
- Shield/temporary defense.
- Attribute modifier.
- Damage-over-time.
- Healing-over-time.
- Threat/taunt.
- Cleanse.
- Control effect (only if supported).

### 9.4 Combat behavior profiles

Allow the player to select behavior profiles or simple priorities:

- Aggressive.
- Defensive.
- Support-first.
- Focus-fire.
- Preserve mana.

The combat engine still selects legal actions. A behavior profile changes priorities, not the simulation rules.

### 9.5 Recovery and incapacitation

Expand recovery with:

- Rest services at safe locations.
- Consumable healing.
- Recovery timers measured in world actions if appropriate.
- Recovery cost balancing.
- Optional injury effects only if they add meaningful gameplay.

Avoid punishing failure so heavily that players become trapped in a no-progress state.

---

## 10. Expanded Combat

### 10.1 Combat goals

Improve tactical variety while retaining automatic combat.

### 10.2 Additions

- More enemy archetypes: tank, striker, ranged, caster, support, summoner, boss.
- Enemy group composition rules.
- Boss phases.
- Encounter modifiers.
- More abilities and status effects.
- Threat/targeting logic.
- Front/back formation interactions.
- Resistances and vulnerabilities.
- Equipment and party synergy.
- Better combat report summaries.

### 10.3 Determinism

Every battle must be reproducible from:

- Encounter definition version.
- Party snapshot.
- Character/equipment snapshot.
- Combat rules version.
- RNG seed.

Persist the exact snapshots or immutable references sufficient to reconstruct the simulation. If combat formulas change in a later release, old battle reports remain immutable records, not recalculated results.

### 10.4 Balance simulation

Create a simulation harness that can run thousands of seeded battles without the UI.

Measure:

- Win rate by party level and event difficulty.
- Average turns.
- Character death/incapacitation rate.
- Resource consumption.
- Ability usage frequency.
- Enemy archetype win rates.
- Reward value relative to difficulty.

Use simulation to identify outliers; do not optimize only for a single party composition.

---

## 11. Equipment, Loot, Research, and Economy

### 11.1 Item model

Separate:

- Item definition/template.
- Owned item instance.
- Equipment slot assignment.
- Item affixes/modifiers.
- Upgrade state.

An item instance may have rolled properties, but all rolls are generated by deterministic game code from bounded tables and a seed.

### 11.2 Rarity

Define a controlled rarity ladder, for example:

- Common
- Uncommon
- Rare
- Epic
- Legendary

Rarity affects allowed affix count/value bands. It must not permit arbitrary stat inflation.

### 11.3 Loot generation

The LLM may suggest a thematic item concept or name. The engine chooses the actual item template, rarity, affixes, and numeric stats using loot tables and reward budgets.

### 11.4 Research

Research can unlock:

- New abilities.
- Ability upgrades.
- Equipment recipes or item families.
- Region knowledge.
- Event access.
- Party-wide passive bonuses.

Research progress is a deterministic resource/objective system. The LLM can narrate discoveries but cannot invent a new executable ability effect.

### 11.5 Economy

Expand gold sinks carefully:

- Recovery/rest.
- Equipment upgrades.
- Services.
- Optional event preparation costs.

Keep a resource transaction ledger. Avoid adding a complex market or dynamic economy unless the gameplay loop needs it.

---

## 12. Full Event Board and Scheduling

### 12.1 Board composition

Maintain a deliberate mixture:

- Persistent storyline events.
- Region-specific opportunities.
- Threat-response events.
- Discovery/scout events.
- Research opportunities.

Board size should be configurable. Prioritize relevance and quality over filling every slot.

### 12.2 Event prioritization

A deterministic scoring layer may consider:

- Storyline priority.
- Region accessibility.
- Party level suitability.
- Current threats.
- Recent event repetition.
- Event age/expiration.
- Player history.
- Content variety.

The Event Director can propose candidates; the engine owns final eligibility and board composition.

### 12.3 Temporary opportunities

Temporary opportunities expire by world turn. Their expiration must be visible to the player and tested around boundary turns.

### 12.4 Duplicate prevention

Use stable event fingerprints/tags and recent-history checks. Avoid generating the same concept with only a changed title.

---

## 13. Frontend Expansion

### 13.1 Preserve the UI architecture

Continue with React and UI SDK. Keep application-owned components as the stable interface:

```text
src/components/ui/
  Button/
  Dialog/
  Tabs/
  Tooltip/
  Progress/
  Menu/
  Select/
  Toast/
  ...
```

These components may internally use UI SDK primitives. Feature screens must not import low-level UI SDK behavior directly unless there is a strong reason.

Before using or upgrading UI SDK:

- Read the installed `node_modules/@ui-sdk/react/docs/llms.txt`.
- Consult the relevant component docs.
- For custom primitives, consult `core.md` and `rendering.md`.
- Pin versions and test keyboard/focus behavior.
- Record breaking changes in an ADR.

### 13.2 Full screen map

- Dashboard / adventurer overview.
- World map (region/location graph).
- Region detail.
- Location detail.
- Event Board with filters.
- Event detail and preparation.
- Active event progress.
- Party roster and formation.
- Character detail and progression.
- Ability book.
- Equipment and inventory.
- Research.
- Battle report and combat log.
- Journal/storyline tracker.
- Threat overview.
- Settings and diagnostics.
- Save management.

### 13.3 UI design system

Define tokens for:

- Typography.
- Spacing.
- Border/radius.
- Surface/background.
- Text hierarchy.
- Semantic status colors.
- Rarity.
- Event categories.
- Difficulty.
- HP/MP/XP progress.
- Focus/hover/disabled states.

Keep the parchment/fantasy theme subtle. Use accessible contrast and readable text as the primary design requirement.

### 13.4 Interaction and accessibility

- Keyboard navigation.
- Focus management.
- Screen reader labels.
- Reduced motion.
- Responsive layouts.
- Clear empty/loading/error states.
- Confirmation for destructive actions.
- Toasts for action outcomes.
- No icon-only critical actions without accessible labels.

### 13.5 Client state

Separate server state from transient UI state. The server remains authoritative. Cache invalidation should follow command outcomes. Do not duplicate game formulas in frontend code.

---

## 14. Persistence, Save Compatibility, and Data Evolution

### 14.1 Migration discipline

Every schema change must:

1. Add a numbered migration.
2. Define forward behavior.
3. Define backup/rollback expectations.
4. Test migration from the previous released schema.
5. Test fresh database creation.
6. Update data model docs and ADRs where appropriate.

### 14.2 Save version

Introduce a save-format version separate from the SQLite schema version. This is useful for export/import and future portability.

### 14.3 Backup and restore

Implement:

- Manual backup.
- Automatic pre-migration backup.
- Export save bundle.
- Import with schema/version validation.
- Integrity check.
- Clear failure reporting.

Do not overwrite a valid save before verifying an imported save.

### 14.4 Audit and action history

Keep an append-only action history for important game state changes. This is not full event sourcing. Store enough information to explain state transitions and diagnose bugs.

---

## 15. API and Application Hardening

### 15.1 API contracts

- Version public API contracts when breaking changes are required.
- Validate all input at the boundary.
- Return stable error codes.
- Avoid leaking database details.
- Add pagination to history/content lists when needed.
- Add request IDs and idempotency keys to mutations.

### 15.2 Concurrency

Even in a single-player game, duplicate tabs and retries can race.

Use:

- Optimistic version checks for mutable aggregate state.
- Idempotency keys.
- Unique constraints for reward grants and world actions.
- Transactions around state changes.
- Explicit conflict responses.

### 15.3 Security

- Keep local deployment assumptions explicit.
- Validate all client input.
- Sanitize model-generated text before rendering.
- Do not render model output as raw HTML.
- Restrict file paths and import/export destinations.
- Protect diagnostics endpoints if they expose sensitive operational data.
- Never expose LLM API credentials to the browser.

### 15.4 Performance

Measure before optimizing. Potential improvements:

- Read models for dashboard/board.
- Indexes for common queries.
- Bounded context construction.
- Background generation jobs.
- Cache static content definitions.
- Avoid reloading the full game state after every small command.

---

## 16. Observability and Developer Tooling

### 16.1 Structured logs

Include:

- Request ID.
- Operation ID.
- Player/world ID (non-sensitive internal identifier).
- Use-case name.
- Event/battle ID where relevant.
- Generation ID.
- Model/prompt/schema versions.
- Duration and result classification.

Do not log secrets or unrestricted prompt context by default.

### 16.2 Metrics

Track:

- API latency/error rate.
- SQLite operation latency.
- Combat simulation duration.
- Event board refresh duration.
- LLM generation latency.
- Token usage when available.
- Generation validation/fallback rates.
- Event completion/failure rates.
- Reward distribution.
- Combat win rates.

### 16.3 Developer tools

Add an internal developer panel or CLI commands for:

- Inspecting current world state.
- Listing active threats/storylines.
- Generating an event from a selected fixture.
- Validating a generated event without persisting it.
- Running a deterministic battle simulation.
- Advancing a test world turn.
- Inspecting generation metadata.
- Exporting a diagnostic bundle with secrets removed.

Do not expose unsafe state mutation tools in the normal player UI.

---

## 17. Content Authoring and Validation

### 17.1 Static content pipeline

Create schemas and validators for:

- Regions and locations.
- Enemy templates.
- Abilities.
- Equipment.
- Loot tables.
- Storyline definitions.
- World rules.
- Event templates.

Validate all static content in CI.

### 17.2 Content versioning

Each definition has a stable ID and version. Renaming display text should not break references. Removing a referenced template requires migration or a compatibility alias.

### 17.3 Content tooling

Build a small developer-facing content inspector before building a large CMS. It should validate content and show references/dependencies.

### 17.4 LLM-generated content lifecycle

Generated content should move through explicit states:

`proposed -> validated -> accepted -> active/archived`

For single-player local gameplay, automatic acceptance is fine after all hard validations pass. Keep an optional developer review mode for inspecting raw and normalized output.

---

## 18. Full-Production Milestone Plan

Each milestone assumes previous milestones are complete and accepted. The implementation agent must inspect the current code and docs before starting. If the MVP implementation differs from this plan, update the plan through an ADR rather than forcing a rewrite.

### P1 — Baseline Audit and Production Backlog

**Goal:** Establish an accurate production starting point from the completed MVP.

Steps:

1. Verify MVP release tag and clean working tree.
2. Run all MVP tests, type checks, formatting, and builds.
3. Inspect all root/app `AGENTS.md` instructions.
4. Review ADRs and mark superseded decisions correctly.
5. Audit current schema, migrations, API contracts, prompts, and static content.
6. Record current model, quantization, inference server, prompt versions, and evaluation results.
7. Create a production gap analysis mapping each target feature to existing modules.
8. Create a dependency graph for production milestones.
9. Update `RPG_IMPLEMENTATION.md` only where implementation evidence requires a clarified plan; do not silently alter scope.
10. Add an ADR for any required architectural change.

Deliverables:

- Baseline audit report.
- Production backlog.
- Updated known limitations.
- Verified MVP regression baseline.

Acceptance:

- Production work starts from a tested, documented commit.
- No existing MVP behavior is accidentally scheduled for reimplementation.
- All gaps and dependencies are explicit.

### P2 — Content Model and Region Expansion

**Goal:** Expand the world from the MVP starter region into a coherent multi-region world.

Steps:

1. Finalize region/location definition schemas.
2. Add stable content IDs, versions, tags, and reference validation.
3. Define 4–6 initial regions with distinct themes and level ranges.
4. Add 4–8 locations per region, beginning with fewer if content quality requires it.
5. Define region and location graph connections.
6. Add region-specific enemy family and event allowlists.
7. Add discovery and access conditions.
8. Add static content validation to CI.
9. Add world/region/location read models.
10. Expand the world map UI to show discovered/unknown/access states.
11. Add tests for content references, discovery, and connection state.
12. Update world/data model docs and content authoring guide.

Acceptance:

- Multiple regions can be discovered and accessed through explicit conditions.
- Invalid static content fails validation.
- The world remains a simple graph; no pathfinding has been introduced accidentally.

### P3 — Threats, World Facts, and Consequences

**Goal:** Give the world persistent state that changes in response to player actions.

Steps:

1. Add threat and world-fact schema/migrations.
2. Define a small threat lifecycle and stage transitions.
3. Add deterministic world rule definitions for selected actions.
4. Add world simulation orchestration after world-advancing actions.
5. Add consequence records and journal entries.
6. Add threat conditions to event eligibility.
7. Add region/location state changes from validated consequences.
8. Add a threat overview UI.
9. Add deterministic fixture-based tests for each rule.
10. Update world simulation docs and ADRs if needed.

Acceptance:

- Threats evolve only through explicit, testable conditions.
- A player action can create visible consequences in a later turn.
- The same world state/action sequence produces the same result.
- LLM output cannot directly apply a threat stage change.

### P4 — Storyline Chains and Branching Outcomes

**Goal:** Implement durable multi-stage storylines.

Steps:

1. Define static storyline and stage schemas.
2. Add player/world storyline progress tables.
3. Implement prerequisite and completion condition evaluators.
4. Implement transactional stage transitions.
5. Implement once-only outcome effects.
6. Connect storyline stages to event templates and event generation.
7. Add a small authored storyline with at least three stages.
8. Add one explicit branch based on a persisted player decision or world condition.
9. Add storyline tracker and journal UI.
10. Add tests for stage ordering, branch conditions, repeated commands, and invalid transitions.
11. Update storyline docs and authoring examples.

Acceptance:

- Storyline progression survives reloads and model changes.
- Stage transitions and effects apply once.
- Branches are explicit, testable, and visible to the player.
- The LLM provides narrative, not authoritative stage progression.

### P5 — Advanced Event Objectives and Encounter Mechanics

**Goal:** Expand event variety without destabilizing the event lifecycle.

Steps:

1. Add objective types with deterministic completion rules.
2. Add objective-specific state and progress records.
3. Add boss encounter and optional encounter structures.
4. Add encounter modifiers and event hazards from a controlled effect vocabulary.
5. Add protection/survival/investigation/research event templates.
6. Expand event semantic validation to cover new mechanics.
7. Update Event Generator schemas/prompts with supported objective/encounter types.
8. Add fixtures for valid and invalid examples.
9. Add UI progress indicators and event detail presentation.
10. Test partial progress, retries, and failure outcomes.
11. Update event docs and prompt versions.

Acceptance:

- New objective types are fully supported end-to-end.
- Generated events cannot request unsupported mechanics.
- Multi-encounter progress remains durable and idempotent.

### P6 — Expanded Combat, Enemy Families, and Bosses

**Goal:** Improve combat depth while preserving deterministic automatic resolution.

Steps:

1. Version combat rules and encounter snapshots.
2. Add enemy archetypes and behavior profiles.
3. Add expanded ability effect types.
4. Add resistance/vulnerability handling.
5. Add encounter modifiers and boss phase state machines.
6. Improve target selection and threat rules.
7. Add player-selectable behavior profiles.
8. Add combat simulation CLI/harness.
9. Run seeded batch simulations across party compositions and level bands.
10. Tune balance and record results.
11. Expand battle report UI with boss phases, effects, and action reasons.
12. Add backward-compatibility tests for historical battle reports.
13. Update combat docs and ADRs.

Acceptance:

- Battle outcomes remain reproducible for a given rules/content snapshot and seed.
- Boss phases and status effects have explicit legal transitions.
- Balance reports can be reproduced.
- Existing battle history is not recalculated under new formulas.

### P7 — Character Progression, Abilities, and Research

**Goal:** Give party members meaningful long-term development.

Steps:

1. Define versioned XP curves and level-up rules.
2. Implement attribute growth profiles or controlled player choices.
3. Add ability unlock and upgrade definitions.
4. Add research trees/paths with explicit prerequisites.
5. Add research progress and unlock transactions.
6. Add passive traits and party synergy only where supported by combat rules.
7. Add character progression and ability book screens.
8. Add tests for level boundaries, unlock prerequisites, and duplicate grants.
9. Run balance simulations for new abilities.
10. Update progression docs and content schemas.

Acceptance:

- Level-ups and unlocks are deterministic and idempotent.
- Research cannot unlock unsupported ability effects.
- UI accurately reflects server-authoritative progression.

### P8 — Equipment, Loot, and Economy Expansion

**Goal:** Add a controlled loot ecosystem and meaningful gold sinks.

Steps:

1. Expand item definitions and equipment slot rules.
2. Add rarity bands and bounded affix tables.
3. Implement deterministic item-instance generation from seeds.
4. Expand enemy/event loot tables.
5. Add equipment upgrades or enhancement if justified by the design.
6. Add recovery/services as gold sinks.
7. Add resource transaction history and economy diagnostics.
8. Add loot/reward simulation and distribution reports.
9. Add inventory filtering/sorting and item comparison UI.
10. Add tests for item generation bounds, ownership, and economy invariants.
11. Update item/economy docs.

Acceptance:

- Item stats are generated only by deterministic bounded rules.
- LLM suggestions cannot create arbitrary item power.
- Economy transactions are auditable and never duplicated.

### P9 — LLM World Director and Contextual Generation

**Goal:** Introduce model-assisted world development after deterministic world rules and storylines are stable.

Steps:

1. Define World Director proposal schema.
2. Build compact world context from threats, facts, regions, storylines, and history.
3. Define allowed proposal kinds and effect candidates.
4. Implement World Director task orchestration.
5. Add semantic validation and policy evaluation.
6. Require deterministic engine confirmation before any proposal becomes a world effect.
7. Connect accepted proposals to narrative generation and eligible event concepts.
8. Add context-size budgeting and relevance tests.
9. Add model regression fixtures and evaluation metrics.
10. Add fallback behavior for unavailable/low-quality output.
11. Update prompt registry, LLM docs, and ADRs.

Acceptance:

- World Director can make relevant proposals grounded in current state.
- Invalid or unsupported proposals are rejected.
- No LLM proposal bypasses deterministic world rules.
- World progression remains functional without the model.

### P10 — Generation Jobs, Quality Evaluation, and Model Routing

**Goal:** Make LLM generation reliable and measurable at production scale for a local application.

Steps:

1. Review generation latency and API impact from real measurements.
2. Add SQLite-backed durable generation jobs only if asynchronous execution is warranted.
3. Implement job lifecycle, retries, idempotency, and cancellation.
4. Add generation history and failure classification.
5. Build a repeatable evaluation suite for event/narrative/world tasks.
6. Add duplicate detection and content diversity metrics.
7. Add optional model routing behind configuration and measured evaluations.
8. Add prompt/model comparison reports.
9. Add generation queue diagnostics.
10. Test restart recovery and interrupted jobs.
11. Update operations and LLM architecture docs.

Acceptance:

- A server restart does not lose accepted content or leave jobs permanently running.
- Retries cannot create duplicate events.
- Model routing is justified by measured quality/latency improvements.
- The game remains playable if all generation jobs fail.

### P11 — Frontend Completion and UX Polish

**Goal:** Turn the MVP screens into a cohesive full-game interface.

Steps:

1. Audit design tokens and application-owned component library.
2. Review all UI SDK integrations against installed docs.
3. Standardize navigation, loading, error, empty, and success states.
4. Complete world/region/location views.
5. Complete Event Board filters and event preparation.
6. Complete party roster, formation, character progression, and abilities.
7. Complete inventory, item comparison, research, and recovery flows.
8. Complete storyline/threat/journal views.
9. Improve battle report readability and filtering.
10. Add responsive behavior and keyboard navigation.
11. Audit focus management, labels, contrast, and reduced motion.
12. Add frontend component and end-to-end tests.
13. Update web `AGENTS.md`, UI architecture docs, and changelog.

Acceptance:

- All core game systems have clear, consistent player-facing screens.
- No important action is available only through hidden developer endpoints.
- Keyboard and screen-reader basics work.
- UI remains a presentation/client interaction layer, not a second game engine.

### P12 — Save Management, Reliability, and Security

**Goal:** Make local saves recoverable and the application robust under errors and repeated commands.

Steps:

1. Add save-format versioning.
2. Implement manual backup/export.
3. Implement restore/import with validation and staging.
4. Add automatic backup before risky migrations.
5. Add database integrity checks.
6. Audit idempotency and concurrency for every mutating command.
7. Add optimistic version checks where appropriate.
8. Sanitize all model-generated text.
9. Audit API diagnostics and secret handling.
10. Test corrupted import, interrupted restore, duplicate commands, and migration failure.
11. Update operations/security docs.

Acceptance:

- A user can back up and restore a valid save.
- Failed imports do not destroy the current save.
- Repeated requests do not duplicate rewards or world effects.
- Model-generated content cannot inject executable markup into the UI.

### P13 — Content Production and Narrative Continuity

**Goal:** Increase the amount and coherence of playable content.

Steps:

1. Define a content production standard and review checklist.
2. Expand region lore, enemy families, equipment, abilities, and event templates.
3. Add storyline continuity summaries derived from persisted facts.
4. Add a content inspector/validator for developers.
5. Add content dependency/reference reports.
6. Add generation diversity checks and repetition controls.
7. Run structured playtests across regions and party levels.
8. Review narrative consistency and event pacing.
9. Tune event board composition and opportunity expiration.
10. Update content authoring docs and fixtures.

Acceptance:

- Content is internally consistent and validated.
- New content can be added without changing core engine code for ordinary cases.
- The Event Board presents varied, relevant content without filler.

### P14 — Production Readiness and Release

**Goal:** Establish a stable, supportable release.

Steps:

1. Run complete clean-install and upgrade tests.
2. Run all unit, integration, simulation, generation, and end-to-end suites.
3. Test LLM unavailable, timeout, invalid output, and model replacement.
4. Test backup/restore and database migration paths.
5. Run performance profiling and resolve measured bottlenecks.
6. Audit security, logging, and secret handling.
7. Audit all documentation and `AGENTS.md` instructions.
8. Review ADR status and unresolved decisions.
9. Record dependency versions, model configuration, prompt versions, and content version.
10. Create release notes and known limitations.
11. Tag the production baseline.
12. Define post-release bug triage and balance iteration process.

Acceptance:

- All critical gameplay and data integrity scenarios pass.
- A save can be backed up and restored.
- Model failure does not prevent normal play.
- Documentation accurately describes the shipped system.
- No unresolved critical defects remain.

---

## 19. Production Test Matrix

### 19.1 Domain tests

- Region/location discovery transitions.
- Threat stage transitions.
- World action advancement policy.
- Storyline prerequisites and branches.
- Event lifecycle and objective completion.
- Combat rules and historical result integrity.
- XP/level/ability unlock boundaries.
- Equipment/loot generation bounds.
- Reward transaction idempotency.

### 19.2 Integration tests

- World action triggers deterministic world rules.
- Threat resolution unlocks storyline stage.
- Storyline stage creates an eligible event.
- Generated event uses valid region/enemy/objective templates.
- Event completion applies world consequences once.
- Research unlocks ability and persists.
- Save export/import preserves game state.
- Generation job resumes or fails safely after restart.

### 19.3 Simulation tests

- Party/enemy win rates by level.
- Boss encounter success rates.
- Ability usage and resource efficiency.
- Loot rarity distribution.
- Gold inflow/outflow.
- Recovery cost sustainability.
- Event difficulty/reward correlation.

### 19.4 LLM evaluation tests

- Structured output validity.
- Semantic consistency.
- Context grounding.
- Duplicate/repetition detection.
- Event playability.
- Reward intent bounds.
- Narrative continuity.
- Latency and fallback rate.

### 19.5 End-to-end scenarios

1. Discover a new region and unlock a storyline.
2. Complete a sequence of storyline events and resolve a regional threat.
3. Fail a late encounter and retain earlier event progress.
4. Research and unlock a new party ability.
5. Obtain a rare item and equip it.
6. Replace the configured local model and continue the existing save.
7. Disable inference and finish already accepted events.
8. Export a save, reset the test database, and restore it.
9. Repeat state-changing API calls and verify no duplicated rewards/effects.

---

## 20. Documentation and Agent Rules (Continued)

The MVP documentation workflow remains mandatory throughout production.

### 20.1 Documentation ownership

- Root `AGENTS.md`: repository-wide rules, architecture boundaries, commands, and documentation policy.
- `apps/web/AGENTS.md`: React/UI SDK conventions, accessibility, client/server authority, frontend testing.
- `apps/server/AGENTS.md`: API/application/domain/infrastructure boundaries, transactions, LLM safety, persistence.
- Package `AGENTS.md`: only where package-specific rules materially help.
- ADRs: decisions and trade-offs, not a replacement for current architecture docs.
- Domain docs: current behavior and invariants.
- Prompt docs: current task contracts and versions.
- Operations docs: setup, recovery, backups, diagnostics.

### 20.2 Mandatory change workflow

For every implementation change:

1. Read root and relevant app/package `AGENTS.md`.
2. Read current architecture and domain documentation for the touched area.
3. Inspect existing implementation and tests.
4. Make the smallest coherent change.
5. Add or update tests.
6. Update relevant docs in the same change.
7. Update prompt/schema versions if generation contracts changed.
8. Add a new ADR if a material decision changes.
9. Update changelog where appropriate.
10. Run format, type-check, tests, and build.
11. Report implementation, documentation, and verification changes.

### 20.3 Documentation drift prevention

Add CI checks for:

- Required documentation files.
- Broken internal Markdown links.
- Prompt schema/version metadata consistency where practical.
- Migration documentation or schema snapshot changes where practical.

Do not rely on a script that blindly rewrites docs from source code. Generated API/schema reference pages may be automated, but architectural explanations and domain invariants require deliberate review.

### 20.4 Agent completion report

Every coding-agent milestone report must include:

```md
## Summary

What changed and why?

## Implementation

Which modules and flows changed?

## Documentation

Which docs, ADRs, prompts, and AGENTS.md files were updated?

## Tests and verification

Commands executed and results.

## Risks / follow-up

Known limitations, migration notes, and next steps.
```

---

## 21. Release and Maintenance Strategy

### 21.1 Versioning

Track independently:

- Application release version.
- SQLite schema version.
- Save format version.
- Static content version.
- Combat rules version.
- Prompt version.
- Generation output schema version.

### 21.2 Compatibility

- Do not delete content IDs referenced by saves.
- Use aliases or migrations for renamed definitions.
- Preserve historical battle results.
- Do not regenerate existing events on model upgrade.
- Keep old prompt/schema metadata for generated content inspection.
- Test upgrades from supported released save versions.

### 21.3 Balance and content updates

Treat balance changes as game-rule changes:

- Document the intended change.
- Add/update tests.
- Run simulations.
- Record relevant ADR or changelog entry.
- Consider effects on existing characters/items/saves.
- Never silently rewrite historical outcomes.

### 21.4 Ongoing health indicators

Review periodically:

- Event completion and failure rates.
- Player progression pace.
- Party archetype usage.
- Combat win rates.
- Reward and gold economy.
- Event repetition.
- LLM acceptance/fallback rate.
- Save integrity and migration success.
- Crash/error rate.

---

## 22. Final Production Definition of Done

The full-production implementation is complete when:

- The MVP baseline remains intact and all its core invariants still pass.
- The world supports multiple connected regions, persistent threats, discoveries, and consequences.
- Storylines support multi-stage progression and explicit branches.
- Events support a broader set of objectives and encounter mechanics.
- Combat has deeper enemy, ability, and boss behavior while remaining deterministic.
- Characters, abilities, research, equipment, loot, and economy form a coherent progression loop.
- LLM world/event/narrative generation is structured, evaluated, observable, and safely bounded.
- The frontend presents all major systems through a coherent, accessible React experience built on application-owned components and UI SDK behaviors.
- Saves can be backed up, restored, migrated, and validated.
- Critical state changes are transactional and idempotent.
- Automated tests and simulations cover important gameplay and integrity invariants.
- Documentation, ADRs, prompts, and root/app `AGENTS.md` remain current.
- The game remains playable without an available LLM.

**Production success means a coherent, extensible RPG whose world feels authored and responsive, whose content can be creatively generated, and whose rules remain deterministic, testable, and under the game's control.**
