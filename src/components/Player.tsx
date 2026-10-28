"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOT_SEATS } from "@/content/catalog";
import {
  buildDebrief,
  callsPerRun,
  choose,
  spokenWhy,
  resolveNode,
  resolveText,
  score,
  startRun,
  traitTotals,
  type RunState,
} from "@/lib/engine";
import type { DecisionNode, EndingNode, Grade, HotSeat, Media, Option, SceneNode } from "@/lib/hotseat-types";
import { useGame, type RunRecord } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { ADVISOR, NARRATOR, speak, stopVoice } from "@/lib/voice";
import { Bar, Caption, Icon, MediaView } from "./ui";
import { Debrief } from "./Debrief";

type Phase =
  | { kind: "scene"; node: SceneNode }
  | { kind: "decision"; node: DecisionNode }
  | { kind: "reveal"; node: DecisionNode; option: Option; before: RunState }
  | { kind: "ending"; node: EndingNode }
  | { kind: "debrief"; node: EndingNode; record: RunRecord };

const VERDICT = {
  great: { title: "Great call!", color: "var(--color-green)", bg: "bg-[#0f2a10]", btn: "green", points: "+25 CEO points" },
  ok: { title: "Risky call", color: "var(--color-gold)", bg: "bg-[#2a2306]", btn: "gold", points: "+10 CEO points" },
  bad: { title: "Costly call", color: "var(--color-red)", bg: "bg-[#2d0f0f]", btn: "red", points: "−1 board trust" },
} as const;

