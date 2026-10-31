import React, { useRef, useState } from "react";
import { IconTrash, IconUpload } from "./Icons";
import { useToast } from "./Toasts";

const MAX_BYTES = 15 * 1024 * 1024;

/** Reads a picked/dropped image file and downscales it through a canvas so the
 *  upload payload stays small no matter the original resolution. */
async function fileToDataUrl(file: File, maxDim: number): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Only PNG, JPEG or WebP images");
  if (file.size > MAX_BYTES) throw new Error("Image file is too large");
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
  // Downscale.
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That file isn't a valid image"));
    i.src = raw;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && raw.length < 620_000) return raw; // already small enough
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

interface ImageDropProps {
  /** e.g. "Logo" / "Favicon" / "Profile picture" */
  label: string;
  /** current stored URL, "" when none */
  url: string | null;
  onChange: (url: string) => void;
  /** performs the upload, resolves with the new URL */
  upload: (dataUrl: string) => Promise<string>;
  /** clear button; omit to hide */
  onClear?: () => void;
  maxDim?: number;
  /** visual shape of the preview tile */
  shape?: "square" | "circle" | "tab";
  className?: string;
}

export function ImageDrop({ label, url, onChange, upload, onClear, maxDim = 512, shape = "square", className = "" }: ImageDropProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = Boolean(url);

  async function handleFile(f: File | undefined | null) {
    if (!f) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(f, maxDim);
      const newUrl = await upload(dataUrl);
      onChange(newUrl);
      toast.push(`${label} updated`, "success");
    } catch (e) {
      toast.pushError(e instanceof Error ? e.message : `${label} upload failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <span className="mb-[7px] block text-[11px] font-bold uppercase tracking-wider text-text-3">{label}</span>
      {has ? (
        <div className="flex items-center gap-[12px] rounded-xl border border-border bg-white/4 p-[10px]">
          <img
            src={url ?? ""}
            alt={label}
            className={`h-[52px] w-[52px] flex-none object-contain ${
              shape === "circle" ? "rounded-full ring-2 ring-brand/35" : shape === "tab" ? "rounded-[8px]" : "rounded-[12px]"
            }`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[12.5px] font-semibold text-white">Image set</span>
            <span className="text-[10.5px] text-text-3">Drop a new file to replace</span>
          </div>
          <div className="flex flex-none items-center gap-[7px]">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <span className="btn-spinner" /> : null} Replace
            </button>
            {onClear && (
              <button type="button" className="btn btn-ghost btn-sm !border-red-500/30 !text-red-400" onClick={onClear} disabled={busy}>
                <IconTrash size={14} /> Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`relative flex w-full items-center gap-[12px] rounded-xl border border-dashed px-[14px] py-[14px] text-left transition-all duration-150 ${
            over ? "border-brand bg-brand/10" : "border-white/14 bg-white/3 hover:border-brand/50 hover:bg-white/5"
          }`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <span className={`grid h-[44px] w-[44px] flex-none place-items-center rounded-[12px] border ${over ? "border-brand/50 bg-brand/15 text-brand" : "border-border bg-black/25 text-text-3"}`}>
            {busy ? <span className="btn-spinner" /> : <IconUpload size={17} />}
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-white">
              {busy ? "Uploading…" : `Drop ${label.toLowerCase()} or click to browse`}
            </span>
            <span className="block text-[10.5px] text-text-3">PNG, JPEG, WebP — auto-optimised</span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
