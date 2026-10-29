import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { db, type Node, type Server } from "./db.js";

let wss: WebSocketServer | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    if (!part.trim()) continue;
    const i = part.indexOf("=");
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

/** Session-backed socket authorization: only owners (and admins) get a console. */
function authorizeSession(req: IncomingMessage, serverId: string): boolean {
  const token = parseCookies(req.headers.cookie)["ae_session"];
  if (!token) return false;
  const user = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as { id: string; role: string } | undefined;
  if (!user) return false;
  if (user.role === "admin") return true;
  const server = db.prepare("SELECT user_id FROM servers WHERE id = ?").get(serverId) as
    | { user_id: string }
    | undefined;
  return Boolean(server && server.user_id === user.id);
}

/** Called once at boot so we can attach the upgrade handler to the HTTP server. */
export function setWsServer(server: HttpServer) {
  wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Path: /api/servers/:id/console
    const groups = req.url?.match(/^\/api\/servers\/([\w-]+)\/console$/);
    if (!groups || !wss) {
      socket.destroy();
      return;
    }
    const serverId = groups[1];
    if (!authorizeSession(req, serverId)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => {
      pipeConsole(serverId, client).catch(() => client.close());
    });
  });
}

async function pipeConsole(serverId: string, client: WebSocket) {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as
    | Server
    | undefined;
  if (!server) return client.close(1008, "not found");
  const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(server.node_id) as
    | Node
    | undefined;
  if (!node) return client.close(1008, "node missing");

  const daemonUrl = `ws://${node.host}:${node.daemon_port}/v1/ws/${serverId}?token=${encodeURIComponent(node.token)}`;
  const daemon = new WebSocket(daemonUrl, { handshakeTimeout: 10_000 });

  daemon.on("open", () => {
    client.on("message", (data, isBinary) => {
      // Forward commands; the daemon filters/handles framing.
      if (!isBinary && daemon.readyState === WebSocket.OPEN) daemon.send(String(data));
    });
  });
  daemon.on("message", (data, isBinary) => {
    if (!isBinary && client.readyState === WebSocket.OPEN) client.send(String(data));
  });
  daemon.on("close", () => client.close());
  daemon.on("error", () => client.close(1002, "daemon error"));

  client.on("close", () => daemon.close());
  client.on("error", () => {
    daemon.close();
  });
}
