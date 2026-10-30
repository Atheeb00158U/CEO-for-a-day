"use client";

import { useEffect, useState } from "react";
import { useContent } from "@/lib/content-client";
import type { Doing, Focus, Onboarding as Answers } from "@/lib/game-state";
import type { CatalogEntry } from "@/lib/hotseat-types";
import type { PlayView } from "@/lib/play";
import { install, installWay, onInstallChange, type InstallWay } from "@/lib/pwa";
import { playSfx } from "@/lib/sfx";
import { useGame } from "@/lib/store";
import { Player } from "./Player";
import { Bar, Card, MediaView } from "./ui";
import { Logo } from "./Logo";

/** Calls a new player makes in the trial before the style card. */
const TRIAL_CALLS = 2;

const DOING: { id: Doing; label: string }[] = [
  { id: "job", label: "I have a job" },
  { id: "starting", label: "I'm starting a business" },
  { id: "running", label: "I run a business" },
  { id: "student", label: "I'm a student" },
  { id: "curious", label: "I'm just curious" },
];

const FOCUS: { id: Focus; label: string }[] = [
  { id: "scratch", label: "Building something from nothing" },
  { id: "rival", label: "Beating a bigger rival" },
  { id: "money", label: "Money, loans and risk" },
  { id: "change", label: "Seeing big change coming" },
];

const MINUTES: { id: NonNullable<Answers["minutes"]>; label: string; hint: string }[] = [
  { id: 5, label: "5 minutes", hint: "A quick break" },
  { id: 10, label: "10 minutes", hint: "A cup of chai" },
  { id: 15, label: "15 minutes", hint: "A proper session" },
];

/** What the style card says to someone in each situation. */
const FOR_YOU: Record<Doing, string> = {
  job: "Watch for these calls at your own company. You'll start to see them everywhere.",
  starting: "Better to learn this here than with your own money.",
  running: "Hold it up against the calls you make in your own business.",
  student: "Most people only learn this after their first big mistake.",
  curious: "Every Hot Seat adds to it. Your full style is on your Profile.",
};

type Step = "hook" | "doing" | "focus" | "minutes" | "trial" | "play";

