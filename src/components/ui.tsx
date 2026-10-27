"use client";

import type { Media } from "@/lib/hotseat-types";

/* ---------------- Icons (inline SVG, no icon font) ---------------- */
type IP = { className?: string };
export const Icon = {
  flame: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#ff9600"
        d="M12 2c1.2 4.2 6 5.8 6 11.6A6 6 0 0 1 6 13.6c0-2.6 1.3-4.4 2.8-5.5-.1 2.3 1.1 3.5 2.2 3.5-.6-3.3.5-6.6 1-9.6z"
      />
      <path fill="#ffc800" d="M12 21a3.2 3.2 0 0 1-3.2-3.2c0-2 1.6-3 2.3-4.6.9 1.6 4.1 2.4 4.1 4.6A3.2 3.2 0 0 1 12 21z" />
    </svg>
  ),
  flameOff: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4a5863"
        d="M12 2c1.2 4.2 6 5.8 6 11.6A6 6 0 0 1 6 13.6c0-2.6 1.3-4.4 2.8-5.5-.1 2.3 1.1 3.5 2.2 3.5-.6-3.3.5-6.6 1-9.6z"
      />
    </svg>
  ),
  coin: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#ffc800" />
      <circle cx="12" cy="12" r="6.5" fill="#ffd94a" stroke="#c99b00" strokeWidth="1.5" />
      <path
        d="M12 8.2v7.6M10 10.2h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3"
        stroke="#a37c00"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        transform="translate(0 -1.2)"
      />
    </svg>
  ),
  bolt: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#58cc02" d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" />
    </svg>
  ),
  boltPurple: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#b583ff" d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" />
    </svg>
  ),
  heart: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#ff4b4b"
        d="M12 21s-7.6-4.6-9.7-9.3C.8 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.8-1.3 2.3-2.4 4.4-2.4 3.7 0 5.8 3.8 4.3 7.2C19.6 16.4 12 21 12 21z"
      />
      <path d="M7 7.5c-1.3.3-2.2 1.5-2 2.8" stroke="#ffb3b3" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  ),
  heartOff: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#3a4650"
        d="M12 21s-7.6-4.6-9.7-9.3C.8 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.8-1.3 2.3-2.4 4.4-2.4 3.7 0 5.8 3.8 4.3 7.2C19.6 16.4 12 21 12 21z"
      />
    </svg>
  ),
  snow: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="#7fdcff" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" />
    </svg>
  ),
  rewind: ({ className = "size-6" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#2bd9c5" d="M11 6v12L3 12zm9 0v12l-8-6z" />
    </svg>
  ),
  close: ({ className = "size-7" }: IP) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  speaker: ({ className = "size-5" }: IP) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  lock: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" />
    </svg>
  ),
  check: ({ className = "size-9" }: IP) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  play: ({ className = "size-9" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" />
    </svg>
  ),
  chair: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M7 3h10a2 2 0 0 1 2 2v7h1a1 1 0 0 1 0 2h-1.3l1.2 6.2a1 1 0 0 1-2 .4L16.7 16H7.3l-1.2 4.6a1 1 0 0 1-2-.4L5.3 14H4a1 1 0 0 1 0-2h1V5a2 2 0 0 1 2-2z" />
    </svg>
  ),
  /* bottom nav */
  navHome: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  navLeague: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15v3h3v3H8v-3h3v-3a5 5 0 0 1-2.7-3H8a4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 1.3 1.9C7.1 9 7 8 7 7zm12 0h-1c0 1-.1 2-.3 2.9A2 2 0 0 0 18 8z" />
    </svg>
  ),
  navNotes: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M6 2h9l5 5v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 9v2h8v-2zm0 4v2h6v-2zm6-11v4h4z" />
    </svg>
  ),
  navShop: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4 4h16l-1 5a3 3 0 0 1-5 1.5A3 3 0 0 1 12 11a3 3 0 0 1-2-.5A3 3 0 0 1 5 9zM5 12.5a4.9 4.9 0 0 0 2 .5 5 5 0 0 0 2.5-.7 5 5 0 0 0 5 0A5 5 0 0 0 19 12.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    </svg>
  ),
  navProfile: ({ className = "size-7" }: IP) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="12" cy="8" r="4.5" />
      <path d="M3.5 21a8.5 8.5 0 0 1 17 0z" />
    </svg>
  ),
};

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
  label = true,
}: {
  media: Media;
  className?: string;
  wavy?: boolean;
  kenBurns?: boolean;
  label?: boolean;
}) {
  const [kind, name] = media.split(":");
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${wavy ? "wavy" : "rounded-3xl"} ${className}`}>
      {kind === "vid" ? (
        <video
          key={name}
          src={`./media/${name}.mp4`}
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
          src={`./media/${name}.webp`}
          alt=""
          className={`develop absolute inset-0 size-full object-cover ${kenBurns ? "kb" : ""}`}
        />
      )}
      {label && (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/80">
          {kind === "vid" ? "Archive footage" : "AI illustration"}
        </span>
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
