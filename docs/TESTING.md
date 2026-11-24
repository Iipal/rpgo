# Testing Strategy

## 1. Commands

```bash
bun test              # whole suite
bun test tests/game-rules.test.ts
bun run typecheck
bun run lint
bun run build
bun run docs:check
```

Tests use Bun's built-in runner. No test requires a live model server or the production database.

## 2. Layers

### Unit tests — `tests/game-rules.test.ts`, `tests/combat-status.test.ts`

- Derived stats and equipment bonuses.
- XP thresholds, level-up overflow and level cap.
- Seeded RNG determinism and stable seed hashing.
- Discovery state transitions, region derivation and threat thresholds.
- Combat determinism for identical input and seed.
- Battle termination within the turn limit.
- No combatant acts after being defeated.
- Poison ticks, defense debuffs and draw outcomes.
- Reward bands and rarity clamping.

### Integration tests — `tests/game-service.test.ts`

- Fresh seed creates a persisted world, four-member party, inventory, journal and mixed fallback board.
- Equipment ownership, equip persistence and rejection of unknown items.
- Rest cost, full recovery, cleared incapacitation and no world advance.
- Accept advances the world exactly once per operation; replay returns the same turn.
- Scout completion discovers a location and grants rewards once.
- Multi-encounter event: first victory persists when the second encounter fails.
- Temporary opportunity expiry by world turn.
- World action insertion is idempotent at the database boundary.
- Completed battles are immutable across retries and a rebuilt repository.
- Equipped items survive a rebuilt read model.
- Region threat rises after outcome thresholds are reached.
- Scouting the Ashen Gate unlocks the region; unknown regions reject discovery.

Integration tests use `openDatabase(":memory:")`, run the real migrations, seed the real world and drive the real `GameService` with `DisabledLlmProvider`. `tests/helpers.ts` also accepts a fake provider so orchestration can be tested without a model server.

### Static content tests — `tests/content-validation.test.ts`

- Zod schemas accept every authored region, location, enemy, ability and equipment definition.
- Six regions each have four to eight locations with tags and reciprocal location connections.
- Every non-start region has an explicit scout access condition and a matching fallback route event.
- Region connections are reciprocal.
- Duplicate IDs, missing route events and enemy families outside a region allowlist are rejected.
- The world read model exposes tags, dynamic route status and location adjacency.

### HTTP tests — `tests/http.test.ts`

- `{ data, correlationId }` envelope and correlation header echo.
- Event board and read-model routes.
- Malformed JSON and schema-invalid bodies return `INVALID_COMMAND`.
- Operation IDs are honoured through the `x-operation-id` header.
- Unknown routes and unknown events return typed `NOT_FOUND` errors.
- Diagnostics never expose API keys.

### Provider tests — `tests/generation-service.test.ts`

`FakeLlmProvider` in `tests/fake-provider.ts` scripts deterministic responses. Coverage:

- Success with recorded model, prompt/schema versions and correlation ID.
- Malformed JSON retried once, then accepted.
- Schema mismatch exhausting attempts.
- Timeout and unavailable providers recorded without throwing.
- Oversized or unrelated output capped and rejected.
- Disabled generation making no provider call.
- JSON wrapped in a Markdown fence.

### Model-contract tests — `tests/generation-validation.test.ts`

- Valid concept normalization (location, expiry).
- Unknown region, wrong category, impossible objective/type pair, locked region.
- Duplicate active title or storyline key.
- Difficulty clamping for low-level parties.
- Valid non-combat generated event.
- Unknown enemy template and unknown behavior rejection.
- Non-combat event with encounters rejected.
- Attack encounter cap.

These tests call the same `validateConcept` and `validateGenerated` functions used in production. They do not call a model.

### Generation fixture evaluation — `tests/fixtures/generation/cases.json`

`tests/generation-fixtures.test.ts` evaluates a versioned set of representative model payloads
through the real schema and semantic validation. Each case declares `kind`, `expect` and its raw
value. The suite asserts every expectation and prints total, accepted, rejected and acceptance
rate, which acts as a lightweight regression metric for prompt and schema changes.

Add a case whenever a prompt, schema or allowlist changes. Expected-reject cases are as valuable as
expected-accept cases and must not be deleted to make a model look better.

## 3. Determinism rules

- Never use `Math.random()` in combat, rewards, event seeds or content selection.
- Pass a seed into the RNG. Tiebreak turn order on stable IDs.
- Tests may use fixed operation IDs and `GAME_SEED=424242` through `tests/helpers.ts`.
- If a formula changes, add a precise numeric assertion rather than a broad range.
- A flaky deterministic test is a bug; fix the source of nondeterminism.

## 4. Database tests

- Each integration test opens a fresh `:memory:` database.
- `migrate()` runs every migration from an empty schema.
- Foreign keys are enabled, so cascade and reference bugs surface.
- Test empty-database migration separately with a file database:

```bash
rm -f /tmp/rpgo-migration-check.sqlite
DATABASE_PATH=/tmp/rpgo-migration-check.sqlite bun run migrate
```

## 5. Manual end-to-end checklist

Run `bun run dev` with the local model enabled, then:

1. Load the app; confirm world turn, gold, research and model chip render.
2. Open the World screen; confirm regions, locations, discovery states and rest.
3. Open the event board; confirm storyline and opportunity sections.
4. Open an event; confirm description, objectives, encounters, reward preview and recommended power.
5. Accept the event; confirm turn advances, board refreshes and no duplicate command occurs on double-click.
6. Fight an encounter; confirm pending state, battle report, action log and survivors.
7. Win a dungeon; confirm rewards appear only after the server confirms completion.
8. Reload; confirm the completed event and rewards did not replay.
9. Start a two-encounter dungeon, win the first, lose the second; confirm the first encounter stays cleared and no completion reward is granted.
10. Complete a scout event; confirm the target location becomes accessible.
11. Let an opportunity pass its expiry turn; confirm it disappears on board refresh.
12. Rest with low HP; confirm full recovery, 15 gold cost and unchanged turn.
13. Equip and unequip gear; confirm persistence after reload.
14. Stop the model server; refresh; confirm fallback status and continue playing.
15. Generate a development opportunity from Diagnostics; confirm validation or a clean failure.
16. Check diagnostics for model, prompt/schema version, latency and fallback status.
17. Confirm no API key is shown anywhere in the UI or logs.

## 6. Duplicate and failure scenarios

- Repeat the same accept/start/resolve operation ID: no second reward or turn.
- Refresh during a pending command: server state remains authoritative.
- Resolve an already-resolved encounter: stored report returned, no simulation.
- Send malformed JSON or unknown IDs: typed 4xx error, no state mutation.
- Disable the LLM: existing events and fallback posts still work.
- Return malformed model JSON: generation rejected, fallback event created.
- Use a model that ignores the schema: visible invalid generation, no half-valid event.

## 7. Adding tests

- New pure formula → unit test with exact values.
- New command → integration test for success, duplicate operation and invalid state.
- New schema or semantic rule → model-contract test and a fixture case.
- New provider or orchestration path → fake-provider test for success, malformed output, timeout and unavailable.
- New migration → run from empty database and assert the new table/constraint exists.
- New UI flow → add a manual checklist step and keep authoritative logic server-side.

## 8. Local verification

There is no hosted CI pipeline. Run the full gate locally before declaring work complete:

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run lint
bun run build
bun run docs:check
```

`bun run docs:check` validates required documentation files and internal Markdown links. No step requires a live model server; keep verification deterministic and offline.
