"use client";

import { useState } from "react";
import { useContent } from "@/lib/content-client";
import { cardsToday, useGame } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { Card, Icon, MediaView } from "./ui";

const GRADE_COLOR = { great: "var(--color-green)", ok: "var(--color-gold)", bad: "var(--color-red)" } as const;

type Section = "cards" | "mistakes" | "seats";

export function NotesTab({
  onPlay,
  onReview,
  onLesson,
}: {
  onPlay: () => void;
  onReview: () => void;
  onLesson: (lessonId: string) => void;
}) {
  const { course } = useContent();
  const [section, setSection] = useState<Section>("cards");
  // While the course is off, Notes is the Hot Seat notes alone, as before.
  if (!course) return <SeatNotes onPlay={onPlay} />;
  const tabs: { id: Section; label: string }[] = [
    { id: "cards", label: "Cards" },
    { id: "mistakes", label: "Mistakes" },
    { id: "seats", label: "Hot Seats" },
  ];
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Notes">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={section === t.id}
            className="tile !px-2 !py-2.5 text-center !text-[14px]"
            onClick={() => {
              playSfx("tab");
              setSection(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {section === "cards" && <CardsNotes onReview={onReview} onLesson={onLesson} />}
      {section === "mistakes" && <Mistakes />}
      {section === "seats" && <SeatNotes onPlay={onPlay} />}
    </div>
  );
}

/** Today's flashcards, and the rule of every lesson the player has finished. */
function CardsNotes({ onReview, onLesson }: { onReview: () => void; onLesson: (lessonId: string) => void }) {
  const { s } = useGame();
  const { course } = useContent();
  const due = cardsToday(s).length;
  const deck = Object.keys(s.cards).length;
  const done = course!.units.flatMap((u) => u.modules.flatMap((m) => m.lessons)).filter((l) => s.lessons[l.id] !== undefined);
  return (
    <>
      <Card className="flex items-center gap-3 border-purple/50 bg-purple/10">
        <Icon.bolt className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black">{!deck ? "No cards yet" : due ? `Today's cards: ${due}` : "All done for today"}</p>
          <p className="text-[14px] font-bold text-muted">
            {!deck
              ? "Finish a lesson to get your first cards."
              : due
                ? "About 2 minutes. Keeps your streak alive."
                : "Come back tomorrow for more."}
          </p>
        </div>
        {due > 0 && (
          <button type="button" className="btn3d purple !w-auto !px-4 !py-2.5 !text-[14px]" onClick={onReview}>
            Review
          </button>
        )}
      </Card>
      {deck > 0 && (
        <p className="text-center text-[13px] font-bold text-muted">
          {deck} card{deck > 1 ? "s" : ""} in your deck
        </p>
      )}
      {done.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-black tracking-[.12em] text-brand uppercase">Rules you know</p>
            <h2 className="text-[19px] leading-tight font-black">Your lessons</h2>
          </div>
          {done.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black tracking-wider text-muted uppercase">
                  {l.title} · {s.lessons[l.id]}%
                </p>
                <p className="mt-1 text-[15px] leading-snug font-bold">{l.principle}</p>
              </div>
              <button type="button" onClick={() => onLesson(l.id)} className="shrink-0 text-[13px] font-black text-brand uppercase">
                Again
              </button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/** Every first-try miss in a lesson, and every risky or costly call in a Hot Seat, with what works. */
function Mistakes() {
  const { s } = useGame();
  const { catalog } = useContent();
  const seat = s.runs.flatMap((r) =>
    r.notes.filter((n) => n.grade !== "great").map((n) => ({ ...n, company: catalog.find((c) => c.id === r.hotSeatId)?.company ?? "" })),
  );
  if (!s.mistakes.length && !seat.length)
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center">
        <Icon.check className="size-10 text-muted" />
        <p className="text-[18px] font-black">No mistakes yet</p>
        <p className="max-w-[28ch] font-bold text-muted">Anything you get wrong lands here, with what works instead.</p>
      </Card>
    );
  return (
    <div className="flex flex-col gap-2">
      {s.mistakes.map((m) => (
        <div key={`${m.lessonId}/${m.screenId}`} className="rounded-2xl border-2 border-line bg-surface p-3">
          <p className="text-[15px] leading-snug font-black">{m.prompt}</p>
          <p className="mt-1 text-[14px] font-bold text-red">You said: {m.picked}</p>
          {m.right && <p className="text-[14px] font-bold text-green">Answer: {m.right}</p>}
          <p className="mt-1 text-[14px] font-bold text-muted">{m.why}</p>
        </div>
      ))}
      {seat.map((n, i) => (
        <div key={i} className="rounded-2xl border-2 border-line bg-surface p-3">
          <p className="text-[12px] font-black tracking-wider uppercase" style={{ color: GRADE_COLOR[n.grade] }}>
            {n.company} · {n.year} · {n.title}
          </p>
          <p className="mt-1 text-[14px] font-bold text-red">You chose: {n.choice}</p>
          {n.better && <p className="text-[14px] font-bold text-green">What works: {n.better}</p>}
          <p className="mt-1 text-[14px] font-bold text-muted">{n.takeaway}</p>
        </div>
      ))}
    </div>
  );
}

function SeatNotes({ onPlay }: { onPlay: () => void }) {
  const { s } = useGame();
  const { catalog } = useContent();
  // Latest run per Hot Seat
  const latest = Object.values(Object.fromEntries([...s.runs].reverse().map((r) => [r.hotSeatId, r])));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-[28px] font-black">Revision notes</h1>
        <p className="font-bold text-muted">Every hot seat you finish leaves notes here, written for the calls you made.</p>
      </div>
      {latest.length === 0 && s.dailyLog.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Icon.navNotes className="size-12 text-muted" />
          <p className="text-[18px] font-black">No notes yet</p>
          <p className="max-w-[28ch] font-bold text-muted">Finish your first hot seat and your key takeaways land here.</p>
          <button type="button" className="btn3d mt-2 max-w-[260px]" onClick={onPlay}>
            Take a hot seat
          </button>
        </Card>
      )}
      {latest.map((r) => {
        const hs = catalog.find((c) => c.id === r.hotSeatId);
        if (!hs) return null; // no longer published
        return (
          <Card key={r.hotSeatId} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {hs.cover && <MediaView media={hs.cover} className="size-16 shrink-0 !rounded-2xl" kenBurns={false} />}
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[.12em] text-brand">
                  {hs.company} · score {r.score}
                </p>
                <h2 className="text-[19px] font-black leading-tight">{hs.title}</h2>
                <p className="text-[13px] font-bold text-muted">
                  {new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] font-bold leading-snug marker:text-brand">
              {r.patterns.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              {r.notes.map((n, i) => (
                <div key={i} className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: GRADE_COLOR[n.grade] }}>
                    {n.year} · {n.title}
                  </p>
                  <p className="mt-1 text-[15px] font-bold leading-snug">{n.takeaway}</p>
                  {n.better && <p className="mt-1 text-[13px] font-bold text-muted">Next time: {n.better}</p>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      {s.dailyLog.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[.12em] text-brand">Daily calls</p>
            <h2 className="text-[19px] font-black leading-tight">One decision a day</h2>
          </div>
          <div className="flex flex-col gap-2">
            {s.dailyLog.map((n) => (
              <div key={n.day} className="rounded-2xl bg-surface-2 p-3">
                <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: GRADE_COLOR[n.grade] }}>
                  {n.company} · {n.title}
                </p>
                <p className="mt-1 text-[15px] font-bold leading-snug">{n.takeaway}</p>
                {n.better && <p className="mt-1 text-[13px] font-bold text-muted">Next time: {n.better}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
