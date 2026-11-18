# ADR-0002 — The LLM proposes content; the engine decides

- **Status:** Accepted
- **Date:** 2026-11-18
- **Supersedes:** —

## Context

The game uses a small local OpenAI-compatible model for event concepts, event definitions and
narrative flavour. Local models are slow, occasionally emit malformed JSON and can hallucinate IDs,
stats or rewards. Allowing the model to write game state would make the game non-deterministic,
exploitable and hard to debug.

## Decision

Treat every model response as untrusted input to a content pipeline:

1. Versioned prompt and schema name are sent with the request.
2. Raw text is extracted and parsed as JSON.
3. A Zod schema from `packages/contracts` validates the shape.
4. Application-level semantic validation checks IDs, type/objective pairs, encounter caps,
   difficulty, duplicates and reward allowlists.
5. The engine normalizes and clamps the result, then persists it.
6. Every attempt is recorded in `llm_generations` with status, latency, model and versions.
7. On failure the board uses authored fallback content.

The model may choose narrative and known templates only. It never chooses damage, hit chance, stats,
reward amounts, world turns, item stats or persistence.

Generation runs outside database transactions. Retries are bounded and configured, not open-ended.

## Consequences

- The game remains playable and deterministic with the model disabled.
- A weak model degrades content quality, not game integrity.
- Validation is intentionally strict; we do not weaken it to make a model pass.
- Diagnostics must expose enough metadata to debug a bad model without leaking secrets.
- Adding a task requires a schema, a versioned prompt, semantic validation, a fallback path and a
  model-contract test.
