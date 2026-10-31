import crypto from "node:crypto";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { setWsServer } from "./console.js";
import {
  COOKIE,
  createSession,
  destroySession,
  hashPassword,
  lookupUser,
  publicUser,
  requireAdmin,
  requireAuth,
  verifyPassword,
} from "./auth.js";
import { daemonFetch, specFromServer, statuses } from "./daemon.js";
import { db, type Egg, type Node, type Server, type User, CUSTOM_EGG_ID } from "./db.js";
import { registerFilesBackups } from "./files-backups.js";
import { startScheduler } from "./scheduler.js";

const app = Fastify({ logger: false, trustProxy: true });
app.register(cookie);
registerFilesBackups(app);
startScheduler();

const id = () => crypto.randomUUID();
const now = () => Date.now();

type Authed = FastifyRequest & { user: User };

// ---------------------------------------------------------------- auth

app.post("/api/auth/register", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return reply.status(400).send({ error: "email and password are required" });
  }
  if (password.length < 8) {
    return reply.status(400).send({ error: "password must be at least 8 characters" });
  }
  const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as any).c as number;
  const openRegister = process.env.AETHER_OPEN_REGISTER === "true";
  if (userCount > 0 && !openRegister) {
    return reply
      .status(403)
      .send({ error: "registration is closed; ask an admin to create your account" });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return reply.status(409).send({ error: "email already registered" });
  }
  const user: User = {
    id: id(),
    email,
    password_hash: hashPassword(password),
    role: userCount === 0 ? "admin" : "user",
    created_at: now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(user.id, user.email, user.password_hash, user.role, user.created_at);
  createSession(reply, user.id);
  return { user: publicUser(user) };
});

app.post("/api/auth/login", async (req, reply) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  if (!row || !verifyPassword(body.password ?? "", row.password_hash)) {
    return reply.status(401).send({ error: "invalid credentials" });
  }
  createSession(reply, row.id);
  return { user: publicUser(row) };
});

app.post("/api/auth/logout", async (req, reply) => {
  destroySession(req, reply);
  return { ok: true };
});

app.get("/api/auth/me", async (req, reply) => {
  const user = lookupUser(req);
  if (!user) return reply.status(401).send({ error: "unauthorized" });
  return { user: publicUser(user) };
});

// ---------------------------------------------------------------- account self-service

// Update the signed-in user's profile (display name, bio, discord link).
app.patch("/api/account", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const displayName = body.displayName === undefined ? user.display_name : String(body.displayName).slice(0, 48).trim();
  const bio = body.bio === undefined ? user.bio : String(body.bio).slice(0, 280).trim();
  if (displayName === "") return reply.status(400).send({ error: "Display name cannot be empty" });
  // Discord IDs must be a numeric snowflake (17-20 digits) or empty to unlink.
  const discordId =
    body.discordId === undefined ? (user.discord_id ?? "") : String(body.discordId).trim();
  if (discordId !== "" && !/^\d{17,20}$/.test(discordId)) {
    return reply.status(400).send({ error: "Discord ID must be a numeric snowflake (17-20 digits)" });
  }

  db.prepare("UPDATE users SET display_name = ?, bio = ?, discord_id = ? WHERE id = ?").run(
    displayName === "" ? null : displayName,
    bio === "" ? null : bio,
    discordId === "" ? null : discordId,
    user.id,
  );
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  return { user: publicUser(fresh) };
});

// Change the signed-in user's password (requires the current password).
app.post("/api/account/password", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  if (!current || !next) return reply.status(400).send({ error: "Both passwords are required" });
  if (next.length < 6) return reply.status(400).send({ error: "New password must be at least 6 characters" });
  if (current === next) return reply.status(400).send({ error: "New password must differ from the current one" });

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
  if (!verifyPassword(current, row.password_hash)) {
    return reply.status(403).send({ error: "Current password is incorrect" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
  return { ok: true };
});

// ---------------------------------------------------------------- user servers

function serverView(s: Server, node: Node | null, status: string) {
  return {
    id: s.id,
    name: s.name,
    userId: s.user_id,
    nodeId: s.node_id,
    node: node ? { id: node.id, name: node.name, host: node.host } : null,
    image: s.image,
    port: s.port,
    ports: JSON.parse(s.ports || "[]"),
    memoryMB: s.memory_mb,
    cpus: s.cpus,
    backupEveryHours: s.backup_every_hours,
    lastBackupAt: s.last_backup_at,
    status,
  };
}

app.get("/api/servers", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const where = user.role === "admin" ? "" : "WHERE user_id = ?";
  const list = db
    .prepare(`SELECT * FROM servers ${where}`)
    .all(...(where ? [user.id] : [])) as Server[];
  const nodes = nodeMap();
  const st = await statuses(nodes, list);
  return {
    servers: list.map((s) => serverView(s, nodes.get(s.node_id) ?? null, st.get(s.id) ?? "unknown")),
  };
});

app.get("/api/servers/:id", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id) ?? null;
  const st = await statuses(new Map(node ? [[node.id, node]] : []), [s]);
  const view = serverView(s, node, st.get(s.id) ?? "unknown");
  if (user.role === "admin") view.userId = s.user_id;
  else view.userId = user.id;
  return { server: view };
});

