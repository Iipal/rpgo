# Operations

## 1. Prerequisites

- Bun 1.2 or newer.
- A local OpenAI-compatible inference server for generated content (optional).
- Write access to the SQLite database directory.

## 2. Configuration

Copy `.env.example` to `apps/server/.env` and adjust:

| Variable                | Default                    | Meaning                                                                             |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `PORT`                  | `3001`                     | API port.                                                                           |
| `WEB_ORIGIN`            | `http://localhost:5173`    | Allowed CORS origin.                                                                |
| `DATABASE_PATH`         | `../../data/rpgo.sqlite`   | SQLite file, relative to `apps/server`, or `:memory:`.                              |
| `LLM_BASE_URL`          | `http://127.0.0.1:8080/v1` | OpenAI-compatible base URL.                                                         |
| `LLM_API_KEY`           | `local-development`        | Non-empty key; dummy values are fine locally.                                       |
| `LLM_MODEL`             | `qwen3.5-2b-instruct`      | Exact model identifier.                                                             |
| `LLM_TIMEOUT_MS`        | `15000`                    | Per-request timeout.                                                                |
| `LLM_MAX_RETRIES`       | `1`                        | Provider-level retries, clamped 0–2.                                                |
| `LLM_MAX_OUTPUT_TOKENS` | `1200`                     | Maximum generated tokens.                                                           |
| `LLM_ENABLED`           | `true`                     | Set `false` for fallback-only play.                                                 |
| `LLM_DEBUG`             | `false`                    | Store raw response text in generation records. Never enable in shared environments. |
| `GAME_SEED`             | empty                      | Numeric seed or a string hashed to a stable seed.                                   |

The web app reads `VITE_API_URL` (default `http://localhost:3001/api`) at build time.

## 3. Development

```bash
bun install
bun run dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:3001>
- Health: <http://localhost:3001/api/health>
- Diagnostics: <http://localhost:3001/api/system/diagnostics>

`bun run dev` runs both processes with `concurrently`. Stop with Ctrl-C.

The server applies migrations and seeds an empty database on startup.

## 4. Production-style run

```bash
bun run build
bun run start
```

Serve the built web files from `apps/web/dist/` with any static server, or host them separately and set `VITE_API_URL` before building. Set `WEB_ORIGIN` to the deployed web origin. The server exposes `/api/dev/generate-event` only when `NODE_ENV` is not `production`.

## 5. Health and diagnostics

`GET /api/health` returns:

```json
{
  "data": {
    "status": "ok | degraded",
    "api": "ok",
    "database": { "ok": true, "schemaVersion": "0001_init.sql" },
    "llm": {
      "enabled": true,
      "configured": true,
      "reachable": true,
      "model": "Qwen3.5-2B-MLX-4bit",
      "baseUrl": "http://127.0.0.1:8981/v1",
      "lastGeneration": { "...": "..." },
      "fallbackActive": false
    },
    "correlationId": "..."
  },
  "correlationId": "..."
}
```

`fallbackActive` is true when the LLM is disabled, unreachable or the latest generation failed. The UI shows a warning banner and continues play.

`GET /api/system/diagnostics` adds the 20 most recent generation records. Secrets are never returned.

## 6. Logs

The server emits one JSON line per request with method, path, status, duration and correlation ID. Errors include a correlation ID without stack traces to clients. Generation attempts are persisted in SQLite and summarize status, latency, model, prompt version, schema version and error code.

Client errors include the correlation ID when available; use it to find the matching server log.

## 7. Backups

SQLite runs in WAL mode. Back up safely:

```bash
# Prefer the SQLite backup command while the server is running
sqlite3 data/rpgo.sqlite ".backup '/backups/rpgo-$(date +%Y%m%d-%H%M%S).sqlite'"
```

Or stop the server and copy the database plus `-wal` and `-shm` files. Restoring:

```bash
# Stop the server first.
cp /backups/rpgo-YYYYMMDD-HHMMSS.sqlite data/rpgo.sqlite
# Remove stale sidecars if the backup is a complete standalone file.
rm -f data/rpgo.sqlite-wal data/rpgo.sqlite-shm
bun run dev
```

Verify with `/api/health` and the game state.

## 8. Reset a local world

Stop the server, back up if needed, then remove the database and sidecars:

```bash
rm -f data/rpgo.sqlite data/rpgo.sqlite-wal data/rpgo.sqlite-shm
bun run dev
```

A fresh world is seeded on next start.

## 9. Model troubleshooting

| Symptom                | Check                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `reachable: false`     | Is the inference server running? Can you `curl $LLM_BASE_URL/models`?                                                             |
| 401/403                | Set a non-empty `LLM_API_KEY` accepted by the server.                                                                             |
| Model not found        | Use the exact ID from `/v1/models` in `LLM_MODEL`.                                                                                |
| Timeouts               | Increase `LLM_TIMEOUT_MS`; small local models can take 20–60 seconds per structured event.                                        |
| Rejected JSON          | Inspect diagnostics status; the model may not follow JSON mode. Try a more capable model or disable the LLM and rely on fallback. |
| Slow board refresh     | Accepting or discovering waits for generation. Reduce output tokens, lower timeout, or use a faster model.                        |
| Fallback always active | Check the last generation error code and server logs by correlation ID.                                                           |

The game is designed to stay playable when generation fails. Do not disable validation to force a model through.

## 10. Database troubleshooting

- `SQLITE_BUSY`: increase `busy_timeout` in `openDatabase` or ensure only one server process writes the file.
- Foreign key errors: run from a fresh database to verify migrations; do not delete parent rows manually.
- Missing migrations: check `schema_migrations` and the `migrations/` directory path.
- Corruption: restore the latest backup. Do not edit the database while the server is running.

## 11. Security

- Never commit `apps/server/.env` or real API keys.
- Diagnostics must not expose keys, raw prompts containing secrets, or environment dumps.
- The dev generation endpoint is disabled under `NODE_ENV=production`.
- CORS is restricted to `WEB_ORIGIN`.
- Treat model output as untrusted text; it is validated and never executed.
- Run the server on a trusted local network only; the MVP has no authentication.

## 12. Deployment checklist

1. Set `NODE_ENV=production`.
2. Set `WEB_ORIGIN` to the deployed web origin.
3. Set `DATABASE_PATH` to a persistent volume.
4. Run migrations before serving.
5. Configure the model endpoint and timeout.
6. Verify `/api/health` and one full game loop.
7. Back up the database.
8. Confirm no secrets appear in logs, diagnostics or the client bundle.
