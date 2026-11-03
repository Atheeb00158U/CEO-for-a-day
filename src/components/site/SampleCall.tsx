"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Pick, PlayView, Reveal, Screen } from "@/lib/play"; // types only: nothing from play.ts ships to the browser

type Decision = Extract<Screen, { kind: "decision" }>;

const HOT_SEAT = "kingfisher-airlines";
// The same words and colours as the game's verdict sheet (VERDICT in Player.tsx).
const GRADE = {
  great: { title: "Great call!", color: "var(--color-green)" },
  ok: { title: "Risky call", color: "var(--color-gold)" },
  bad: { title: "Costly call", color: "var(--color-red)" },
} as const;

const post = async (picks: Pick[]): Promise<PlayView> => {
  const r = await fetch("/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hotSeatId: HOT_SEAT, picks }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

/** One real decision from a free Hot Seat, playable on the website. The server replays the pick, as in the game. */
export function SampleCall() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    post([])
      .then((v) => setDecision((v.screens.find((s) => s.kind === "decision") as Decision | undefined) ?? null))
      .catch(() => setDecision(null));
  }, []);

  if (!decision) return null; // the section's text still says what a Hot Seat is

  const pick = async (optionId: string) => {
    setBusy(true);
    setFailed(false);
    try {
      const v = await post([{ nodeId: decision.id, optionId }]);
      if (v.reveal) setReveal(v.reveal);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className="text-[15px] font-bold text-muted">{decision.year}</p>
      <p className="mt-1 text-[16px] leading-snug">{decision.setup}</p>
      <p className="mt-3 text-[19px] leading-snug font-black">{decision.question}</p>
      {!reveal ? (
        <div className="mt-4 grid gap-2">
          {decision.options.map((o) => (
            <button key={o.id} type="button" className="tile" disabled={busy} onClick={() => pick(o.id)}>
              {o.label}
            </button>
          ))}
          {failed && <p className="text-[15px] font-bold text-red">That did not load. Tap again.</p>}
        </div>
      ) : (
        <div className="mt-4" role="status">
          <p className="text-[15px] font-bold text-muted">You chose: {reveal.label}</p>
          <p className="mt-2 text-[18px] font-black" style={{ color: GRADE[reveal.grade].color }}>
            {GRADE[reveal.grade].title}
          </p>
          <p className="mt-1 text-[16px] leading-snug">{reveal.outcome}</p>
          <p className="mt-2 text-[16px] leading-snug">{reveal.why}</p>
          <Link href="/app" className="btn3d green mt-5">
            Play the whole Hot Seat free
          </Link>
        </div>
      )}
    </div>
  );
}
