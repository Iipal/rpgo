# Prompt: Event Director

- **Task:** `event_director`
- **Prompt version:** `event-director@1`
- **Schema version:** `EventConcept@1`
- **Schema name:** `EventConcept`
- **Source:** `apps/server/src/infrastructure/llm/prompts/event-director.ts`
- **Zod contract:** `EventConceptSchema` in `packages/contracts/src/index.ts`

## Role

Propose one event concept for the guild board. The concept is a pitch, not a playable event. The engine decides whether to accept it and later asks the Event Generator to expand it.

## Input contract

A compact JSON object containing:

- world turn, party level and party power
- requested category (`storyline` or `opportunity`)
- visible board titles
- recently completed event titles
- accessible region IDs, names and descriptions
- eligible location IDs, names and descriptions for each accessible region

Input is sanitised to exclude secrets, database IDs that are not content IDs, and raw history.

## Output contract

```json
{
  "type": "dungeon | scout | research | attack",
  "category": "storyline | opportunity",
  "title": "4–80 characters",
  "hook": "10–240 characters",
  "regionId": "known accessible region id",
  "locationId": "optional eligible location id",
  "difficultyBand": "easy | normal | hard",
  "objectiveKind": "defeat_enemies | discover_location | complete_research",
  "expiresInWorldTurns": "optional integer 1–10, opportunities only",
  "storylineKey": "optional lowercase key, 1–64 characters"
}
```

Return one JSON object only. No markdown fences, commentary or extra fields.

## Allowed IDs and enums

- Types: `dungeon`, `scout`, `research`, `attack`.
- Categories: `storyline`, `opportunity`.
- Difficulties: `easy`, `normal`, `hard`.
- Objectives: `defeat_enemies`, `discover_location`, `complete_research`.
- Region and location IDs must come from the supplied context.
- Type/objective pairing is fixed:
  - `dungeon` and `attack` → `defeat_enemies`
  - `scout` → `discover_location`
  - `research` → `complete_research`

## Prohibitions

- Do not invent region or location IDs.
- Do not duplicate a visible board title or storyline key.
- Do not propose `hard` for a level-one party.
- Do not include expiry on a storyline concept.
- Do not include stats, rewards, enemy lists, formulas, code or SQL.
- Do not describe a specific encounter; that belongs to the Event Generator.

## Style

- Fantasy guild-board voice, grounded and concrete.
- Short title, evocative hook with a clear reason to act.
- Avoid modern slang, meta-commentary and proper nouns that contradict the world.
- One concept only.

## Valid example

```json
{
  "type": "scout",
  "category": "opportunity",
  "title": "The Reed-Light Path",
  "hook": "A lantern glow flickers between the reeds where no path is marked.",
  "regionId": "greenreach",
  "locationId": "old_road",
  "difficultyBand": "easy",
  "objectiveKind": "discover_location",
  "expiresInWorldTurns": 3
}
```

## Engine validation

`validateConcept` in `apps/server/src/application/generation-validation.ts` checks category, region accessibility, location eligibility, type/objective pairing, discovery target, storyline key shape, duplicate title/key and difficulty. It computes `expiresOnTurn` and the target location. Rejection never creates an event; the board uses fallback content.
