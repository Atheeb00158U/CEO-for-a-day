"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODULE_BANNERS, moduleSrcSet } from "@/lib/brand";
import { showPaywall } from "@/lib/content-client";
import { coursePath, type NodeState } from "@/lib/course-path";
import type { CourseOutline } from "@/lib/course-types";
import type { CatalogEntry } from "@/lib/hotseat-types";
import { phoneLocks } from "@/lib/locks";
import { useGame } from "@/lib/store";
import { Icon, MediaView } from "./ui";

const COPY = {
  members: "For members",
  next: "Back to your place",
};

/** Every unit header, and the banner of a module without a picture, is the brand gold (Atheeb, 6 Nov 2026: no rainbow). */
// Hex, not var(--color-…): Tailwind only emits the theme colours that classes use.
const GOLD = "linear-gradient(135deg, #f3ae47, #b87a1f)";

const RING: Record<NodeState, string> = {
  done: "bg-[#2a1f0d] text-brand",
  current: "bg-brand text-[#1a1206]",
  open: "bg-surface-2 text-ink",
  locked: "bg-surface-2 text-[#4a5863]",
};

/**
 * Home's course map: each unit's header, then one unboxed block per module (on the page background): a picture banner, the title, and a grid of round
 * tiles (the lessons in order, then Practice) closed by the module's Hot Seats as wide tiles.
 * Lessons unlock in order; there is no skipping ahead (Atheeb, 6 Nov 2026: players miss the learning).
 */
