# ADR-0003 — Action-based world turns

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

A single-player text RPG can advance time in two ways: wall-clock time or explicit player actions.
Wall-clock progression punishes players for closing the browser, creates background work and makes
expiry rules hard to test. It also conflicts with a slow local model that may take 20–60 seconds per
generation.

## Decision

World time advances only through a closed set of meaningful actions:

| Action                | Trigger                            |
| --------------------- | ---------------------------------- |
| `event_accepted`      | A contract is accepted.            |
| `event_completed`     | A non-research contract completes. |
| `event_failed`        | A contract ends in defeat or draw. |
| `location_discovered` | A location is charted directly.    |
| `research_completed`  | A research contract completes.     |

Each action inserts a `world_actions` row and increments `worlds.turn` inside the same transaction.
The row is unique on `(world_id, action_type, operation_id)`, so a retried command cannot add a
second turn.

Viewing screens, changing tabs, opening dialogs, equipping, changing formation, resting and
reloading never advance time. Opportunity expiry is expressed in world turns: an opportunity created
on turn `T` with `expiresInWorldTurns = N` expires once the turn is greater than `T + N`.

## Consequences

- Closing the browser changes nothing; no scheduler or background job is needed.
- Expiry and board refresh are deterministic and testable.
- Multi-encounter events advance time once at the event outcome, not per encounter.
- Tests can assert exact turn counts for every command.
- The design intentionally excludes real-time cooldowns, energy regenerating over wall-clock time
  and scheduled world simulation.