export function Player({ hotSeatId, onExit, onNotes }: { hotSeatId: string; onExit: () => void; onNotes: () => void }) {
  const hs = HOT_SEATS[hotSeatId] as HotSeat;
  const game = useGame();
  const [run, setRun] = useState<RunState>(() => startRun(hs));
  const [phase, setPhase] = useState<Phase>(() => toPhase(hs, startRun(hs)));
  const [usedHindsight, setUsedHindsight] = useState(false);
  const [badgesBefore, setBadgesBefore] = useState(game.s.badges);
  const totalDecisions = useMemo(() => callsPerRun(hs), [hs]);
  const finished = useRef(false); // a double tap on "See your results" must not pay out twice

  useEffect(() => () => stopVoice(), []);

  // A lost heart lands after the verdict and meter sounds (see RevealView and Meters).
  const trustBefore = useRef(run.trust);
  useEffect(() => {
    if (run.trust < trustBefore.current) playSfx("heart", 800);
    trustBefore.current = run.trust;
  }, [run.trust]);

  const advance = (state: RunState, nextId: string) => {
    const s2 = { ...state, nodeId: nextId };
    setRun(s2);
    setPhase(toPhase(hs, s2));
  };

  const onChoose = (node: DecisionNode, opt: Option) => {
    const next = choose(hs, run, node, opt);
    setPhase({ kind: "reveal", node, option: opt, before: run });
    setRun(next);
  };

  const onHindsight = () => {
    if (phase.kind !== "reveal" || usedHindsight || !game.spendHindsight()) return;
    setUsedHindsight(true);
    setRun(phase.before);
    setPhase({ kind: "decision", node: phase.node });
  };

  const finish = (node: EndingNode) => {
    if (finished.current) return;
    finished.current = true;
    const d = buildDebrief(hs, run);
    const sc = score(hs, run, node);
    const realEnding = hs.realEnding;
    const tierRank = { fired: 0, collapse: 1, survivor: 2, legend: 3 } as const;
    const rec = game.finishRun(
      { hotSeatId: hs.id, score: sc, endingId: node.id, endingTier: node.tier, notes: d.lines, patterns: d.patterns },
      traitTotals(hs, run),
      { recovered: d.recovered, beatHistory: tierRank[node.tier] > tierRank[realEnding] },
    );
    setPhase({ kind: "debrief", node, record: rec });
  };

  const decisionsDone = run.picks.length;
  const progress = phase.kind === "debrief" || phase.kind === "ending" ? 100 : (decisionsDone / totalDecisions) * 100;

  if (phase.kind === "debrief") {
    return (
      <Debrief
        hs={hs}
        run={run}
        ending={phase.node}
        record={phase.record}
        badgesBefore={badgesBefore}
        onExit={onExit}
        onNotes={onNotes}
        onReplay={() => {
          const r = startRun(hs);
          setRun(r);
          setUsedHindsight(false);
          setBadgesBefore(game.s.badges);
          finished.current = false;
          setPhase(toPhase(hs, r));
        }}
      />
    );
  }

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
        <div className="flex items-center gap-0.5" aria-label={`${run.trust} board trust left`}>
          {Array.from({ length: hs.startTrust }, (_, i) =>
            i < run.trust ? <Icon.heart key={i} className="size-6" /> : <Icon.heartOff key={i} className="size-6" />,
          )}
        </div>
      </div>
      <Meters hs={hs} run={run} />

      {phase.kind === "scene" && (
        <SceneView key={phase.node.id} hs={hs} run={run} node={phase.node} onNext={() => advance(run, phase.node.next)} />
      )}
      {phase.kind === "decision" && (
        <DecisionView
          key={phase.node.id + (usedHindsight ? "h" : "")}
          year={phase.node.year}
          media={phase.node.media}
          setup={resolveText(phase.node.setup, run)}
          question={phase.node.question}
          advisor={resolveText(phase.node.advisor, run)}
          warning={run.trust === 1 ? "Board warning: one more costly call and you're out." : undefined}
          options={phase.node.options}
          onChoose={(id) =>
            onChoose(
              phase.node,
              phase.node.options.find((o) => o.id === id)!,
            )
          }
        />
      )}
      {phase.kind === "reveal" && (
        <RevealView
          key={phase.node.id + phase.option.id}
          year={phase.node.year}
          media={phase.option.media}
          real={!!phase.option.real}
          outcome={resolveText(phase.option.outcome, run)}
          grade={phase.option.grade}
          why={phase.option.why}
          better={phase.option.better}
          pointsLabel={VERDICT[phase.option.grade].points}
          realChoice={realChoiceFor(hs, phase.node, phase.option)}
          hindsight={
            !usedHindsight && game.s.hindsights > 0 && phase.option.grade !== "great"
              ? { left: game.s.hindsights, onUse: onHindsight }
              : undefined
          }
          onNext={() => {
            // Counted here, not at "Lock it in", so a Hindsight redo never counts the undone pick.
            game.recordDecision(phase.option.grade);
            setPhase(toPhase(hs, run));
          }}
        />
      )}
      {phase.kind === "ending" && <EndingView key={phase.node.id} run={run} node={phase.node} onNext={() => finish(phase.node)} />}
    </div>
  );
}

function realChoiceFor(hs: HotSeat, node: DecisionNode, option: Option) {
  const real = node.options.find((o) => o.real);
  return !option.real && real ? { company: hs.company, label: real.label } : undefined;
}

function toPhase(hs: HotSeat, s: RunState): Phase {
  const n = resolveNode(hs, s, s.nodeId);
  if (n.type === "scene") return { kind: "scene", node: n };
  if (n.type === "decision") return { kind: "decision", node: n };
  if (n.type === "ending") return { kind: "ending", node: n };
  throw new Error("router node should have been resolved");
}

