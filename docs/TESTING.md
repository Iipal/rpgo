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

### Unit tests — `tests/game-rules.test.ts`

- Derived stats and equipment bonuses.
- XP thresholds, level-up overflow and level cap.
- Seeded RNG determinism and stable seed hashing.
- Discovery state transitions.
- Combat determinism for identical input and seed.
- Battle termination within the turn limit.
- No combatant acts after being defeated.
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

Integration tests use `openDatabase(":memory:")`, run the real migrations, seed the real world and drive the real `GameService` with `DisabledLlmProvider`.

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
- New schema or semantic rule → model-contract test.
- New migration → run from empty database and assert the new table/constraint exists.
- New UI flow → add a manual checklist step and keep authoritative logic server-side.

## 8. CI

`.github/workflows/ci.yml` installs with the lockfile, then runs typecheck, tests, lint, build and docs check. It does not start a model server. Keep CI deterministic and offline.
