"use client";

import { useEffect, useState } from "react";
import { buildDebrief, reviewedDebrief, type Debriefs, type RunState } from "@/lib/engine";
import type { EndingNode, HotSeat } from "@/lib/hotseat-types";
import { BADGES, ECONOMY, useGame, type RunRecord } from "@/lib/store";
import { stopVoice } from "@/lib/voice";
import { Card, Icon } from "./ui";

// Loaded only when a debrief opens, as its own chunk.
const DEBRIEFS = import.meta.glob<Debriefs>("/content/hotseats/*/debriefs.json", { import: "default" });

const GRADE = {
  great: { c: "var(--color-green)", t: "Great" },
  ok: { c: "var(--color-gold)", t: "Risky" },
  bad: { c: "var(--color-red)", t: "Costly" },
} as const;

export function Debrief({
  hs,
  run,
  ending,
  record,
  badgesBefore,
  onExit,
  onNotes,
  onReplay,
}: {
  hs: HotSeat;
  run: RunState;
  ending: EndingNode;
  record: RunRecord;
  /** Badges the player had when this run started; only newer ones are shown. */
  badgesBefore: string[];
  onExit: () => void;
  onNotes: () => void;
  onReplay: () => void;
}) {
  const { s } = useGame();
  const d = buildDebrief(hs, run);
  const [written, setWritten] = useState<string>();
  useEffect(() => {
    DEBRIEFS[`/content/hotseats/${hs.id}/debriefs.json`]?.()
      .then((all) => setWritten(reviewedDebrief(all, run.picks)))
      .catch(() => {}); // offline or missing: the assembled takeaways below still show
  }, [hs.id, run.picks]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    stopVoice();
    const t = setTimeout(() => setShown(record.score), 120);
    return () => clearTimeout(t);
  }, [record.score]);
  const boosted = record.xp > ECONOMY.completionXp + record.score;
  const ring = 2 * Math.PI * 52;
  const newBadges = s.badges.filter((b) => BADGES[b] && !badgesBefore.includes(b));

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 pb-10"
      style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-[13px] font-black uppercase tracking-[.14em] text-brand">Hot Seat complete · {hs.company}</p>
        <h1 className="mt-1 text-[30px] font-black leading-tight">{ending.title}</h1>
        <div className="relative mt-4 size-[140px]">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-surface-2)" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={shown >= 70 ? "var(--color-green)" : shown >= 40 ? "var(--color-gold)" : "var(--color-red)"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - shown / 100)}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.3,.7,.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              <p className="text-[40px] font-black leading-none tabular-nums">{record.score}</p>
              <p className="text-[12px] font-black uppercase tracking-wider text-muted">CEO score</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<Icon.bolt className="size-6" />}
          value={`+${record.xp}`}
          label={boosted ? "XP · 2× boost" : "XP"}
          color="var(--color-green)"
        />
        <Stat icon={<Icon.coin className="size-6" />} value={`+${ECONOMY.completionCoins}`} label="Coins" color="var(--color-gold)" />
        <Stat
          icon={<Icon.heart className="size-6" />}
          value={`${run.trust}/${hs.startTrust}`}
          label="Board trust"
          color="var(--color-red)"
        />
      </div>

      <Card>
        <h2 className="text-[19px] font-black">Your calls</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {d.lines.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-11 shrink-0 pt-0.5 text-[14px] font-black tabular-nums text-muted">{l.year}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold leading-snug">{l.choice}</p>
                <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black uppercase tracking-wider">
                  <span style={{ color: GRADE[l.grade].c }}>{GRADE[l.grade].t}</span>
                  {l.real && <span className="text-muted">· What {hs.company} did</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="border-brand/40 bg-brand/5">
        <h2 className="text-[19px] font-black">Your key takeaways</h2>
        <p className="text-[13px] font-bold text-muted">Saved to your notes, written for the calls you made.</p>
        {written
          ? written.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="mt-3 text-[15px] font-bold leading-snug">
                {para}
              </p>
            ))
          : null}
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] font-bold leading-snug marker:text-brand">
          {!written && d.patterns.map((p) => <li key={p}>{p}</li>)}
          {d.lines.map((l, i) => (
            <li key={i}>{l.takeaway}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-[19px] font-black">What really happened</h2>
        <p className="mt-2 text-[15px] font-bold leading-snug text-muted">{hs.realHistory}</p>
        <details className="mt-3 text-[13px] font-bold text-muted">
          <summary className="cursor-pointer font-black text-brand">Sources</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {hs.sources.map((x) => (
              <li key={x.url}>
                <a className="underline" href={x.url} target="_blank" rel="noopener noreferrer">
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2">{hs.credits}</p>
        </details>
      </Card>

      {newBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {newBadges.map((b) => (
            <span key={b} className="pop rounded-full bg-gold/15 px-3 py-1.5 text-[13px] font-black text-gold">
              Badge · {BADGES[b].name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <button type="button" className="btn3d green" onClick={onExit}>
          Continue
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn3d ghost !text-[14px]" onClick={onReplay}>
            Try another path
          </button>
          <button type="button" className="btn3d ghost !text-[14px]" onClick={onNotes}>
            Open notes
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="rounded-2xl border-2 p-2.5 text-center" style={{ borderColor: color }}>
      <p className="rounded-lg py-0.5 text-[11px] font-black uppercase tracking-wider" style={{ background: color, color: "#0b1015" }}>
        {label}
      </p>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[20px] font-black tabular-nums">
        {icon}
        {value}
      </p>
    </div>
  );
}
