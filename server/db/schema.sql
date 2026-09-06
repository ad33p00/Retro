CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  pin_hash TEXT,
  timer_ends_at INTEGER,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  author_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  display_name TEXT,
  color TEXT NOT NULL,
  is_facilitator INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_groups_board ON groups(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id);
CREATE INDEX IF NOT EXISTS idx_votes_card ON votes(card_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_participant_card ON votes(card_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_action_items_board ON action_items(board_id);
CREATE INDEX IF NOT EXISTS idx_participants_board ON participants(board_id);
