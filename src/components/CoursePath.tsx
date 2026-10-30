"use client";

import { useMemo } from "react";
import { coursePath, type NodeState } from "@/lib/course-path";
import type { CourseOutline } from "@/lib/course-types";
import type { CatalogEntry } from "@/lib/hotseat-types";
import { useGame } from "@/lib/store";
import { Icon, MediaView } from "./ui";

// The path snakes left and right a little, like a trail.
const SWAY = [0, 44, 64, 44, 0, -44, -64, -44];

const RING: Record<NodeState, string> = {
  done: "bg-[#2a1f0d] text-brand",
  current: "bg-brand text-[#1a1206]",
  open: "bg-surface-2 text-ink",
  locked: "bg-surface-2 text-[#4a5863]",
};

/**
 * Home's course path: each unit's header, then per module its lessons in order, a Practice node and the Hot Seats
 * that close it. Lessons unlock in order; a module can be skipped with a short test-out quiz.
 */
export function CoursePath({
  outline,
  catalog,
  onLesson,
  onTestOut,
  onPractice,
  onPlay,
}: {
  outline: CourseOutline;
  catalog: CatalogEntry[];
  onLesson: (lessonId: string) => void;
  onTestOut: (moduleId: string, lessonIds: string[]) => void;
  onPractice: (title: string, lessonIds: string[]) => void;
  onPlay: (hotSeatId: string) => void;
}) {
  const { s } = useGame();
  const path = useMemo(() => coursePath(outline, { lessons: s.lessons, best: s.best }), [outline, s.lessons, s.best]);
  let n = 0; // node count, for the sway
  return (
    <div className="flex flex-col gap-8">
      {path.units.map((u, ui) => (
        <section key={u.id} className="flex flex-col gap-5">
          <div className="rounded-3xl border-b-4 border-brand-dark bg-brand px-4 py-3 text-[#1a1206]">
            <p className="text-[12px] font-black tracking-[.14em] uppercase opacity-70">Unit {ui + 1}</p>
            <h2 className="text-[21px] leading-tight font-black">{u.title}</h2>
            <p className="text-[14px] font-bold opacity-80">{u.goal}</p>
          </div>
          {u.modules.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-4">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-black tracking-[.12em] text-muted uppercase">{m.title}</p>
                  <p className="text-[14px] font-bold text-muted">{m.goal}</p>
                </div>
                {m.canTestOut && (
                  <button
                    type="button"
                    onClick={() =>
                      onTestOut(
                        m.id,
                        m.lessons.map((l) => l.id),
                      )
                    }
                    className="shrink-0 rounded-full border-2 border-line px-3 py-1.5 text-[12px] font-black tracking-wide text-brand uppercase"
                  >
                    Test out
                  </button>
                )}
              </div>
              {m.lessons.map((l) => (
                <Node
                  key={l.id}
                  sway={SWAY[n++ % SWAY.length]}
                  state={l.state}
                  label={l.title}
                  sub={l.state === "done" ? `Best ${l.best}%` : l.state === "locked" ? "Locked" : `${l.minutes} min`}
                  onClick={() => onLesson(l.id)}
                >
                  {l.state === "done" ? <Icon.check /> : l.state === "locked" ? <Icon.lock /> : <Icon.play />}
                </Node>
              ))}
              <Node
                sway={SWAY[n++ % SWAY.length]}
                state={m.practice.state === "open" ? "open" : "locked"}
                size="sm"
                tone="purple"
                label="Practice"
                sub="Mixed cards, 2 min"
                onClick={() => onPractice(`Practice: ${m.title}`, m.practice.lessonIds)}
              >
                <Icon.bolt className="size-7" />
              </Node>
              {m.gates.map((g) => {
                const hs = catalog.find((c) => c.id === g.id);
                if (!hs) return null;
                const playable = hs.available && g.state !== "locked";
                return (
                  <Node
                    key={g.id}
                    sway={SWAY[n++ % SWAY.length]}
                    state={hs.available ? g.state : "locked"}
                    size="lg"
                    label={`Hot Seat · ${hs.company}`}
                    sub={
                      !hs.available
                        ? "Coming soon"
                        : g.state === "done"
                          ? `Best ${s.best[g.id]}`
                          : g.state === "locked"
                            ? "Finish the lessons"
                            : hs.title
                    }
                    onClick={() => playable && onPlay(g.id)}
                  >
                    {hs.emblem ? (
                      <MediaView media={hs.emblem} kenBurns={false} className="!absolute inset-0 !rounded-full" />
                    ) : (
                      <Icon.chair />
                    )}
                  </Node>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Node({
  state,
  sway,
  size = "md",
  tone,
  label,
  sub,
  onClick,
  children,
}: {
  state: NodeState;
  sway: number;
  size?: "sm" | "md" | "lg";
  tone?: "purple";
  label: string;
  sub: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const px = { sm: "size-[64px]", md: "size-[76px]", lg: "size-[96px]" }[size];
  const ring = tone === "purple" && state !== "locked" ? "bg-purple text-[#160a2c]" : RING[state];
  return (
    <button
      type="button"
      disabled={state === "locked"}
      onClick={onClick}
      style={{ transform: `translateX(${sway}px)` }}
      className="flex flex-col items-center gap-1.5 text-center disabled:cursor-default"
      aria-label={`${label}. ${sub}`}
    >
      <span className={`node-ring relative grid ${px} place-items-center rounded-full ${ring} ${state === "current" ? "bob" : ""}`}>
        {state === "current" && <span className="absolute -inset-[7px] rounded-full border-[5px] border-brand/30 border-t-brand" />}
        {children}
        {state === "done" && size === "lg" && (
          <span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-[3px] border-bg bg-brand text-[#1a1206]">
            <Icon.check className="size-4" />
          </span>
        )}
      </span>
      <span
        className={`max-w-[180px] text-[14px] leading-tight font-extrabold ${state === "current" ? "text-brand" : state === "locked" ? "text-muted" : "text-ink"}`}
      >
        {state === "current" && <span className="block text-[11px] font-black tracking-[.14em] uppercase">Start</span>}
        {label}
        <span className="block text-[12px] font-bold text-muted">{sub}</span>
      </span>
    </button>
  );
}
