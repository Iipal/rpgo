# Game Design

This document is the source of truth for player-facing rules through the P2 content expansion. When
a formula or rule changes, update this file and the corresponding pure rule in
`packages/game-rules`.

## 1. The loop

1. View the world and event board.
2. Choose an available contract.
3. Review objectives, encounters, recommended power and reward preview.
4. Accept it. The world advances one turn and the board refreshes.
5. Fight each encounter automatically, or complete a field objective.
6. Receive victory, partial defeat or failure.
7. Rewards are granted only on confirmed completion, exactly once.
8. The world advances on completion or failure.
9. Rest, equip, chart routes and repeat.

There is no real-time progression. Closing the browser changes nothing.

## 2. World

Six regions ship in the P2 content model:

| Region       | Levels | Theme                                 | Entry condition                             |
| ------------ | ------ | ------------------------------------- | ------------------------------------------- |
| Greenreach   | 1–3    | Starter frontier, woods and old roads | Starting region                             |
| Ashen March  | 3–6    | Burned frontier, ruins and ash        | Scout from Greenreach to the Ashen Gate     |
| Frostmere    | 5–8    | Cold lake country and drowned barrows | Scout from Ashen March to Frostmere Shore   |
| Sunken Coast | 7–10   | Drowned harbours and salt marsh       | Scout from Frostmere to Tidewreck Harbor    |
| Emberdeep    | 9–12   | Volcanic forges and cinder markets    | Scout from Sunken Coast to the Ember Gate   |
| Hollow Crown | 11–15  | Glass fields and an empty throne      | Scout from Emberdeep to the Crown Threshold |

Each region has four to eight locations. Every non-start region declares an explicit scout access
condition, and authored content validation requires a fallback event from the previous region that
targets its entry location. The world remains a graph; there is no pathfinding or movement
simulation.

A region contains locations. Locations have one of three discovery states:

| State        | Meaning                                            |
| ------------ | -------------------------------------------------- |
| `unknown`    | Not charted.                                       |
| `discovered` | Known by name or rumour; not yet safely reachable. |
| `accessible` | Open to the company.                               |

Discovery only moves forward. The `discover` command advances a location one step and costs a world turn. A scout event can also advance its target location.

A region's status is derived from its locations: accessible if any location is accessible,
discovered if any location is known, otherwise unknown. Charting a location in a new region is what
unlocks it. A scout contract from the previous region reveals the next region's entry location; the
player then charts that location to make the region accessible. Once open, authored attack
opportunities and generated contracts can use the region.

Regions declare an event-type allowlist and an enemy-family allowlist. Generated concepts must use
an allowed event type, and generated encounters must draw enemies from families allowed in that
region. Authored content is validated at import time, so a broken connection, missing route event or
disallowed enemy fails fast instead of producing an unreachable region.

There is no movement simulation or pathfinding. The world is a set of regions, locations and
connectivity data. Region and location connections are reciprocal and are shown in the world read
model.

### 2.1 Threat

Each region has a threat level between 1 and 10. It is recomputed after a contract completes or
fails:

```text
threat = min(10, baseThreat + floor(completedEvents / 3) + floor(failedEvents / 2))
```

The count is per region and includes the outcome just recorded. Recomputation is idempotent, so a
retried command cannot raise threat twice. Threat is displayed in the world read model and is
intended to drive harder content bands in later milestones; it does not alter combat maths in the
MVP.

## 3. World turns

World time advances only for explicitly defined meaningful actions:

| Action                | When                                                      |
| --------------------- | --------------------------------------------------------- |
| `event_accepted`      | A contract is accepted.                                   |
| `event_completed`     | A non-research contract reaches its completion condition. |
| `event_failed`        | A contract ends in defeat or draw.                        |
| `location_discovered` | A location is charted directly.                           |
| `research_completed`  | A research contract is completed.                         |

Viewing screens, opening dialogs, changing tabs, equipping, unequipping, changing formation, resting, refreshing the page and retrying a command receipt never advance time.

A multi-encounter event advances time once per event-level outcome, not once per encounter. The world action table has a unique constraint on `(world_id, action_type, operation_id)`, so a retried command cannot add a second turn.

## 4. Party

One party, up to four characters. Starter archetypes:

| Archetype | Role            | Base attributes (STR/AGI/INT/VIT) | Growth per level  |
| --------- | --------------- | --------------------------------- | ----------------- |
| Warrior   | Frontline tank  | 8 / 4 / 2 / 8                     | +2 / +1 / 0 / +2  |
| Ranger    | Physical damage | 5 / 8 / 3 / 5                     | +1 / +2 / 0 / +1  |
| Mage      | Magic damage    | 3 / 4 / 9 / 4                     | +0 / +1 / +2 / +1 |
| Cleric    | Support         | 4 / 4 / 6 / 6                     | +1 / +1 / +1 / +2 |

