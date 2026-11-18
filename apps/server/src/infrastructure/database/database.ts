import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Db = Database;

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../../migrations/", import.meta.url));

export function openDatabase(path: string): Db {
  if (path !== ":memory:") {
    const parent = dirname(path);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 3000;");
  return db;
}

export function migrate(db: Db): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db
      .query<{ id: string }, []>("SELECT id FROM schema_migrations")
      .all()
      .map((row) => row.id),
  );
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec(sql);
      db.run("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)", [
        file,
        new Date().toISOString(),
      ]);
      db.exec("COMMIT;");
      ran.push(file);
    } catch (error) {
      db.exec("ROLLBACK;");
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return ran;
}

export function currentSchemaVersion(db: Db): string | null {
  const row = db
    .query<{ id: string }, []>("SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1")
    .get();
  return row?.id ?? null;
}

export function resetForTests(db: Db): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  for (const table of tables) db.exec(`DROP TABLE IF EXISTS "${table.name}";`);
  db.exec("PRAGMA foreign_keys = ON;");
}
