import { daemonFetch } from "./daemon.js";
import { db, type Node } from "./db.js";

const CHECK_INTERVAL = 60_000; // 1 minute

/**
 * Scheduled backups: servers with backup_every_hours > 0 are snapshotted on
 * cadence, keeping the most recent AETHER_KEEP_BACKUPS archives per server.
 */
export function startScheduler() {
  const keep = Number(process.env.AETHER_KEEP_BACKUPS) || 10;
  const timer = setInterval(run, CHECK_INTERVAL);
  timer.unref?.();
  run();
}

async function run() {
  const rows = db
    .prepare("SELECT * FROM servers WHERE backup_every_hours > 0")
    .all() as Array<{ id: string; name: string; node_id: string; backup_every_hours: number; last_backup_at: number | null }>;
  const now = Date.now();
  for (const s of rows) {
    const last = s.last_backup_at ?? 0;
    if (now - last < s.backup_every_hours * 3_600_000) continue;
    const node = db.prepare("SELECT * FROM nodes WHERE id = ?").get(s.node_id) as Node | undefined;
    if (!node) continue;
    try {
      const res = await daemonFetch(node, `/v1/backups/${s.id}`, { method: "POST" });
      if (!res.ok) continue;
      db.prepare("UPDATE servers SET last_backup_at = ? WHERE id = ?").run(now, s.id);
      await prune(node, s.id);
      console.log(`[scheduler] backup completed for ${s.name} (${s.id})`);
    } catch {
      // node unreachable; retry on the next tick once the cadence elapses
      continue;
    }
  }
}

// Delete oldest archives beyond the retention cap.
async function prune(node: Node, serverId: string) {
  const keep = Number(process.env.AETHER_KEEP_BACKUPS) || 10;
  try {
    const res = await daemonFetch(node, `/v1/backups/${serverId}`);
    if (!res.ok) return;
    const list = (await res.json()) as { backups: Array<{ id: string; createdAt: string }> };
    const sorted = [...list.backups].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const old of sorted.slice(0, Math.max(0, sorted.length - keep))) {
      await daemonFetch(node, `/v1/backups/${serverId}/${old.id}`, { method: "DELETE" });
    }
  } catch {
    /* pruning is best-effort */
  }
}
