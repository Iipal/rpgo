# Domain Glossary

| Term                              | Meaning                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Action (world action)**         | A meaningful player command that may advance world time. Persisted in `world_actions`.                                    |
| **Adventurer / character**        | A member of the party. Has attributes, level, equipment, abilities and a combat preset.                                   |
| **Archetype**                     | Warrior, Ranger, Mage or Cleric. Determines base attributes, growth and preset behavior.                                  |
| **Battle / encounter resolution** | One automatic, seeded combat simulation between the party and an encounter's enemies.                                     |
| **Battle report**                 | The immutable stored result of a battle: outcome, rounds, seed, survivors and action log.                                 |
| **Board**                         | The visible set of available and active events, capped at four.                                                           |
| **Command**                       | A state-changing API operation with an operation ID and, where replay matters, a receipt.                                 |
| **Concept**                       | An Event Director proposal: type, category, title, hook, region, difficulty and objective kind. Not yet a playable event. |
| **Contract / event**              | A playable posting with objectives, encounters, reward preview and completion/failure text.                               |
| **Difficulty band**               | Easy, normal or hard. Controls enemy scaling, recommended power and reward bands.                                         |
| **Access condition**              | How a region becomes known: the starting region or a scout route from an earlier region to an entry location.             |
| **Content version**               | Version of the authored `data/regions.json` content set. Separate from application and schema versions.                   |
| **Discovery status**              | `unknown` → `discovered` → `accessible`. Monotonic.                                                                       |
| **Encounter**                     | One battle within an event. Dungeons cap at two; attacks at one; scout/research have none.                                |
| **Enemy family**                  | Broad enemy category (`beast`, `undead`, `cult`, etc.) used by a region's allowlist.                                      |
| **Event Director**                | LLM task that proposes an event concept.                                                                                  |
| **Event Generator**               | LLM task that expands an accepted concept into a complete event definition.                                               |
| **Fallback event**                | Authored content used when generation is disabled, unavailable or invalid.                                                |
| **Generation**                    | One attempt to obtain model output. Persisted in `llm_generations` with model, prompt and schema versions.                |
| **Grant key**                     | Stable unique key that makes a reward grant idempotent.                                                                   |
| **Incapacitated**                 | A character at 0 HP. Cannot act until rest or recovery.                                                                   |
| **Narrative Generator**           | Optional LLM task for flavour text. Never required for gameplay.                                                          |
| **Objective**                     | A completion condition: defeat enemies, discover a location or complete research.                                         |
| **Operation ID**                  | Client/server identifier for one logical command. Reuse on retry; a new ID means a new intent.                            |
| **Opportunity**                   | Temporary event category that expires by world turn.                                                                      |
| **Party**                         | The single player-controlled group of up to four characters.                                                              |
| **Party power**                   | Sum of member power; used for recommendations and UI comparison.                                                          |
| **Prompt version**                | Version string stored with a generation, e.g. `event-generator@1`.                                                        |
| **Receipt**                       | Stored command result used to replay an already-applied operation safely.                                                 |
| **Region**                        | A named area containing four to eight locations, with event/enemy allowlists and graph connections to other regions.      |
| **Region connection**             | A reciprocal static link between two regions. Its read-model status follows the target region's discovery state.          |
| **Reward intent**                 | Model-proposed reward category (gold, experience, equipment, research). Amounts are engine-derived.                       |
| **Schema version**                | Version string for a model output contract, e.g. `GeneratedEvent@1`.                                                      |
| **Seed**                          | Deterministic integer input to RNG. Event battles derive it from event ID, encounter index and `GAME_SEED`.               |
| **Storyline event**               | Persistent event category, not removed by opportunity refresh.                                                            |
| **Turn (world turn)**             | Integer world time. Advanced only by defined meaningful actions.                                                          |
| **World Director**                | Optional future task for world proposals. Not required by the MVP.                                                        |
