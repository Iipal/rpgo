-- MVP schema. One local player/world per database; stable content IDs are used
-- for regions, locations, and definitions. Instance IDs are UUIDs.

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  research_points INTEGER NOT NULL DEFAULT 0 CHECK (research_points >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE worlds (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL DEFAULT 1 CHECK (turn >= 1),
  current_region_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  level_min INTEGER NOT NULL,
  level_max INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unknown','discovered','accessible')),
  threat_level INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unknown','discovered','accessible')),
  discovered_turn INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL UNIQUE REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archetype TEXT NOT NULL CHECK (archetype IN ('warrior','ranger','mage','cleric')),
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL,
  agility INTEGER NOT NULL,
  intelligence INTEGER NOT NULL,
  vitality INTEGER NOT NULL,
  health INTEGER NOT NULL,
  mana INTEGER NOT NULL,
  incapacitated INTEGER NOT NULL DEFAULT 0,
  ability_ids_json TEXT NOT NULL,
  combat_behavior_id TEXT NOT NULL,
  formation TEXT NOT NULL CHECK (formation IN ('front','back')),
  created_at TEXT NOT NULL
);

CREATE TABLE character_equipment (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('weapon','armor','accessory')),
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, slot),
  UNIQUE (item_id)
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('weapon','armor','accessory')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare')),
  description TEXT NOT NULL,
  bonuses_json TEXT NOT NULL,
  equipped_by TEXT REFERENCES characters(id) ON DELETE SET NULL,
  acquired_turn INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('dungeon','scout','research','attack')),
  category TEXT NOT NULL CHECK (category IN ('storyline','opportunity')),
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  description TEXT NOT NULL,
  introduction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','active','completed','failed','expired')),
  difficulty_band TEXT NOT NULL CHECK (difficulty_band IN ('easy','normal','hard')),
  region_id TEXT NOT NULL REFERENCES regions(id),
  location_id TEXT REFERENCES locations(id),
  objective_kind TEXT NOT NULL CHECK (objective_kind IN ('defeat_enemies','discover_location','complete_research')),
  reward_intent_json TEXT NOT NULL,
  reward_preview_json TEXT NOT NULL,
  completion_text TEXT NOT NULL,
  failure_text TEXT NOT NULL,
  result_text TEXT,
  source TEXT NOT NULL CHECK (source IN ('generated','fallback','authored')),
  expires_on_turn INTEGER,
  storyline_key TEXT,
  created_turn INTEGER NOT NULL,
  current_encounter_index INTEGER NOT NULL DEFAULT 0,
  encounters_completed INTEGER NOT NULL DEFAULT 0,
  accepted_turn INTEGER,
  completed_turn INTEGER,
  generation_id TEXT REFERENCES llm_generations(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_board ON events(world_id, status, category);

CREATE TABLE event_objectives (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('defeat_enemies','discover_location','complete_research')),
  description TEXT NOT NULL,
  target_count INTEGER,
  target_ref TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, position)
);

CREATE TABLE event_encounters (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  enemies_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','failed')),
  UNIQUE (event_id, position)
);

CREATE TABLE battle_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  encounter_index INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('victory','defeat','draw')),
  rounds INTEGER NOT NULL,
  party_result_json TEXT NOT NULL,
  enemy_result_json TEXT NOT NULL,
  action_log_json TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, encounter_index)
);

CREATE INDEX idx_battle_sessions_event ON battle_sessions(event_id);

CREATE TABLE battle_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_id TEXT NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  type TEXT NOT NULL,
  target_names TEXT NOT NULL,
  amount INTEGER,
  crit INTEGER,
  reason TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX idx_battle_actions_battle ON battle_actions(battle_id);

CREATE TABLE world_actions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (world_id, action_type, operation_id)
);

CREATE TABLE resource_transactions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  grant_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  target_id TEXT,
  detail_json TEXT NOT NULL,
  turn INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE llm_generations (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT,
  schema_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','invalid','timeout','unavailable','refused')),
  error_code TEXT,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  response_text TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_journal_world ON journal_entries(world_id, turn);

CREATE TABLE command_receipts (
  operation_id TEXT NOT NULL,
  command TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (operation_id, command)
);
