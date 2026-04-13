import BetterSqlite3 from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(__dirname, "../../../scheduler.db");

const db = new BetterSqlite3(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id         TEXT,
    title              TEXT    NOT NULL,
    description        TEXT    DEFAULT '',
    tags               TEXT    DEFAULT '',
    category_id        TEXT    DEFAULT '22',
    privacy            TEXT    DEFAULT 'public',
    file_path          TEXT,
    youtube_id         TEXT,
    playlist_id        TEXT,
    status             TEXT    DEFAULT 'queued',
    scheduled_at       TEXT,
    published_at       TEXT,
    upload_progress    REAL    DEFAULT 0.0,
    error_message      TEXT,
    created_at         TEXT    NOT NULL,
    updated_at         TEXT,
    is_draft           INTEGER DEFAULT 0,
    made_for_kids      INTEGER DEFAULT 0,
    default_language   TEXT    DEFAULT '',
    notification_status TEXT   DEFAULT 'none',
    bulk_id            TEXT,
    thumbnail_path     TEXT
  );

  CREATE TABLE IF NOT EXISTS schedule_slots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    hour        INTEGER NOT NULL,
    minute      INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    posts_per_week      INTEGER DEFAULT 3,
    posts_per_month     INTEGER DEFAULT 12,
    default_privacy     TEXT    DEFAULT 'public',
    default_category    TEXT    DEFAULT '22',
    openrouter_api_key  TEXT    DEFAULT '',
    ai_model            TEXT    DEFAULT 'openai/gpt-4o',
    auto_fill_slots     INTEGER DEFAULT 1,
    time_zone           TEXT    DEFAULT 'Asia/Kolkata'
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id                INTEGER PRIMARY KEY DEFAULT 1,
    token_data        TEXT,
    channel_id        TEXT,
    channel_title     TEXT,
    channel_thumbnail TEXT,
    connected_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS scheduler_rules (
    id         TEXT    PRIMARY KEY,
    weekday    INTEGER NOT NULL,
    time_local TEXT    NOT NULL,
    timezone   TEXT    DEFAULT 'UTC',
    active     INTEGER DEFAULT 1,
    channel_id TEXT,
    created_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL,
    title_template       TEXT,
    description_template TEXT,
    tags_template        TEXT,
    category_id          TEXT,
    privacy              TEXT,
    playlist_id          TEXT,
    auto_schedule        INTEGER DEFAULT 0,
    thumbnail_url        TEXT,
    ai_prompt            TEXT,
    channel_id           TEXT,
    created_at           TEXT    NOT NULL,
    updated_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS media (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT    NOT NULL,
    public_url      TEXT    NOT NULL,
    storage_path    TEXT    DEFAULT 'external',
    file_size_bytes INTEGER,
    mime_type       TEXT,
    channel_id      TEXT,
    uploaded_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT    NOT NULL,
    post_id     TEXT,
    channel_id  TEXT,
    metadata    TEXT,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL,
    description  TEXT,
    status       TEXT    DEFAULT 'draft',
    scheduled_at TEXT,
    published_at TEXT,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT,
    thumbnail_url TEXT,
    metadata     TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    DEFAULT 'system',
    title       TEXT    NOT NULL,
    body        TEXT,
    delivery    TEXT    DEFAULT 'in_app',
    status      TEXT    DEFAULT 'unread',
    channel_id  TEXT,
    user_id     TEXT,
    created_at  TEXT    NOT NULL
  );
`);

// Runtime migrations
const settingsCols = (db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>).map(c => c.name);
if (!settingsCols.includes("posts_per_month")) {
  db.prepare("ALTER TABLE settings ADD COLUMN posts_per_month INTEGER DEFAULT 12").run();
}

const videoCols = (db.prepare("PRAGMA table_info(videos)").all() as Array<{ name: string }>).map(c => c.name);
if (!videoCols.includes("channel_id")) {
  db.prepare("ALTER TABLE videos ADD COLUMN channel_id TEXT").run();
}
if (!videoCols.includes("made_for_kids")) {
  db.prepare("ALTER TABLE videos ADD COLUMN made_for_kids INTEGER DEFAULT 0").run();
}
if (!videoCols.includes("default_language")) {
  db.prepare("ALTER TABLE videos ADD COLUMN default_language TEXT DEFAULT ''").run();
}
if (!videoCols.includes("updated_at")) {
  db.prepare("ALTER TABLE videos ADD COLUMN updated_at TEXT").run();
}

// Support for older activity_logs name (metadata vs metadata_json)
const activityCols = (db.prepare("PRAGMA table_info(activity_logs)").all() as Array<{ name: string }>).map(c => c.name);
if (activityCols.includes("metadata") && !activityCols.includes("metadata_json")) {
  // We keep metadata for Node. If it was created by Python, it might be metadata_json.
  // Actually, Python used "metadata" in the column name but "metadata_json" in the model.
}

db.prepare("CREATE INDEX IF NOT EXISTS idx_videos_channel_status_created ON videos(channel_id, status, created_at DESC)").run();

// Ensure settings row always exists
const existing = db.prepare("SELECT id FROM settings WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO settings (id) VALUES (1)").run();
}

// Ensure oauth row always exists
const existingOAuth = db.prepare("SELECT id FROM oauth_tokens WHERE id = 1").get();
if (!existingOAuth) {
  db.prepare("INSERT INTO oauth_tokens (id) VALUES (1)").run();
}

export default db;

export function now(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
