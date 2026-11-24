# Data Model

SQLite is the only persistence store. Migrations live in `migrations/` and are applied in filename order. Foreign keys are enabled. Timestamps are UTC ISO strings. World turn is an integer.

## 1. Entity overview

```text
players 1──1 worlds 1──* regions 1──* locations
                  │
                  ├──1 parties 1──* characters 1──* character_equipment
                  │                     │
                  │                     └── inventory_items (owned by party)
                  ├──* events 1──* event_objectives
                  │          1──* event_encounters 1──1 battle_sessions
                  │                                    1──* battle_actions
                  ├──* world_actions
                  ├──* journal_entries
                  └──* resource_transactions

llm_generations 1──* events (nullable generation_id)
command_receipts (standalone idempotency records)
```

## 2. Tables

### `players`

One local player. Fields: `id`, `name`, `gold`, `research_points`, `created_at`.

### `worlds`

One world per player in the MVP. Fields: `id`, `player_id`, `turn`, `current_region_id`, timestamps.

### `regions`

Fields: `id`, `world_id`, `name`, `description`, `level_min`, `level_max`, `status`, `threat_level`, `sort_order`. Status is constrained to discovery states.

`threat_level` is recomputed (not incremented in place) from the region's completed and failed
events: `min(10, baseThreat + floor(completed / 3) + floor(failed / 2))`. The base value comes from
`data/regions.json`, so restoring a database and replaying the formula is safe.

### `locations`

Fields: `id`, `region_id`, `name`, `description`, `status`, `discovered_turn`, `sort_order`. Location IDs are stable content IDs used by generation allowlists.

### `parties`

Fields: `id`, `world_id`, `name`, `created_at`.

### `characters`

Fields: `id`, `party_id`, `name`, `archetype`, `level`, `experience`, `strength`, `agility`, `intelligence`, `vitality`, `health`, `mana`, `incapacitated`, `ability_ids_json`, `combat_behavior_id`, `formation`, `created_at`.

Vitals are stored separately from derived maxima. Equipment bonuses affect maxima and are recomputed on read.

### `inventory_items`

Owned item instances. Fields: `id`, `party_id`, `definition_id`, `name`, `slot`, `rarity`, `description`, `bonuses_json`, `equipped_by`, `acquired_turn`, `created_at`.

An item instance belongs to the party. `definition_id` points at static content in `data/equipment.json`; stats are copied into the instance at acquisition so content changes do not rewrite history.

### `character_equipment`

Maps a character slot to an inventory instance. Fields: `character_id`, `equip_slot`, plus inventory reference. One row per slot. Equipping first clears the slot and then writes the new mapping in one transaction.

### `events`

Fields: `id`, `world_id`, `type`, `category`, `title`, `hook`, `description`, `introduction`, `status`, `difficulty_band`, `region_id`, `location_id`, `objective_kind`, `reward_intent_json`, `reward_preview_json`, `completion_text`, `failure_text`, `result_text`, `source`, `expires_on_turn`, `storyline_key`, `created_turn`, `current_encounter_index`, `encounters_completed`, `accepted_turn`, `completed_turn`, `generation_id`, `created_at`.

`source` distinguishes `generated`, `fallback` and `authored`. `generation_id` links accepted content to its generation metadata. Active and available events are the visible board.

### `event_objectives`

Fields: `id`, `event_id`, `position`, `kind`, `description`, `target_count`, `target_ref`, `progress`, `completed`. `target_ref` is a location ID for discovery objectives.

### `event_encounters`

Fields: `id`, `event_id`, `position`, `title`, `description`, `enemies_json`, `status`. `enemies_json` stores groups of `{ templateId, count, behaviorId }`; stats are derived by the engine at resolution time.

### `battle_sessions`

Fields: `id`, `event_id`, `encounter_index`, `seed`, `outcome`, `rounds`, `party_result_json`, `enemy_result_json`, `action_log_json`, `operation_id`, `created_at`.

