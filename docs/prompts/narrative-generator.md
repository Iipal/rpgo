# Prompt: Narrative Generator

- **Task:** `narrative_generator`
- **Prompt version:** `narrative-generator@1`
- **Schema version:** `NarrativeResponse@1`
- **Schema name:** `NarrativeResponse`
- **Source:** `apps/server/src/infrastructure/llm/prompts/narrative-generator.ts`
- **Zod contract:** `NarrativeResponseSchema` in `packages/contracts/src/index.ts`

## Role

Add short flavour after an event outcome. Narrative is optional and never required to execute a game action.

## Input contract

- Kind: `victory` or `defeat` (the schema also permits `teaser`, `introduction` and `discovery` for future tasks).
- Event title.
- Location name.
- Party level.
- The event's stored completion or failure text as grounding.

## Output contract

```json
{ "text": "1–3 sentences, maximum 600 characters" }
```

Return one JSON object only, with no markdown or commentary.

## Rules

- Write 1–3 sentences, 400 characters or fewer where possible.
- Match the supplied victory/defeat outcome.
- Do not change gameplay facts, rewards, injuries, locations or world time.
- Do not introduce new named characters, factions or items unless already in the supplied text.
- Do not promise rewards or describe numeric mechanics.
- Avoid gore, cruelty and modern slang.
- If unsure, write a restrained summary rather than inventing detail.

## Style

Grounded fantasy chronicle voice, past tense for outcomes, concrete sensory detail, no second-person instructions.

## Valid example

```json
{
  "text": "The company returned from the birches at dusk, mud to the knee and the goblin standard burned behind them. Thornbury's hunters said the wood sounded like itself again."
}
```

## Fallback

If generation is disabled, unavailable, timed out or invalid, the event keeps its authored/stored completion or failure text. A narrative failure is never surfaced as a game-action failure.