app.post("/api/servers/:id/power", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id);
  if (!node) return reply.status(502).send({ error: "server's node is missing" });
  const action = ((req.body ?? {}) as any).action;
  if (!["start", "stop", "restart", "kill"].includes(action)) {
    return reply.status(400).send({ error: "invalid action" });
  }
  try {
    const res = await daemonFetch(node, `/v1/servers/${s.id}/power`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return reply.status(res.status).send({ error: await res.text() });
    return res.json();
  } catch (err: any) {
    return reply.status(502).send({ error: `node unreachable: ${err.message}` });
  }
});

// Relay live container stats from the owning node's daemon.
app.get("/api/servers/:id/stats", async (req, reply) => {
  if (!requireAuth(req as Authed, reply)) return;
  const user = (req as Authed).user;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get((req.params as any).id) as
    | Server
    | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  if (user.role !== "admin" && s.user_id !== user.id) {
    return reply.status(403).send({ error: "not your server" });
  }
  const node = nodeMap().get(s.node_id);
  if (!node) return reply.status(502).send({ error: "server's node is missing" });
  try {
    const res = await daemonFetch(node, `/v1/servers/${s.id}/stats`, {}, 5_000);
    if (!res.ok) return reply.status(res.status).send({ error: await res.text() });
    return res.json();
  } catch (err: any) {
    return reply.status(502).send({ error: `node unreachable: ${err.message}` });
  }
});

// ---------------------------------------------------------------- admin CRUD

function nodeMap(): Map<string, Node> {
  const rows = db.prepare("SELECT * FROM nodes").all() as Node[];
  return new Map(rows.map((n) => [n.id, n]));
}

// Per-node daemon reachability + health summary for admin node cards.
app.get("/api/admin/nodes/status", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const rows = db.prepare("SELECT * FROM nodes ORDER BY created_at").all() as Node[];
  const counts = new Map(
    (db
      .prepare("SELECT node_id, COUNT(*) AS c FROM servers GROUP BY node_id")
      .all() as Array<{ node_id: string; c: number }>).map((r) => [r.node_id, r.c]),
  );
  const nodes = await Promise.all(
    rows.map(async (n) => {
      const base = {
        id: n.id,
        name: n.name,
        host: n.host,
        daemonPort: n.daemon_port,
        serverCount: counts.get(n.id) ?? 0,
      };
      try {
        const res = await daemonFetch(n, "/healthz", {}, 3_000);
        return res.ok ? { ...base, online: true, version: await res.text() } : { ...base, online: false, version: null };
      } catch {
        return { ...base, online: false, version: null };
      }
    }),
  );
  return { nodes };
});

app.get("/api/admin/users", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at").all() as User[];
  return {
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    })),
  };
});

app.post("/api/admin/users", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = (req.body ?? {}) as any;
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !body.password) return reply.status(400).send({ error: "email and password required" });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
    return reply.status(409).send({ error: "email already registered" });
  const user: User = {
    id: id(),
    email,
    password_hash: hashPassword(String(body.password)),
    role: body.role === "admin" ? "admin" : "user",
    created_at: now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(user.id, user.email, user.password_hash, user.role, user.created_at);
  return { user: publicUser(user) };
});

app.patch("/api/admin/users/:uid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const uid = (req.params as any).uid;
  const body = (req.body ?? {}) as any;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid) as User | undefined;
  if (!user) return reply.status(404).send({ error: "not found" });
  if (body.role) {
    if (!["admin", "user"].includes(body.role)) return reply.status(400).send({ error: "bad role" });
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, uid);
  }
  if (body.password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(String(body.password)),
      uid,
    );
  }
  if (body.email) {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(
      String(body.email).trim().toLowerCase(),
      uid,
    );
  }
  return { user: { ...publicUser({ ...user, role: body.role ?? user.role }), email: body.email ?? user.email } };
});

app.delete("/api/admin/users/:uid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const uid = (req.params as any).uid;
  if (uid === (req as Authed).user.id)
    return reply.status(400).send({ error: "cannot delete yourself" });
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  return { deleted: uid };
});

app.get("/api/admin/nodes", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  return { nodes: db.prepare("SELECT * FROM nodes ORDER BY created_at").all() };
});

