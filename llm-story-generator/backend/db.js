import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'llm.db');
import fs from 'fs';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT,
  classification TEXT,
  genre TEXT,
  model TEXT,
  profile_json TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  models_json TEXT,
  character_id TEXT,
  draft_text TEXT,
  genre TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
`);

const storyColumns = db.prepare("PRAGMA table_info(stories)").all().map((row) => row.name);
if (!storyColumns.includes('genre')) {
  db.exec("ALTER TABLE stories ADD COLUMN genre TEXT;");
}

function upsertCharacter({ id, name, classification, genre, model, profile }) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO characters (id,name,classification,genre,model,profile_json,created_at) VALUES (@id,@name,@classification,@genre,@model,@profile_json,@created_at)`);
  return stmt.run({ id, name, classification, genre, model, profile_json: JSON.stringify(profile || {}), created_at: Date.now() });
}

function getCharacter(id) {
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
  if (!row) return null;
  row.profile = JSON.parse(row.profile_json || '{}');
  return row;
}

function listCharacters() {
  const rows = db.prepare('SELECT * FROM characters ORDER BY created_at DESC').all();
  return rows.map(r => ({ ...r, profile: JSON.parse(r.profile_json || '{}') }));
}

function deleteCharacter(id) {
  return db.prepare('DELETE FROM characters WHERE id = ?').run(id);
}

function saveStory({ id, title, content, models, character_id, draft_text, genre }) {
  const now = Date.now();
  const stmt = db.prepare(`INSERT OR REPLACE INTO stories (id,title,content,models_json,character_id,draft_text,genre,created_at,updated_at) VALUES (@id,@title,@content,@models_json,@character_id,@draft_text,@genre,@created_at,@updated_at)`);
  return stmt.run({ id, title, content, models_json: JSON.stringify(models || []), character_id, draft_text, genre, created_at: now, updated_at: now });
}

function listStories() {
  const rows = db.prepare('SELECT * FROM stories ORDER BY updated_at DESC').all();
  return rows.map(r => ({ ...r, models: JSON.parse(r.models_json || '[]') }));
}

function getStory(id) {
  const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id);
  if (!row) return null;
  row.models = JSON.parse(row.models_json || '[]');
  return row;
}

function deleteStory(id) {
  return db.prepare('DELETE FROM stories WHERE id = ?').run(id);
}

export { upsertCharacter, getCharacter, listCharacters, deleteCharacter, saveStory, listStories, getStory, deleteStory };
