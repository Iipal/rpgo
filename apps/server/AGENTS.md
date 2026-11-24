# AGENTS.md — server app

Read the root [`AGENTS.md`](../../AGENTS.md) first, then [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](../../docs/DATA_MODEL.md) and [`docs/LLM_PIPELINE.md`](../../docs/LLM_PIPELINE.md).

## Boundaries

```text
src/http          → request parsing, route wiring, HTTP errors
src/application   → use cases and orchestration
src/domain        → domain errors only (no Hono, SQLite, React, LLM imports)
src/infrastructure→ SQLite repository, migrations, LLM provider, prompts
```

- `src/domain` and `packages/game-rules` must stay infrastructure-free.
- `src/application` may depend on domain, repository interfaces/implementations and generation services. It must not depend on Hono.
- Only `src/infrastructure/llm` may know the OpenAI-compatible wire format.
- The repository is the only code that executes SQL.
- Do not hold a database transaction open across an LLM call.

## Commands

```bash
bun run --cwd apps/server dev       # watch server on :3001
bun run --cwd apps/server start     # start once
bun run --cwd apps/server migrate   # apply migrations
bun run --cwd apps/server build     # bundle to dist/
bun test                            # from repo root
```

`apps/server/.env` is loaded automatically by Bun when the server starts. Keep secrets out of source and docs; update `.env.example` instead.

## Rules for state changes

- Every mutating use case accepts an operation ID and stores a receipt where replay matters.
- Unique constraints back up application checks:
  - `world_actions(world_id, action_type, operation_id)`
  - `resource_transactions(grant_key)`
  - `battle_sessions(event_id, encounter_index)`
  - `command_receipts(operation_id, command)`
- Reward grants use stable `grant_key`s and `INSERT OR IGNORE`.
- A completed battle is read back from `battle_sessions`; never simulate it again.
- A multi-encounter event advances the world only on event completion or event failure, not per encounter.

## LLM rules

- Model output is untrusted. Parse with Zod, then run `validateConcept` / `validateGenerated`.
- The model may choose only known templates, behaviours, event types and reward categories.
- Enforce region event-type and enemy-family allowlists; do not pass disallowed templates to the generator.
- The engine derives all stats and reward quantities.
- Record every attempt in `llm_generations`, including status, latency, model and prompt/schema version.
- Retry at most once and only where useful. Return fallback content when generation fails.
- Keep the LLM task isolated from game rules; do not call a model during combat.

## Tests

- Unit tests cover pure rules in `packages/game-rules`.
- Integration tests open `:memory:` SQLite, run migrations, seed and drive `GameService` with `DisabledLlmProvider`.
- Add a model-contract test for every new generation schema or semantic rule.
- Never make a test depend on a live model server.

## Documentation checklist

Update `docs/DATA_MODEL.md` for schema changes, `docs/ARCHITECTURE.md` for dependency/flow changes, `docs/LLM_PIPELINE.md` and `docs/prompts/` for prompt/schema changes, and `CHANGELOG.md` for user-visible or operational changes.
