import { ensureGame } from "../../application/seeding";
import { loadConfig } from "../../config";
import { migrate, openDatabase } from "./database";
import { Repository } from "./repository";

const config = loadConfig();
const db = openDatabase(config.databasePath);
migrate(db);
const repo = new Repository(db);
ensureGame(repo);
const player = repo.getPlayer();
const world = repo.getWorld();
const party = repo.getParty();
console.log(
  JSON.stringify({
    message: "Seed complete",
    player: player?.name,
    gold: player?.gold,
    worldId: world?.id,
    turn: world?.turn,
    party: party?.name,
    characters: party ? repo.getCharacters(party.id).length : 0,
    events: world ? repo.getVisibleBoard(world.id).length : 0,
    database: config.databasePath,
  }),
);
db.close();