function Meters({ hs, run }: { hs: HotSeat; run: RunState }) {
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

function useNarration(lines: { text: string; voice?: string }[], enabled: boolean) {
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

function VoiceButton({ onClick }: { onClick: () => void }) {
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

function YearChip({ year, real }: { year: string; real?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-lg bg-surface-2 px-2 py-1 text-[13px] font-black tabular-nums text-ink">{year}</span>
      {real !== undefined && (
        <span
          className={`rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider ${real ? "bg-ink text-bg" : "border-2 border-dashed border-muted text-muted"}`}
        >
          {real ? "Real history" : "Alternate history"}
        </span>
      )}
    </div>
  );
}

function SceneView({ run, node, onNext }: { hs: HotSeat; run: RunState; node: SceneNode; onNext: () => void }) {
  const { s } = useGame();
  const text = resolveText(node.text, run);
  const { prog, replay } = useNarration([{ text }], s.settings.voice);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <MediaView media={node.media} className="aspect-[4/3] w-full" />
      <YearChip year={node.year} real={run.picks.length ? run.onRealPath : undefined} />
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
  options,
  onChoose,
}: {
  year: string;
  media?: Media;
  setup: string;
  question: string;
  advisor?: string;
  warning?: string;
  options: ChoiceItem[];
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
          <YearChip year={year} />
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
          disabled={!sel}
          onClick={() => {
            if (!sel) return;
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
  onNext,
}: {
  year: string;
  media?: Media;
  real: boolean;
  outcome: string;
  grade: Grade;
  why: string;
  better?: string;
  pointsLabel: string;
  /** Shown when the player didn't make the real company's call. */
  realChoice?: { company: string; label: string };
  extra?: React.ReactNode;
  hindsight?: { left: number; onUse: () => void };
  onNext: () => void;
}) {
  const { s } = useGame();
  const v = VERDICT[grade];
  useEffect(() => playSfx(grade, 120), [grade]);
  const { prog, replay } = useNarration([{ text: outcome }, { text: spokenWhy({ why, better }) }], s.settings.voice);
  return (
    <div className="flex flex-1 flex-col gap-4 pb-[300px]">
      {media && <MediaView media={media} className="aspect-[16/9] w-full" />}
      <YearChip year={year} real={real} />
      <p className="text-[13px] font-black uppercase tracking-[.12em] text-muted">What happened</p>
      <Caption text={outcome} progress={prog(0)} className="-mt-2 text-[20px] font-bold leading-snug" />
      {s.settings.voice && <VoiceButton onClick={replay} />}
      {realChoice && (
        <div className="rounded-2xl border-2 border-line bg-surface p-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted">What {realChoice.company} actually did</p>
          <p className="mt-1 text-[15px] font-bold">{realChoice.label}</p>
        </div>
      )}
      {extra}

      <div className={`sheet fixed inset-x-0 bottom-0 z-30 ${v.bg}`} style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[24px] font-black" style={{ color: v.color }}>
              {v.title}
            </h3>
            <span className="text-[14px] font-black" style={{ color: v.color }}>
              {pointsLabel}
            </span>
          </div>
          <p className="text-[15px] font-bold leading-snug">
            <span className="font-black" style={{ color: v.color }}>
              {grade === "great" ? "Why it worked: " : "Why it hurt: "}
            </span>
            {why}
          </p>
          {better && (
            <p className="text-[15px] font-bold leading-snug">
              <span className="font-black" style={{ color: v.color }}>
                What would have worked:{" "}
              </span>
              {better}
            </p>
          )}
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
              onClick={() => {
                playSfx("next");
                onNext();
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EndingView({ run, node, onNext }: { run: RunState; node: EndingNode; onNext: () => void }) {
  const { s } = useGame();
  const text = resolveText(node.text, run);
  useEffect(() => playSfx(node.tier === "legend" || node.tier === "survivor" ? "legend" : "lose"), [node.tier]);
  const { prog } = useNarration([{ text }], s.settings.voice);
  const color = { legend: "var(--color-gold)", survivor: "var(--color-blue)", collapse: "var(--color-red)", fired: "var(--color-red)" }[
    node.tier
  ];
  return (
    <div className="flex flex-1 flex-col gap-4">
      <MediaView media={node.media} className="aspect-[4/3] w-full" />
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
