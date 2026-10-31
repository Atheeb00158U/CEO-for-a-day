"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStep, type PlayResponse } from "@/lib/content-client";
import { spokenWhy } from "@/lib/engine";
import type { Grade, Media } from "@/lib/hotseat-types";
import type { Pick, PlayView, Screen } from "@/lib/play";
import { useGame, type RunRecord } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { ADVISOR, NARRATOR, speak, stopVoice } from "@/lib/voice";
import { Bar, Caption, Icon, MediaView } from "./ui";
import { Logo } from "./Logo";
import { Debrief } from "./Debrief";
import { MADE_UP_LABEL } from "@/content/catalog";

type Phase =
  { kind: "screen"; i: number } | { kind: "reveal" } | { kind: "checkpoint" } | { kind: "debrief"; record: RunRecord; endingTitle: string };

const VERDICT = {
  great: { title: "Great call!", color: "var(--color-green)", bg: "bg-[#0f2a10]", btn: "green", points: "+25 CEO points" },
  ok: { title: "Risky call", color: "var(--color-gold)", bg: "bg-[#2a2306]", btn: "gold", points: "+10 CEO points" },
  bad: { title: "Costly call", color: "var(--color-red)", bg: "bg-[#2d0f0f]", btn: "red", points: "−1 board trust" },
} as const;

/** A pause after the first few calls, used by the welcome screens. The run carries on from where it stopped. */
export interface Checkpoint {
  after: number;
  render: (view: PlayView, onContinue: () => void) => React.ReactNode;
}

/**
 * Plays a Hot Seat. The phone holds only the picks; each step (and its verdict) comes from the server, which
 * replays the picks through the engine. So no answer is on the phone before the player picks it.
 */
