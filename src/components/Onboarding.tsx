"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useContent } from "@/lib/content-client";
import type { Doing, Focus, Onboarding as Answers } from "@/lib/game-state";
import type { CatalogEntry } from "@/lib/hotseat-types";
import type { PlayView } from "@/lib/play";
import { install, installWay, onInstallChange, type InstallWay } from "@/lib/pwa";
import { playSfx } from "@/lib/sfx";
import { useGame } from "@/lib/store";
import { speak, stopVoice } from "@/lib/voice";
import { WOLF_VOICE, WOLF_WELCOME, type WolfBeat } from "@/lib/wolf-lines";
import { Player } from "./Player";
import { Bar, Caption, Card, Icon, MediaView, Pill } from "./ui";
import { COURSE_TRIAL_ID } from "@/content/catalog";
import { LessonPlayer } from "./LessonPlayer";
import { WolfPicture } from "./WolfPicture";

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

const COPY = {
  start: "Let's start",
  skip: "Skip, just play",
  skipTour: "Skip tour",
  next: "Next",
  firstLesson: "Start my first lesson",
  play: "Let's play",
  replay: "Hear it again",
};

type Step = "hook" | "doing" | "focus" | "minutes" | "tour" | "lesson" | "trial" | "play";

/** The tour, in order: one beat for each part of the game, each with a real piece of it moving beside the wolf. */
const TOUR = ["lesson", "hotSeat", "hearts", "streak", "league", "notes", "go"] as const satisfies WolfBeat[];
type TourBeat = (typeof TOUR)[number];

/**
 * The welcome screens for a new player, hosted by the wolf: he asks three quick questions that change the game,
 * shows how it works in a short tour, then hands over to Unit 1's first lesson and the trial Hot Seat's first calls,
 * with a style card from those calls. He speaks every line; "Skip" is on every screen.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { s, setOnboarding } = useGame();
  const { trial, course } = useContent();
  // With the course on and the kirana Hot Seat in place: Unit 1's first lesson, then the trial's first calls.
  const firstLesson = trial?.id === COURSE_TRIAL_ID ? course?.units[0]?.modules[0]?.lessons[0]?.id : undefined;
  const [step, setStep] = useState<Step>("hook");
  const [beat, setBeat] = useState(0);
  // No lesson to show without the course, so its beat and the "go" beat drop out.
  const tour = TOUR.filter((b) => firstLesson || (b !== "lesson" && b !== "go"));
  const finish = () => {
    setOnboarding({ done: true });
    onDone();
  };
  const answer = (patch: Partial<Answers>, next: Step) => {
    playSfx("select");
    setOnboarding(patch);
    setStep(next);
  };

  const afterTour = () => {
    stopVoice();
    if (firstLesson) setStep("lesson");
    else if (trial) setStep("trial");
    else finish();
  };

  if (step === "lesson" && firstLesson) return <LessonPlayer target={{ lessonId: firstLesson }} onExit={() => setStep("trial")} />;

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

  const inTour = step === "tour";
  const tourBeat = tour[beat];
  const lastBeat = beat === tour.length - 1;
  const wolf: WolfBeat = inTour ? tourBeat : step === "hook" ? "hello" : (step as "doing" | "focus" | "minutes" | "trial");
  const steps = 4 + tour.length;
  const at = step === "trial" ? steps : ({ hook: 0, doing: 1, focus: 2, minutes: 3 }[step as "hook"] ?? 4 + beat);
  const nextBeat = () => {
    playSfx("next");
    if (lastBeat) afterTour();
    else setBeat(beat + 1);
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1">
          <Bar value={(at / steps) * 100} color="var(--color-green)" h="h-3" />
        </div>
        <button
          type="button"
          onClick={inTour && !lastBeat ? afterTour : finish}
          className="text-[14px] font-black tracking-wide text-muted uppercase"
        >
          {inTour && !lastBeat ? COPY.skipTour : COPY.skip}
        </button>
      </div>

      <WolfHost beat={wolf} look={step === "hook" ? "hero" : inTour ? "row" : "small"} />

      {step === "hook" && (
        <div className="pt-6">
          <button type="button" className="btn3d green" onClick={() => setStep("doing")}>
            {COPY.start}
          </button>
        </div>
      )}

      {step === "doing" && <Choices items={DOING} onPick={(id) => answer({ doing: id }, "focus")} />}
      {step === "focus" && <Choices items={FOCUS} onPick={(id) => answer({ focus: id }, "minutes")} />}
      {step === "minutes" && (
        <Choices
          items={MINUTES}
          onPick={(id) => {
            setBeat(0);
            answer({ minutes: id }, "tour");
          }}
        />
      )}

      {inTour && (
        <>
          <div className="flex flex-1 items-center justify-center py-4">
            <TourStage key={tourBeat} beat={tourBeat} />
          </div>
          <button type="button" className="btn3d green" onClick={nextBeat}>
            {!lastBeat ? COPY.next : firstLesson ? COPY.firstLesson : COPY.play}
          </button>
        </>
      )}

      {step === "trial" && trial && <TrialIntro hs={trial} onStart={() => setStep("play")} />}
    </div>
  );
}

/**
 * The wolf in the frame with his line in a speech bubble. He says it out loud (unless the voice is off), the words
 * light up as he speaks, and he moves a little while he talks. A new beat stops the old line first, so lines never
 * overlap; leaving the screen stops him too.
 */
