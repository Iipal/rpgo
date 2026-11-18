# The Grey Company — RPGO MVP

A browser-based, single-player, text-only fantasy RPG driven by a local language model. The deterministic game engine owns stats, combat, rewards and world time. The model proposes event concepts and prose inside a strict schema; invalid or unavailable output falls back to authored content.

This repository implements the MVP specified in [`docs/MVP_RPG.md`](docs/MVP_RPG.md).

## What works

- Persisted world, four-character starter party, inventory, equipment and formations.
- Action-based world turns: accepting, completing or failing a contract and discovering a location advance time; viewing, equipping and resting do not.
- Event board with persistent storyline contracts and temporary opportunities that expire by world turn.
- Four event types: Dungeon, Scout, Research and Attack.
- Automatic, seeded, deterministic combat with a full action log and immutable stored reports.
- Partial defeat: cleared encounters stay cleared, survivors keep their HP and defeated characters are incapacitated.
- Rewards granted exactly once, only after a confirmed completion.
- Local OpenAI-compatible LLM for Event Director, Event Generator and narrative flavour.
- Strict Zod + semantic validation, bounded retries, generation metadata and deterministic fallback events.
- Diagnostics screen for API, SQLite, model reachability and recent generations.
- Unit, integration and model-contract tests.
- Documentation, ADRs and agent instructions.

## Quick start

Requirements: Bun 1.2+ and a local OpenAI-compatible inference server (optional; the game works without it).

```bash
bun install
cp .env.example apps/server/.env   # review values
bun run dev
```

Open <http://localhost:5173>. The API listens on <http://localhost:3001>; health is at <http://localhost:3001/api/health>.

The server seeds a starter world on first run and applies migrations automatically. To prepare the database separately:

```bash
bun run migrate
```

## Local model

The default `.env.example` points at `http://127.0.0.1:8080/v1`. Set your own endpoint and exact model ID:

```env
LLM_BASE_URL=http://127.0.0.1:8981/v1
LLM_MODEL=Qwen3.5-2B-MLX-4bit
LLM_API_KEY=local-development
```

The API key may be any non-empty string for local servers. `GET /v1/models` should list the model ID. The model must support JSON-object responses well enough to satisfy the schemas in [`packages/contracts/src/index.ts`](packages/contracts/src/index.ts).

To run without a model, set `LLM_ENABLED=false`. Existing and fallback content remains fully playable.

## Commands

| Command              | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `bun run dev`        | Run API and web app together.                     |
| `bun run build`      | Build the web bundle and server bundle.           |
| `bun test`           | Run unit and integration tests.                   |
| `bun run typecheck`  | Type-check every workspace.                       |
| `bun run lint`       | Biome checks.                                     |
| `bun run format`     | Apply Biome formatting and fixes.                 |
| `bun run migrate`    | Apply SQL migrations.                             |
| `bun run seed`       | Ensure the starter world exists.                  |
| `bun run docs:check` | Verify required docs and internal Markdown links. |

## Project layout

```text
apps/web                 React 19 + Vite + UI SDK
apps/server              Bun + Hono + SQLite
packages/contracts       Zod schemas and shared DTOs
packages/game-rules      Deterministic rules and combat
packages/game-content    Static content + fallback events
data                     Regions, enemies, abilities, equipment
migrations               Ordered SQL migrations
tests                    Unit, integration, model-contract tests
docs                     Architecture, design, data, LLM, testing, ops, ADRs
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, dependency flow, lifecycle.
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — rules, formulas, progression and balance.
- [`docs/DOMAIN_GLOSSARY.md`](docs/DOMAIN_GLOSSARY.md) — shared vocabulary.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — tables, constraints, idempotency.
- [`docs/LLM_PIPELINE.md`](docs/LLM_PIPELINE.md) — generation, validation, fallback.
- [`docs/TESTING.md`](docs/TESTING.md) — test strategy and manual checklist.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — configuration, backup, troubleshooting.
- [`docs/decisions/`](docs/decisions/) — architecture decision records.
- [`AGENTS.md`](AGENTS.md) — rules for coding agents.

## Known MVP limitations

- One party, one region pair, no movement simulation or map pathfinding.
- No accounts, multiplayer, economy simulation, crafting, dialogue trees or permadeath.
- No image, audio or animation systems.
- The local model's generation can take 20–60 seconds; the UI keeps commands pending rather than pretending work is instantaneous.
- Storyline stages are represented minimally; sequential multi-stage storylines are a production expansion.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for backup, reset and troubleshooting procedures.
