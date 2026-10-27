"use client";

import { useMemo } from "react";
import { CATALOG, HOT_SEATS } from "@/content/catalog";
import { playerOrder } from "@/lib/engine";
import { QUESTS, today, useGame } from "@/lib/store";
import { Bar, Card, Icon, MediaView } from "./ui";

export function HomeTab({ onPlay, onShop }: { onPlay: (id: string) => void; onShop: () => void }) {
  const { s, boosterActive, activateBooster } = useGame();
  const order = useMemo(() => playerOrder(CATALOG, s.seed), [s.seed]);
  const current = order.find((c) => c.available && s.best[c.id] === undefined) ?? order.find((c) => c.available)!;
  const hs = HOT_SEATS[current.id];
  const playedToday = s.lastActiveDay === today();
  const best = s.best[current.id];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-black leading-tight">{playedToday ? "Streak safe today" : "Continue your streak!"}</h1>
          <p className="text-[15px] font-bold text-muted">{playedToday ? "Come back tomorrow to keep it going." : "Make one decision to start your day."}</p>
        </div>
        {playedToday ? <Icon.flame className="size-14" /> : <Icon.flameOff className="size-14" />}
      </section>

      {/* Current Hot Seat */}
      <section className="-mx-4">
        <MediaView media={hs.cover} wavy className="aspect-[16/9] w-full" />
        <div className="px-4 pt-4 text-center">
          <p className="text-[13px] font-black uppercase tracking-[.14em] text-blue">Hot Seat · {hs.company} · {hs.years}</p>
          <h2 className="mt-1 text-[28px] font-black leading-tight text-balance">{hs.title}</h2>
          <p className="mt-1 text-[16px] font-bold text-muted">{hs.hook}</p>
          <p className="mt-2 text-[14px] font-bold text-muted">
            4 big calls · {hs.minutes} min · {best !== undefined ? `Your best: ${best}` : "Narrated"}
          </p>
          <div className="mx-auto mt-4 max-w-[360px]">
            <button type="button" className="btn3d green" onClick={() => onPlay(hs.id)}>
              {best !== undefined ? "Play again" : "Take the hot seat"}
            </button>
          </div>
        </div>
      </section>

      {/* Booster */}
      {!boosterActive && s.boosters > 0 && (
        <Card className="flex items-center gap-3 border-purple/50 bg-purple/10">
          <Icon.boltPurple className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-black">Double XP for 15 minutes</p>
            <p className="text-[14px] font-bold text-muted">You have {s.boosters} booster{s.boosters > 1 ? "s" : ""}. Use it before you play.</p>
          </div>
          <button type="button" className="btn3d purple !w-auto !px-4 !py-2.5 !text-[14px]" onClick={activateBooster}>Use</button>
        </Card>
      )}

      {/* Path */}
      <section>
        <h3 className="mb-3 text-[13px] font-black uppercase tracking-[.14em] text-muted">Your hot seats</h3>
        <div className="grid grid-cols-3 gap-x-2 gap-y-5">
          {order.map((c) => {
            const done = s.best[c.id] !== undefined;
            const isCurrent = c.id === current.id;
            return (
              <button key={c.id} type="button" disabled={!c.available} onClick={() => c.available && onPlay(c.id)} className="flex flex-col items-center gap-2 text-center disabled:cursor-default">
                <span className={`node-ring relative grid size-[84px] place-items-center rounded-full ${done ? "bg-[#0f2533] text-blue" : isCurrent ? "bg-blue text-[#04121b]" : "bg-surface-2 text-[#4a5863]"}`}>
                  {isCurrent && <span className="absolute -inset-[7px] rounded-full border-[5px] border-blue/30 border-t-blue" />}
                  {done ? <Icon.check /> : c.available ? <Icon.play /> : <Icon.lock />}
                </span>
                <span className={`text-[14px] font-extrabold leading-tight ${isCurrent ? "text-blue" : c.available ? "text-ink" : "text-muted"}`}>
                  {c.company}
                  <span className="block text-[12px] font-bold text-muted">{c.available ? (done ? `Best ${s.best[c.id]}` : "Ready") : "Coming soon"}</span>
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
          <button type="button" onClick={onShop} className="text-[14px] font-black uppercase text-blue">View all</button>
        </div>
        <div className="flex flex-col gap-3">
          {QUESTS.map((q) => {
            const v = Math.min(q.goal, q.read(s.quests));
            return (
              <div key={q.id} className="flex items-center gap-3">
                <Icon.bolt className="size-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[15px] font-extrabold"><span>{q.label}</span><span className="tabular-nums text-muted">{v}/{q.goal}</span></div>
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
