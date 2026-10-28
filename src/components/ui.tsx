"use client";

import type { Media } from "@/lib/hotseat-types";

export { Icon } from "./icons";

/* ---------------- Primitives ---------------- */
export function Pill({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      aria-label={label}
      title={label}
      className="flex items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-[17px] font-black tabular-nums"
    >
      {children}
    </div>
  );
}

export function Bar({ value, color = "var(--color-green)", h = "h-3.5" }: { value: number; color?: string; h?: string }) {
  return (
    <div className={`${h} w-full overflow-hidden rounded-full bg-surface-2`}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color,
          boxShadow: "inset 0 -4px 0 rgba(0,0,0,.18), inset 0 3px 0 rgba(255,255,255,.25)",
        }}
      />
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border-2 border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function MediaView({
  media,
  className = "",
  wavy = false,
  kenBurns = true,
}: {
  media: Media;
  className?: string;
  wavy?: boolean;
  kenBurns?: boolean;
}) {
  const [kind, name] = media.split(":");
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${wavy ? "wavy" : "rounded-3xl"} ${className}`}>
      {kind === "vid" ? (
        <video
          key={name}
          src={`/media/${name}.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="develop absolute inset-0 size-full object-cover"
          style={{ filter: "sepia(.3) contrast(1.08)" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={name}
          src={`/media/${name}.webp`}
          alt=""
          className={`develop absolute inset-0 size-full object-cover ${kenBurns ? "kb" : ""}`}
        />
      )}
    </div>
  );
}

/** Words light up as the narrator reads them. */
export function Caption({ text, progress, className = "" }: { text: string; progress: number; className?: string }) {
  const words = text.split(/(\s+)/);
  const total = text.length || 1;
  let pos = 0;
  return (
    <p className={className}>
      {words.map((w, i) => {
        const start = pos;
        pos += w.length;
        if (/^\s+$/.test(w)) return w;
        return (
          <span key={i} className={`word ${start / total <= progress * 1.03 ? "on" : ""}`}>
            {w}
          </span>
        );
      })}
    </p>
  );
}
