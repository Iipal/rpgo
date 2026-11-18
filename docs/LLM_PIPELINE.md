# LLM Pipeline

## 1. Role of the model

The local model is a constrained creative author. It may propose event concepts, complete event definitions and short narrative text. It may not:

- choose or modify damage, hit chance, stats, rewards, world turns or player resources;
- write to SQLite directly;
- create arbitrary items, enemies, formulas, code or SQL;
- bypass validation or decide whether validation applies.

The deterministic engine accepts, normalizes and persists content. Model output is untrusted input.

## 2. Pipeline

```text
Persisted state
  → compact, sanitised context
  → versioned prompt + schema name
  → local OpenAI-compatible chat completion
  → raw text (metadata recorded)
  → JSON extraction (strip fences, take first complete object)
  → Zod schema validation
  → semantic/domain validation
  → normalization and clamping
  → persist accepted event + generation metadata
  → expose playable event
```

Generation is never performed inside a database transaction.

## 3. Provider

`LlmProvider` exposes:

```ts
interface LlmProvider {
  model: string;
  generateStructured(request: {
    task: string;
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    temperature?: number;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<{
    text: string;
    model: string;
    usage?: { inputTokens?: number; outputTokens?: number };
    latencyMs: number;
  }>;
  health(): Promise<{ reachable: boolean; model: string }>;
}
```

`OpenAiCompatibleProvider` posts to `${LLM_BASE_URL}/chat/completions` with:

- `stream: false`
- `response_format: { type: "json_object" }`
- system and user messages
- configured model and token limit
- `AbortController` timeout

If the server rejects JSON mode with a 400, one retry is made without `response_format`. Responses are capped at 200 KB. Health calls `GET /models` and caches for 20 seconds.

`DisabledLlmProvider` returns `LLM_UNAVAILABLE` and reports unhealthy. Application code treats disabled generation as “use fallback”.

## 4. Tasks

| Task                | Prompt version          | Schema                | Purpose                                           |
| ------------------- | ----------------------- | --------------------- | ------------------------------------------------- |
| Event Director      | `event-director@1`      | `EventConcept@1`      | Propose one board concept.                        |
| Event Generator     | `event-generator@1`     | `GeneratedEvent@1`    | Expand a validated concept into a complete event. |
| Narrative Generator | `narrative-generator@1` | `NarrativeResponse@1` | Short victory/defeat flavour. Optional.           |

Prompts live in `apps/server/src/infrastructure/llm/prompts/`. Human-readable contracts are in `docs/prompts/`.

### 4.1 Event Director

Output:

```json
{
  "type": "dungeon | scout | research | attack",
  "category": "storyline | opportunity",
  "title": "4–80 chars",
  "hook": "10–240 chars",
  "regionId": "known region id",
  "locationId": "optional known location id",
  "difficultyBand": "easy | normal | hard",
  "objectiveKind": "defeat_enemies | discover_location | complete_research",
  "expiresInWorldTurns": "1–10, opportunities only",
  "storylineKey": "optional stable key"
}
```

Semantic validation checks:

- Requested category matches.
- Region exists and is accessible.
- Location exists and is not unknown; otherwise the first eligible location is selected.
- Type and objective kind match (`dungeon`/`attack` → defeat, `scout` → discover, `research` → research).
- Discovery objectives have a valid target location still left to discover.
- Title and storyline key do not duplicate an available or active event.
- Difficulty is allowed for the party level; excessive bands are clamped.
- Expiry is present only for opportunities; the engine computes `expiresOnTurn`.

### 4.2 Event Generator

Output: title, description, introduction, 1–2 objectives, 0–2 encounters, 1–4 reward intents, completion text, failure text.

Semantic validation checks:

- First objective matches the concept objective kind.
- Encounter count does not exceed the type cap: dungeon 2, attack 1, scout 0, research 0.
- Combat events have at least one encounter; non-combat events have none.
- Enemy template IDs are in the known allowlist.
- Behavior IDs are one of `enemy_brute`, `enemy_skirmisher`, `enemy_caster`, `enemy_support`.
- Reward intents use allowed kinds and rarities.
- Enemy stats, reward amounts and equipment stats are never accepted from the model; the engine derives them.