app.post("/api/admin/nodes", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = (req.body ?? {}) as any;
  const name = String(body.name ?? "").trim();
  const host = String(body.host ?? "").trim();
  if (!name || !host) return reply.status(400).send({ error: "name and host are required" });
  const node: Node = {
    id: id(),
    name,
    host,
    daemon_port: Number(body.daemonPort) || 8080,
    token: String(body.token ?? "").trim(),
    created_at: now(),
  };
  db.prepare("INSERT INTO nodes (id, name, host, daemon_port, token, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    node.id,
    node.name,
    node.host,
    node.daemon_port,
    node.token,
    node.created_at,
  );
  return { node };
});

app.patch("/api/admin/nodes/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nid) as Node | undefined;
  if (!node) return reply.status(404).send({ error: "not found" });
  const body = (req.body ?? {}) as any;
  const upd: Partial<Node> = {
    name: body.name ? String(body.name).trim() : node.name,
    host: body.host ? String(body.host).trim() : node.host,
    daemon_port: Number(body.daemonPort) || node.daemon_port,
    token: body.token ? String(body.token).trim() : node.token,
  };
  db.prepare(
    "UPDATE nodes SET name = ?, host = ?, daemon_port = ?, token = ? WHERE id = ?",
  ).run(upd.name!, upd.host!, upd.daemon_port!, upd.token!, nid);
  return { node: { ...node, ...upd } };
});

app.delete("/api/admin/nodes/:nid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const nid = (req.params as any).nid;
  const count = (db.prepare("SELECT COUNT(*) AS c FROM servers WHERE node_id = ?").get(nid) as any)
    .c as number;
  if (count > 0) return reply.status(400).send({ error: "node still has servers" });
  db.prepare("DELETE FROM nodes WHERE id = ?").run(nid);
  return { deleted: nid };
});

app.get("/api/admin/eggs", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const eggs = db.prepare("SELECT * FROM eggs ORDER BY sort, name").all() as Egg[];
  return {
    eggs: eggs.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      image: e.image,
      ports: JSON.parse(e.ports || "[]"),
      env: JSON.parse(e.env || "{}"),
      memoryMB: e.memory_mb,
      cpus: e.cpus,
    })),
  };
});

// Validate optional fields shared by create/patch server.
function parseServerFields(body: any) {
  const env: string = typeof body.env === "string" ? body.env : JSON.stringify(body.env ?? {});
  if (!/^[\x00-\x7F]*$/.test(env) || (env && !safeJSON(env))) return null;
  let ports = "[]";
  let portsValue = body.ports ?? "[]";
  try {
    const parsed = Array.isArray(portsValue) ? portsValue.filter(validPort) : JSON.parse(portsValue);
    ports = JSON.stringify(parsed);
  } catch {
    return null;
  }
  return {
    name: String(body.name ?? "").trim(),
    user_id: String(body.userId ?? ""),
    node_id: String(body.nodeId ?? ""),
    image: String(body.image ?? "").trim(),
    env,
    ports,
    port: body.port == null ? null : Number(body.port),
    memory_mb: body.memoryMB == null ? null : Math.round(Number(body.memoryMB)),
    cpus: body.cpus == null ? null : Number(body.cpus),
    command: body.command ? String(body.command) : null,
    backup_every_hours: Math.max(0, Math.round(Number(body.backupEveryHours ?? 0))) || 0,
  };
}

function validPort(p: any) {
  return p && Number.isInteger(Number(p.port)) && Number(p.port) > 0 && Number(p.port) <= 65535 &&
    ["tcp", "udp"].includes(String(p.protocol));
}

function safeJSON(s: string) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

app.get("/api/admin/servers", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const list = db.prepare("SELECT * FROM servers ORDER BY created_at").all() as Server[];
  const nodes = nodeMap();
  const st = await statuses(nodes, list);
  return {
    servers: list.map((s) => serverView(s, nodes.get(s.node_id) ?? null, st.get(s.id) ?? "unknown")),
  };
});

