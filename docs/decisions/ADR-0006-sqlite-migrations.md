# ADR-0006 — SQLite with ordered SQL migrations and a hand-written repository

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

The MVP is local and single-player. It needs durable relational state, transactional reward grants,
unique constraints for idempotency and a backup story that a single person can operate. Options were
an embedded ORM, a document store or direct SQLite access.

## Decision

Use SQLite in WAL mode with:

- Ordered, numbered SQL files in `migrations/` applied by a small runner and recorded in
  `schema_migrations`.
- Foreign keys enabled, check constraints on enum-like columns and indexes on hot read paths.
- One hand-written repository (`infrastructure/database/repository.ts`) that owns every SQL
  statement, transaction and row mapping.
- Row-to-DTO mapping isolated in `application/mappers.ts`.
- `openDatabase(path)` supports `:memory:` for integration tests.

Migrations are append-only: an applied migration is never edited. Schema changes add a new file and
are tested from an empty database.

## Consequences

- The whole dataset is one file that can be copied or backed up with `sqlite3 .backup`.
- Unique constraints encode idempotency guarantees that application code cannot accidentally bypass.
- Direct SQL keeps behaviour explicit and dependency-free, at the cost of boilerplate mapping code.
- Tests run the real migrations against `:memory:`, so schema drift is caught immediately.
- No ORM migration tooling is required; the trade-off is that schema changes are manual and must be
  reviewed carefully.
