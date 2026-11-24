# Production Baseline

> **Purpose:** Record the verified MVP baseline and the P1 audit that starts production work.
> **Status:** MVP verified; P2 content expansion in progress.
> **Last updated:** 2026-11-19.

This document is the P1 deliverable required by [`RPG_IMPLEMENTATION.md`](RPG_IMPLEMENTATION.md).
It records what exists, what was verified, what is intentionally deferred, and how production
milestones depend on each other.

## 1. Baseline record

| Item                          | Value                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Application version           | `0.1.0`                                                                                          |
| MVP implementation commit     | `30c837b57f430be686acdae99ff121a6498c5e24` (`30c837b yes`)                                       |
| Working tree                  | MVP hardening present as uncommitted changes; not treated as a release tag                       |
| SQLite schema version         | `0001_init.sql`                                                                                  |
| Static content version        | MVP shipped 2 regions and 5 locations without a version field; P2 introduces `contentVersion: 2` |
| Combat rules                  | Seeded, deterministic, turn limit 30                                                             |
| Event Director prompt         | `event-director@1` / `EventConcept@1`                                                            |
| Event Generator prompt        | `event-generator@1` / `GeneratedEvent@1`                                                         |
| Narrative Generator prompt    | `narrative-generator@1` / `NarrativeResponse@1`                                                  |
| Runtime                       | Bun `1.4.2`                                                                                      |
| Default model                 | `qwen3.5-2b-instruct` at `http://127.0.0.1:8080/v1` (configurable, never hard-coded in logic)    |
| Default LLM timeout / retries | `15000 ms` / `1` (clamped 0–2)                                                                   |

### 1.1 Dependency snapshot

| Package                          | Version         |
| -------------------------------- | --------------- |
| React                            | `19.3.1`        |
| Vite                             | `8.3.8`         |
| TypeScript                       | `5.9.3`         |
| Hono                             | `4.13.19`       |
| Zod                              | `3.25.76`       |
| `@ui-sdk/react` / `@ui-sdk/core` | `0.1.0-beta.10` |
| `react-icons`                    | `5.7.0`         |
| Biome                            | `2.6.8`         |

Dependency versions are resolved from `bun.lock`; update this table when a production milestone
changes a pinned version.

## 2. Verified MVP regression baseline

Run from a clean checkout with Bun 1.2+:

| Check                           | Result                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | passed, 118 installs, no changes                                                                                                        |
| `bun run typecheck`             | passed                                                                                                                                  |
| `bun test`                      | 65 tests passed across 10 files (59 MVP + 6 P2 content tests)                                                                           |
| `bun run lint`                  | passed                                                                                                                                  |
| `bun run build`                 | passed                                                                                                                                  |
| `bun run docs:check`            | passed                                                                                                                                  |
| Fresh migration                 | `0001_init.sql` applied to an empty file                                                                                                |
| Seed                            | 1 player, 1 world, 1 party, 4 characters, initial events created                                                                        |
| Backup / restore                | `sqlite3 .backup`-equivalent copy restored; `PRAGMA integrity_check` returned `ok`; regions, locations, events and characters preserved |
| LLM disabled                    | suite exercises disabled provider and deterministic fallback                                                                            |
| Duplicate commands              | HTTP and service tests replay `command_receipts` without duplicate rewards or turns                                                     |
| Battle reload                   | completed battle is returned from storage and cannot be re-simulated                                                                    |

The manual LLM-online playtest still depends on a locally running inference server. The application
is verified to work without one.

## 3. MVP capability audit