Characters have level, experience, four attributes, health, mana, three equipment slots, abilities and a preset combat behavior. There is no talent tree or respec in the MVP.

### 4.1 Derived stats

With attributes `STR`, `AGI`, `INT`, `VIT`, level `L`, and summed equipment bonuses `b`:

```text
maxHealth   = 30 + VIT × 6 + L × 4 + b.health
maxMana     = 10 + INT × 4 + L × 2 + b.mana
attack      = STR × 2 + L + b.attack
magicAttack = INT × 2 + L + b.magicAttack
defense     = floor(VIT × 1.2 + L) + b.defense
speed       = AGI × 2 + L + b.speed
critChance  = clamp(0.05 + AGI × 0.01 + b.critChance, 0.05, 0.50)
```

Character power is:

```text
attack + magicAttack + defense + speed + floor(maxHealth / 4) + floor(maxMana / 4)
```

Party power is the sum of member power.

### 4.2 Experience and levels

```text
xpToNextLevel(L) = 60 + (L − 1) × 40
```

Experience is per character and is applied on event completion. A level-up consumes the threshold and rolls overflow into the next level. Maximum level is 20. On level-up, attributes grow by the archetype growth row.

### 4.3 Formation

Two rows: front and back.

- Melee attacks prefer front-row targets when a valid front-row target exists.
- Ranged and magical attacks follow their ability targeting rules.
- Formation is a combat rule, not a spatial simulation.
- Changing formation is a free administrative action and never advances the world.

### 4.4 Incapacitation and rest

At 0 HP a character is incapacitated and cannot act. They are skipped by combatant construction until restored.

Rest costs **15 gold** and restores every party member to full health and mana, clears incapacitation, records a journal entry and **does not** advance the world. If gold is insufficient, the command is rejected.

## 5. Combat

Combat is automatic, turn-based and deterministic given the same initial state and seed.

### 5.1 Initialization

- Party combatants come from living, non-incapacitated characters with current HP, derived stats, abilities and formation.
- Enemy combatants come from known templates. Enemy stats are derived from the template and scaled by party level and difficulty band:

```text
easy   × 0.82
normal × 1.00
hard   × 1.25
```

- The encounter seed is `hashSeed(eventId, encounterIndex, GAME_SEED)`.
- Turn order is speed descending; ties break on stable combatant ID.

### 5.2 Damage and healing

For an ability with power `P`, attacker offense `A` (physical attack or magic attack), effective defense `D`, and seeded variance `v ∈ [0.9, 1.1]`:

```text
mitigation = D × (0.6 for physical, 0.3 for magic)
raw        = A × P × v − mitigation
damage     = max(1, round(raw × (critical ? 1.5 : 1)))
```

Critical chance is rolled per attack using the attacker's crit chance. Healing is deterministic from the ability's heal power and magic attack, with the same seeded variance policy where applicable.

Status effects:

- **Poison** deals fixed damage at the start of the affected combatant's turn for a limited number of rounds.
- **Defense up** increases effective defense by a percentage for a number of rounds.
- **Defense down** decreases effective defense by a percentage for a number of rounds.

Cooldowns are tracked per ability per combatant.

### 5.3 Termination

The battle ends when one side has no living combatants or the round limit is reached.

```text
party alive = 0        → defeat
enemies alive = 0      → victory
round limit reached    → draw
```

Default round limit: **30**.

Every action is logged with round, actor, action, targets, type, amount, critical flag, reason code and readable text. Logs are persisted with the battle.

### 5.4 Behavior presets

No model is called during combat.

| Preset           | Priority                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| Warrior          | Guard when own HP is low or a backline ally is threatened; otherwise attack.            |
| Ranger           | Target low-health or vulnerable enemies; use a special shot when available.             |
| Mage             | Use area damage when two or more enemies live; otherwise single-target magic or attack. |
| Cleric           | Heal the most injured ally under threshold; otherwise buff defense; otherwise attack.   |
| Enemy brute      | Heavy attack when available; otherwise basic attack.                                    |
| Enemy skirmisher | Focus the weakest valid target.                                                         |
| Enemy caster     | Use its spell; otherwise attack.                                                        |
| Enemy support    | Heal a wounded ally; otherwise attack.                                                  |

Reason codes are persisted in the log for debugging.

## 6. Events

### 6.1 Types

