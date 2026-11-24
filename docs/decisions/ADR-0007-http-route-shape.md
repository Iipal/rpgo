# ADR-0007 — HTTP routes grouped by aggregate, with documented deviations from the MVP spec

- **Status:** Accepted
- **Date:** 2026-11-19
- **Supersedes:** —

## Context

`docs/MVP_RPG.md` §8 lists suggested routes (`/api/game/state`, `/api/party/rest`,
`/api/characters/:id/equip`, `/api/system/health`). The implementation groups commands by the
aggregate they change (`world`, `party`) and uses `POST` bodies for identifiers that are not part of
the resource path. The spec allows the exact route shape to change through an ADR, but no ADR
recorded the actual shape.

## Decision

The public HTTP surface is:

| Method | Route                     | Purpose                           |
| ------ | ------------------------- | --------------------------------- |
| GET    | `/api/health`             | API, database and model health    |
| GET    | `/api/system/diagnostics` | Extended diagnostics and fallback |
| GET    | `/api/game`               | Initial game read model           |
| GET    | `/api/world`              | Regions and locations             |
| GET    | `/api/party`              | Party, characters and inventory   |
| GET    | `/api/events`             | Event Board                       |
| GET    | `/api/events/:id`         | Event detail                      |
| POST   | `/api/events/:id/accept`  | Accept event                      |
| POST   | `/api/events/:id/start`   | Start current encounter           |
| POST   | `/api/events/:id/resolve` | Resolve current encounter         |
| POST   | `/api/world/discover`     | Discover a location               |
| POST   | `/api/world/rest`         | Recover the party (world-scoped)  |
| POST   | `/api/party/equip`        | Equip an owned item               |
| POST   | `/api/party/unequip`      | Unequip a slot                    |
| POST   | `/api/party/formation`    | Change a character's row          |
| GET    | `/api/journal`            | World and event history           |

Rules:

- Paths identify the aggregate under change; ids that only parameterise a command travel in the
  validated request body.
- `/api/health` is the cheap liveness/readiness probe; `/api/system/diagnostics` is the
  operator-facing view and may expose recent generation metadata but never secrets.
- The dev-only `/api/dev/generate-event` endpoint is disabled when `NODE_ENV=production`.

## Consequences

- Routes stay stable and are asserted by `tests/http.test.ts`.
- A future resource-oriented API would be a new ADR and a versioned surface, not a silent rename.
- Documentation must use the routes above; `docs/MVP_RPG.md` §8 remains the historical suggestion.

## Alternatives considered

- **Match the spec table literally.** Rejected: `/api/characters/:id/equip` would require a
  character-scoped route for an item that is owned by the party, and `/api/party/rest` would imply
  rest is not a world action.
- **A single `/api/command` endpoint.** Rejected: it hides the command surface and weakens typed
  validation and route-level authorization.
