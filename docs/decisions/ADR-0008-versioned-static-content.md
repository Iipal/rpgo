# ADR-0008 — Versioned static content with fail-fast reference validation

- **Status:** Accepted
- **Date:** 2026-11-19
- **Supersedes:** —

## Context

The MVP loaded `data/*.json` with TypeScript casts and `as` assertions. That was acceptable for two
regions and a small fallback set, but P2 introduces six regions, thirty locations, reciprocal region
and location graphs, region event/enemy allowlists and a chained access route. A typo in this data
could silently create an unreachable region, an invalid enemy reference or an event that can never
be generated.

## Decision

Authored definitions remain static JSON in `data/`, not database rows. They are validated at import:

- `packages/game-content/src/schemas.ts` defines Zod schemas for regions, locations, enemies,
  abilities and equipment.
- `data/regions.json` carries a `contentVersion`, and each region/location carries a stable `id`,
  `version` and `tags`.
- Region and location connections are reciprocal and validated.
- Every non-start region declares an `accessCondition` (`start` or `scout`), and validation requires
  a fallback event from the source region that targets the entry location.
- Regions declare event-type and enemy-family allowlists; generated events are checked against them.
- `findContentErrors` runs on import and throws on any cross-file reference failure.

Persisted rows continue to store player-specific discovery state, threat and event instances. Static
metadata such as tags and route definitions is read from content when building the world DTO.

## Consequences

- Invalid content fails at server start and in `tests/content-validation.test.ts`, not during play.
- Adding a region requires a schema-valid entry, reciprocal connections, a reachable access route and
  at least one fallback event for its entry location.
- Content changes are code changes: update the JSON, schemas, validator fixture and docs together.
- No migration is required for P2 because the database schema did not change.
- Definitions remain easy to review and diff in Git, at the cost of re-seeding a new world to see
  initial status changes. Persisted discoveries are never rewritten by content edits.

## Alternatives considered

- **Store definitions in SQLite tables.** Rejected for P2. It adds migrations and sync complexity
  without a gameplay need; definitions are versioned content, not mutable player state.
- **Validate only in tests.** Rejected. A production start should not serve a half-valid world.
- **Rely on TypeScript casts.** Rejected. `as` assertions do not check JSON at runtime and already hid
  missing references during the MVP.
- **Allow arbitrary region connections without a route event.** Rejected. It can create regions that
  are present in content but impossible to unlock.
