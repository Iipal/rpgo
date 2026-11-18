import { BoardService } from "./application/board";
import { GameService } from "./application/game-service";
import { ensureGame } from "./application/seeding";
import { loadConfig } from "./config";
import { createApp } from "./http/server";
import { migrate, openDatabase } from "./infrastructure/database/database";
import { Repository } from "./infrastructure/database/repository";
import { GenerationService } from "./infrastructure/llm/generation-service";
import {
  DisabledLlmProvider,
  OpenAiCompatibleProvider,
} from "./infrastructure/llm/openai-provider";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const applied = migrate(db);

const repo = new Repository(db);
ensureGame(repo);

const provider = config.llm.enabled
  ? new OpenAiCompatibleProvider(config.llm)
  : new DisabledLlmProvider(config.llm.model);
const generation = new GenerationService(provider, repo, config.llm);
const board = new BoardService(repo, generation);
const service = new GameService(repo, board, generation, config);
const app = createApp({ service, config });

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(
  JSON.stringify({
    level: "info",
    message: "RPGO server listening",
    url: `http://localhost:${server.port}`,
    database: config.databasePath,
    migrationsApplied: applied,
    llm: config.llm.enabled ? config.llm.baseUrl : "disabled",
  }),
);

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", message: "Shutting down", signal }));
  server.stop();
  db.close();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