app.post("/api/admin/servers", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const body = { ...((req.body as any) ?? {}) };

  // Egg presets fill in image/env/ports/cpu/memory defaults.
  if (body.eggId && body.eggId !== CUSTOM_EGG_ID) {
    const egg = db.prepare("SELECT * FROM eggs WHERE id = ?").get(String(body.eggId)) as
      | Egg
      | undefined;
    if (!egg) return reply.status(400).send({ error: "unknown egg" });
    const eggEnv = JSON.parse(egg.env || "{}");
    const userEnv = typeof body.env === "object" && body.env ? body.env : {};
    if (!body.image) body.image = egg.image;
    if (!body.ports || (Array.isArray(body.ports) && body.ports.length === 0)) {
      body.ports = JSON.parse(egg.ports || "[]");
    }
    if (body.memoryMB == null) body.memoryMB = egg.memory_mb;
    if (body.cpus == null) body.cpus = egg.cpus;
    body.env = { ...eggEnv, ...userEnv };
  }

  const fields = parseServerFields(body);
  if (!fields) return reply.status(400).send({ error: "invalid server fields" });
  if (!fields.name || !fields.image || !fields.user_id || !fields.node_id) {
    return reply
      .status(400)
      .send({ error: "name, userId, nodeId and image are required" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(fields.user_id);
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(fields.node_id) as Node | undefined;
  if (!user) return reply.status(400).send({ error: "unknown user" });
  if (!node) return reply.status(400).send({ error: "unknown node" });

  const server: Server = {
    id: id(),
    created_at: now(),
    last_backup_at: null,
    ...fields,
  } as unknown as Server;
  db.prepare(
    `INSERT INTO servers (id, name, user_id, node_id, image, env, ports, port, memory_mb, cpus, command, created_at, backup_every_hours, last_backup_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    server.id,
    server.name,
    server.user_id,
    server.node_id,
    server.image,
    server.env,
    server.ports,
    server.port,
    server.memory_mb,
    server.cpus,
    server.command,
    server.created_at,
    server.backup_every_hours,
    null,
  );

  // Register with the daemon so the container is created (and image pulled).
  try {
    const res = await daemonFetch(node, "/v1/servers", {
      method: "POST",
      body: JSON.stringify(specFromServer(server)),
    });
    if (!res.ok) {
      const text = await res.text();
      return reply
        .status(200)
        .send({ server, warning: `node rejected registration: ${text}` });
    }
  } catch (err: any) {
    return reply.status(200).send({
      server,
      warning: `node unreachable, server will be pushed on next power action: ${err.message}`,
    });
  }
  return { server: serverView(server, node, "created") };
});

app.patch("/api/admin/servers/:sid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const sid = (req.params as any).sid;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  const patch = parseServerFields({ ...s, ...(req.body ?? {}) });
  if (!patch) return reply.status(400).send({ error: "invalid server fields" });
  db.prepare(
    `UPDATE servers SET name = ?, user_id = ?, node_id = ?, image = ?, env = ?, ports = ?,
     port = ?, memory_mb = ?, cpus = ?, command = ?, backup_every_hours = ? WHERE id = ?`,
  ).run(
    patch.name,
    patch.user_id,
    patch.node_id,
    patch.image,
    patch.env,
    patch.ports,
    patch.port,
    patch.memory_mb,
    patch.cpus,
    patch.command,
    patch.backup_every_hours,
    sid,
  );
  // Push new spec to the (possibly new) node; container recreation is handled by the daemon.
  const node = nodeMap().get(patch.node_id);
  if (node) {
    try {
      const updated = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server;
      await daemonFetch(node, "/v1/servers", {
        method: "POST",
        body: JSON.stringify(specFromServer(updated)),
      });
    } catch {
      /* push best-effort; power actions retry */
    }
  }
  const st = node ? await statuses(new Map([[node.id, node]]), [s]) : new Map<string, string>();
  return { server: serverView({ ...s, ...patch }, node ?? null, st.get(s.id) ?? "unknown") };
});

app.delete("/api/admin/servers/:sid", async (req, reply) => {
  if (!requireAdmin(req as Authed, reply)) return;
  const sid = (req.params as any).sid;
  const s = db.prepare("SELECT * FROM servers WHERE id = ?").get(sid) as Server | undefined;
  if (!s) return reply.status(404).send({ error: "not found" });
  const node = nodeMap().get(s.node_id);
  if (node) {
    try {
      await daemonFetch(node, `/v1/servers/${s.id}`, { method: "DELETE" });
    } catch {
      /* still remove locally */
    }
  }
  db.prepare("DELETE FROM servers WHERE id = ?").run(sid);
  return { deleted: sid };
});

// ---------------------------------------------------------------- boot

const port = Number(process.env.AETHER_PANEL_PORT) || 3000;

// Serve the built client in production if it exists.
const clientDist = path.join(process.cwd(), "panel", "client", "dist");
if (fs.existsSync(clientDist)) {
  await app.register(fastifyStatic, { root: clientDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) return reply.status(404).send({ error: "not found" });
    return reply.sendFile("index.html");
  });
}

await app.ready();
setWsServer(app.server);
const addr = await app.listen({ host: "0.0.0.0", port });

console.log(`aether panel api listening on ${addr}`);
console.log(`open the client at http://localhost:${port}${fs.existsSync(clientDist) ? "" : " (dev: client on :5173)"}`);
