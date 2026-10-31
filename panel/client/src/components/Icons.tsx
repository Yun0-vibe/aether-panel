import React from "react";
import {
  LayoutGrid, Server, ShieldCheck, Users, Layers, SquareTerminal, Folder,
  FileText, Archive, Settings, Activity, Cpu, MemoryStick, HardDrive, Globe,
  Clock, Zap, Power, Square, RotateCw, Skull, Plus, Upload, Download, Trash2,
  Pencil, Search, Bell, LogOut, ChevronRight, ChevronLeft, X, Check,
  TriangleAlert, Eye, EyeOff, Sparkles, KeyRound, Mail, Lock, Copy, ArrowLeft,
  Rocket,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

/* Real icons come from lucide-react (www.lucide.dev) — the industry-standard
 * set used by shadcn/ui. Export names stay stable so the app never changes. */

export const IconGrid = (p: LucideProps) => <LayoutGrid {...p} />;
export const IconServer = (p: LucideProps) => <Server {...p} />;
export const IconShield = (p: LucideProps) => <ShieldCheck {...p} />;
export const IconUsers = (p: LucideProps) => <Users {...p} />;
export const IconLayers = (p: LucideProps) => <Layers {...p} />;
export const IconTerminal = (p: LucideProps) => <SquareTerminal {...p} />;
export const IconFolder = (p: LucideProps) => <Folder {...p} />;
export const IconFile = (p: LucideProps) => <FileText {...p} />;
export const IconArchive = (p: LucideProps) => <Archive {...p} />;
export const IconSettings = (p: LucideProps) => <Settings {...p} />;
export const IconActivity = (p: LucideProps) => <Activity {...p} />;
export const IconCpu = (p: LucideProps) => <Cpu {...p} />;
export const IconMemory = (p: LucideProps) => <MemoryStick {...p} />;
export const IconHardDrive = (p: LucideProps) => <HardDrive {...p} />;
export const IconGlobe = (p: LucideProps) => <Globe {...p} />;
export const IconClock = (p: LucideProps) => <Clock {...p} />;
export const IconZap = (p: LucideProps) => <Zap {...p} />;

export const IconPower = (p: LucideProps) => <Power {...p} />;
export const IconStop = (p: LucideProps) => <Square {...p} />;
export const IconRefresh = (p: LucideProps) => <RotateCw {...p} />;
export const IconSkull = (p: LucideProps) => <Skull {...p} />;
export const IconPlus = (p: LucideProps) => <Plus {...p} />;
export const IconUpload = (p: LucideProps) => <Upload {...p} />;
export const IconDownload = (p: LucideProps) => <Download {...p} />;
export const IconTrash = (p: LucideProps) => <Trash2 {...p} />;
export const IconEdit = (p: LucideProps) => <Pencil {...p} />;
export const IconSearch = (p: LucideProps) => <Search {...p} />;
export const IconBell = (p: LucideProps) => <Bell {...p} />;
export const IconLogout = (p: LucideProps) => <LogOut {...p} />;
export const IconChevronRight = (p: LucideProps) => <ChevronRight {...p} />;
export const IconChevronLeft = (p: LucideProps) => <ChevronLeft {...p} />;
export const IconClose = (p: LucideProps) => <X {...p} />;
export const IconCheck = (p: LucideProps) => <Check {...p} />;
export const IconAlert = (p: LucideProps) => <TriangleAlert {...p} />;
export const IconEye = (p: LucideProps) => <Eye {...p} />;
export const IconEyeOff = (p: LucideProps) => <EyeOff {...p} />;
export const IconSparkle = (p: LucideProps) => <Sparkles {...p} />;
export const IconKey = (p: LucideProps) => <KeyRound {...p} />;
export const IconMail = (p: LucideProps) => <Mail {...p} />;
export const IconLock = (p: LucideProps) => <Lock {...p} />;
export const IconCopy = (p: LucideProps) => <Copy {...p} />;
export const IconArrowLeft = (p: LucideProps) => <ArrowLeft {...p} />;
export const IconRocket = (p: LucideProps) => <Rocket {...p} />;

/* Discord isn't in lucide — keep a hand-tuned but accurate Discord mark. */
export const IconDiscord = (p: LucideProps) => (
  <svg
    className={p.className}
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
  </svg>
);

/* ---------------- the actual brand logo (unchanged — this is the mark) ---------------- */

export function AetherMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="aetherGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="0.78" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="aetherFade" x1="24" y1="6" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M24 3.2 43.2 14v20L24 44.8 4.8 34V14L24 3.2Z" fill="url(#aetherFade)" />
      <path
        d="M24 3.2 43.2 14v20L24 44.8 4.8 34V14L24 3.2Z"
        stroke="url(#aetherGrad)"
        strokeWidth="1.5"
        opacity="0.75"
      />
      <path
        d="M24 11.5 35.6 32h-5.1l-2.4-4.5h-8.2L17.5 32h-5.1L24 11.5Zm0 8-2.6 4.8h5.2L24 19.5Z"
        fill="url(#aetherGrad)"
      />
      <circle cx="24" cy="24" r="20.5" stroke="#22d3ee" strokeOpacity="0.18" strokeWidth="0.8" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " compact" : ""}`}>
      <AetherMark size={compact ? 28 : 36} className="brand-mark" />
      {!compact && (
        <span className="brand-words">
          <span className="brand-name">AETHER</span>
          <span className="brand-tag">CONTROL PANEL</span>
        </span>
      )}
    </span>
  );
}
