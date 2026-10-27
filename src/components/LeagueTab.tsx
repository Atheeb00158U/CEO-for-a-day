"use client";

import { useMemo } from "react";
import { DEMOTE, daysLeft, leagueRows, PROMOTE } from "@/lib/league";
import { LEAGUES, useGame } from "@/lib/store";
import { Icon } from "./ui";

const TIER_COLORS = ["#cd7f32", "#58cc02", "#1cb0f6", "#b583ff", "#ff4b4b", "#ffc800"];

export function LeagueTab({ onPlay }: { onPlay: () => void }) {
  const { s } = useGame();
  const tier = s.league.tier;
  const rows = useMemo(
    () => leagueRows({ seed: s.seed, weekId: s.league.weekId, tier, yourXp: s.league.weeklyXp, yourName: s.name }),
    [s.seed, s.league.weekId, tier, s.league.weeklyXp, s.name],
  );
  const youIdx = rows.findIndex((r) => r.you);
  const color = TIER_COLORS[tier];

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="-mx-4 flex items-end justify-center gap-4 overflow-hidden px-4">
        {LEAGUES.map((name, i) => (
          <Shield key={name} color={TIER_COLORS[i]} active={i === tier} locked={i > tier} size={i === tier ? 92 : 52} />
        )).slice(Math.max(0, tier - 1), tier + 3)}
      </div>
      <div className="text-center">
        <h1 className="text-[28px] font-black" style={{ color }}>{LEAGUES[tier]} league</h1>
        <p className="font-bold text-muted">League ends in <b className="text-ink">{daysLeft(s.league.weekId)} days</b>. Top {PROMOTE} move up.</p>
      </div>

      {s.league.weeklyXp === 0 && (
        <div className="rounded-3xl border-2 border-line p-4">
          <p className="text-[18px] font-black">Start earning XP!</p>
          <p className="mb-3 font-bold text-muted">Finish a hot seat to earn XP and climb the league.</p>
          <button type="button" className="btn3d" onClick={onPlay}>Take a hot seat</button>
        </div>
      )}

      <div className="flex items-center justify-between px-1 text-[12px] font-black uppercase tracking-[.12em] text-muted">
        <span>Player</span><span>XP this week</span>
      </div>
      <ol className="flex flex-col overflow-hidden rounded-3xl">
        {rows.map((r, i) => {
          const zoneTop = i < PROMOTE, zoneBottom = i >= rows.length - DEMOTE;
          return (
            <li key={r.id}>
              {i === PROMOTE && <ZoneLabel text={`Top ${PROMOTE} · Promotion zone`} color="var(--color-green)" up />}
              {i === rows.length - DEMOTE && <ZoneLabel text="Demotion zone" color="var(--color-red)" />}
              <div className={`flex items-center gap-3 px-4 py-3 ${r.you ? "relative z-[1] -mx-0.5 rounded-2xl border-2 border-red/80 bg-[#2a1214]" : zoneTop ? "bg-[#0f2116]" : "bg-surface"} ${!r.you ? "border-b border-bg" : ""}`}>
                <span className={`w-7 text-center text-[17px] font-black tabular-nums ${zoneTop ? "text-green" : zoneBottom ? "text-red" : "text-muted"}`}>{i + 1}</span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full text-[16px] font-black text-[#0b1015]" style={{ background: r.color }}>{r.name[0]}</span>
                <span className="flex-1 truncate text-[17px] font-extrabold">{r.you ? `${r.name} (you)` : r.name}</span>
                <span className="flex items-center gap-1 text-[17px] font-black tabular-nums"><Icon.bolt className="size-5" />{r.xp}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {youIdx >= rows.length - DEMOTE && s.league.weeklyXp > 0 && (
        <p className="text-center text-[14px] font-extrabold text-red">You&apos;re in the danger zone. Finish one more hot seat to climb out.</p>
      )}
      <p className="text-center text-[12px] font-bold text-muted">Preview league: other players are simulated until launch.</p>
    </div>
  );
}

function ZoneLabel({ text, color, up }: { text: string; color: string; up?: boolean }) {
  return (
    <p className="flex items-center justify-center gap-2 bg-bg py-3 text-[13px] font-black uppercase tracking-[.12em]" style={{ color }}>
      <span className="grid size-5 place-items-center rounded-full text-[#0b1015]" style={{ background: color }}>
        <svg viewBox="0 0 12 12" className={`size-3 ${up ? "" : "rotate-180"}`} aria-hidden="true"><path d="M6 2 2 7h3v3h2V7h3z" fill="currentColor" /></svg>
      </span>
      {text}
    </p>
  );
}

function Shield({ color, active, locked, size }: { color: string; active: boolean; locked: boolean; size: number }) {
  return (
    <svg viewBox="0 0 64 72" width={size} height={size * 1.12} aria-hidden="true" style={{ opacity: locked ? 0.35 : 1, filter: active ? `drop-shadow(0 6px 14px ${color}66)` : undefined }}>
      <path d="M32 3 58 13v20c0 17-11 29-26 36C17 62 6 50 6 33V13z" fill={locked ? "#3a4650" : color} />
      <path d="M32 10 51 17v16c0 12-8 22-19 27-11-5-19-15-19-27V17z" fill="rgba(255,255,255,.22)" />
      <path d="M32 20 40 38H24z" fill={locked ? "#2b3640" : "rgba(255,255,255,.75)"} />
    </svg>
  );
}
