import { resolve } from "node:path";
import { hashSeed } from "@rpgo/game-rules";

export interface LlmConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  debug: boolean;
}

export interface Config {
  port: number;
  webOrigin: string;
  databasePath: string;
  llm: LlmConfig;
  gameSeed: number | null;
}

function int(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const databasePath = env.DATABASE_PATH ?? "../../data/rpgo.sqlite";
  return {
    port: int(env.PORT, 3001),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:5173",
    databasePath: databasePath === ":memory:" ? databasePath : resolve(process.cwd(), databasePath),
    llm: {
      enabled: bool(env.LLM_ENABLED, true),
      baseUrl: (env.LLM_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(/\/+$/, ""),
      apiKey: env.LLM_API_KEY ?? "local-development",
      model: env.LLM_MODEL ?? "qwen3.5-2b-instruct",
      timeoutMs: int(env.LLM_TIMEOUT_MS, 15000),
      maxRetries: Math.min(2, Math.max(0, int(env.LLM_MAX_RETRIES, 1))),
      maxOutputTokens: int(env.LLM_MAX_OUTPUT_TOKENS, 1200),
      debug: bool(env.LLM_DEBUG, false),
    },
    gameSeed: env.GAME_SEED
      ? Number.isFinite(Number.parseInt(env.GAME_SEED, 10))
        ? Number.parseInt(env.GAME_SEED, 10)
        : hashSeed(env.GAME_SEED)
      : null,
  };
}
