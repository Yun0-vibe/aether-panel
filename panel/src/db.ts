import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbFile =
  process.env.AETHER_DB_FILE ?? path.join(process.cwd(), "data.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  host TEXT NOT NULL,
  daemon_port INTEGER NOT NULL DEFAULT 8080,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  env TEXT NOT NULL DEFAULT '{}',
  port INTEGER,
  memory_mb INTEGER,
  cpus REAL,
  command TEXT,
  created_at INTEGER NOT NULL,
  backup_every_hours INTEGER NOT NULL DEFAULT 0,
  last_backup_at INTEGER
);
`);

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: number;
}

export interface Node {
  id: string;
  name: string;
  host: string;
  daemon_port: number;
  token: string;
  created_at: number;
}

export interface Server {
  id: string;
  name: string;
  user_id: string;
  node_id: string;
  image: string;
  env: string;
  port: number | null;
  memory_mb: number | null;
  cpus: number | null;
  command: string | null;
  created_at: number;
  backup_every_hours: number;
  last_backup_at: number | null;
}

// Existing databases may predate the scheduled-backup columns.
try {
  db.exec("ALTER TABLE servers ADD COLUMN backup_every_hours INTEGER NOT NULL DEFAULT 0");
} catch {
  /* column exists */
}
try {
  db.exec("ALTER TABLE servers ADD COLUMN last_backup_at INTEGER");
} catch {
  /* column exists */
}
