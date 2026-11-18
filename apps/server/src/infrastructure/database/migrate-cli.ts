import { loadConfig } from "../../config";
import { currentSchemaVersion, migrate, openDatabase } from "./database";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const applied = migrate(db);
console.log(
  JSON.stringify({
    message: applied.length > 0 ? "Migrations applied" : "Database already up to date",
    applied,
    schemaVersion: currentSchemaVersion(db),
    database: config.databasePath,
  }),
);
db.close();
