# ADR-0001 — Modular monolith with a deterministic rules core

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

The MVP is a single-player browser RPG that must run locally, stay debuggable and keep a local
language model from becoming the source of truth. We need a repository shape that a small team and
coding agents can reason about, without the operational cost of multiple deployables.

## Decision

Build one Bun process that serves a Hono API, one Vite-built React client and one SQLite file.
Separate the code into layers with a strict dependency direction:

```text
http → application → domain rules (packages/game-rules)
                   → infrastructure (SQLite, LLM HTTP)
```

- `packages/game-rules` stays pure TypeScript: no framework, database or network imports.
- `packages/contracts` owns shared Zod schemas and DTOs.
- `apps/server/src/application` coordinates use cases but never imports Hono.
- `apps/server/src/infrastructure` is the only layer with SQL and model wire formats.
- `apps/server/src/http` validates transport input and delegates.

The deterministic engine is authoritative for stats, combat, rewards, world time and persistence.

## Consequences

- Local development is a single command and a single database file.
- Rules can be unit-tested without a server or database.
- The model can be swapped or disabled without touching game rules.
- The client cannot compute authoritative outcomes because it never imports rules code as a source
  of truth.
- A future split into services would require extracting application boundaries; the layer rules make
  that mechanically possible but it is not a goal.
