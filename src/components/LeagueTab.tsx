"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth";
import { daysLeft } from "@/lib/league";
import type { LeagueBoard } from "@/lib/server/game";
import { LEAGUES, useGame } from "@/lib/store";
import { SignInCard } from "./SignInCard";
import { Icon } from "./ui";

const TIER_COLORS = ["#cd7f32", "#58cc02", "#1cb0f6", "#b583ff", "#ff4b4b", "#ffc800"];
const AVATARS = ["#1cb0f6", "#58cc02", "#ff9600", "#ce82ff", "#ff4b4b", "#ffc800", "#2bd9c5", "#ff86d0"];
const colorOf = (id: string) => AVATARS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length];

/** Weekly leagues with real players. Guests are asked to sign in: a league needs an account. */
export function LeagueTab({ onPlay }: { onPlay: () => void }) {
  const { s, account } = useGame();
  const [board, setBoard] = useState<LeagueBoard | null>();
  useEffect(() => {
    if (!account) return;
    let live = true;
    api<LeagueBoard>("/api/league")
      .then((b) => live && setBoard(b))
      .catch(() => live && setBoard(null));
    return () => {
      live = false;
    };
  }, [account, s.xp]);

  const tier = board?.tier ?? s.league.tier;
  const color = TIER_COLORS[tier];
  const real = board?.rows.filter((r) => !r.bot) ?? [];
  const rank = real.findIndex((r) => r.you);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="-mx-4 flex items-end justify-center gap-4 overflow-hidden px-4">
        {LEAGUES.map((name, i) => (
          <Shield key={name} color={TIER_COLORS[i]} active={i === tier} locked={i > tier} size={i === tier ? 92 : 52} />
        )).slice(Math.max(0, tier - 1), tier + 3)}
      </div>
      <div className="text-center">
        <h1 className="text-[28px] font-black" style={{ color }}>
          {LEAGUES[tier]} league
        </h1>
        {board && (
          <p className="font-bold text-muted">
            League ends in <b className="text-ink">{daysLeft(board.weekId)} days</b>.{" "}
            {board.promote.minXp > 1
              ? `Top ${board.promote.count} with ${board.promote.minXp}+ XP move up.`
              : `Top ${board.promote.count} move up.`}
          </p>
        )}
      </div>

      {!account && (
        <SignInCard
          title="Join a league"
          text="Leagues are for players with an account. Sign in with Google to race real players each week."
        />
      )}

      {account && board === null && (
        <p className="text-center font-bold text-muted">Couldn&apos;t load your league. Check your connection.</p>
      )}

      {account && board && !board.joined && (
        <div className="rounded-3xl border-2 border-line p-4">
          <p className="text-[18px] font-black">Start earning XP!</p>
          <p className="mb-3 font-bold text-muted">Earn XP this week to join a group of players in your league.</p>
          <button type="button" className="btn3d" onClick={onPlay}>
            Take a hot seat
          </button>
        </div>
      )}

      {board?.joined && (
        <>
          <div className="flex items-center justify-between px-1 text-[12px] font-black uppercase tracking-[.12em] text-muted">
            <span>Player</span>
            <span>XP this week</span>
          </div>
          <ol className="flex flex-col overflow-hidden rounded-3xl">
            {board.rows.map((r) => {
              const place = r.bot ? -1 : real.indexOf(r);
              const zoneTop = place >= 0 && place < board.promote.count && r.xp >= board.promote.minXp;
              const zoneBottom = place >= 0 && board.demote > 0 && place >= real.length - board.demote;
              return (
                <li key={r.id}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 ${r.you ? "relative z-[1] -mx-0.5 rounded-2xl border-2 border-red/80 bg-[#2a1214]" : zoneTop ? "bg-[#0f2116]" : "bg-surface"} ${!r.you ? "border-b border-bg" : ""} ${r.bot ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`w-7 text-center text-[17px] font-black tabular-nums ${zoneTop ? "text-green" : zoneBottom ? "text-red" : "text-muted"}`}
                    >
                      {r.bot ? "·" : place + 1}
                    </span>
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full text-[16px] font-black text-[#0b1015]"
                      style={{ background: colorOf(r.id) }}
                    >
                      {r.name[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 truncate text-[17px] font-extrabold">
                      {r.you ? `${r.name} (you)` : r.name}
                      {r.bot && <span className="ml-1 text-[12px] font-black text-muted uppercase">practice</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[17px] font-black tabular-nums">
                      <Icon.bolt className="size-5" />
                      {r.xp}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          {board.demote > 0 && rank >= real.length - board.demote && (
            <p className="text-center text-[14px] font-extrabold text-red">
              You&apos;re in the danger zone. Finish one more hot seat to climb out.
            </p>
          )}
          {board.rows.some((r) => r.bot) && (
            <p className="text-center text-[12px] font-bold text-muted">
              Your group is still filling up. Practice rivals keep you company, but only real players count for moving up.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Shield({ color, active, locked, size }: { color: string; active: boolean; locked: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={size * 1.12}
      aria-hidden="true"
      style={{ opacity: locked ? 0.35 : 1, filter: active ? `drop-shadow(0 6px 14px ${color}66)` : undefined }}
    >
      <path d="M32 3 58 13v20c0 17-11 29-26 36C17 62 6 50 6 33V13z" fill={locked ? "#3a4650" : color} />
      <path d="M32 10 51 17v16c0 12-8 22-19 27-11-5-19-15-19-27V17z" fill="rgba(255,255,255,.22)" />
      <path d="M32 20 40 38H24z" fill={locked ? "#2b3640" : "rgba(255,255,255,.75)"} />
    </svg>
  );
}
