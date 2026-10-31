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
CREATE TABLE IF NOT EXISTS eggs (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  ports TEXT NOT NULL DEFAULT '[]',
  env TEXT NOT NULL DEFAULT '{}',
  memory_mb INTEGER NOT NULL DEFAULT 2048,
  cpus REAL NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS nests (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
`);

// Existing databases may predate the 2FA / Discord-oauth columns.
try {
  db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
} catch { /* column exists */ }
try {
  db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0");
} catch { /* column exists */ }
try {
  db.exec("ALTER TABLE users ADD COLUMN discord_username TEXT");
} catch { /* column exists */ }
try {
  db.exec("ALTER TABLE users ADD COLUMN discord_avatar TEXT");
} catch { /* column exists */ }

export interface Egg {
  id: string;
  name: string;
  description: string;
  image: string;
  ports: string;
  env: string;
  memory_mb: number;
  cpus: number;
  sort: number;
  nest_id?: string;
}

export interface Nest {
  id: string;
  name: string;
  sort: number;
}

// Game presets ("eggs") — inserted once, updated on boot if the seed changed.
const EGG_SEED: Egg[] = [
  {
    id: "minecraft-java",
    name: "Minecraft Java",
    description: "Vanilla/Paper/Fabric via itzg/minecraft-server. Set TYPE=PAPER or TYPE=FABRIC in env.",
    image: "itzg/minecraft-server",
    ports: JSON.stringify([{ port: 25565, protocol: "tcp" }]),
    env: JSON.stringify({ EULA: "TRUE", TYPE: "VANILLA", MEMORY: "1G", MOTD: "Aether Panel" }),
    memory_mb: 2048,
    cpus: 1,
    sort: 10,
  },
  {
    id: "minecraft-bedrock",
    name: "Minecraft Bedrock",
    description: "Cross-platform Bedrock server (UDP 19132).",
    image: "itzg/minecraft-bedrock-server",
    ports: JSON.stringify([
      { port: 19132, protocol: "udp" },
      { port: 19132, protocol: "tcp" },
    ]),
    env: JSON.stringify({ EULA: "TRUE", SERVER_NAME: "Aether Bedrock" }),
    memory_mb: 2048,
    cpus: 1,
    sort: 11,
  },
  {
    id: "valheim",
    name: "Valheim",
    description: "Valheim dedicated (UDP 2456-2458). Set PASSWORD in env (min 5 chars).",
    image: "itzg/valheim-server",
    ports: JSON.stringify([
      { port: 2456, protocol: "udp" },
      { port: 2457, protocol: "udp" },
      { port: 2458, protocol: "udp" },
    ]),
    env: JSON.stringify({
      SERVER_NAME: "Aether Server",
      WORLD_NAME: "Midgard",
      SERVER_PUBLIC: "0",
      SERVER_PORT: "2456",
    }),
    memory_mb: 4096,
    cpus: 2,
    sort: 20,
  },
  {
    id: "palworld",
    name: "Palworld",
    description: "Palworld dedicated (UDP 8211). Heavy: needs 4GB+ RAM.",
    image: "thijsvanloef/palworld-server-docker",
    ports: JSON.stringify([
      { port: 8211, protocol: "udp" },
      { port: 27015, protocol: "udp" },
    ]),
    env: JSON.stringify({
      PORT: "8211",
      PLAYERS: "16",
      COMMUNITY: "false",
      SERVER_NAME: "Aether Palworld",
    }),
    memory_mb: 6144,
    cpus: 2,
    sort: 30,
  },
  {
    id: "cs2",
    name: "Counter-Strike 2",
    description: "CS2 dedicated server. Requires a GSLT match token for public play.",
    image: "cm2network/cs2",
    ports: JSON.stringify([
      { port: 27015, protocol: "tcp" },
      { port: 27015, protocol: "udp" },
    ]),
    env: JSON.stringify({}),
    memory_mb: 4096,
    cpus: 2,
    sort: 40,
  },
  {
    id: "terraria",
    name: "Terraria",
    description: "Terraria dedicated server (tshock).",
    image: "quantumforce/terraria-server",
    ports: JSON.stringify([{ port: 7777, protocol: "tcp" }]),
    env: JSON.stringify({}),
    memory_mb: 2048,
    cpus: 1,
    sort: 50,
  },
  {
    id: "discord-js",
    name: "Discord Bot (Node.js)",
    description: "discord.js bot on Node 20. Upload your code, set STARTUP_FILE (e.g. index.js) and DISCORD_TOKEN in env.",
    image: "node:20-bookworm-slim",
    ports: JSON.stringify([]),
    env: JSON.stringify({ STARTUP_FILE: "index.js", DISCORD_TOKEN: "" }),
    memory_mb: 512,
    cpus: 0.5,
    sort: 110,
  },
  {
    id: "nodejs-app",
    name: "Node.js App",
    description: "Generic Node 20 app. Set STARTUP_FILE; add PORT if it listens on HTTP (3000 pre-mapped).",
    image: "node:20-bookworm-slim",
    ports: JSON.stringify([{ port: 3000, protocol: "tcp" }]),
    env: JSON.stringify({ STARTUP_FILE: "index.js", PORT: "3000" }),
    memory_mb: 1024,
    cpus: 1,
    sort: 111,
  },
  {
    id: "discord-py",
    name: "Discord Bot (Python)",
    description: "discord.py bot on Python 3.12. Upload your code, set STARTUP_FILE (e.g. main.py) and DISCORD_TOKEN in env.",
    image: "python:3.12-slim",
    ports: JSON.stringify([]),
    env: JSON.stringify({ STARTUP_FILE: "main.py", DISCORD_TOKEN: "" }),
    memory_mb: 512,
    cpus: 0.5,
    sort: 120,
  },
  {
    id: "python-app",
    name: "Python App",
    description: "Generic Python 3.12 app. Set STARTUP_FILE; add PORT if it listens on HTTP (8080 pre-mapped).",
    image: "python:3.12-slim",
    ports: JSON.stringify([{ port: 8080, protocol: "tcp" }]),
    env: JSON.stringify({ STARTUP_FILE: "main.py", PORT: "8080" }),
    memory_mb: 1024,
    cpus: 1,
    sort: 121,
  },
];

export const CUSTOM_EGG_ID = "custom";

// Nests group eggs in both the admin editor and the creation wizard.
const NEST_SEED: Nest[] = [
  { id: "minecraft", name: "Minecraft", sort: 10 },
  { id: "game-servers", name: "Game Servers", sort: 100 },
  { id: "javascript", name: "JavaScript / Node", sort: 110 },
  { id: "python", name: "Python", sort: 120 },
];

export function seedNests() {
  const ins = db.prepare(
    `INSERT INTO nests (id, name, sort) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, sort=excluded.sort`,
  );
  for (const n of NEST_SEED) ins.run(n.id, n.name, n.sort);
}

export function seedEggs() {
  const nestFor = (eggId: string) =>
    eggId.startsWith("minecraft")
      ? "minecraft"
      : eggId === "discord-js" || eggId === "nodejs-app"
        ? "javascript"
        : eggId === "discord-py" || eggId === "python-app"
          ? "python"
          : "game-servers";
  const ins = db.prepare(
    `INSERT INTO eggs (id, name, description, image, ports, env, memory_mb, cpus, sort, nest_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
       image=excluded.image, ports=excluded.ports, env=excluded.env,
       memory_mb=excluded.memory_mb, cpus=excluded.cpus, sort=excluded.sort, nest_id=excluded.nest_id`,
  );
  for (const e of EGG_SEED) {
    ins.run(e.id, e.name, e.description, e.image, e.ports, e.env, e.memory_mb, e.cpus, e.sort, nestFor(e.id));
  }
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: number;
  display_name?: string | null;
  bio?: string | null;
  discord_id?: string | null;
  discord_username?: string | null;
  discord_avatar?: string | null;
  totp_secret?: string | null;
  totp_enabled?: number | null;
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
  ports: string;
}

// Existing databases may predate the ports column (egg presets send multiple
// tcp/udp bindings; the single port column stays for display compatibility).
try {
  db.exec("ALTER TABLE servers ADD COLUMN ports TEXT NOT NULL DEFAULT '[]'");
} catch {
  /* column exists */
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

// Existing databases predate the account self-service profile fields.
try {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
} catch {
  /* column exists */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
} catch {
  /* column exists */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN discord_id TEXT");
} catch {
  /* column exists */
}

// Eggs may predate nests — add the column first...
try {
  db.exec("ALTER TABLE eggs ADD COLUMN nest_id TEXT NOT NULL DEFAULT ''");
} catch {
  /* column exists */
}

// nests must exist AND be seeded before the backfill picks a nest id.
seedNests();

{
  const nestIds = new Set(
    (db.prepare("SELECT id FROM nests").all() as Nest[]).map((n) => n.id),
  );
  if (nestIds.size > 0) {
    const orphan = db
      .prepare("SELECT id FROM eggs WHERE nest_id = '' OR nest_id IS NULL")
      .all() as Array<{ id: string }>;
    for (const { id } of orphan) {
      const nestId = nestIds.has("minecraft") && id.startsWith("minecraft") ? "minecraft" : [...nestIds][0];
      db.prepare("UPDATE eggs SET nest_id = ? WHERE id = ?").run(nestId, id);
    }
  }
}

seedEggs();

/* ------------------------------------------------------------- branding */

export interface Branding {
  panelName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
}

const BRANDING_DEFAULTS: Branding = {
  panelName: "Aether Panel",
  tagline: "Game servers, handled.",
  logoUrl: "",
  faviconUrl: "",
};

export function getBranding(): Branding {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (key: keyof typeof BRANDING_DEFAULTS) => {
    const raw = map.get(key);
    return raw && raw.trim() !== "" ? raw : BRANDING_DEFAULTS[key];
  };
  return {
    panelName: pick("panelName"),
    tagline: pick("tagline"),
    logoUrl: pick("logoUrl"),
    faviconUrl: pick("faviconUrl"),
  };
}

export function setBranding(patch: Partial<Record<keyof Branding, string>>): Branding {
  const clean: Record<string, string> = {};
  for (const k of ["panelName", "tagline", "logoUrl", "faviconUrl"] as const) {
    const v = patch[k];
    if (typeof v !== "string") continue;
    const t = v.trim().slice(0, 300);
    // Clearing the name would break the whole UI, so keep a sane fallback.
    clean[k] = t === "" && k === "panelName" ? BRANDING_DEFAULTS.panelName : t;
  }
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  );
  for (const [k, v] of Object.entries(clean)) upsert.run(k, v);
  return getBranding();
}
