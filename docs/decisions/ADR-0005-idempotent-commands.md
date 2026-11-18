# ADR-0005 — Idempotent commands with operation IDs and receipts

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

A player can double-click, retry after a timeout or refresh during a slow request. A local model can
make a board refresh take tens of seconds, which increases the chance of a duplicated command. Some
commands grant rewards or advance world time, so duplication is not cosmetic.

## Decision

Every state-changing command carries an operation ID, either in the body or the `x-operation-id`
header. The server derives one when absent, but the web client always supplies and reuses one for the
same logical action.

Idempotency is layered:

| Layer       | Mechanism                                                                                |
| ----------- | ---------------------------------------------------------------------------------------- |
| Application | `command_receipts(operation_id, command)` replays the prior result with fresh read data. |
| World       | `world_actions` unique on `(world_id, action_type, operation_id)`.                       |
| Rewards     | `resource_transactions.grant_key` unique with `INSERT OR IGNORE`.                        |
| Combat      | `battle_sessions` unique on `(event_id, encounter_index)`.                               |

Application checks run first; database constraints are the final defense. Receipts are written
inside the command transaction and refreshed after post-transaction board or narrative work.

The client clears an operation ID only after a successful response. A new intent gets a new ID.

## Consequences

- Retries and double submissions cannot double-grant rewards or double-advance time.
- Commands are safe to retry without special-case client logic.
- Every new mutating use case must define its receipt or unique key and test the duplicate case.
- The database schema becomes part of the correctness contract, not just storage.
