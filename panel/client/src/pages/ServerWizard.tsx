import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../auth/AuthContext";
import { useToast } from "../components/Toasts";
import {
  IconArrowLeft, IconCheck, IconChevronRight, IconServer, IconUsers, IconLayers,
  IconRocket, IconCpu, IconMemory, IconAlert,
} from "../components/Icons";

interface EggPort { port: number; protocol: string }
interface Egg {
  id: string;
  name: string;
  description?: string;
  image: string;
  ports?: EggPort[];
  env?: Record<string, string>;
  memoryMB?: number;
  cpus?: number;
  nestId: string;
  nestName: string | null;
}
interface NestOpt { id: string; name: string }
interface UserOpt { id: string; email: string }
interface NodeOpt { id: string; name: string; host: string }

const STEPS = ["Game", "Configure", "Review"] as const;

const FIELD =
  "h-[40px] w-full rounded-lg border border-border bg-[rgba(0,0,0,0.26)] px-[13px] text-[13.5px] text-white outline-none transition-all duration-150 focus:border-brand/60 focus:bg-[rgba(34,211,238,0.05)]";

export function ServerWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [eggs, setEggs] = useState<Egg[] | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [nodes, setNodes] = useState<NodeOpt[]>([]);

  useEffect(() => {
    api<{ eggs?: Egg[] }>("/api/admin/eggs").then((d) => setEggs(d.eggs ?? [])).catch(() => setEggs([]));
    api<{ users?: UserOpt[] }>("/api/admin/users").then((d) => setUsers(d.users ?? [])).catch(() => {});
    api<{ nodes?: NodeOpt[] }>("/api/admin/nodes").then((d) => setNodes(d.nodes ?? [])).catch(() => {});
  }, []);

  const [eggId, setEggId] = useState<string | null>(null);
  const [customImage, setCustomImage] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [memoryMB, setMemoryMB] = useState("");
  const [cpus, setCpus] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const egg = (eggs ?? []).find((e) => e.id === eggId) ?? null;

  const pickEgg = useCallback((e: Egg) => {
    setEggId(e.id);
    setMemoryMB(String(e.memoryMB ?? 1024));
    setCpus(String(e.cpus ?? 1));
    if (!name) setName(`${e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-1`);
  }, [name]);

  const pickCustom = useCallback(() => {
    setEggId("custom");
    if (!memoryMB) setMemoryMB("2048");
    if (!cpus) setCpus("1");
  }, [memoryMB, cpus]);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      await api("/api/admin/servers", {
        method: "POST",
        body: {
          name, userId, nodeId,
          eggId: eggId === "custom" ? undefined : eggId,
          image: eggId === "custom" ? customImage.trim() : undefined,
          memoryMB: Number(memoryMB) || undefined,
          cpus: Number(cpus) || undefined,
        },
      });
      toast.push(`${name} provisioned — image pulling on the node`, "success");
      navigate("/admin/servers");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create server");
      setBusy(false);
    }
  }

  const canNext =
    step === 0
      ? eggId !== null
      : step === 1
        ? name.trim() !== "" && userId !== "" && nodeId !== "" && (eggId !== "custom" || customImage.trim() !== "")
        : true;

  // Group eggs by nest for the selection grid.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; eggs: Egg[] }>();
    for (const e of eggs ?? []) {
      const key = e.nestId || e.nestName || "Game Servers";
      if (!map.has(key)) map.set(key, { name: key, eggs: [] });
      map.get(key)!.eggs.push(e);
    }
    return [...map.entries()].map(([, v]) => v);
  }, [eggs]);

  return (
    <div className="flex flex-col gap-[20px]">
      {/* header + step rail */}
      <div className="flex items-center gap-[10px]">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <IconArrowLeft size={15} className="flex-none" /> Back
        </button>
      </div>
      <div>
        <h1 className="page-title bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#818cf8] bg-clip-text text-[clamp(26px,3vw,34px)] font-black tracking-tight text-transparent">
          Create server
        </h1>
        <p className="mt-[6px] text-[13.5px] text-text-2">Pick a preset, assign an owner and node, review, provision.</p>
      </div>

      <ol className="flex items-center gap-[6px] flex-wrap">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <li className={`flex items-center gap-[8px] rounded-full border px-[14px] py-[7px] text-[12px] font-bold transition-colors ${i === step ? "border-fuchsia-400/50 bg-[rgba(168,85,247,0.12)] text-fuchsia-200" : i < step ? "border-green/30 bg-[rgba(52,211,153,0.08)] text-green-400" : "border-border bg-white/3 text-text-3"}`}>
              {i < step ? <IconCheck size={13} className="flex-none" /> : <span className="font-mono text-[11px]">{i + 1}</span>}
              {s}
            </li>
            {i < STEPS.length - 1 && <IconChevronRight size={13} className="flex-none text-text-3" />}
          </React.Fragment>
        ))}
      </ol>

      {/* step 1: eggs */}
      {step === 0 && (
        <div className="flex flex-col gap-[18px]">
          {eggs === null && <div className="card p-6 text-[13px] text-text-3">Loading presets…</div>}
          {grouped.map((group) => (
            <div key={group.name} className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-[8px] border-b border-border pb-[7px]">
                <IconLayers size={14} className="flex-none text-fuchsia-300" />
                <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-2">{group.name}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[14px]">
                {group.eggs.map((e) => (
                  <EggCard key={e.id} egg={e} selected={eggId === e.id} onPick={pickEgg} />
                ))}
              </div>
            </div>
          ))}
          {eggs !== null && (
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-[8px] border-b border-border pb-[7px]">
                <IconLayers size={14} className="flex-none text-fuchsia-300" />
                <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-2">Advanced</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[14px]">
                <button
                  onClick={pickCustom}
                  className={`relative flex flex-col items-start gap-[8px] rounded-[18px] border border-dashed p-[18px] text-left transition-all duration-200 hover:-translate-y-[3px] ${eggId === "custom" ? "border-fuchsia-400/60 bg-[rgba(168,85,247,0.10)] shadow-[0_22px_44px_-24px_rgba(168,85,247,0.55)]" : "border-border bg-surface hover:border-fuchsia-400/40"}`}
                >
                  {eggId === "custom" && (
                    <span className="absolute top-[14px] right-[14px] grid h-[22px] w-[22px] place-items-center rounded-full brand-grad text-white">
                      <IconCheck size={13} />
                    </span>
                  )}
                  <span className="font-display text-[16px] font-black text-white">Custom image</span>
                  <span className="text-[12px] leading-[1.5] text-text-2 min-h-[36px]">Any Docker image — defaults applied, no preset ports or env.</span>
                  <span className="mono trunc w-full rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[9px] py-[5px] text-[11px] text-text-3">image set in next step</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* step 2: configuration */}
      {step === 1 && (
        <section className="card p-[22px]">
          <div className="grid grid-cols-1 gap-[15px] lg:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Server name</span>
              <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. survival-01" />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Owner</span>
              <select className={FIELD} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select a user…</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.email}</option>))}
              </select>
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Node</span>
              <select className={FIELD} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                <option value="">Select a node…</option>
                {nodes.map((n) => (<option key={n.id} value={n.id}>{n.name} — {n.host}</option>))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-[12px]">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Memory (MB)</span>
                <input className={FIELD} type="number" min={256} step={128} value={memoryMB} onChange={(e) => setMemoryMB(e.target.value)} />
              </label>
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">vCPUs</span>
                <input className={FIELD} type="number" min={0.5} step={0.5} value={cpus} onChange={(e) => setCpus(e.target.value)} />
              </label>
            </div>
            {eggId === "custom" && (
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">Docker image</span>
                <input className={FIELD + " font-mono !text-[12.5px]"} value={customImage} onChange={(e) => setCustomImage(e.target.value)} placeholder="e.g. ghcr.io/pterodactyl/yolks:java_17" />
              </label>
            )}
          </div>
          {nodes.length === 0 && (
            <p className="mt-[14px] flex items-center gap-[8px] rounded-lg border border-yellow-500/30 bg-[rgba(250,204,21,0.08)] px-[13px] py-[10px] text-[12.5px] text-yellow-300">
              <IconAlert size={15} className="flex-none" /> No nodes exist yet — register one under Nodes first.
            </p>
          )}
        </section>
      )}

      {/* step 3: review */}
      {step === 2 && (
        <section className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[380px_1fr]">
          <div className="card p-[22px] flex flex-col gap-[14px]">
            <h3 className="flex items-center gap-[9px] text-[15px] font-bold"><IconServer size={17} className="text-fuchsia-300" /> {name || "unnamed server"}</h3>
            <dl className="flex flex-col gap-[11px] text-[13px]">
              <Row icon={<IconAlert size={14} className="flex-none text-text-3" />} label="Preset" value={egg?.name ?? "Custom image"} />
              <Row icon={<IconServer size={14} className="flex-none text-text-3" />} label="Image" value={(egg?.image ?? customImage) || "—"} mono />
              <Row icon={<IconUsers size={14} className="flex-none text-text-3" />} label="Owner" value={users.find((u) => u.id === userId)?.email ?? "—"} />
              <Row icon={<IconLayers size={14} className="flex-none text-text-3" />} label="Node" value={nodes.find((n) => n.id === nodeId)?.name ?? "—"} />
              <Row icon={<IconMemory size={14} className="flex-none text-text-3" />} label="Memory" value={`${memoryMB || "?"} MB`} />
              <Row icon={<IconCpu size={14} className="flex-none text-text-3" />} label="vCPUs" value={cpus || "?"} />
              <Row icon={<IconLayers size={14} className="flex-none text-text-3" />} label="Ports (preset)" value={(egg?.ports ?? []).map((p) => `${p.port}/${p.protocol}`).join(", ") || "none"} />
            </dl>
          </div>
          <div className="card p-[22px] flex flex-col gap-[14px]">
            <h3 className="flex items-center gap-[9px] text-[15px] font-bold"><IconRocket size={17} className="text-fuchsia-300" /> What happens next</h3>
            <ol className="flex flex-col gap-[10px] text-[13px] leading-[1.65] text-text-2">
              <li className="flex gap-[9px]"><Step n="1">A Docker container <span className="mono text-white">aether-{name || "…"}</span> is created on <span className="text-white">{nodes.find((n) => n.id === nodeId)?.name ?? "the node"}</span>.</Step></li>
              <li className="flex gap-[9px]"><Step n="2">The preset's image is pulled automatically (first pull can take a few minutes).</Step></li>
              <li className="flex gap-[9px]"><Step n="3">Ports and environment from the preset are applied together with the limits above.</Step></li>
              <li className="flex gap-[9px]"><Step n="4">The owner can start the server right away from their dashboard.</Step></li>
            </ol>
          </div>
        </section>
      )}

      {err && (
        <div className="flex items-center gap-[8px] rounded-lg border border-red-500/30 bg-[rgba(248,113,113,0.1)] px-[13px] py-[10px] text-[12.5px] text-red-400">
          {err}
        </div>
      )}

      {/* nav buttons */}
      <div className="flex items-center justify-end gap-[10px] pt-[4px]">
        {step > 0 && <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>Back</button>}
        {step < 2 && (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        )}
        {step === 2 && (
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <span className="btn-spinner" /> : <IconRocket size={16} className="flex-none" />} Provision server
          </button>
        )}
      </div>
    </div>
  );
}

