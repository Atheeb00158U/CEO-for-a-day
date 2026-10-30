"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLessonStep, type LessonTarget } from "@/lib/content-client";
import { TEST_OUT_PASS } from "@/lib/game-state";
import type { Answer, LessonScreen, LessonView } from "@/lib/lesson-play";
import { useGame } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { stopVoice } from "@/lib/voice";
import { DecisionView, RevealView, VerdictSheet } from "./Player";
import { Logo } from "./Logo";
import { Bar, Card, Icon, MediaView, Pill } from "./ui";

type Exercise = Exclude<LessonScreen, { kind: "explain" }>;
type Phase = { kind: "screen"; i: number } | { kind: "reveal"; shown: Exercise; value: Answer["value"] } | { kind: "done"; xp: number };

/**
 * Plays a lesson, or a module's test-out quiz. Like the Hot Seat player, the phone holds only the answers: each
 * Check sends them all to /api/lesson, which replays them and returns the verdict and the next screens.
 */
export function LessonPlayer({ target, testOut, onExit }: { target: LessonTarget; testOut?: string[]; onExit: () => void }) {
  const game = useGame();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [view, setView] = useState<LessonView>();
  const [phase, setPhase] = useState<Phase>({ kind: "screen", i: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ answers: Answer[]; shown?: Exercise; value?: Answer["value"] } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const playKey = useRef(newPlayKey());
  const finished = useRef(false); // a double tap at the end must not pay twice

  const load = (next: Answer[], shown?: Exercise, value?: Answer["value"]) => {
    setBusy(true);
    setFailed(null);
    fetchLessonStep(target, next)
      .then((v) => {
        setAnswers(next);
        setView(v);
        if (shown && value !== undefined && v.reveal) {
          playSfx(v.reveal.correct ? "great" : "bad");
          setPhase({ kind: "reveal", shown, value });
        } else setPhase({ kind: "screen", i: 0 });
      })
      .catch(() => setFailed({ answers: next, shown, value }))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    load([]);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    const r = view?.result;
    if (finished.current || !r) return;
    finished.current = true;
    setSaveFailed(false);
    game
      .finishLesson({ target, answers, result: r, playKey: playKey.current, testOut })
      .then((xp) => {
        if (xp) playSfx("coins", 300);
        setPhase({ kind: "done", xp });
      })
      .catch(() => {
        finished.current = false; // same play key, so trying again can't pay twice
        setSaveFailed(true);
      });
  };

  /** After a verdict or an explain screen: the next screen, or the end. */
  const advance = (i: number) => {
    if (view && i >= view.screens.length && view.result) finish();
    else setPhase({ kind: "screen", i });
  };

  if (!view)
    return (
      <div className="grid min-h-dvh place-items-center px-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={96} className={failed ? "" : "pop"} />
          {failed ? (
            <>
              <p className="text-[20px] font-black">Couldn&apos;t load this lesson</p>
              <button type="button" className="btn3d green" onClick={() => load([])}>
                Try again
              </button>
              <button type="button" className="text-[15px] font-extrabold text-muted uppercase" onClick={onExit}>
                Go back
              </button>
            </>
          ) : (
            <p className="text-[18px] font-black text-muted">Loading…</p>
          )}
        </div>
      </div>
    );

  if (phase.kind === "done") return <LessonEnd view={view} xp={phase.xp} testOut={!!testOut} onExit={onExit} />;

  const screen = phase.kind === "screen" ? view.screens[phase.i] : undefined;
  const check = (shown: Exercise, value: Answer["value"]) => {
    if (busy) return;
    playSfx("lock");
    load([...answers, { screenId: shown.id, value }], shown, value);
  };
  const reveal = phase.kind === "reveal" ? view.reveal : undefined;
  const progress = view.result && phase.kind !== "screen" ? 100 : (view.progress.done / Math.max(1, view.progress.total)) * 100;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3 py-2">
        <button type="button" onClick={onExit} aria-label="Leave lesson" className="text-muted">
          <Icon.close />
        </button>
        <div className="flex-1">
          <Bar value={progress} h="h-4" />
        </div>
      </div>

      {(failed || saveFailed) && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-red/15 px-3 py-2">
          <p className="text-[14px] font-extrabold text-red">That didn&apos;t go through.</p>
          <button
            type="button"
            className="text-[14px] font-black text-brand uppercase"
            onClick={() => (failed ? load(failed.answers, failed.shown, failed.value) : finish())}
          >
            Try again
          </button>
        </div>
      )}

      {screen?.kind === "explain" && (
        <div key={screen.id} className="flex flex-1 flex-col gap-4">
          {screen.media && <MediaView media={screen.media} className="aspect-[4/3] w-full" />}
          {screen.title && <p className="text-[13px] font-black tracking-[.12em] text-brand uppercase">{screen.title}</p>}
          <p className="text-[22px] leading-snug font-bold">{screen.text}</p>
          <div className="mt-auto pt-4 pb-6">
            <button
              type="button"
              className="btn3d"
              onClick={() => {
                playSfx("next");
                advance((phase as { i: number }).i + 1);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {screen && screen.kind !== "explain" && (
        <ExerciseView key={`${screen.id}${screen.retry ? "r" : ""}`} shown={screen} busy={busy} onCheck={check} />
      )}

      {reveal && phase.kind === "reveal" && phase.shown.kind === "scenario" && (
        <RevealView
          year={phase.shown.year ?? ""}
          media={phase.shown.media}
          outcome={reveal.outcome ?? ""}
          grade={reveal.grade ?? (reveal.correct ? "great" : "bad")}
          why={reveal.why}
          better={reveal.better}
          pointsLabel={reveal.retry ? "Second try" : ""}
          onNext={() => advance(0)}
        />
      )}
      {reveal && phase.kind === "reveal" && phase.shown.kind !== "scenario" && (
        <>
          <ExerciseView shown={phase.shown} busy locked={phase.value} onCheck={() => {}} />
          <VerdictSheet
            grade={reveal.guess ? "ok" : reveal.correct ? "great" : "bad"}
            title={
              reveal.guess ? (reveal.right ? "Good guess. Here's the answer" : "Good guess!") : reveal.correct ? "Correct!" : "Not quite"
            }
            pointsLabel={!reveal.correct && !reveal.retry && !testOut ? "You'll see it again" : undefined}
            lines={[...(reveal.right ? [{ label: "Answer: ", text: reveal.right }] : []), { label: "Why: ", text: reveal.why }]}
            onNext={() => advance(0)}
          />
        </>
      )}
    </div>
  );
}

const newPlayKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `play-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** One exercise. `locked` shows the answer already given (under the verdict sheet) and turns taps off. */
function ExerciseView({
  shown,
  busy,
  locked,
  onCheck,
}: {
  shown: Exercise;
  busy: boolean;
  locked?: Answer["value"];
  onCheck: (shown: Exercise, value: Answer["value"]) => void;
}) {
  if (shown.kind === "scenario")
    return (
      <DecisionView
        year={shown.year ?? ""}
        media={shown.media}
        setup={shown.setup}
        question={shown.question}
        advisor={shown.advisor}
        options={shown.options}
        busy={busy}
        onChoose={(id) => onCheck(shown, id)}
      />
    );
  return (
    <div className={`flex flex-1 flex-col gap-4 ${locked !== undefined ? "pb-[260px]" : ""}`}>
      {shown.retry && <p className="text-[13px] font-black tracking-[.12em] text-gold uppercase">Try this one again</p>}
      {shown.kind === "choice" && (
        <Choice shown={shown} locked={locked as string | undefined} busy={busy} onCheck={(v) => onCheck(shown, v)} />
      )}
      {shown.kind === "gap" && <Gap shown={shown} locked={locked as string[] | undefined} busy={busy} onCheck={(v) => onCheck(shown, v)} />}
      {shown.kind === "order" && (
        <Order shown={shown} locked={locked as string[] | undefined} busy={busy} onCheck={(v) => onCheck(shown, v)} />
      )}
      {shown.kind === "sort" && (
        <Sort shown={shown} locked={locked as string[] | undefined} busy={busy} onCheck={(v) => onCheck(shown, v)} />
      )}
    </div>
  );
}

function CheckButton({ ready, busy, hidden, onClick }: { ready: boolean; busy: boolean; hidden: boolean; onClick: () => void }) {
  if (hidden) return null;
  return (
    <div className="mt-auto pt-2 pb-6">
      <button type="button" className="btn3d green" disabled={!ready || busy} onClick={onClick}>
        Check
      </button>
    </div>
  );
}

type Props<K extends Exercise["kind"], V> = {
  shown: Extract<Exercise, { kind: K }>;
  locked?: V;
  busy: boolean;
  onCheck: (v: V) => void;
};

function Choice({ shown, locked, busy, onCheck }: Props<"choice", string>) {
  const [sel, setSel] = useState<string | null>(locked ?? null);
  return (
    <>
      {shown.media && <MediaView media={shown.media} className="aspect-[16/9] w-full" kenBurns={false} />}
      {shown.guess && <p className="text-[13px] font-black tracking-[.12em] text-purple uppercase">Take a guess</p>}
      <h2 className="text-[24px] leading-tight font-black text-balance">{shown.prompt}</h2>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Options">
        {shown.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sel === o.id}
            disabled={locked !== undefined}
            className="tile flex gap-3"
            onClick={() => {
              playSfx("select");
              setSel(o.id);
            }}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line text-[13px] font-black text-muted">
              {i + 1}
            </span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <CheckButton ready={!!sel} busy={busy} hidden={locked !== undefined} onClick={() => sel && onCheck(sel)} />
    </>
  );
}

/** Fill the gaps from a word bank: tap a word to put it in the next gap, tap a filled gap to take it back. */
function Gap({ shown, locked, busy, onCheck }: Props<"gap", string[]>) {
  const parts = shown.text.split("___");
  const [filled, setFilled] = useState<(string | null)[]>(locked ?? Array(parts.length - 1).fill(null));
  const used = new Set(filled.filter(Boolean));
  const place = (w: string) => {
    if (locked) return;
    playSfx("select");
    setFilled((f) => {
      const i = f.indexOf(null);
      return i < 0 || f.includes(w) ? f : f.map((x, j) => (j === i ? w : x));
    });
  };
  return (
    <>
      <p className="text-[13px] font-black tracking-[.12em] text-muted uppercase">Fill the gaps</p>
      <p className="text-[22px] leading-[1.9] font-bold">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              <button
                type="button"
                disabled={!!locked || !filled[i]}
                onClick={() => setFilled((f) => f.map((x, j) => (j === i ? null : x)))}
                className={`mx-1 inline-block min-w-[80px] rounded-xl border-b-4 px-2 align-middle text-[18px] font-black ${filled[i] ? "border-brand bg-surface-2 text-ink" : "border-line text-transparent"}`}
                aria-label={filled[i] ? `Gap ${i + 1}: ${filled[i]}, tap to remove` : `Gap ${i + 1}, empty`}
              >
                {filled[i] ?? "____"}
              </button>
            )}
          </span>
        ))}
      </p>
      <div className="flex flex-wrap gap-2">
        {shown.bank.map((w) => (
          <button
            key={w}
            type="button"
            disabled={!!locked || used.has(w)}
            onClick={() => place(w)}
            className={`tile !w-auto !px-4 !py-2 ${used.has(w) ? "opacity-30" : ""}`}
          >
            {w}
          </button>
        ))}
      </div>
      <CheckButton ready={filled.every(Boolean)} busy={busy} hidden={!!locked} onClick={() => onCheck(filled as string[])} />
    </>
  );
}

/** Put steps in order: tap them in turn to number them, tap a numbered one to take it back. No dragging. */
function Order({ shown, locked, busy, onCheck }: Props<"order", string[]>) {
  const [picked, setPicked] = useState<string[]>(locked ?? []);
  return (
    <>
      <h2 className="text-[24px] leading-tight font-black text-balance">{shown.prompt}</h2>
      <p className="-mt-2 text-[14px] font-bold text-muted">Tap the steps in order, first to last.</p>
      <div className="flex flex-col gap-3">
        {shown.steps.map((step) => {
          const n = picked.indexOf(step);
          return (
            <button
              key={step}
              type="button"
              aria-pressed={n >= 0}
              disabled={!!locked}
              className="tile flex gap-3"
              onClick={() => {
                playSfx("select");
                setPicked((p) => (p.includes(step) ? p.filter((x) => x !== step) : [...p, step]));
              }}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line text-[13px] font-black text-muted">
                {n >= 0 ? n + 1 : ""}
              </span>
              <span>{step}</span>
            </button>
          );
        })}
      </div>
      <CheckButton ready={picked.length === shown.steps.length} busy={busy} hidden={!!locked} onClick={() => onCheck(picked)} />
    </>
  );
}

/** Sort into two buckets: each item has a button for each bucket. */
function Sort({ shown, locked, busy, onCheck }: Props<"sort", string[]>) {
  const [put, setPut] = useState<(string | null)[]>(locked ?? shown.items.map(() => null));
  return (
    <>
      <h2 className="text-[24px] leading-tight font-black text-balance">{shown.prompt}</h2>
      <div className="flex flex-col gap-3">
        {shown.items.map((item, i) => (
          <div key={item} className="rounded-2xl border-2 border-line bg-surface p-3">
            <p className="text-[17px] font-extrabold">{item}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {shown.buckets.map((b, k) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={put[i] === String(k)}
                  disabled={!!locked}
                  className="tile !px-2 !py-2 text-center !text-[14px]"
                  onClick={() => {
                    playSfx("select");
                    setPut((p) => p.map((x, j) => (j === i ? String(k) : x)));
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <CheckButton ready={put.every((x) => x !== null)} busy={busy} hidden={!!locked} onClick={() => onCheck(put as string[])} />
    </>
  );
}

/** The end of a lesson: the takeaway, accuracy, XP and the cards added to Notes. */
function LessonEnd({ view, xp, testOut, onExit }: { view: LessonView; xp: number; testOut: boolean; onExit: () => void }) {
  const r = view.result!;
  const passed = r.accuracy >= TEST_OUT_PASS;
  useEffect(() => playSfx(testOut && !passed ? "lose" : "legend"), [testOut, passed]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4 pt-10 pb-6">
      <Logo size={88} className="pop mx-auto" />
      <h1 className="text-center text-[30px] leading-tight font-black">
        {testOut ? (passed ? "You tested out!" : "Not yet") : "Lesson done!"}
      </h1>
      {testOut && (
        <p className="text-center text-[16px] font-bold text-muted">
          {passed
            ? "These lessons are marked done, and their cards are in Notes."
            : `You need ${TEST_OUT_PASS}% to skip ahead. Try the lessons first.`}
        </p>
      )}
      <div className="flex justify-center gap-2">
        <Pill label={`${r.accuracy}% right first time`}>
          <Icon.check className="size-5" />
          {r.accuracy}%
        </Pill>
        {xp > 0 && (
          <Pill label={`${xp} XP`}>
            <Icon.bolt className="size-5" />+{xp} XP
          </Pill>
        )}
      </div>
      {!testOut && (
        <Card className="border-brand/50 bg-brand/10">
          <p className="text-[12px] font-black tracking-[.12em] text-brand uppercase">Takeaway</p>
          <p className="mt-1 text-[21px] leading-snug font-black">{r.principle}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[15px] font-bold marker:text-brand">
            {r.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}
      {(!testOut || passed) && r.cardIds.length > 0 && (
        <p className="text-center text-[15px] font-bold text-muted">
          {r.cardIds.length} flashcard{r.cardIds.length > 1 ? "s" : ""} added to Notes.
        </p>
      )}
      <div className="mt-auto">
        <button type="button" className="btn3d green" onClick={onExit}>
          Continue
        </button>
      </div>
    </div>
  );
}
