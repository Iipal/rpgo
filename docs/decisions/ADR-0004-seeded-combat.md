# ADR-0004 — Seeded, automatic, immutable combat

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

Combat must feel like a real tactical outcome without requiring a tactical grid, manual control or a
model call on every turn. It must also be reproducible for debugging and safe to retry over HTTP.

## Decision

Combat is an automatic, turn-based simulation implemented as a pure function in
`packages/game-rules`:

- Input: party combatants from stored character state, enemy groups from known templates, ability
  definitions and a numeric seed.
- Turn order: speed descending, then stable combatant ID as a tiebreak.
- Behaviour presets make decisions from deterministic rules with persisted reason codes.
- Damage, healing, status effects, critical hits and cooldowns are resolved from seeded variance.
- The encounter seed is `hashSeed(eventId, encounterIndex, GAME_SEED)`.
- Default round limit is 30; no living party means defeat, no living enemies means victory, and a
  reached limit means draw.

The resolved battle is stored once in `battle_sessions`, unique on `(event_id, encounter_index)`.
Resolving an already-resolved encounter reads that row instead of simulating again.

No model is called during combat. The LLM never influences an outcome.

## Consequences

- The same state and seed always produce the same log, which makes bugs reproducible.
- A completed battle is immutable; retries cannot reroll a loss.
- Tests assert determinism, termination and no post-defeat actions.
- Partial defeat works naturally: cleared encounters stay completed, survivors keep HP and defeated
  characters are incapacitated.
- Balance changes require re-running seeded simulations rather than editing a single encounter.