export function CoursePath({
  outline,
  catalog,
  onLesson,
  onPractice,
  onPlay,
}: {
  outline: CourseOutline;
  catalog: CatalogEntry[];
  onLesson: (lessonId: string) => void;
  onPractice: (title: string, lessonIds: string[]) => void;
  onPlay: (hotSeatId: string) => void;
}) {
  const { s, membership, paywall } = useGame();
  const path = useMemo(() => coursePath(outline, { lessons: s.lessons, best: s.best }), [outline, s.lessons, s.best]);
  // Members-only items (a hint: the server's 402 is the real gate). A tap opens the offer straight away.
  const locked = useMemo(() => phoneLocks(outline, membership, paywall, s), [outline, membership, paywall, s]);

  // "Back to your place" shows while the current tile is scrolled out of view, pointing the way back to it.
  const root = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const el = root.current?.querySelector("[data-current]");
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setAway(e.isIntersecting ? null : e.boundingClientRect.top < (e.rootBounds?.height ?? innerHeight) / 2 ? "up" : "down"),
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setAway(null);
    };
  }, [path]);

  return (
    <div ref={root} className="flex flex-col gap-8">
      {path.units.map((u, ui) => (
        <section key={u.id} className="flex flex-col gap-10">
          <div className="rounded-3xl border-b-4 border-black/30 px-4 py-3 text-[#1a1206]" style={{ background: GOLD }}>
            <p className="text-[12px] font-black tracking-[.14em] uppercase opacity-70">Unit {ui + 1}</p>
            <h2 className="text-[21px] leading-tight font-black">{u.title}</h2>
            <p className="text-[14px] font-bold opacity-80">{u.goal}</p>
          </div>
          {u.modules.map((m) => {
            const gates = m.gates.flatMap((g) => {
              const hs = catalog.find((c) => c.id === g.id);
              return hs ? [{ ...g, hs }] : [];
            });
            const cover = gates.find((g) => g.hs.cover)?.hs.cover;
            return (
              <article key={m.id}>
                {/* The module's own banner, else its gate Hot Seat's cover, else a plain gold block. */}
                {MODULE_BANNERS[m.id] ? (
                  <picture className="wavy-b relative block h-[148px] w-full overflow-hidden rounded-t-3xl bg-surface-2">
                    <source type="image/avif" srcSet={moduleSrcSet(m.id, "avif")} sizes="(max-width: 480px) 100vw, 448px" />
                    <source type="image/webp" srcSet={moduleSrcSet(m.id, "webp")} sizes="(max-width: 480px) 100vw, 448px" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/course/modules/${m.id}-960.webp`}
                      alt={MODULE_BANNERS[m.id]}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                  </picture>
                ) : cover ? (
                  <MediaView media={cover} kenBurns={false} className="wavy-b h-[148px] w-full !rounded-t-3xl !rounded-b-none" />
                ) : (
                  <div className="wavy-b grid h-[148px] place-items-center rounded-t-3xl" style={{ background: GOLD }}>
                    <Icon.chair className="size-14 text-[#1a1206] opacity-25" />
                  </div>
                )}
                <div className="pt-3">
                  <h3 className="text-[20px] leading-tight font-black">{m.title}</h3>
                  <p className="mt-1 text-[14px] font-bold text-muted">{m.goal}</p>
                  <div className="mt-5 grid grid-cols-3 gap-x-2 gap-y-5">
                    {m.lessons.map((l) => {
                      const paid = locked({ kind: "lesson", id: l.id });
                      return (
                        <Tile
                          key={l.id}
                          state={l.state}
                          members={paid}
                          label={l.title}
                          sub={
                            paid
                              ? COPY.members
                              : l.state === "done"
                                ? `Best ${l.best}%`
                                : l.state === "locked"
                                  ? "Locked"
                                  : `${l.minutes} min`
                          }
                          onClick={() => (paid ? showPaywall({ lessonId: l.id }) : onLesson(l.id))}
                        >
                          {l.state === "done" ? (
                            <Icon.check className="size-8" />
                          ) : l.state === "locked" ? (
                            <Icon.lock className="size-6" />
                          ) : (
                            <Icon.play className="size-8" />
                          )}
                        </Tile>
                      );
                    })}
                    <Tile
                      state={m.practice.state === "open" ? "open" : "locked"}
                      tone="purple"
                      label="Practice"
                      sub="Mixed cards, 2 min"
                      onClick={() => onPractice(`Practice: ${m.title}`, m.practice.lessonIds)}
                    >
                      <Icon.bolt className="size-7" />
                    </Tile>
                    {gates.map(({ id, state, hs }) => {
                      const playable = hs.available && state !== "locked";
                      const paid = hs.available && locked({ kind: "hotseat", id });
                      return (
                        <Gate
                          key={id}
                          hs={hs}
                          state={hs.available ? state : "locked"}
                          members={paid}
                          sub={
                            !hs.available
                              ? "Coming soon"
                              : paid
                                ? COPY.members
                                : state === "done"
                                  ? `Best ${s.best[id]}`
                                  : state === "locked"
                                    ? "Finish the lessons"
                                    : hs.title
                          }
                          onClick={() => (paid ? showPaywall({ hotSeatId: id }) : playable && onPlay(id))}
                        />
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {away && (
        <button
          type="button"
          onClick={() => root.current?.querySelector("[data-current]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="pop fixed left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full whitespace-nowrap bg-brand px-4 py-2.5 text-[14px] font-black text-[#1a1206] shadow-[0_4px_0_var(--color-brand-dark)] active:translate-y-[2px]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}
        >
          <svg viewBox="0 0 24 24" className={`size-5 ${away === "up" ? "rotate-180" : ""}`} aria-hidden>
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {COPY.next}
        </button>
      )}
    </div>
  );
}

const MembersBadge = () => (
  <span className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-[3px] border-bg bg-gold text-[#2a1d00]">
    <Icon.lock className="size-3.5" />
  </span>
);

/** One round tile in a module's grid, its label underneath. */
function Tile({
  state,
  tone,
  members = false,
  label,
  sub,
  onClick,
  children,
}: {
  state: NodeState;
  tone?: "purple" | "ghost";
  /** Members only: shows a lock badge, and a tap opens the offer even before the tile unlocks. */
  members?: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const current = state === "current";
  const ring =
    tone === "purple" && state !== "locked"
      ? "bg-purple text-[#160a2c]"
      : tone === "ghost"
        ? "border-[3px] border-dashed border-brand/60 bg-transparent text-brand"
        : RING[state];
  return (
    <button
      type="button"
      disabled={state === "locked" && !members}
      onClick={onClick}
      data-current={current || undefined}
      className={`flex flex-col items-center gap-2 text-center disabled:cursor-default ${state === "locked" && !members ? "opacity-60" : ""}`}
      aria-label={`${label}. ${sub}`}
    >
      <span className="grid h-[84px] place-items-center">
        <span
          className={`relative grid place-items-center rounded-full ${tone === "ghost" ? "" : "node-ring"} ${ring} ${current ? "bob size-[80px]" : "size-[66px]"}`}
        >
          {current && <span className="absolute -inset-[7px] animate-pulse rounded-full border-[4px] border-brand/50" />}
          {children}
          {members && <MembersBadge />}
        </span>
      </span>
      <span
        className={`text-[13px] leading-tight font-extrabold ${current ? "text-brand" : state === "locked" ? "text-muted" : "text-ink"}`}
      >
        {current && <span className="block text-[11px] font-black tracking-[.14em] uppercase">Start</span>}
        <span className="line-clamp-2">{label}</span>
        <span className="block text-[11px] font-bold text-muted">{sub}</span>
      </span>
    </button>
  );
}

/** A Hot Seat closing the module: the reward, a wide tile with its picture. */
function Gate({
  hs,
  state,
  members,
  sub,
  onClick,
}: {
  hs: CatalogEntry;
  state: NodeState;
  members: boolean;
  sub: string;
  onClick: () => void;
}) {
  const current = state === "current";
  const label = `Hot Seat · ${hs.company}`;
  const pic = hs.cover ?? hs.emblem;
  return (
    <button
      type="button"
      disabled={state === "locked" && !members}
      onClick={onClick}
      data-current={current || undefined}
      aria-label={`${label}. ${sub}`}
      className={`node-ring relative col-span-3 flex h-[112px] items-end overflow-hidden rounded-3xl border-[3px] text-left disabled:cursor-default ${current ? "border-brand" : state === "done" ? "border-brand-dark" : "border-line"}`}
    >
      {pic ? (
        <MediaView media={pic} kenBurns={false} className={`!absolute inset-0 !rounded-none ${state === "locked" ? "grayscale" : ""}`} />
      ) : (
        <span className="absolute inset-0 bg-surface-2" />
      )}
      <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
      <span className="relative flex w-full items-center gap-3 p-3">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[11px] font-black tracking-[.14em] uppercase ${current ? "text-brand" : "text-gold"}`}>
            {current && "Start "}Hot Seat
          </span>
          <span className="line-clamp-2 text-[17px] leading-tight font-black text-white">{hs.company}</span>
          <span className="block truncate text-[12px] font-bold text-white/70">{sub}</span>
        </span>
        <span
          className={`relative grid size-12 shrink-0 place-items-center rounded-full ${state === "done" || current ? "bg-brand text-[#1a1206]" : "bg-surface-2 text-ink"} ${current ? "bob" : ""}`}
        >
          {state === "done" ? (
            <Icon.check className="size-6" />
          ) : state === "locked" ? (
            <Icon.lock className="size-5" />
          ) : (
            <Icon.chair className="size-6" />
          )}
          {members && <MembersBadge />}
        </span>
      </span>
    </button>
  );
}
