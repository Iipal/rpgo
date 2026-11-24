# AGENTS.md — working on RPGO

This is the root instruction file for every coding agent and human contributor. Read it before editing anything.

## 1. Start here

1. Read this file completely.
2. Read the `AGENTS.md` for the app or package you are changing:
   - [`apps/server/AGENTS.md`](apps/server/AGENTS.md)
   - [`apps/web/AGENTS.md`](apps/web/AGENTS.md)
3. Read the docs that describe the area you are touching:
   - [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
   - [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
   - [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
   - [`docs/LLM_PIPELINE.md`](docs/LLM_PIPELINE.md)
   - [`docs/TESTING.md`](docs/TESTING.md)
   - [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
4. Search the repository for existing patterns before adding a new abstraction.
5. Run the verification commands at the bottom of this file before declaring work complete.

## 2. Non-negotiable boundaries

- The deterministic engine is authoritative. The LLM never writes to SQLite, changes stats, awards rewards, rolls dice, or advances world time.
- LLM output is untrusted input. It must pass Zod schema validation and then domain validation before persistence.
- Domain code (`apps/server/src/domain`, `packages/game-rules`) must not import React, Hono, SQLite, Bun server APIs, or the LLM SDK.
- Application use cases coordinate; infrastructure implements persistence and external calls.
- Commands are idempotent by operation ID. Database unique constraints are the final defense, not the only defense.
- Completed battles are immutable. Never re-simulate a battle that already has a stored result.
- Generation is never performed inside an open database transaction.
- Active or accepted events are never overwritten by a board refresh.
- The game must remain playable with the LLM disabled. Preserve fallback content.
- Do not expose internal database rows as API responses. Use `packages/contracts` DTOs.
- Do not commit secrets. `apps/server/.env` is local and gitignored; update `.env.example` instead.

## 3. Architecture at a glance

```text
React web app (apps/web)
    ↓ typed fetch + DTOs
Hono API (apps/server/src/http)
    ↓ command/query use cases
Application services (apps/server/src/application)
    ↓ domain rules + repositories
Domain rules (packages/game-rules)  SQLite (migrations/)
    ↓
LLM orchestration (apps/server/src/infrastructure/llm)
    ↓ OpenAI-compatible HTTP
Local inference server
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full dependency flow and request lifecycle.

## 4. Repository map

| Path                                      | Responsibility                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/server/src/domain`                  | Errors and domain primitives. No infrastructure imports.                             |
| `apps/server/src/application`             | Use cases: game loop, board, rewards, event persistence, validation, mappers.        |
| `apps/server/src/infrastructure/database` | SQLite connection, migrations runner, repository.                                    |
| `apps/server/src/infrastructure/llm`      | Provider abstraction, OpenAI-compatible client, generation service, prompt registry. |
| `apps/server/src/http`                    | Hono routes, request validation, response envelope, correlation IDs.                 |
| `apps/web/src`                            | React screens, features, API client, styles.                                         |
| `packages/contracts`                      | Shared Zod schemas and DTOs for API and model-output boundaries.                     |
| `packages/game-rules`                     | Pure deterministic rules: stats, XP, RNG, combat, rewards, world progression.        |
| `packages/game-content`                   | Static content lookup maps, fallback event definitions, starter party.               |
| `data`                                    | Human-authored JSON content (regions, enemies, abilities, equipment).                |
| `migrations`                              | Ordered SQL migrations.                                                              |
| `tests`                                   | Unit, integration and model-contract tests.                                          |
| `docs`                                    | Architecture, design, data, LLM, testing, operations and ADRs.                       |

## 5. Change rules

### Behaviour changes

- Add or update tests in the same change.
- Keep generated content on the same deterministic execution path as authored content.
- If a command can change state, derive or accept an operation ID and test the duplicate case.
- If a world rule changes, test that view-only actions do not advance time and that one event advances the world once.
- If a battle rule changes, keep the simulator deterministic for a given seed and update the combat documentation.

### Data changes

- Add a new numbered migration; never edit an applied migration in place.
- Test migrations from an empty database.
- Preserve the ability to back up and restore the SQLite file.
- Update `data/*.json` and the schemas/validation in `packages/game-content` together.
- Keep region and location connections reciprocal, and keep region event/enemy allowlists valid.
- Every non-start region needs an explicit access condition and a fallback route event that reaches it.
- Run `tests/content-validation.test.ts` after any static content change.

### LLM changes

- Version every prompt and schema. Store both with each accepted generation.
- Keep task output schemas in `packages/contracts`.
- Validate semantic meaning after schema validation: IDs, categories, objective/type pairs, difficulty, duplicates, encounter caps, reward allowlists.
- Record failures without secrets and keep fallback content playable.
- Never let a provider-specific SDK leak into application or domain code.

### UI changes

- Use [`@ui-sdk/react`](apps/web/AGENTS.md) interaction primitives, importing each part from its own entry point.
- Use `react-icons/gi` for game symbols. Every icon-only control needs an accessible name.
- Never optimistically show rewards. Show confirmed server state only.
- Show generation state separately from game-action state.
- Keep duplicate submissions disabled while a command is pending.

## 6. Documentation is part of the change

Whenever implementation changes, update the affected documentation in the same change:

1. Identify affected domain concepts, API contracts, data structures, prompts, configuration and workflows.
2. Update the relevant docs under `docs/`.
3. Update this file or an app `AGENTS.md` if commands, conventions or boundaries changed.
4. Add a new ADR when a material architectural decision changes. Do not rewrite an accepted ADR; supersede it.
5. Update prompt documentation and prompt/schema versions when prompt contracts change.
6. Update [`CHANGELOG.md`](CHANGELOG.md) for user-visible or operationally significant changes.
7. Include the documentation checklist in the completion summary.

## 7. Verification

Run from the repository root:

```bash
bun install
bun run typecheck
bun test
bun run lint
bun run build
bun run docs:check
```

For database work also run a migration against a fresh file:

```bash
DATABASE_PATH=/tmp/rpgo-migration-check.sqlite bun run migrate
```

For the full local loop:

```bash
bun run dev
# web: http://localhost:5173
# api: http://localhost:3001/api/health
```

## 8. Completion template

Report:

- What changed and why.
- Files and docs changed.
- Tests added or updated and the commands run.
- Migration or configuration impact.
- Any known limitation or follow-up.
- Confirmation that no secrets or debug artifacts were committed.