Unique on `(event_id, encounter_index)` so a completed encounter is immutable.

### `battle_actions`

One row per logged action, linked to a battle. Used for audit and debugging; the UI renders the canonical log stored in `battle_sessions.action_log_json`.

### `world_actions`

Fields: `id`, `world_id`, `action_type`, `operation_id`, `turn`, `detail_json`, `created_at`.

Unique on `(world_id, action_type, operation_id)`. A row means that action already advanced the world for that operation.

### `resource_transactions`

Fields: `id`, `player_id`, `grant_key`, `kind`, `amount`, `detail_json`, `turn`, `created_at`.

Unique on `grant_key`. Reward grants use `INSERT OR IGNORE`; rest also records a negative gold transaction with a unique key.

### `llm_generations`

Fields: `id`, `task`, `model`, `prompt_version`, `schema_version`, `status`, `error_code`, `latency_ms`, input/output token counts, `response_text` (only when `LLM_DEBUG=true`), `correlation_id`, `created_at`.

Statuses: `success`, `invalid`, `timeout`, `unavailable`, `refused`.

### `journal_entries`

Fields: `id`, `world_id`, `turn`, `kind`, `title`, `detail`, `created_at`. Read-only history shown in the Journal screen.

### `command_receipts`

Fields: `operation_id`, `command`, `result_json`, `created_at`. Primary key `(operation_id, command)`.

A repeated command returns the stored result with fresh read data. Receipts are written inside the command transaction and refreshed after post-transaction board/narrative work.

## 3. Constraints and indexes

- Foreign keys with `ON DELETE CASCADE` for child rows.
- Check constraints on enum-like columns (`status`, `archetype`, `slot`, `rarity`, `formation`).
- Unique world action and grant keys.
- Unique battle per event encounter.
- Indexes on world events, event children, inventory, journal and generation time.

## 4. Idempotency summary

| Operation                                | Key                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| Accept/start/resolve/rest/discover/equip | `command_receipts(operation_id, command)`            |
| World advancement                        | `world_actions(world_id, action_type, operation_id)` |
| Reward grant                             | `resource_transactions(grant_key)`                   |
| Battle result                            | `battle_sessions(event_id, encounter_index)`         |

Application checks are the first defense; database constraints are the final defense.

## 5. Static content definitions

Authored content is not stored in SQLite as definitions. `data/*.json` is the source of truth and is
loaded by `packages/game-content` at import time.

- `data/regions.json` has a `contentVersion` and a `regions` array.
- Each region has a stable `id`, `version`, `tags`, level range, threat base, `eventTypes`,
  `enemyFamilies`, `accessCondition`, reciprocal region `connections`, and four to eight locations.
- Each location has a stable `id`, `version`, `tags`, reciprocal location `connections` and a
  discovery status.
- `data/enemies.json` gives every enemy a stable `id` and `family`; regions allowlist families.
- `packages/game-content/src/schemas.ts` validates each file with Zod.
- `findContentErrors` checks cross-file references: duplicate IDs, reciprocal connections, access
  conditions, route events, enemy families, abilities, equipment and fallback content.
- Invalid authored content throws at import time rather than producing a partially broken world.

Persisted rows still copy display names and instance data where history must remain stable (for
example inventory bonuses). Changing a definition does not rewrite historical instances.

## 6. Migration policy

- Add a new numbered file; never edit an applied migration.
- Run from an empty database in tests.
- Back up the SQLite file before applying migrations in a shared environment.
- `schema_migrations` records each applied filename and timestamp.

## 7. Deletion and retention

The MVP has no user deletion flow. For local reset, stop the server, back up the database, then remove `data/rpgo.sqlite` (and `-wal`/`-shm`). The next start reseeds a fresh world.

Generation records are retained for diagnostics. Raw response text is stored only when explicitly enabled and must never contain secrets.
