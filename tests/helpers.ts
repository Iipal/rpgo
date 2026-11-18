import { BoardService } from "../apps/server/src/application/board";
import { GameService } from "../apps/server/src/application/game-service";
import { ensureGame } from "../apps/server/src/application/seeding";
import type { Config } from "../apps/server/src/config";
import {
  type Db,
  migrate,
  openDatabase,
} from "../apps/server/src/infrastructure/database/database";
import { Repository } from "../apps/server/src/infrastructure/database/repository";
import { GenerationService } from "../apps/server/src/infrastructure/llm/generation-service";
import { DisabledLlmProvider } from "../apps/server/src/infrastructure/llm/openai-provider";

export interface TestService {
  db: Db;
  repo: Repository;
  service: GameService;
  board: BoardService;
  config: Config;
  close: () => void;
}

export function createTestService(options: { llmEnabled?: boolean } = {}): TestService {
  const db = openDatabase(":memory:");
  migrate(db);
  const repo = new Repository(db);
  ensureGame(repo);
  const config: Config = {
    port: 0,
    webOrigin: "http://localhost:5173",
    databasePath: ":memory:",
    gameSeed: 424242,
    llm: {
      enabled: options.llmEnabled ?? false,
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "test",
      model: "test-model",
      timeoutMs: 1000,
      maxRetries: 0,
      maxOutputTokens: 512,
      debug: false,
    },
  };
  const generation = new GenerationService(new DisabledLlmProvider("test-model"), repo, config.llm);
  const board = new BoardService(repo, generation);
  const service = new GameService(repo, board, generation, config);
  return {
    db,
    repo,
    service,
    board,
    config,
    close: () => db.close(),
  };
}
