# Changelog

All notable user-visible and operational changes are recorded here. The format follows Keep a Changelog and the project uses semantic versioning for the MVP baseline.

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
- Full documentation set, six ADRs, prompt contracts, root and app-level `AGENTS.md`, documentation checker and CI workflow.
- Non-numeric `GAME_SEED` values are hashed into a stable numeric seed.

### Changed

- Research event completion advances the world with `research_completed`; other non-combat completions use `event_completed`.
- Typecheck now runs against a single root project instead of unimplemented package build steps.

### Known limitations

- One party, no multiplayer, no tactical grid, no movement simulation, no permadeath.
- Board refresh after a command can wait on local model inference; the UI keeps the command pending and reports generation status.
- Storyline sequencing is represented minimally, without multi-stage storyline records.
