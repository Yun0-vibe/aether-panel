import type { FastifyInstance, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import { requireAuth } from "./auth.js";
import { daemonFetch } from "./daemon.js";
import { db, type Node, type Server, type User } from "./db.js";

type Authed = FastifyRequest & { user: User };

interface GuardResult {
  server: Server;
  node: Node;
}

async function guard(
  req: FastifyRequest,
  reply: { status(int: number): { send(v: any): void } } & any,
): Promise<GuardResult | null> {
  if (!requireAuth(req as Authed, reply)) return null;
  const user = (req as Authed).user;
  const server = db
    .prepare("SELECT * FROM servers WHERE id = ?")
    .get((req.params as any).id) as Server | undefined;
  if (!server) {
    reply.status(404).send({ error: "not found" });
    return null;
  }
  if (user.role !== "admin" && server.user_id !== user.id) {
    reply.status(403).send({ error: "not your server" });
    return null;
  }
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(server.node_id) as
    | Node
    | undefined;
  if (!node) {
    reply.status(502).send({ error: "node missing" });
    return null;
  }
  return { server, node };
}

function q(p: string): string {
  return encodeURIComponent(p);
}

// Streams a daemon response (or request) body through the panel.
async function pipe(
  reply: any,
  res: Response,
  headers: Record<string, string> = {},
) {
  reply.code(res.status);
  for (const [k, v] of Object.entries(headers)) reply.header(k, v);
  if (res.body) {
    Readable.fromWeb(res.body as any).pipe(reply.raw);
    return reply;
  }
  reply.send();
  return reply;
}

async function readDaemon(res: Response, reply: any) {
  const text = await res.text();
  if (!res.ok) {
    reply.code(res.status).send({ error: text });
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function registerFilesBackups(app: FastifyInstance) {
  // Raw octet-stream bodies (uploads) arrive as buffers.
  app.addContentTypeParser(
    /^(application\/octet-stream|multipart\/form-data)/,
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  app.get("/api/servers/:id/files", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const res = await daemonFetch(
      g.node,
      `/v1/files/${g.server.id}?path=${q(String((req.query as any)?.path ?? ""))}`,
    );
    if (!res.ok) return { error: await res.text() };
    return readDaemon(res, reply);
  });

  app.get("/api/servers/:id/files/read", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    return pipe(
      reply,
      await daemonFetch(
        g.node,
        `/v1/files/${g.server.id}/read?path=${q(String((req.query as any).path ?? ""))}`,
      ),
    );
  });

  // Text file editor save: {path, content}
  app.post("/api/servers/:id/files/write", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const { path: path, content } = (req.body ?? {}) as { path?: string; content?: string };
    if (!path) {
      reply.code(400).send({ error: "path required" });
      return;
    }
    const res = await daemonFetch(g.node, `/v1/files/${g.server.id}/write?path=${q(path)}`, {
      method: "POST",
      body: content ?? "",
    });
    return readDaemon(res, reply);
  });

  // Binary upload: raw body to ?path=/plugins/foo.jar
  app.post("/api/servers/:id/files/upload", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const res = await daemonFetch(
      g.node,
      `/v1/files/${g.server.id}/upload?path=${q(String((req.query as any).path ?? ""))}`,
      {
        method: "POST",
        body: Buffer.isBuffer(req.body)
          ? new Uint8Array(req.body)
          : ((req.body as any)?.buffer ?? req.body ?? ""),
      },
    );
    return readDaemon(res, reply);
  });

  // Download a folder as tar.gz
  app.get("/api/servers/:id/files/tar", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const sname = g.server.name.replace(/[^\w-]/g, "");
    return pipe(reply, await daemonFetch(
      g.node,
      `/v1/files/${g.server.id}/tar?path=${q(String((req.query as any).path ?? ""))}`,
    ), {
      "Content-Disposition": `attachment; filename=${JSON.stringify(`${sname}-files.tar.gz`)}`,
    });
  });

  // mkdir | delete | rename — {action, path, to?}
  app.post("/api/servers/:id/files", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const body = (req.body ?? {}) as { action?: string; path?: string; to?: string };
    const route = { mkdir: "mkdir", delete: "delete", rename: "rename" }[body.action ?? ""];
    if (!route || !body.path || (body.action === "rename" && !body.to)) {
      reply.code(400).send({ error: "invalid action" });
      return;
    }
    let res: Response;
    if (route === "rename") {
      res = await daemonFetch(g.node, `/v1/files/${g.server.id}/rename`, {
        method: "POST",
        body: JSON.stringify({ from: body.path, to: body.to }),
      });
    } else {
      res = await daemonFetch(g.node, `/v1/files/${g.server.id}/${route}?path=${q(body.path)}`, {
        method: "POST",
        body: "",
      });
    }
    return readDaemon(res, reply);
  });

  // ------------------------------------------------------------------ backups

  app.get("/api/servers/:id/backups", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    return readDaemon(await daemonFetch(g.node, `/v1/backups/${g.server.id}`), reply);
  });

  app.post("/api/servers/:id/backups", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    return readDaemon(
      // long snapshot time is fine; fetch has its own 15s cap in daemonFetch
      await fetchDaemonLong(g.node, `/v1/backups/${g.server.id}`, "POST"),
      reply,
    );
  });

  app.get("/api/servers/:id/backups/:bid", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const bid = String((req.params as any).bid);
    return pipe(reply, await daemonFetch(
      g.node,
      `/v1/backups/${g.server.id}/${q(bid)}`,
    ), {
      "Content-Disposition": `attachment; filename=${JSON.stringify(`${bid}.tar.gz`)}`,
    });
  });

  app.post("/api/servers/:id/backups/:bid/restore", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    const res = await fetchDaemonLong(
      g.node,
      `/v1/backups/${g.server.id}/${q(String((req.params as any).bid))}/restore`,
      "POST",
    );
    return readDaemon(res, reply);
  });

  app.delete("/api/servers/:id/backups/:bid", async (req, reply) => {
    const g = await guard(req, reply);
    if (!g) return;
    return readDaemon(
      await daemonFetch(g.node, `/v1/backups/${g.server.id}/${q(String((req.params as any).bid))}`, {
        method: "DELETE",
      }),
      reply,
    );
  });
}

// Backup create/restore can outlive the general 15s daemon timeout.
function fetchDaemonLong(node: Node, path: string, method: string): Promise<Response> {
  return fetch(`http://${node.host}:${node.daemon_port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${node.token}` },
    signal: AbortSignal.timeout(900_000),
  });
}
