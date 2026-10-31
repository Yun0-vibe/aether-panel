// Boot-probe: starts the compiled panel on a temp port/db, checks the new
// routes respond, then exits the process. Nothing is left running.
process.env.AETHER_PANEL_PORT = "39991";
process.env.AETHER_DB_FILE = process.env.AETHER_DB_FILE ?? "/tmp/probe.db";
await import("./dist/main.js");

const base = "http://127.0.0.1:39991";
async function check(path, opts = {}) {
  try {
    const res = await fetch(base + path, { ...opts });
    const body = res.status === 302 ? "(redirect)" : await res.json().catch(() => "");
    console.log(path, "→", res.status, JSON.stringify(body).slice(0, 180));
  } catch (e) {
    console.log(path, "→ ERR", e.message);
  }
}
await new Promise((r) => setTimeout(r, 900));
await check("/healthz");
await check("/api/branding");
await check("/api/auth/discord/status");
await check("/api/account/passkeys"); // unauthorized expected (401)
await check("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "x@y.z", password: "nope" }) });
process.exit(0);
