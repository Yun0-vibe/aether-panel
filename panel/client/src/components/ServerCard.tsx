import { Link } from "react-router-dom";
import { gameAddress } from "../auth/AuthContext";
import type { ServerSummary } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import { IconActivity, IconGlobe, IconHardDrive, IconCopy, IconCheck, IconServer, IconUsers } from "../components/Icons";

export function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "running" || s === "started" || s === "online"
      ? "badge-green"
      : s === "stopped" || s === "exited" || s === "" || s === "offline" || s === "no-node"
        ? "badge-gray"
        : s === "starting" || s === "restarting" || s === "created"
          ? "badge-blue"
          : s === "killed" || s === "error" || s === "node-offline"
            ? "badge-red"
            : "badge-yellow";
  const label =
    s === "no-node" ? "unassigned" : s === "node-offline" ? "node offline" : s || "unknown";
  return (
    <span className={`status-badge ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
      {label}
    </span>
  );
}

function artFor(image: string) {
  const seed = image.replace(/[:@]/g, "/");
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}

function gameName(image: string) {
  const parts = image.replace(/:latest$/, "").split("/").filter(Boolean);
  const raw = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? image;
  return raw.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 28);
}

export function ServerCard({ server }: { server: ServerSummary }) {
  const hue = artFor(server.image);
  const running = ["running", "started", "online"].includes((server.status ?? "").toLowerCase());
  const name = gameName(server.image);
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const toast = useToast();
  const address = gameAddress(server.node?.host, server.port);

  async function copyAddress(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.push(`Copied ${server.name} — ${address}`, "success");
    } catch {
      toast.pushError("Clipboard blocked by the browser");
    }
  }

  return (
    <Link to={`/servers/${server.id}`} className="relative flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface backdrop-blur-[16px] -webkit-backdrop-blur-[16px] shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group animate-[fade-up_520ms_var(--ease)_both]">
      <div className="relative h-[118px] grid place-items-center overflow-hidden border-b border-border" style={{ background: `linear-gradient(135deg, hsla(${hue},80%,52%,0.42), hsla(${(hue + 45) % 360},75%,42%,0.22) 60%, transparent)` }}>
        <span className="absolute inset-0 w-[190px] h-[190px] rounded-full blur-[42px] opacity-55 group-hover:opacity-85 group-hover:scale-110 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ background: `hsl(${hue} 90% 58%)` }} />
        <span className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[26px_26px] mask-[linear-gradient(180deg,#000,transparent)] -webkit-mask-[linear-gradient(180deg,#000,transparent)]" />
        <span className="relative z-10 flex items-center justify-center min-w-[54px] h-[14px] rounded-[16px] px-3 font-display text-[20px] font-bold tracking-[0.04em] text-white/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] bg-white/10 border border-white/18 backdrop-blur-[6px] -webkit-backdrop-blur-[6px] shadow-[0_10px_26px_-10px_rgba(0,0,0,0.75)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:-translate-y-[2px]">
          {initials}
        </span>
        {running && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse" />}
      </div>

      <div className="flex flex-col gap-[13px] p-[15px] p-[16px] pb-[16px]">
        <div className="flex items-flex-start justify-between gap-[10px]">
          <div className="min-w-0 flex flex-col gap-[3px]">
            <h3 className="text-[16px] font-bold trunc">{server.name}</h3>
            <span className="text-[11px] font-semibold tracking-widest uppercase trunc text-text-3">{name}</span>
          </div>
          <StatusBadge status={server.status} />
        </div>

        <div className="flex flex-wrap gap-[6px]">
          {server.owner && (
            <span className="inline-flex items-center gap-[5px] max-w-full px-[3.5px] py-[3px] rounded-lg bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.28)] text-[11px] font-semibold text-[#c4b5fd]" title={server.owner.email}>
              <IconUsers size={14} className="flex-none opacity-80" />
              <span className="trunc">{server.owner.displayName}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-[5px] max-w-full px-[3.5px] py-[3px] rounded-lg bg-white/4 border border-border text-[11px] font-semibold text-text-2">
            <IconHardDrive size={14} className="text-text-3 flex-none" />
            <span className="trunc" title={name}>{name}</span>
          </span>
          <span className="inline-flex items-center gap-[5px] max-w-full px-[3.5px] py-[3px] rounded-lg bg-white/4 border border-border text-[11px] font-semibold text-text-2">
            <IconActivity size={14} className="text-text-3 flex-none" />
            {server.node?.name ?? server.nodeId ?? "—"}
          </span>
          {address ? (
            <button
              onClick={copyAddress}
              title={`Click to copy ${address}`}
              aria-label={`Copy server address ${address}`}
              className="inline-flex items-center gap-[5px] max-w-full px-[3.5px] py-[3px] rounded-lg bg-white/4 border border-border text-[11px] font-semibold text-text-2 font-mono transition-colors duration-150 hover:border-brand/60 hover:text-brand cursor-copy"
            >
              <IconGlobe size={14} className="text-text-3 flex-none" />
              <span className="trunc">{address}</span>
              <IconCopy size={12} className="text-text-3 flex-none" />
            </button>
          ) : server.port != null ? (
            <span className="inline-flex items-center gap-[5px] max-w-full px-[3.5px] py-[3px] rounded-lg bg-white/4 border border-border text-[11px] font-semibold text-text-2">
              <IconGlobe size={14} className="text-text-3 flex-none" />
              {server.port}
            </span>
          ) : null}
        </div>

        <span className="self-start text-[12px] font-bold text-brand opacity-0 translate-x-[-6px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:translate-x-0">Manage server</span>
      </div>
    </Link>
  );
}
