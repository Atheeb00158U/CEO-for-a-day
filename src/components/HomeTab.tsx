"use client";

import { useMemo } from "react";
import { homeOrder, MADE_UP_LABEL } from "@/content/catalog";
import { useContent } from "@/lib/content-client";
import type { DailyQuestion } from "@/lib/hotseat-types";
import { questsFor, today, useGame } from "@/lib/store";
import { CoursePath } from "./CoursePath";
import { Bar, Card, Icon, MediaView } from "./ui";

export function HomeTab({
  daily: call,
  onPlay,
  onDaily,
  onShop,
  onLesson,
  onTestOut,
  onPractice,
}: {
  /** Today's Daily Call, once loaded. */
  daily?: DailyQuestion | null;
  onPlay: (id: string) => void;
  onDaily: () => void;
  onShop: () => void;
  onLesson: (lessonId: string) => void;
  onTestOut: (moduleId: string, lessonIds: string[]) => void;
  onPractice: (title: string, lessonIds: string[]) => void;
}) {
  const { s, boosterActive, activateBooster } = useGame();
  const { catalog, course } = useContent();
  const order = useMemo(() => homeOrder(catalog, s.seed, s.onboarding.focus), [catalog, s.seed, s.onboarding.focus]);
  const current = order.find((c) => c.available && s.best[c.id] === undefined) ?? order.find((c) => c.available)!;
  const hs = current;
  const playedToday = s.lastActiveDay === today();
  const dailyDone = call && s.daily?.day === today() && s.daily.id === call.id ? s.daily : null;
  const best = s.best[current.id];
  // With the course on, Hot Seats that gate a module sit on the path; the rest stay in a grid below it.
  const gated = new Set(course?.units.flatMap((u) => u.modules.flatMap((m) => m.gates)) ?? []);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-black leading-tight">{playedToday ? "Streak safe today" : "Continue your streak!"}</h1>
          <p className="text-[15px] font-bold text-muted">
            {playedToday ? "Come back tomorrow to keep it going." : "Make one decision to start your day."}
          </p>
        </div>
        {playedToday ? <Icon.flame className="size-14" /> : <Icon.flameOff className="size-14" />}
      </section>

      {/* Today's call */}
      {call && (
        <button
          type="button"
          onClick={onDaily}
          className="flex items-center gap-4 rounded-2xl border-2 border-brand/50 bg-brand/10 p-4 text-left focus-visible:ring-4 focus-visible:ring-brand/50 focus-visible:outline-none"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-[#1a1206]">
            {dailyDone ? <Icon.check className="size-7" /> : <Icon.bolt className="size-7 [&_path]:fill-[#1a1206]" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black tracking-[.12em] text-brand uppercase">Today&apos;s call · 1 min</span>
            <span className="block text-[17px] leading-tight font-black">
              {call.company} · {call.title}
            </span>
            <span className="block text-[14px] font-bold text-muted">
              {dailyDone ? `Done today · +${dailyDone.xp} XP · tap to see it again` : "One decision. Keeps your streak alive."}
            </span>
          </span>
        </button>
      )}

      {course && (
        <CoursePath outline={course} catalog={catalog} onLesson={onLesson} onTestOut={onTestOut} onPractice={onPractice} onPlay={onPlay} />
      )}

      {/* Current Hot Seat */}
      {!course && (
        <section className="-mx-4">
          {hs.cover && <MediaView media={hs.cover} wavy className="aspect-[16/9] w-full" />}
          <div className="px-4 pt-4 text-center">
            <p className="text-[13px] font-black uppercase tracking-[.14em] text-brand">
              Hot Seat · {hs.company} · {hs.years}
            </p>
            <h2 className="mt-1 text-[28px] font-black leading-tight text-balance">{hs.title}</h2>
            <p className="mt-1 text-[16px] font-bold text-muted">{hs.hook}</p>
            {hs.madeUp && <p className="mt-1 text-[13px] font-black tracking-wider text-purple uppercase">{MADE_UP_LABEL}</p>}
            <p className="mt-2 text-[14px] font-bold text-muted">
              {hs.calls} big calls · {hs.minutes} min · {best !== undefined ? `Your best: ${best}` : "Narrated"}
            </p>
            <div className="mx-auto mt-4 max-w-[360px]">
              <button type="button" className="btn3d green" onClick={() => onPlay(hs.id)}>
                {best !== undefined ? "Play again" : "Take the hot seat"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Booster */}
      {!boosterActive && s.boosters > 0 && (
        <Card className="flex items-center gap-3 border-purple/50 bg-purple/10">
          <Icon.boltPurple className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-black">Double XP for 15 minutes</p>
            <p className="text-[14px] font-bold text-muted">
              You have {s.boosters} booster{s.boosters > 1 ? "s" : ""}. Use it before you play.
            </p>
          </div>
          <button type="button" className="btn3d purple !w-auto !px-4 !py-2.5 !text-[14px]" onClick={activateBooster}>
            Use
          </button>
        </Card>
      )}

      {/* Path */}
      <section>
        <h3 className="mb-3 text-[13px] font-black uppercase tracking-[.14em] text-muted">
          {course ? "More hot seats" : "Your hot seats"}
        </h3>
        <div className="grid grid-cols-3 gap-x-2 gap-y-5">
          {order
            .filter((c) => !gated.has(c.id))
            .map((c) => {
              const done = s.best[c.id] !== undefined;
              const isCurrent = !course && c.id === current.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.available}
                  onClick={() => c.available && onPlay(c.id)}
                  className="flex flex-col items-center gap-2 text-center disabled:cursor-default"
                >
                  <span
                    className={`node-ring relative grid size-[84px] place-items-center rounded-full ${done ? "bg-[#2a1f0d] text-brand" : isCurrent ? "bg-brand text-[#1a1206]" : "bg-surface-2 text-[#4a5863]"}`}
                  >
                    {isCurrent && <span className="absolute -inset-[7px] rounded-full border-[5px] border-brand/30 border-t-brand" />}
                    {c.emblem ? (
                      <MediaView
                        media={c.emblem}
                        kenBurns={false}
                        className={`!absolute inset-0 !rounded-full ${isCurrent ? "bob" : ""}`}
                      />
                    ) : done ? (
                      <Icon.check />
                    ) : c.available ? (
                      <Icon.play />
                    ) : (
                      <Icon.lock />
                    )}
                    {done && c.emblem && (
                      <span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-[3px] border-bg bg-brand text-[#1a1206]">
                        <Icon.check className="size-4" />
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[14px] font-extrabold leading-tight ${isCurrent ? "text-brand" : c.available ? "text-ink" : "text-muted"}`}
                  >
                    {c.company}
                    <span className="block text-[12px] font-bold text-muted">
                      {c.available ? (done ? `Best ${s.best[c.id]}` : c.madeUp ? "Made-up story" : "Ready") : "Coming soon"}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
        <p className="mt-4 text-center text-[13px] font-bold text-muted">Your order is unique to you. New hot seats drop every week.</p>
      </section>

      {/* Daily quests */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">Daily quests</h3>
          <button type="button" onClick={onShop} className="text-[14px] font-black uppercase text-brand">
            View all
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {questsFor(s).map((q) => {
            const v = Math.min(q.goal, q.read(s.quests));
            return (
              <div key={q.id} className="flex items-center gap-3">
                <Icon.bolt className="size-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[15px] font-extrabold">
                    <span>{q.label}</span>
                    <span className="tabular-nums text-muted">
                      {v}/{q.goal}
                    </span>
                  </div>
                  <Bar value={(v / q.goal) * 100} color="var(--color-gold)" h="h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