| Type     | Purpose                       | Typical reward emphasis    |
| -------- | ----------------------------- | -------------------------- |
| Dungeon  | Multi-encounter challenge     | Gold and equipment         |
| Scout    | Explore and discover          | XP, discovery, modest gold |
| Research | Complete a research objective | Research points            |
| Attack   | Defend or assault a target    | Gold and rare equipment    |

### 6.2 Categories and status

- **Storyline** — persistent until completed, failed or explicitly invalidated.
- **Opportunity** — expires after its world-turn window.

Statuses: `available`, `active`, `completed`, `failed`, `expired`.

### 6.3 Objectives

- `defeat_enemies` — progress advances per cleared encounter; target count equals encounter count for generated content.
- `discover_location` — completes when the target location advances one discovery step.
- `complete_research` — completes on resolution; grants research points.

### 6.4 Board

- Maximum four visible events (`available` + `active`).
- Aim for at least one storyline and one opportunity.
- Storyline events are not removed by opportunity refresh.
- Opportunities expire by world turn, never wall-clock time.
- Active events are not regenerated or overwritten.
- Fewer than four events is acceptable if generation fails.
- Board refresh happens after meaningful world actions. It never blocks the command response: when
  generation is disabled the board is filled synchronously from fallback definitions; when enabled,
  model-backed generation and narrative enrichment run in the background with per-event fallback.
- Temporary opportunities may target a location that is discovered but not yet accessible, which
  gives the player a reason to use the `discover` command.

### 6.5 Expiry policy

For an opportunity created on turn `T` with `expiresInWorldTurns = N` (default 4):

```text
expiresOnTurn = T + N
```

The opportunity is expired when the current world turn becomes greater than `expiresOnTurn`. The UI phrases this as “Expires after turn N”. This gives the player turns `T` through `T + N` inclusive.

### 6.6 Encounters and partial defeat

Dungeons have at most two encounters; attacks at most one; scouts and research have none.

On victory:

- Encounter is marked completed.
- Party HP and mana are written back.
- Objective progress advances.
- If it was the last encounter, the event completes, the world advances, and rewards are granted once.

On defeat or draw:

- The current encounter is marked failed.
- The event is marked failed.
- The world advances with `event_failed`.
- No completion rewards are granted.
- Previously cleared encounters remain completed.
- Survivors keep remaining HP; defeated characters are incapacitated.
- Consumed resources remain consumed.

### 6.7 Narrative

Short model-written text is optional flavour for board teasers, event introductions, discovery
notifications and victory/defeat results. Narrative is generated in the background after the
authoritative state change and stored on the event or in the journal. If generation is disabled,
times out or fails validation, deterministic authored text remains in place and nothing about the
action changes.

## 7. Rewards

Reward intents are categories, not amounts. The engine computes amounts from difficulty and event type.

```text
goldBase     = easy 30 / normal 55 / hard 95
xpBase       = easy 25 / normal 45 / hard 75
researchBase = easy 8 / normal 14 / hard 22
```

Multipliers:

| Type     | Gold | XP  |
| -------- | ---- | --- |
| Dungeon  | 1.4  | 0.9 |
| Scout    | 0.7  | 1.0 |
| Research | 0.5  | 0.8 |
| Attack   | 1.2  | 1.0 |

Dungeons and attacks always include gold and XP. Scouts always include XP. Research always includes research points. Equipment count is at most one for easy/normal and two for hard.

Rarity is clamped:

- easy → common
- normal → rare becomes uncommon
- hard → common becomes uncommon

All grants are inside one transaction. Stable grant keys prevent duplicates:

```text
<eventId>:gold
<eventId>:research
<eventId>:equipment:<index>
<eventId>:xp:<characterId>
```

## 8. Difficulty

Recommended party power is a multiple of current party power:

| Band   | Recommended power  |
| ------ | ------------------ |
| Easy   | 0.70 × party power |
| Normal | 0.95 × party power |
| Hard   | 1.25 × party power |

Hard content requires party level 2 or higher; otherwise the model's band is clamped to normal. Enemy stats scale with party level and band as described above.

The UI labels the comparison as favourable, even or risky. The server remains authoritative.

## 9. Explicit non-goals

No multiplayer, real-time world, multiple parties, tactical grid, manual combat, pathfinding, complex crafting, trading economy, faction diplomacy, permadeath, LLM-defined formulas, cloud LLM requirement, microservices or event sourcing.

## 10. Balance and content notes

- `data/enemies.json` defines twelve enemies across four behavior archetypes.
- `data/abilities.json` defines thirteen abilities including basic attacks, heavy attacks, area magic, healing, poison, defense up and defense down.
- `data/equipment.json` defines fourteen items across three slots and three rarities.
- Fallback events guarantee at least one playable contract of each major type.
- Balance should be tuned through repeatable seeded simulations, not by changing one manual encounter.
