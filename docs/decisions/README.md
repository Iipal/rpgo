# Architecture Decision Records

An ADR records a decision that is expensive to reverse or that constrains future work. Accepted ADRs
are historical records. To change a decision, add a new ADR and mark the old one as superseded.

| ADR                                          | Title                                                            | Status   |
| -------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](ADR-0001-modular-monolith.md)         | Modular monolith with a deterministic rules core                 | Accepted |
| [0002](ADR-0002-llm-as-content-proposer.md)  | The LLM proposes content; the engine decides                     | Accepted |
| [0003](ADR-0003-action-based-world-turns.md) | Action-based world turns                                         | Accepted |
| [0004](ADR-0004-seeded-combat.md)            | Seeded, automatic, immutable combat                              | Accepted |
| [0005](ADR-0005-idempotent-commands.md)      | Idempotent commands with operation IDs and receipts              | Accepted |
| [0006](ADR-0006-sqlite-migrations.md)        | SQLite with ordered SQL migrations and a hand-written repository | Accepted |

## Template

```markdown
# ADR-000N — Title

- **Status:** Proposed | Accepted | Superseded by ADR-000M
- **Date:** YYYY-MM-DD
- **Supersedes:** ADR-000X or —

## Context

What forces are at play? What constraints and options exist?

## Decision

What we will do, stated in the present tense.

## Consequences

What becomes easier, what becomes harder, and what is now explicitly out of scope.
```
