"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Pick, PlayView, Reveal, Screen } from "@/lib/play"; // types only: nothing from play.ts ships to the browser
import { VERDICT } from "@/lib/verdict";

type Decision = Extract<Screen, { kind: "decision" }>;

const HOT_SEAT = "nirma-washing-powder";

const post = async (picks: Pick[]): Promise<PlayView> => {
  const r = await fetch("/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hotSeatId: HOT_SEAT, picks, site: true }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

const firstDecision = async (): Promise<Decision> => {
  const v = await post([]);
  const d = v.screens.find((s) => s.kind === "decision") as Decision | undefined;
  if (!d) throw new Error("no decision");
  return d;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One real decision from a free Hot Seat, playable on the website. The server replays the pick, as in the game. */
export function SampleCall() {
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const [near, setNear] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [onRealPath, setOnRealPath] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fetch only when the section is close to the screen.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let dead = false;
    (async () => {
      try {
        const d = await firstDecision().catch(async () => {
          await sleep(2000);
          return firstDecision();
        });
        if (!dead) setDecision(d);
      } catch {
        if (!dead) setGaveUp(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, [near]);

  useEffect(() => {
    if (reveal) heading.current?.focus();
  }, [reveal]);

  const pick = useCallback(
    async (optionId: string) => {
      if (!decision) return;
      setBusy(true);
      setFailed(false);
      try {
        const v = await post([{ nodeId: decision.id, optionId }]);
        if (v.reveal) {
          setOnRealPath(v.onRealPath);
          setReveal(v.reveal);
        } else setFailed(true);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [decision],
  );

  if (gaveUp)
    return (
      <div className="rounded-3xl bg-surface p-5">
        <p className="text-[16px] leading-snug">
          Open the app to try a real decision.{" "}
          <Link href="/app" className="font-black text-brand underline">
            Open the app
          </Link>
        </p>
      </div>
    );

  if (!decision) return <div ref={box} className="min-h-[420px] rounded-3xl bg-surface p-5" aria-hidden />;

  const v = reveal ? VERDICT[reveal.grade] : null;
  return (
    <div ref={box} className="rounded-3xl bg-surface p-5">
      <p className="text-[15px] font-bold text-muted">{decision.year}</p>
      <p className="mt-1 text-[16px] leading-snug">{decision.setup}</p>
      <p className="mt-3 text-[19px] leading-snug font-black">{decision.question}</p>
      {!reveal && (
        <div className="mt-4 grid gap-2" aria-busy={busy}>
          {decision.options.map((o) => (
            <button key={o.id} type="button" className={`tile ${busy ? "opacity-60" : ""}`} disabled={busy} onClick={() => pick(o.id)}>
              {o.label}
            </button>
          ))}
          {failed && (
            <p role="alert" className="text-[15px] font-bold text-red">
              That did not load. Tap again.
            </p>
          )}
        </div>
      )}
      <div role="status" className="mt-4 empty:hidden">
        {reveal && v && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-surface-2 px-2 py-1 text-[13px] font-black tabular-nums text-ink">{reveal.year}</span>
              <span
                className={`rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider ${onRealPath ? "bg-ink text-bg" : "border-2 border-dashed border-muted text-muted"}`}
              >
                {onRealPath ? "Real history" : "Our estimate"}
              </span>
            </div>
            <p className="mt-3 text-[15px] font-bold text-muted">You chose: {reveal.label}</p>
            <p ref={heading} tabIndex={-1} className="mt-2 text-[18px] font-black outline-none" style={{ color: v.color }}>
              {v.title}
            </p>
            <p className="mt-1 text-[16px] leading-snug">{reveal.outcome}</p>
            <p className="mt-2 text-[16px] leading-snug">
              <b>{reveal.grade === "great" ? "Why it worked: " : "Why it hurt: "}</b>
              {reveal.why}
            </p>
            {reveal.better && (
              <p className="mt-2 text-[16px] leading-snug">
                <b>The road you didn&apos;t take: </b>
                {reveal.better}
              </p>
            )}
            {reveal.realChoice && (
              <div className="mt-3 rounded-2xl border-2 border-line p-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted">What {reveal.realChoice.company} actually did</p>
                <p className="mt-1 text-[15px] font-bold">{reveal.realChoice.label}</p>
              </div>
            )}
            <Link href="/app" className="btn3d green mt-5">
              Play the whole Hot Seat free
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