function EggCard({ egg: e, selected, onPick }: { egg: Egg; selected: boolean; onPick: (e: Egg) => void }) {
  return (
    <button
      onClick={() => onPick(e)}
      className={`relative flex flex-col items-start gap-[8px] rounded-[18px] border p-[18px] text-left transition-all duration-200 hover:-translate-y-[3px] ${selected ? "border-fuchsia-400/60 bg-[rgba(168,85,247,0.10)] shadow-[0_22px_44px_-24px_rgba(168,85,247,0.55)]" : "border-border bg-surface hover:border-fuchsia-400/40"}`}
    >
      {selected && (
        <span className="absolute top-[14px] right-[14px] grid h-[22px] w-[22px] place-items-center rounded-full brand-grad text-white">
          <IconCheck size={13} />
        </span>
      )}
      <span className="font-display text-[16px] font-black text-white">{e.name}</span>
      <span className="text-[12px] leading-[1.5] text-text-2 min-h-[36px]">{e.description ?? "Custom game image"}</span>
      <span className="mono trunc w-full rounded-lg border border-border bg-[rgba(0,0,0,0.3)] px-[9px] py-[5px] text-[11px] text-text-3">{e.image}</span>
      <span className="flex flex-wrap gap-[4px] text-[10.5px] font-bold text-text-3">
        <span className="inline-flex items-center gap-[4px] rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]"><IconMemory size={11} /> {e.memoryMB ?? 1024} MB</span>
        <span className="inline-flex items-center gap-[4px] rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]"><IconCpu size={11} /> {e.cpus ?? 1} vCPU</span>
        {(e.ports ?? []).slice(0, 3).map((p) => (
          <span key={`${p.port}-${p.protocol}`} className="rounded-[4px] border border-border bg-white/4 px-[6px] py-[2px]">{p.port}/{p.protocol}</span>
        ))}
      </span>
    </button>
  );
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      <dt className="flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-wider text-text-3">{icon}{label}</dt>
      <dd className={`min-w-0 trunc text-right text-white ${mono ? "font-mono text-[12px]" : ""}`} title={value}>{value}</dd>
    </div>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex-none grid h-[20px] w-[20px] place-items-center rounded-full border border-fuchsia-400/40 bg-[rgba(168,85,247,0.12)] font-mono text-[10.5px] font-bold text-fuchsia-300">{n}</span>
      <span>{children}</span>
    </>
  );
}