### 4.3 Narrative Generator

One short string of 1–3 sentences, maximum 600 characters. Used for event result flavour only. If it fails or times out (5 seconds), the stored completion/failure text is used. Narrative can never block a game action.

## 5. Parsing and retries

`GenerationService`:

1. Returns `null` when generation is disabled.
2. Allows at most two application attempts via `maxAttempts`.
3. Records every attempt in `llm_generations` before returning.
4. Extracts JSON from fenced or prose-wrapped output.
5. Validates with the task's Zod schema.
6. Retries once only for parse/schema failures or transient provider failures.
7. Gives up after the bounded retry; the board uses fallback content.

Provider retries are separately bounded by `LLM_MAX_RETRIES` (0–2). Event Director and Event Generator use `maxAttempts: 1` at the application level, so a board refresh does not multiply a slow model call.

## 6. Failure matrix

| Failure                         | Detection                    | Response                                       |
| ------------------------------- | ---------------------------- | ---------------------------------------------- |
| Server unavailable              | Fetch failure / health false | Record `unavailable`; fallback content.        |
| Timeout                         | AbortController              | Record `timeout`; no retry beyond policy.      |
| Empty response                  | Empty content                | Record `invalid`; retry if allowed.            |
| Invalid JSON                    | `JSON.parse` failure         | Record `invalid`; retry if allowed.            |
| Schema mismatch                 | Zod failure                  | Record `invalid`; retry if allowed.            |
| Unknown template/behavior       | Semantic validation          | Reject generation; fallback content.           |
| Duplicate or impossible concept | Semantic validation          | Reject generation; fallback content.           |
| Reward abuse                    | Allowlist and clamping       | Reject or clamp; engine still derives amounts. |
| Model refusal or unrelated text | No JSON / schema failure     | Reject; fallback content.                      |

A failed generation never creates a half-valid event. Accepted and active events remain untouched.

## 7. Observability

Every generation row stores:

- task, model, prompt version, schema version
- status (`success`, `invalid`, `timeout`, `unavailable`, `refused`)
- error code, latency, token counts when available
- correlation ID
- raw response text only when `LLM_DEBUG=true`

The Diagnostics screen shows health, fallback status, last generation and the 20 most recent attempts. Secrets and API keys are never included.

## 8. Configuration

```env
LLM_BASE_URL=http://127.0.0.1:8981/v1
LLM_API_KEY=local-development
LLM_MODEL=Qwen3.5-2B-MLX-4bit
LLM_TIMEOUT_MS=30000
LLM_MAX_RETRIES=1
LLM_MAX_OUTPUT_TOKENS=1200
LLM_ENABLED=true
LLM_DEBUG=false
GAME_SEED=greenreach-1
```

- The model identifier is configuration, not code.
- The actual model returned by the provider is recorded with each generation.
- A non-numeric `GAME_SEED` is hashed to a stable integer so deterministic runs remain reproducible.
- Never commit real credentials. Local servers may accept any non-empty key.

## 9. Model evaluation

The MVP targets a small local instruct model. Evaluate:

- valid JSON rate
- schema-valid rate
- semantic acceptance rate
- duplicate concept rate
- average latency and token counts
- fallback rate
- human-rated narrative quality

Do not weaken validation to make a model pass. A failing model should be visible in diagnostics and should fall back.

## 10. Adding a task

1. Add or extend a Zod schema in `packages/contracts`.
2. Add a versioned prompt module with `version`, `schemaVersion`, `schemaName`, `system` and `user` builders.
3. Add documentation under `docs/prompts/`.
4. Call `GenerationService.generate` from an application service, never from domain code.
5. Validate semantic constraints before persisting.
6. Persist accepted content with generation metadata.
7. Add a model-contract test and a fallback path.
8. Update this document and `CHANGELOG.md`.
