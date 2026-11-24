# Changelog

All notable user-visible and operational changes are recorded here. The format follows Keep a Changelog and the project uses semantic versioning for the MVP baseline.

## [Unreleased]

### Added

- P2 content model: six regions and thirty locations with stable IDs, versions, tags, reciprocal
  region/location connections and explicit scout access conditions.
- Zod schemas and cross-reference validation for authored regions, locations, enemies, abilities and
  equipment; invalid static content now fails fast at import.
- Region event-type and enemy-family allowlists; generated concepts and encounters are rejected when
  they fall outside the region's allowlist.
- World read model exposes region tags, dynamic route status and location adjacency, and the World
  screen shows routes and location metadata.
- Eight additional fallback opportunities chain the new regions together and give each one a
  playable entry contract.
- Production baseline audit and P1/P2 status in `docs/PRODUCTION_BASELINE.md`.
- World rules: region status is derived from known locations and region threat rises in bounded,
  idempotent steps after completed and failed contracts.
- Ashen March can now be unlocked: a frontier scout reveals the Ashen Gate, which then becomes
  reachable and unlocks the region.
- Narrative generation now covers board teasers, event introductions, discovery notifications and
  victory/defeat results, all scheduled after the authoritative transaction.
- Generation fixture set and evaluation test in `tests/fixtures/generation/` and
  `tests/generation-fixtures.test.ts`.
- HTTP route, fake-provider, status-effect, world-rule and battle-immutability tests.
- ADR-0007 documenting the implemented HTTP route shape.
- ADR-0008 documenting versioned static content and fail-fast reference validation.

### Changed

- Board refresh no longer blocks command responses. When generation is disabled the board is filled
  synchronously from fallback definitions; when enabled, model-backed generation and narrative
  enrichment run in the background with per-event fallback.
- Typecheck now includes `tests/**/*.ts`.
- Documentation no longer requires a hosted CI pipeline or release tags; the full gate is run locally.

### Fixed

- Region threat was stored but never updated.
- Biome lint failures caused by formatting drift in web files.

## [0.1.0] — 2026-11-18

### Added

- Complete browser game shell with World, Event Board, Event Detail, Party, Character Detail, Inventory, Journal, Battle Report and Diagnostics screens.
- React 19 + Vite frontend using `@ui-sdk/react` interaction primitives and the `react-icons/gi` Game Icons set.
- Bun + Hono + SQLite server with typed contracts, request validation, correlation IDs and structured logs.
- Persisted starter world (Greenreach and Ashen March), four-character party, equipment, inventory and journal.
- Action-based world turns. Accepting, completing or failing a contract and discovering a location advance time exactly once; viewing, equipping, resting and reloading do not.
- Deterministic seeded combat with automatic party and enemy behavior presets, healing, status effects, critical hits, turn limit and structured action logs.
- Immutable battle reports stored once per encounter and replayed without re-simulation.
- Dungeon, Scout, Research and Attack events with storyline and opportunity categories, board limits and expiry by world turn.
- Event objectives, encounter progress, partial defeat, resting and transactional reward grants with idempotent grant keys.
- Local OpenAI-compatible LLM provider with configuration, timeouts, bounded retries, response-size limits, JSON extraction and generation metadata.
- Event Director, Event Generator and Narrative Generator prompts with schema and semantic validation, content allowlists and deterministic fallback events.
- Diagnostics panel showing API, database and model health, fallback status and recent generation attempts.
- Unit tests for stats, XP, RNG, combat determinism and termination; integration tests for event lifecycle, partial defeat, rewards, rest, equipment and expiry; model-contract tests for concept and generated-event validation.
- Full documentation set, six ADRs, prompt contracts, root and app-level `AGENTS.md`, and a local documentation checker.
- Non-numeric `GAME_SEED` values are hashed into a stable numeric seed.

### Changed

- Research event completion advances the world with `research_completed`; other non-combat completions use `event_completed`.
- Typecheck now runs against a single root project instead of unimplemented package build steps.

### Known limitations

- One party, no multiplayer, no tactical grid, no movement simulation, no permadeath.
- Storyline sequencing is represented minimally, without multi-stage storyline records.