function WolfHost({ beat, look = "small" }: { beat: WolfBeat; look?: "hero" | "row" | "small" }) {
  const { s } = useGame();
  const { pose, line } = WOLF_WELCOME[beat];
  const voiceOn = s.settings.voice;
  const [heard, setHeard] = useState({ beat, p: 0, done: !voiceOn });
  const say = () => {
    if (!voiceOn) return;
    setHeard({ beat, p: 0, done: false });
    speak(
      line,
      WOLF_VOICE,
      (p) => setHeard((h) => (h.beat === beat ? { ...h, p } : h)),
      () => setHeard((h) => (h.beat === beat ? { ...h, p: 1, done: true } : h)),
    );
  };
  useEffect(() => {
    say();
    return stopVoice;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per beat
  }, [beat]);
  const current = heard.beat === beat;
  const progress = !voiceOn || (current && heard.done) ? 1 : current ? heard.p : 0;
  const talking = voiceOn && current && !heard.done;
  const hero = look === "hero";
  const size = { hero: 260, row: 172, small: 120 }[look];

  return (
    <div
      className={
        hero ? "flex flex-1 flex-col-reverse items-center justify-center gap-2" : `flex items-end ${look === "row" ? "pt-6" : "pt-3"}`
      }
    >
      <div key={pose} className={`wolf-in shrink-0 ${hero ? "" : "-mr-3"}`} style={{ width: `min(${size}px, ${hero ? 70 : 40}vw)` }}>
        <div className={talking ? "wolf-talk" : ""}>
          <WolfPicture
            name={pose}
            sizes={`${size}px`}
            priority
            // The poses end at the waist: fade that edge into the page.
            className="h-auto w-full [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]"
            alt=""
          />
        </div>
      </div>
      <div
        key={beat}
        className={`pop relative min-w-0 rounded-2xl border-b-4 border-[#c9b98f] bg-[#fff8e6] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,.4)] ${hero ? "max-w-[320px]" : look === "row" ? "mb-16 flex-1" : "mb-8 flex-1"}`}
        // The spoken words go dark as he says them (Caption's colours, re-pointed for the cream bubble).
        style={{ "--color-muted": "#a8956b", "--color-ink": "#2a1d00" } as CSSProperties}
      >
        <span className={`absolute size-4 rotate-45 bg-[#fff8e6] ${hero ? "-bottom-2 left-1/2 -ml-2" : "bottom-4 -left-2"}`} aria-hidden />
        <Caption
          text={line}
          progress={progress}
          className={`relative leading-snug font-extrabold ${look === "row" ? "text-[18px]" : "text-[21px]"}`}
        />
        {voiceOn && (
          <button type="button" onClick={say} aria-label={COPY.replay} className="relative mt-1 -mb-1 -ml-1 p-1 text-[#8a7650]">
            <Icon.speaker />
          </button>
        )}
      </div>
    </div>
  );
}