| Area                                         | State        | Notes                                                                                               |
| -------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Monorepo, contracts, rules, content packages | Done         | Bun workspaces, Biome, TypeScript project references via root tsconfig                              |
| World, party, inventory, equipment           | Done         | SQLite migrations, seeded starter party, equip/unequip/formation                                    |
| Deterministic combat                         | Done         | Seeded RNG, speed order, crits, healing, poison, defense buffs/debuffs, draw limit                  |
| Event lifecycle                              | Done         | Accept, start, resolve, objectives, partial defeat, rewards, rest                                   |
| Action-based world                           | Done         | Explicit advancing actions, idempotent world actions, region discovery, threat recomputation        |
| Event Board                                  | Done         | Storyline/opportunity mix, expiry by world turn, deterministic fallback, non-blocking model refresh |
| LLM provider                                 | Done         | OpenAI-compatible client, disabled provider, timeout, retry, size cap, health                       |
| Generation                                   | Done         | Director, Generator, Narrative; Zod plus semantic validation; metadata; fixtures                    |
| Narrative                                    | Done         | Teaser, introduction, discovery, victory and defeat; authored fallback always remains               |
| Diagnostics                                  | Done         | Health and recent generations; no secrets                                                           |
| Documentation workflow                       | Done         | Root/app `AGENTS.md`, ADRs, docs checker, completion template                                       |
| CI / release tag                             | Not required | The full gate is local by project decision                                                          |

## 4. P1 production gap analysis

The MVP deliberately deferred these areas. They are production work, not MVP regressions.

| Production area    | Current gap                                                                      | Milestone |
| ------------------ | -------------------------------------------------------------------------------- | --------- |
| World breadth      | Six regions after P2, but only fallback events and simple discovery routes exist | P2, P3    |
| Threats            | Region threat is an aggregate number; no persistent threat entities or stages    | P3        |
| World facts        | No durable fact records; context is rebuilt from rows                            | P3        |
| Storylines         | `storyline_key` only; no stages, branches or persisted progress                  | P4        |
| Event objectives   | Three objective kinds; no boss, protect, survive or investigate mechanics        | P5        |
| Combat depth       | Four enemy behaviors; no boss phases, resistances or encounter modifiers         | P6        |
| Progression        | XP and automatic attribute growth only; no research tree or ability upgrades     | P7        |
| Loot/economy       | Fixed equipment definitions and gold; no affixes, upgrades or loot tables        | P8        |
| World Director     | Not implemented; deterministic rules and fallback content only                   | P9        |
| Generation jobs    | Background promises, no durable queue or restart recovery                        | P10       |
| Frontend           | MVP screens only; no filters, research, threat or storyline views                | P11       |
| Save management    | Manual file copy; no export/import or save-format version                        | P12       |
| Content production | Small authored set; no continuity summaries or content inspector                 | P13       |
| Release hardening  | No release notes, profiling or formal support process                            | P14       |

### 4.1 Known limitations carried forward

- One party and one local player; no accounts or multiplayer.
- No movement, pathfinding or tactical grid.
- Storyline stages are not persisted yet.
- Threat level is computed and displayed but does not yet alter content selection or combat.
- The LLM is optional; generation quality depends on the configured local model.
- Narrative generation runs in the background, so text can appear after the command response.
- No hosted CI and no release tag by project decision.

## 5. Production dependency graph

```text
P2 Content model and regions
  ├── P3 Threats, facts and consequences
  │     └── P4 Storylines and branches
  │           └── P5 Advanced objectives and encounters
  │                 └── P6 Combat depth and bosses
  ├── P7 Character progression and research
  │     └── P8 Loot and economy
  ├── P9 LLM World Director
  │     └── P10 Generation jobs and evaluation
  ├── P11 Frontend completion
  ├── P12 Save management and hardening
  └── P13 Content production
              └── P14 Production readiness
```

P2 is the first production milestone because every later content, threat, storyline and generation
feature needs stable content IDs, region metadata and validated references.

## 6. P2 status

P2 is implemented in this change:

- Region and location definitions are validated with Zod at import time.
- Regions and locations carry stable IDs, versions and tags.
- Six regions and thirty locations exist, with reciprocal region and location connections.
- Every non-start region declares an explicit scout access condition, and the validator requires a
  fallback event that reaches its entry location.
- Regions declare event-type and enemy-family allowlists; generated events are checked against them.
- The world read model exposes region tags, dynamic route status and location adjacency.
- The World screen shows routes, known/unknown states and location metadata, and allows charting in
  a discovered-but-not-yet-accessible region.
- Authored content has cross-reference validation and a dedicated test suite.

P2 does not yet add persistent threats, world facts or storyline stages; those remain P3 and P4.