/**
 * The welcome screens for a new player: three quick questions that change the game, then the first calls of the
 * trial Hot Seat and a style card from those calls. "Skip" on every screen goes straight to Home.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { s, setOnboarding } = useGame();
  const { trial } = useContent();
  const [step, setStep] = useState<Step>("hook");
  const finish = () => {
    setOnboarding({ done: true });
    onDone();
  };
  const answer = (patch: Partial<Answers>, next: Step) => {
    playSfx("select");
    setOnboarding(patch);
    setStep(next);
  };

  if (step === "play" && trial)
    return (
      <Player
        hotSeatId={trial.id}
        onExit={finish}
        onNotes={finish}
        checkpoint={{
          after: TRIAL_CALLS,
          render: (view, onContinue) => (
            <StyleCard
              view={view}
              doing={s.onboarding.doing}
              // Not marked done yet: that would close these screens and the run with them. Leaving the run does it.
              onContinue={onContinue}
              onHome={finish}
            />
          ),
        }}
      />
    );

  const question = { doing: 1, focus: 2, minutes: 3 }[step as "doing"];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1">{question && <Bar value={(question / 3) * 100} color="var(--color-green)" h="h-3" />}</div>
        <button type="button" onClick={finish} className="text-[14px] font-black uppercase tracking-wide text-muted">
          Skip, just play
        </button>
      </div>

      {step === "hook" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Logo size={112} className="pop" />
          <h1 className="text-[30px] leading-tight font-black text-balance">Sit in the hot seat of a real company</h1>
          <p className="text-[18px] font-bold text-muted">Make the big calls. Then see what really happened.</p>
          <div className="mt-auto w-full pb-6">
            <button type="button" className="btn3d green" onClick={() => setStep("doing")}>
              Start
            </button>
          </div>
        </div>
      )}

      {step === "doing" && <Choices title="What are you doing now?" items={DOING} onPick={(id) => answer({ doing: id }, "focus")} />}
      {step === "focus" && (
        <Choices
          title="What do you want to get better at?"
          hint="We'll put those Hot Seats first."
          items={FOCUS}
          onPick={(id) => answer({ focus: id }, "minutes")}
        />
      )}
      {step === "minutes" && (
        <Choices
          title="How long can you play each day?"
          hint="This sets your daily goal. You can play more."
          items={MINUTES}
          onPick={(id) => {
            if (trial) return answer({ minutes: id }, "trial");
            setOnboarding({ minutes: id });
            finish();
          }}
        />
      )}

      {step === "trial" && trial && <TrialIntro hs={trial} onStart={() => setStep("play")} />}
    </div>
  );
}

function Choices<T extends string | number>({
  title,
  hint,
  items,
  onPick,
}: {
  title: string;
  hint?: string;
  items: { id: T; label: string; hint?: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-6 pb-6">
      <h1 className="text-[26px] leading-tight font-black text-balance">{title}</h1>
      {hint && <p className="-mt-2 text-[16px] font-bold text-muted">{hint}</p>}
      <div className="flex flex-col gap-3">
        {items.map((o) => (
          <button key={o.id} type="button" className="tile flex items-center justify-between gap-3" onClick={() => onPick(o.id)}>
            <span>{o.label}</span>
            {o.hint && <span className="text-[14px] font-bold text-muted">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function TrialIntro({ hs, onStart }: { hs: CatalogEntry; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <p className="text-[13px] font-black tracking-[.14em] text-brand uppercase">Your first Hot Seat</p>
      {hs.cover && <MediaView media={hs.cover} className="aspect-[16/9] w-full" />}
      <p className="text-[13px] font-black tracking-[.14em] text-muted uppercase">
        {hs.company} · {hs.years}
      </p>
      <h1 className="-mt-2 text-[28px] leading-tight font-black text-balance">{hs.title}</h1>
      <p className="text-[18px] font-bold">{hs.hook}</p>
      <p className="text-[15px] font-bold text-muted">Try the first {TRIAL_CALLS} calls. About two minutes.</p>
      <div className="mt-auto pb-6">
        <button type="button" className="btn3d green" onClick={onStart}>
          Take the seat
        </button>
      </div>
    </div>
  );
}

/** The player's style from the trial calls they just made. Built from their picks, nothing else. */
function StyleCard({ view, doing, onContinue, onHome }: { view: PlayView; doing?: Doing; onContinue: () => void; onHome: () => void }) {
  const [way, setWay] = useState<InstallWay>(null);
  useEffect(() => {
    const update = () => setWay(installWay());
    update();
    return onInstallChange(update);
  }, []);
  useEffect(() => playSfx("legend"), []);

  const { picks, meta } = view;
  const matched = picks.filter((p) => p.real).length;
  const great = picks.filter((p) => p.grade === "great").length;
  const t = view.traits;
  const lines = [
    t.risk > 0 ? "You take big bets." : t.risk < 0 ? "You play it safe." : null,
    t.horizon > 0 ? "You think about the long run." : t.horizon < 0 ? "You go for money now." : null,
    t.disrupt > 0 ? "You're happy to change what works." : t.disrupt < 0 ? "You protect what already works." : null,
  ].filter(Boolean);
  const left = meta.calls - picks.length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4 pt-8 pb-6">
      <p className="text-[13px] font-black tracking-[.14em] text-brand uppercase">Your CEO style so far</p>
      <h1 className="-mt-2 text-[28px] leading-tight font-black">
        {great === picks.length ? "Sharp start" : great ? "Good instincts, one slip" : "Bold, but costly"}
      </h1>
      <Card className="flex flex-col gap-2">
        <p className="text-[17px] font-extrabold">
          You picked what {meta.company} really did in {matched} of {picks.length} calls.
        </p>
        {lines.map((l) => (
          <p key={l} className="text-[17px] font-bold">
            {l}
          </p>
        ))}
        {doing && <p className="text-[15px] font-bold text-muted">{FOR_YOU[doing]}</p>}
      </Card>
      <p className="text-[16px] font-bold text-muted">
        The story isn&apos;t over. {left > 0 ? `Up to ${left} more calls decide how it ends.` : ""}
      </p>
      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className="btn3d green" onClick={onContinue}>
          Carry on
        </button>
        {way === "button" && (
          <button type="button" className="btn3d ghost" onClick={() => void install()}>
            Install the app
          </button>
        )}
        <button type="button" onClick={onHome} className="py-2 text-[15px] font-extrabold tracking-wide text-muted uppercase">
          Go to Home
        </button>
      </div>
    </div>
  );
}
