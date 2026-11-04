"use client";

// Bits every Club screen uses: the screen-to-screen link, how a refusal becomes a nudge, the avatar and the sheet.
import { createContext, useContext } from "react";
import { ApiError } from "@/lib/auth";
import { CLUB_COPY, type Can, type ClubMe } from "@/lib/community";
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";

export interface ClubCtx {
  me: ClubMe | null;
  reloadMe: () => void;
  /** Open the sheet that matches a gate refusal (join, pay, rank, banned). */
  nudge: (can: Can) => void;
  report: (kind: "post" | "profile" | "message", id: string) => void;
}
export const ClubContext = createContext<ClubCtx>({ me: null, reloadMe: () => {}, nudge: () => {}, report: () => {} });
export const useClub = () => useContext(ClubContext);

/** Open a Club screen: "" (feed), "post/9", "@ravik", "activity", "reports", "inbox", "requests", "chat/9". Steps into history, so Back steps out. */
export function openClub(path: string) {
  try {
    history.pushState(null, "", "#club" + (path ? "/" + path : ""));
  } catch {
    /* sandboxed */
  }
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** The gate's refusal in a 403 `{ error: "club", can }`, if that's what this error is. */
export function gateOf(e: unknown): Can | null {
  const d = e instanceof ApiError && e.status === 403 ? (e.data as { error?: string; can?: Can } | undefined) : undefined;
  return d?.error === "club" && d.can ? d.can : null;
}

/** The server's own sentence for a refused request (409), otherwise the plain retry line. */
export const errorText = (e: unknown) => (e instanceof ApiError && e.status === 409 ? e.message : CLUB_COPY.error);

const COLORS = ["#ff9600", "#58cc02", "#1cb0f6", "#ce82ff", "#ff4b4b", "#ffc800"];
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-black text-[#160d00]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

/** "Trader ★★☆" in small. */
export function TitleStars({ title, stars, maxStars }: { title: string; stars: number; maxStars: number }) {
  return (
    <span className="whitespace-nowrap text-[13px] font-black text-muted">
      {title}{" "}
      {maxStars > 0 && (
        <span aria-hidden="true">
          <span className="text-gold">{"★".repeat(stars)}</span>
          <span className="opacity-40">{"★".repeat(Math.max(0, maxStars - stars))}</span>
        </span>
      )}
    </span>
  );
}

/** A bottom sheet in the game's style. */
export function ClubSheet({
  open,
  onOpenChange,
  title,
  children,
  full,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className={`mx-auto max-w-[480px] gap-3 overflow-y-auto rounded-t-3xl border-2 border-b-0 border-line bg-surface px-5 pt-5 ${full ? "h-[100dvh] rounded-none" : "max-h-[92dvh]"}`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <SheetTitle className="text-[22px] leading-tight font-black">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export const linkBtn = "w-full py-2 text-[15px] font-extrabold tracking-wide text-muted uppercase";
