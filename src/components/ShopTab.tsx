"use client";

import { useState } from "react";
import { ECONOMY, QUESTS, useGame } from "@/lib/store";
import { Bar, Card, Icon } from "./ui";

export function ShopTab() {
  const { s, buy, claimQuest, activateBooster, boosterActive } = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };

  const items = [
    { id: "booster" as const, icon: <Icon.boltPurple className="size-10" />, name: "Double XP", desc: `2× XP for ${ECONOMY.boosterMinutes} minutes. Climb the league faster.`, owned: s.boosters },
    { id: "freeze" as const, icon: <Icon.snow className="size-10" />, name: "Streak freeze", desc: "Protects your streak for one missed day. Used automatically.", owned: s.freezes },
    { id: "hindsight" as const, icon: <Icon.rewind className="size-10" />, name: "Hindsight", desc: "Redo one decision after you see how it played out. One per hot seat.", owned: s.hindsights },
  ];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <h1 className="text-[28px] font-black">Quests & shop</h1>
        <p className="font-bold text-muted">Earn coins from quests and hot seats, then spend them on power-ups.</p>
      </div>

      <Card>
        <h2 className="mb-3 text-[19px] font-black">Daily quests</h2>
        <div className="flex flex-col gap-4">
          {QUESTS.map((q) => {
            const v = Math.min(q.goal, q.read(s.quests));
            const claimed = s.quests.claimed.includes(q.id);
            const ready = v >= q.goal && !claimed;
            return (
              <div key={q.id} className="flex items-center gap-3">
                <Icon.bolt className="size-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[15px] font-extrabold"><span>{q.label}</span><span className="tabular-nums text-muted">{v}/{q.goal}</span></div>
                  <Bar value={(v / q.goal) * 100} color="var(--color-gold)" h="h-3" />
                </div>
                <button type="button" disabled={!ready} onClick={() => { claimQuest(q.id); flash(`+${q.reward} coins`); }}
                  className={`btn3d gold !w-auto shrink-0 !px-3 !py-2 !text-[13px] ${claimed ? "opacity-50" : ""}`}>
                  {claimed ? "Done" : <><Icon.coin className="size-4" />{q.reward}</>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] font-bold text-muted">Quests reset every day at midnight.</p>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-[19px] font-black">Power-ups</h2>
        {items.map((it) => (
          <Card key={it.id} className="flex items-center gap-3">
            {it.icon}
            <div className="min-w-0 flex-1">
              <p className="font-black">{it.name} <span className="text-[13px] font-extrabold text-muted">· you have {it.owned}</span></p>
              <p className="text-[14px] font-bold leading-snug text-muted">{it.desc}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button type="button" className="btn3d gold !w-auto !px-3 !py-2 !text-[13px]" disabled={s.coins < ECONOMY.prices[it.id]}
                onClick={() => flash(buy(it.id) ? `${it.name} added` : "Not enough coins")}>
                <Icon.coin className="size-4" />{ECONOMY.prices[it.id]}
              </button>
              {it.id === "booster" && it.owned > 0 && !boosterActive && (
                <button type="button" className="btn3d purple !w-auto !px-3 !py-2 !text-[13px]" onClick={() => { activateBooster(); flash("Double XP is on"); }}>Use</button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {msg && <div className="pop fixed inset-x-0 top-20 z-40 mx-auto w-fit rounded-full bg-gold px-4 py-2 font-black text-[#2a1d00]" role="status">{msg}</div>}
    </div>
  );
}
