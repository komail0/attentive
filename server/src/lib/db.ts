import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

/**
 * Schema notes (privacy by design):
 *  - `pins` and `comments` have NO student identifier, NO timestamp and NO foreign key to any person.
 *    A pin is only a row saying "someone pinned slide N of session S".
 *  - The only per-person tables are `lecturers`.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE lecturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    course TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'both' CHECK (language IN ('both','en')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','ended')),
    current_slide INTEGER NOT NULL DEFAULT 0,
    joined INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    ended_at TEXT
  );
  CREATE INDEX idx_sessions_lecturer ON sessions(lecturer_id);
  CREATE TABLE slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    n INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_ur TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    summary_ur TEXT NOT NULL DEFAULT '',
    UNIQUE (session_id, n)
  );
  CREATE TABLE pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    slide_n INTEGER NOT NULL
  );
  CREATE INDEX idx_pins_session_slide ON pins(session_id, slide_n);
  CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    slide_n INTEGER NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX idx_comments_session ON comments(session_id);
  CREATE TABLE transcript_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    at TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX idx_transcript_session ON transcript_lines(session_id);
  `,
];

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}
