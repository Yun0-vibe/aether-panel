import type { Node, Server } from "./db.js";

const TIMEOUT = 15_000;

export function daemonBase(node: Node) {
  return `http://${node.host}:${node.daemon_port}`;
}

export async function daemonFetch(
  node: Node,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(daemonBase(node) + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${node.token}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });
}

export function specFromServer(s: Server) {
  let ports: Array<{ port: number; protocol: string }> = [];
  try {
    const parsed = JSON.parse(s.ports || "[]");
    if (Array.isArray(parsed) && parsed.length) ports = parsed;
  } catch {
    /* fall back to legacy single-port spec */
  }
  return {
    id: s.id,
    name: s.name,
    image: s.image,
    env: JSON.parse(s.env || "{}"),
    ports,
    hostPort: ports.length ? undefined : s.port ?? undefined,
    memoryMB: s.memory_mb ?? undefined,
    cpus: s.cpus ?? undefined,
    command: s.command ?? undefined,
  };
}

// Fetch live statuses for a set of servers, tolerating dead nodes.
export async function statuses(
  nodes: Map<string, Node>,
  list: Server[],
): Promise<Map<string, string>> {
  const out = await Promise.all(
    list.map(async (s) => {
      const node = nodes.get(s.node_id);
      if (!node) return [s.id, "no-node"] as const;
      try {
        const res = await daemonFetch(node, `/v1/servers/${s.id}`);
        if (!res.ok) return [s.id, "unknown"] as const;
        const data = (await res.json()) as { server?: { status?: string } };
        return [s.id, data.server?.status ?? "unknown"] as const;
      } catch {
        return [s.id, "node-offline"] as const;
      }
    }),
  );
  return new Map(out);
}