/** The real pieces of the game, moving: what the wolf is talking about, shown instead of told. */
function TourStage({ beat }: { beat: TourBeat }) {
  const d = (s: number, more?: CSSProperties) => ({ "--d": `${s}s`, ...more }) as CSSProperties;

  if (beat === "lesson")
    return (
      <div className="flex w-full max-w-[320px] flex-col gap-3">
        <div className="t-in h-3 overflow-hidden rounded-full bg-surface-2" style={d(0)}>
          <div className="t-fill h-full w-3/5 rounded-full bg-green" style={d(0.3)} />
        </div>
        <p className="t-in text-[19px] font-black" style={d(0.2)}>
          Sales ₹500. Costs ₹350. Profit?
        </p>
        <div className="tile t-in" style={d(0.4)}>
          ₹500
        </div>
        <div className="tile t-in relative" style={d(0.55)}>
          ₹150
          <span
            className="t-in absolute -inset-[2px] flex items-center justify-end rounded-[16px] border-2 border-green bg-green/15 pr-3 text-green"
            style={d(1.3)}
          >
            <Icon.check className="size-7" />
          </span>
        </div>
      </div>
    );

  if (beat === "hotSeat")
    return (
      <div className="flex w-full max-w-[320px] flex-col items-center gap-3">
        <div
          className="t-in grid size-28 place-items-center rounded-full text-brand"
          style={d(0, { background: "radial-gradient(circle, rgba(255,150,0,.35), transparent 70%)" })}
        >
          <Icon.chair className="size-20" />
        </div>
        <div className="tile t-in" style={d(0.4)}>
          Cut prices
        </div>
        <div className="tile t-in relative" style={d(0.55)}>
          Keep prices, give better service
          <span className="t-in absolute -inset-[2px] rounded-[16px] border-2 border-brand bg-brand/15" style={d(1.3)} />
        </div>
      </div>
    );

  if (beat === "hearts")
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {[0.9, 1.6, 2.3].map((t) => (
            <span key={t} className="relative size-16">
              <Icon.heartOff className="absolute inset-0 size-16" />
              <span className="t-out absolute inset-0" style={d(t)}>
                <Icon.heart className="size-16" />
              </span>
            </span>
          ))}
        </div>
        <span
          className="t-in rotate-[-8deg] rounded-xl border-4 border-red px-4 py-1 text-[30px] font-black tracking-widest text-red uppercase"
          style={d(2.9)}
        >
          Fired
        </span>
      </div>
    );

  if (beat === "streak")
    return (
      <div className="relative grid size-[200px] place-items-center">
        <span className="unlit absolute">
          <Icon.flameOff className="size-40" />
        </span>
        <span className="ignite absolute drop-shadow-[0_0_28px_rgba(255,150,0,.6)]">
          <span className="flicker block">
            <Icon.flame className="size-40" />
          </span>
        </span>
        <span className="tick absolute bottom-2 text-[56px] leading-none font-black text-white [text-shadow:0_4px_0_#b35a00]">1</span>
      </div>
    );

  if (beat === "league") {
    // The player's row climbs from third to first as the XP lands.
    const rows = [
      { name: "You", xp: 75, color: "#ff9600", from: 128, you: true },
      { name: "Priya", xp: 60, color: "#1cb0f6", from: -64 },
      { name: "Rahul", xp: 45, color: "#58cc02", from: -64 },
    ];
    return (
      <div className="flex w-full max-w-[320px] flex-col items-center gap-4">
        <div className="t-in" style={d(0)}>
          <Pill label="15 XP">
            <Icon.bolt className="size-6" />
            +15 XP
          </Pill>
        </div>
        <div className="flex w-full gap-2">
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((n) => (
              <span key={n} className="grid h-14 w-6 place-items-center text-[17px] font-black text-muted">
                {n}
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {rows.map((r) => (
              <div
                key={r.name}
                className={`t-rise flex h-14 items-center gap-3 rounded-2xl border-2 px-3 ${r.you ? "border-brand bg-[#2a1f0d]" : "border-line bg-surface"}`}
                style={d(0.9, { "--from": `${r.from}px` } as CSSProperties)}
              >
                <span
                  className="grid size-9 place-items-center rounded-full text-[15px] font-black text-[#0b1015]"
                  style={{ background: r.color }}
                >
                  {r.name[0]}
                </span>
                <span className="flex-1 text-[17px] font-extrabold">{r.name}</span>
                <span className="text-[15px] font-black text-muted tabular-nums">{r.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (beat === "notes")
    return (
      <div className="relative h-[190px] w-full max-w-[320px]">
        {[-1, 0, 1].map((i) => (
          <div
            key={i}
            className="t-in absolute top-10 left-1/2 flex h-[136px] w-[132px] flex-col gap-2.5 rounded-2xl border-2 border-line bg-surface p-3 shadow-[0_6px_0_rgba(0,0,0,.35)]"
            style={d(0.3 + (i + 1) * 0.25, {
              marginLeft: -66,
              transform: `translateX(${i * 82}px) rotate(${i * 8}deg)`,
              zIndex: i === 0 ? 1 : 0,
            })}
          >
            <span className="text-green">
              <Icon.check className="size-7" />
            </span>
            <span className="h-2.5 w-full rounded-full bg-surface-2" />
            <span className="h-2.5 w-4/5 rounded-full bg-surface-2" />
            <span className="h-2.5 w-3/5 rounded-full bg-surface-2" />
          </div>
        ))}
        <span className="t-in absolute -top-3 left-1/2 z-[2] -ml-6 text-brand" style={d(0)}>
          <Icon.navNotes className="size-12" />
        </span>
      </div>
    );

  // "go": the first stop on the course path, waiting.
  return (
    <div className="node-ring t-in bob grid size-24 place-items-center rounded-full bg-green text-[#071400]" style={d(0.2)}>
      <Icon.play className="size-12" />
    </div>
  );
}

/** The answers to the wolf's question (he asks it in his bubble). */
function Choices<T extends string | number>({
  items,
  onPick,
}: {
  items: { id: T; label: string; hint?: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-1 flex-col pt-5">
      <div className="flex flex-col gap-3">
        {items.map((o, i) => (
          // The pop-in sits on a wrapper, so it doesn't hold the tile's own press-down transform.
          <div key={o.id} className="t-in" style={{ "--d": `${0.1 + i * 0.06}s` } as CSSProperties}>
            <button type="button" className="tile flex items-center justify-between gap-3" onClick={() => onPick(o.id)}>
              <span>{o.label}</span>
              {o.hint && <span className="text-[14px] font-bold text-muted">{o.hint}</span>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrialIntro({ hs, onStart }: { hs: CatalogEntry; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      {hs.cover && <MediaView media={hs.cover} className="aspect-[16/9] w-full" />}
      <p className="text-[13px] font-black tracking-[.14em] text-muted uppercase">
        {hs.company} · {hs.years}
      </p>
      <h1 className="-mt-2 text-[28px] leading-tight font-black text-balance">{hs.title}</h1>
      <p className="text-[18px] font-bold">{hs.hook}</p>
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
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4 pt-2 pb-6">
      <WolfHost beat="style" />
      <p className="text-[13px] font-black tracking-[.14em] text-brand uppercase">Your CEO style so far</p>
      <h1 className="-mt-2 text-[28px] leading-tight font-black">
        {great === picks.length ? "Sharp start" : great ? "Good instincts, one slip" : "Bold, but costly"}
      </h1>
      <Card className="flex flex-col gap-2">
        {meta.madeUp ? (
          <p className="text-[17px] font-extrabold">
            {great} of {picks.length} calls were great calls.
          </p>
        ) : (
          <p className="text-[17px] font-extrabold">
            You picked what {meta.company} really did in {matched} of {picks.length} calls.
          </p>
        )}
        {lines.map((l) => (
          <p key={l} className="text-[17px] font-bold">
            {l}
          </p>
        ))}
        {doing && <p className="text-[15px] font-bold text-muted">{FOR_YOU[doing]}</p>}
      </Card>
      <p className="text-[16px] font-bold text-muted">{left > 0 ? `Up to ${left} more calls decide how it ends.` : ""}</p>
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
