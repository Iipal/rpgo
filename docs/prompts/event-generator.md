# Prompt: Event Generator

- **Task:** `event_generator`
- **Prompt version:** `event-generator@1`
- **Schema version:** `GeneratedEvent@1`
- **Schema name:** `GeneratedEvent`
- **Source:** `apps/server/src/infrastructure/llm/prompts/event-generator.ts`
- **Zod contract:** `GeneratedEventSchema` in `packages/contracts/src/index.ts`

## Role

Expand one already-validated concept into a complete, playable event definition. The model chooses narrative and known templates; the engine derives all numbers.

## Input contract

- The normalized concept (type, category, title, hook, region, location, difficulty, objective kind, expiry, target location).
- Allowed enemy template IDs with names and roles.
- Allowed enemy behavior IDs.
- Maximum encounter count for the event type.
- World turn and party level.

## Output contract

```json
{
  "title": "4–90 characters",
  "description": "20–600 characters",
  "introduction": "20–900 characters",
  "objectives": [
    {
      "kind": "defeat_enemies | discover_location | complete_research",
      "description": "4–200 characters",
      "targetCount": "optional integer 1–10"
    }
  ],
  "encounters": [
    {
      "title": "3–90 characters",
      "description": "10–400 characters",
      "enemies": [{ "templateId": "known id", "count": "1–4", "behaviorId": "allowed id" }]
    }
  ],
  "rewardIntent": [
    {
      "kind": "gold | experience | equipment | research",
      "rarity": "optional common | uncommon | rare",
      "target": "optional party | character"
    }
  ],
  "completionText": "10–500 characters",
  "failureText": "10–500 characters"
}
```

Return one JSON object only.

## Hard rules

- First objective kind must match the concept objective kind.
- Encounter caps: dungeon 2, attack 1, scout 0, research 0.
- Combat events require at least one encounter; scout/research must have none.
- Each encounter has 1–3 enemy groups; each group has count 1–4.
- Use only listed enemy template IDs and behavior IDs.
- Do not specify enemy stats, damage, reward amounts, gold values, XP values or formulas.
- Reward intents are categories only. The engine computes quantities.
- Equipment rarity is a suggestion; the engine clamps it to the difficulty band.
- Keep descriptions consistent with the supplied region and location.
- Do not contradict the concept title or hook.
- Do not include code, SQL, HTML, markdown or extra fields.

## Allowed behaviors

`enemy_brute`, `enemy_skirmisher`, `enemy_caster`, `enemy_support`.

Enemy template IDs come from `data/enemies.json` and are supplied in the prompt context. Never invent one.

## Style

- Second-person or present-tense briefing voice.
- Concrete sensory detail, short sentences, no anachronisms.
- Completion and failure text describe outcomes without promising specific rewards.
- Narrative must not reveal hidden numeric mechanics.

## Valid example (combat)

```json
{
  "title": "Beneath the Whispering Wood",
  "description": "The wood has gone quiet. Something has driven the game from the birches and into a mossy hollow.",
  "introduction": "You follow the charcoal burners' path until the birches close overhead. Grey shapes move in the undergrowth, and firelight flickers against a mossy bank.",
  "objectives": [
    {
      "kind": "defeat_enemies",
      "description": "Clear the goblin camp beneath the birches.",
      "targetCount": 2
    }
  ],
  "encounters": [
    {
      "title": "The Outer Thicket",
      "description": "Goblin scouts wait among the roots, bows half-drawn.",
      "enemies": [{ "templateId": "goblin_scout", "count": 2, "behaviorId": "enemy_skirmisher" }]
    },
    {
      "title": "The Mossy Bank",
      "description": "A brute guards the fire while a cultist mutters over a stone.",
      "enemies": [
        { "templateId": "goblin_brute", "count": 1, "behaviorId": "enemy_brute" },
        { "templateId": "cultist", "count": 1, "behaviorId": "enemy_caster" }
      ]
    }
  ],
  "rewardIntent": [
    { "kind": "gold", "target": "party" },
    { "kind": "experience", "target": "party" },
    { "kind": "equipment", "rarity": "uncommon", "target": "party" }
  ],
  "completionText": "The camp is broken and the wood is quiet again. Thornbury's hunters will find the game returning within a week.",
  "failureText": "The company drags its wounded back through the birches. The camp remains, and the wood keeps its silence."
}
```

## Engine validation

`validateGenerated` checks objective matching, encounter caps, combat/non-combat shape, enemy template IDs and behavior allowlists. `persistEvent` builds objectives, encounters and reward preview; `grantRewards` derives actual amounts. A rejected definition creates no event.