export function Player({
  hotSeatId,
  onExit,
  onNotes,
  checkpoint,
}: {
  hotSeatId: string;
  onExit: () => void;
  onNotes: () => void;
  checkpoint?: Checkpoint;
}) {
  const game = useGame();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [view, setView] = useState<PlayResponse>();
  const before = useRef<PlayResponse>(undefined); // the step before the last pick, for Hindsight
  const [phase, setPhase] = useState<Phase>({ kind: "screen", i: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Pick[] | null>(null); // the request to retry
  const [usedHindsight, setUsedHindsight] = useState(false);
  const [badgesBefore, setBadgesBefore] = useState(game.s.badges);
  const finished = useRef(false); // a double tap on "See your results" must not pay out twice
  const runKey = useRef(newRunKey());
  const [saveFailed, setSaveFailed] = useState(false);
  const paused = useRef(false);

  const load = useCallback(
    (next: Pick[]) => {
      setBusy(true);
      setFailed(null);
      fetchStep(hotSeatId, next)
        .then((v) => {
          if (next.length) before.current = view;
          setPicks(next);
          setView(v);
          setPhase(next.length ? { kind: "reveal" } : { kind: "screen", i: 0 });
        })
        .catch(() => setFailed(next))
        .finally(() => setBusy(false));
    },
    [hotSeatId, view],
  );

  useEffect(() => {
    load([]);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotSeatId]);

  // A lost heart lands after the verdict and meter sounds (see RevealView and Meters).
  const trust = view?.trust;
  const trustBefore = useRef(trust);
  useEffect(() => {
    if (trust !== undefined && trustBefore.current !== undefined && trust < trustBefore.current) playSfx("heart", 800);
    trustBefore.current = trust;
  }, [trust]);

  if (!view) return <Loading failed={!!failed} onRetry={() => load(failed ?? [])} onExit={onExit} />;

  const { meta } = view;
  const madeUp = !!meta.madeUp;
  const screen = phase.kind === "screen" ? view.screens[phase.i] : undefined;

  const onHindsight = () => {
    if (phase.kind !== "reveal" || usedHindsight || !before.current || !game.spendHindsight()) return;
    setUsedHindsight(true);
    const prev = before.current;
    setPicks(picks.slice(0, -1));
    setView(prev);
    setPhase({ kind: "screen", i: prev.screens.length - 1 }); // the same decision again
  };

  const finish = (title: string) => {
    const r = view.result;
    if (finished.current || !r) return;
    finished.current = true;
    setSaveFailed(false);
    game
      .finishRun({ hotSeatId: meta.id, picks, result: r, hindsightUsed: usedHindsight, runKey: runKey.current })
      .then((record) => setPhase({ kind: "debrief", record, endingTitle: title }))
      .catch(() => {
        finished.current = false; // same run key, so trying again can't pay twice
        setSaveFailed(true);
      });
  };

  const decisionsDone = view.picks.length;
  const atEnd = phase.kind === "debrief" || screen?.kind === "ending";
  const progress = atEnd ? 100 : (decisionsDone / meta.calls) * 100;

  if (phase.kind === "checkpoint" && checkpoint) return checkpoint.render(view, () => setPhase({ kind: "screen", i: 0 }));

  if (phase.kind === "debrief" && view.result) {
    return (
      <Debrief
        view={view}
        result={view.result}
        endingTitle={phase.endingTitle}
        record={phase.record}
        badgesBefore={badgesBefore}
        onExit={onExit}
        onNotes={onNotes}
        onReplay={() => {
          setUsedHindsight(false);
          setBadgesBefore(game.s.badges);
          finished.current = false;
          runKey.current = newRunKey();
          before.current = undefined;
          setView(undefined);
          load([]);
        }}
      />
    );
  }

  const reveal = phase.kind === "reveal" ? view.reveal : undefined;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      {/* HUD */}
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => {
            stopVoice();
            onExit();
          }}
          aria-label="Leave hot seat"
          className="text-muted"
        >
          <Icon.close />
        </button>
        <div className="flex-1">
          <Bar value={progress} color="var(--color-green)" h="h-4" />
        </div>
        <div className="flex items-center gap-0.5" aria-label={`${view.trust} board trust left`}>
          {Array.from({ length: meta.startTrust }, (_, i) =>
            i < view.trust ? <Icon.heart key={i} className="size-6" /> : <Icon.heartOff key={i} className="size-6" />,
          )}
        </div>
      </div>
      <Meters view={view} />

      {saveFailed && (
        <p role="alert" className="mb-3 rounded-2xl bg-red/15 px-3 py-2 text-[14px] font-extrabold text-red">
          Your result didn&apos;t save. Check your connection and tap &quot;See your results&quot; again.
        </p>
      )}
      {failed && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-red/15 px-3 py-2">
          <p className="text-[14px] font-extrabold text-red">That didn&apos;t go through.</p>
          <button type="button" className="text-[14px] font-black text-brand uppercase" onClick={() => load(failed)}>
            Try again
          </button>
        </div>
      )}

      {screen?.kind === "scene" && (
        <SceneView
          key={screen.id}
          view={view}
          node={screen}
          onNext={() => setPhase({ kind: "screen", i: (phase as { i: number }).i + 1 })}
        />
      )}
      {screen?.kind === "decision" && (
        <DecisionView
          key={screen.id + (usedHindsight ? "h" : "")}
          year={screen.year}
          media={screen.media}
          setup={screen.setup}
          question={screen.question}
          advisor={screen.advisor}
          estimate={!madeUp && !view.onRealPath}
          madeUp={madeUp}
          warning={view.trust === 1 ? "Board warning: one more costly call and you're out." : undefined}
          options={screen.options}
          busy={busy}
          onChoose={(id) => !busy && load([...picks, { nodeId: screen.id, optionId: id }])}
        />
      )}
      {reveal && (
        <RevealView
          key={reveal.nodeId + reveal.optionId}
          choice={reveal.label}
          year={reveal.year}
          media={reveal.media}
          real={madeUp ? undefined : view.onRealPath}
          madeUp={madeUp}
          outcome={reveal.outcome}
          grade={reveal.grade}
          why={reveal.why}
          better={reveal.better}
          pointsLabel={VERDICT[reveal.grade].points}
          realChoice={reveal.realChoice}
          hindsight={
            !usedHindsight && game.s.hindsights > 0 && reveal.grade !== "great"
              ? { left: game.s.hindsights, onUse: onHindsight }
              : undefined
          }
          onNext={() => {
            // Counted here, not at "Lock it in", so a Hindsight redo never counts the undone pick.
            game.recordDecision(reveal.grade);
            if (checkpoint && !paused.current && view.picks.length >= checkpoint.after) {
              paused.current = true;
              stopVoice();
              setPhase({ kind: "checkpoint" });
            } else setPhase({ kind: "screen", i: 0 });
          }}
        />
      )}
      {screen?.kind === "ending" && <EndingView key={screen.id} view={view} node={screen} onNext={() => finish(screen.title)} />}
    </div>
  );
}

const newRunKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Loading({ failed, onRetry, onExit }: { failed: boolean; onRetry: () => void; onExit: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={96} className={failed ? "" : "pop"} />
        {failed ? (
          <>
            <p className="text-[20px] font-black">Couldn&apos;t load this Hot Seat</p>
            <button type="button" className="btn3d green" onClick={onRetry}>
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
}

function Meters({ view }: { view: PlayView }) {
  const run = view;
  const hs = view.meta;
  const prev = useRef(run.meters);
  const [delta, setDelta] = useState<{ profit: number; future: number }>({ profit: 0, future: 0 });
  useEffect(() => {
    const d = { profit: run.meters.profit - prev.current.profit, future: run.meters.future - prev.current.future };
    prev.current = run.meters;
    if (d.profit || d.future) {
      playSfx(d.profit + d.future >= 0 ? "up" : "down", 500);
      setDelta(d);
      const t = setTimeout(() => setDelta({ profit: 0, future: 0 }), 2600);
      return () => clearTimeout(t);
    }
  }, [run.meters]);
  const items = [
    { k: "profit" as const, color: "var(--color-gold)" },
    { k: "future" as const, color: "var(--color-blue)" },
  ];
  return (
    <div className="mb-3 grid grid-cols-2 gap-3">
      {items.map(({ k, color }) => (
        <div key={k} title={hs.meters[k].hint}>
          <div className="mb-1 flex items-center justify-between text-[12px] font-black uppercase tracking-wider text-muted">
            <span>{hs.meters[k].label}</span>
            {delta[k] !== 0 && (
              <span className="pop" style={{ color: delta[k] > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                {delta[k] > 0 ? "+" : ""}
                {delta[k]}
              </span>
            )}
          </div>
          <Bar value={run.meters[k]} color={color} h="h-2.5" />
        </div>
      ))}
    </div>
  );
}

export function useNarration(lines: { text: string; voice?: string }[], enabled: boolean) {
  const [idx, setIdx] = useState(0);
  const [p, setP] = useState(0);
  const key = lines.map((l) => l.text).join("|");
  const play = useCallback(() => {
    if (!enabled) {
      setIdx(lines.length);
      setP(1);
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= lines.length) return;
      const l = lines[i];
      setIdx(i);
      setP(0);
      speak(l.text, l.voice ?? NARRATOR, setP, () => {
        i++;
        if (i < lines.length) next();
        else setIdx(lines.length);
      });
    };
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  useEffect(() => {
    play();
    return () => stopVoice();
  }, [play]);
  /** progress for line n: 1 if done, live value if current, 0 if upcoming */
  const prog = (n: number) => (!enabled ? 1 : n < idx ? 1 : n === idx ? p : 0);
  return { prog, replay: play };
}

export function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start rounded-full border-2 border-line px-3 py-1.5 text-[13px] font-black uppercase tracking-wide text-brand"
    >
      <Icon.speaker /> Replay
    </button>
  );
}

function YearChip({ year, real, madeUp }: { year?: string; real?: boolean; madeUp?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {year && <span className="rounded-lg bg-surface-2 px-2 py-1 text-[13px] font-black tabular-nums text-ink">{year}</span>}
      {real !== undefined && (
        <span
          className={`rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider ${real ? "bg-ink text-bg" : "border-2 border-dashed border-muted text-muted"}`}
        >
          {real ? "Real history" : "Our estimate"}
        </span>
      )}
      {madeUp && (
        <span className="rounded-lg border-2 border-dashed border-purple px-2 py-1 text-[11px] font-black tracking-wider text-purple uppercase">
          {MADE_UP_LABEL}
        </span>
      )}
    </div>
  );
}

function SceneView({ view, node, onNext }: { view: PlayView; node: Extract<Screen, { kind: "scene" }>; onNext: () => void }) {
  const { s } = useGame();
  const { text } = node;
  const run = view;
  const { prog, replay } = useNarration([{ text }], s.settings.voice);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <MediaView media={node.media} className="aspect-[4/3] w-full" />
      <YearChip year={node.year} real={run.picks.length && !run.meta.madeUp ? run.onRealPath : undefined} madeUp={run.meta.madeUp} />
      <Caption text={text} progress={prog(0)} className="text-[21px] font-bold leading-snug" />
      {s.settings.voice && <VoiceButton onClick={replay} />}
      <div className="mt-auto pb-6 pt-4">
        <button
          type="button"
          className="btn3d"
          onClick={() => {
            playSfx("next");
            onNext();
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export interface ChoiceItem {
  id: string;
  label: string;
}

/** The decision screen. Takes text already resolved for the player's path, so Hot Seats and Daily Calls share it. */
export function DecisionView({
  year,
  media,
  setup,
  question,
  advisor,
  warning,
  estimate,
  madeUp,
  options,
  busy,
  onChoose,
}: {
  year: string;
  media?: Media;
  setup: string;
  question: string;
  advisor?: string;
  warning?: string;
  /** The player has left the real path, so this situation is our estimate. */
  estimate?: boolean;
  /** A made-up story: labelled as such, never "Real history" or "Our estimate". */
  madeUp?: boolean;
  options: ChoiceItem[];
  /** Waiting for the server's verdict: the lock button stays down. */
  busy?: boolean;
  onChoose: (optionId: string) => void;
}) {
  const { s } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (warning) playSfx("warning");
  }, [warning]);
  const { prog } = useNarration(
    [{ text: setup }, { text: question }, ...(advisor ? [{ text: advisor, voice: ADVISOR }] : [])],
    s.settings.voice,
  );
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        {media && <MediaView media={media} className="size-20 shrink-0 !rounded-2xl" kenBurns={false} />}
        <div className="min-w-0">
          <YearChip year={year} real={estimate ? false : undefined} madeUp={madeUp} />
          <p className="mt-1 text-[13px] font-black uppercase tracking-[.12em] text-brand">Your call</p>
        </div>
      </div>
      <Caption text={setup} progress={prog(0)} className="text-[17px] font-bold leading-snug" />
      <h2 className="text-[25px] font-black leading-tight text-balance">{question}</h2>
      {advisor && (
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-purple font-black text-[#160a2c]">A</div>
          <div className="relative rounded-2xl rounded-tl-sm border-2 border-line bg-surface px-3 py-2">
            <p className="text-[12px] font-black uppercase tracking-wider text-purple">Your advisor</p>
            <Caption text={advisor} progress={prog(2)} className="text-[15px] font-bold" />
          </div>
        </div>
      )}
      {warning && <p className="shake rounded-2xl bg-red/15 px-3 py-2 text-[14px] font-extrabold text-red">{warning}</p>}
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Options">
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={sel === o.id}
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
      <div className="mt-auto pb-6 pt-2">
        <button
          type="button"
          className="btn3d green"
          disabled={!sel || busy}
          onClick={() => {
            if (!sel || busy) return;
            playSfx("lock");
            onChoose(sel);
          }}
        >
          Lock it in
        </button>
      </div>
    </div>
  );
}

/** What happened, then the verdict sheet. Plain values in, so Hot Seats and Daily Calls share it. */
export function RevealView({
  choice,
  year,
  media,
  real,
  outcome,
  grade,
  why,
  better,
  pointsLabel,
  realChoice,
  extra,
  hindsight,
  madeUp,
  onNext,
}: {
  year: string;
  media?: Media;
  /** Real history, or our estimate of what would have happened. */
  real?: boolean;
  /** The option the player picked: "You chose …" heads the reveal, so the path feels like theirs. */
  choice?: string;
  outcome: string;
  grade: Grade;
  why: string;
  better?: string;
  pointsLabel: string;
  /** Shown when the player didn't make the real company's call. */
  realChoice?: { company: string; label: string };
  extra?: React.ReactNode;
  hindsight?: { left: number; onUse: () => void };
  madeUp?: boolean;
  onNext: () => void;
}) {
  const { s } = useGame();
  const v = VERDICT[grade];
  useEffect(() => playSfx(grade, 120), [grade]);
  const { prog, replay } = useNarration([{ text: outcome }, { text: spokenWhy({ why, better }) }], s.settings.voice);
  const heard = useHeard(prog(1), [outcome, why, better ?? ""].join(" "), s.settings.voice);
  return (
    <div className="flex flex-1 flex-col gap-4 pb-[300px]">
      {media && <MediaView media={media} className="aspect-[16/9] w-full" />}
      <YearChip year={year} real={real} madeUp={madeUp} />
      {choice && (
        <div className="rounded-2xl border-2 border-line bg-surface px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted">You chose</p>
          <p className="text-[16px] font-extrabold">{choice}</p>
        </div>
      )}
      <p className="text-[13px] font-black uppercase tracking-[.12em] text-muted">{choice ? "Where your choice led" : "What happened"}</p>
      <Caption text={outcome} progress={prog(0)} className="-mt-2 text-[20px] font-bold leading-snug" />
      {s.settings.voice && <VoiceButton onClick={replay} />}
      {realChoice && (
        <div className="rounded-2xl border-2 border-line bg-surface p-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted">What {realChoice.company} actually did</p>
          <p className="mt-1 text-[15px] font-bold">{realChoice.label}</p>
        </div>
      )}
      {extra}

      <VerdictSheet
        grade={grade}
        title={v.title}
        pointsLabel={pointsLabel}
        lines={[
          { label: grade === "great" ? "Why it worked: " : "Why it hurt: ", text: why },
          ...(better ? [{ label: "The road you didn't take: ", text: better }] : []),
        ]}
        ready={heard}
        hindsight={hindsight}
        note={madeUp ? MADE_UP_LABEL : undefined}
        onNext={onNext}
      />
    </div>
  );
}

/**
 * True once a reveal has been heard: when its last line finishes playing, or, with the voice off, after roughly the
 * time it takes to read (Atheeb, 31 Oct 2026: a live Continue got tapped before anyone read what happened).
 */
export function useHeard(lastLineProgress: number, text: string, voice: boolean) {
  const [timeUp, setTimeUp] = useState(false);
  useEffect(() => {
    setTimeUp(false);
    if (voice) return;
    const ms = Math.min(6000, 1000 + text.split(/\s+/).length * 120);
    const t = setTimeout(() => setTimeUp(true), ms);
    return () => clearTimeout(t);
  }, [text, voice]);
  return voice ? lastLineProgress >= 1 : timeUp;
}

/** Three pulsing dots, in place of Continue while the verdict is still being read. */
function Dots() {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2.5 animate-pulse rounded-full bg-current" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  );
}

/** The green, gold or red bottom sheet after a pick: a title, a few labelled lines and Continue. Lessons use it too. */
export function VerdictSheet({
  grade,
  title,
  pointsLabel,
  lines,
  hindsight,
  note,
  ready = true,
  onNext,
}: {
  grade: Grade;
  title: string;
  pointsLabel?: string;
  lines: { label: string; text: string }[];
  hindsight?: { left: number; onUse: () => void };
  /** A small line under the verdict, like the made-up story label. */
  note?: string;
  /** False while the verdict is still being read out: Continue waits, so nobody skips what happened. */
  ready?: boolean;
  onNext: () => void;
}) {
  const v = VERDICT[grade];
  return (
    <div className={`sheet fixed inset-x-0 bottom-0 z-30 ${v.bg}`} style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[24px] font-black" style={{ color: v.color }}>
            {title}
          </h3>
          {pointsLabel && (
            <span className="text-[14px] font-black" style={{ color: v.color }}>
              {pointsLabel}
            </span>
          )}
        </div>
        {lines.map((l) => (
          <p key={l.label} className="text-[15px] font-bold leading-snug">
            <span className="font-black" style={{ color: v.color }}>
              {l.label}
            </span>
            {l.text}
          </p>
        ))}
        {note && <p className="text-[12px] font-black tracking-wider text-muted uppercase">{note}</p>}
        <div className="mt-2 flex gap-3">
          {hindsight && (
            <button
              type="button"
              className="btn3d ghost !w-auto shrink-0 !px-3 !text-[13px]"
              onClick={hindsight.onUse}
              aria-label={`Use Hindsight to redo this call. ${hindsight.left} left`}
            >
              <Icon.rewind className="size-5" /> Redo ({hindsight.left})
            </button>
          )}
          <button
            type="button"
            className={`btn3d ${v.btn}`}
            disabled={!ready}
            aria-label={ready ? "Continue" : "Still reading out what happened"}
            onClick={() => {
              playSfx("next");
              onNext();
            }}
          >
            {ready ? "Continue" : <Dots />}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndingView({ view, node, onNext }: { view: PlayView; node: Extract<Screen, { kind: "ending" }>; onNext: () => void }) {
  const { s } = useGame();
  const { text } = node;
  const run = view;
  useEffect(() => playSfx(node.tier === "legend" || node.tier === "survivor" ? "legend" : "lose"), [node.tier]);
  const { prog } = useNarration([{ text }], s.settings.voice);
  const color = { legend: "var(--color-gold)", survivor: "var(--color-blue)", collapse: "var(--color-red)", fired: "var(--color-red)" }[
    node.tier
  ];
  return (
    <div className="flex flex-1 flex-col gap-4">
      <MediaView media={node.media} className="aspect-[4/3] w-full" />
      {run.meta.madeUp ? <YearChip madeUp /> : !run.onRealPath && <YearChip real={false} />}
      <p className="text-[13px] font-black uppercase tracking-[.14em]" style={{ color }}>
        {node.tier === "fired" ? "Game over" : "The end"}
      </p>
      <h2 className="-mt-2 text-[32px] font-black leading-tight">{node.title}</h2>
      <Caption text={text} progress={prog(0)} className="text-[19px] font-bold leading-snug" />
      <div className="mt-auto pb-6 pt-4">
        <button type="button" className="btn3d" onClick={onNext}>
          See your results
        </button>
      </div>
    </div>
  );
}
