"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCards } from "@/lib/content-client";
import type { Card } from "@/lib/course-types";
import type { CardReview } from "@/lib/game-state";
import { cardsToday, useGame } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { Logo } from "./Logo";
import { Bar, Icon, Pill } from "./ui";

/**
 * A flashcard session ("Daily 10", or a Practice node). Each card is a small situation with tap answers; the app
 * grades from right or wrong and how long it took, and saves the whole session in one go at the end.
 */
export function ReviewSession({ lessonIds, title, onExit }: { lessonIds?: string[]; title: string; onExit: () => void }) {
  const game = useGame();
  const [cards, setCards] = useState<Card[]>();
  const [failed, setFailed] = useState(false);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [reviews, setReviews] = useState<CardReview[]>([]);
  const [done, setDone] = useState<{ xp: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    // Card answers aren't secret, so the phone gets each card whole and shows the answer straight after a tap.
    // A Practice node (`lessonIds`) reviews its lessons' cards, due or not; otherwise today's cards from the whole deck.
    fetchCards(lessonIds ?? Object.keys(game.s.lessons))
      .then((all) => {
        const byId = new Map<string, Card>(all.map((c) => [c.id, c]));
        const ids = cardsToday(game.s, new Date(), lessonIds && all.map((c) => c.id));
        setCards(ids.map((id) => byId.get(id)).filter((c): c is Card => !!c));
        shownAt.current = Date.now();
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (all: CardReview[]) => {
    if (!cards) return;
    setSaving(true);
    setFailed(false);
    game
      .reviewCards(all, Object.fromEntries(cards.map((c) => [c.id, c.answer])))
      .then((xp) => {
        if (xp) playSfx("coins", 200);
        setDone({ xp });
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  };

  if (!cards)
    return (
      <div className="grid min-h-dvh place-items-center px-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={96} className={failed ? "" : "pop"} />
          <p className="text-[18px] font-black text-muted">{failed ? "Couldn't load your cards." : "Loading…"}</p>
          {failed && (
            <button type="button" className="text-[15px] font-extrabold text-muted uppercase" onClick={onExit}>
              Go back
            </button>
          )}
        </div>
      </div>
    );

  if (done || !cards.length) {
    const right = reviews.filter((r) => cards.find((c) => c.id === r.cardId)?.answer === r.pick).length;
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4 pt-10 pb-6 text-center">
        <Logo size={88} className="pop mx-auto" />
        <h1 className="text-[30px] font-black">{cards.length ? "Cards done!" : "All done for today"}</h1>
        {cards.length > 0 && (
          <div className="flex justify-center gap-2">
            <Pill label={`${right} of ${reviews.length} right`}>
              <Icon.check className="size-5" />
              {right}/{reviews.length}
            </Pill>
            {done!.xp > 0 && (
              <Pill label={`${done!.xp} XP`}>
                <Icon.bolt className="size-5" />+{done!.xp} XP
              </Pill>
            )}
          </div>
        )}
        <p className="font-bold text-muted">
          {cards.length ? "Cards you missed come back sooner. The rest wait longer." : "No cards are due. Come back tomorrow."}
        </p>
        <div className="mt-auto">
          <button type="button" className="btn3d green" onClick={onExit}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  const card = cards[i];
  const answered = pick !== null;
  const right = pick === card.answer;
  const next = () => {
    playSfx("next");
    if (i + 1 < cards.length) {
      setI(i + 1);
      setPick(null);
      shownAt.current = Date.now();
    } else save(reviews);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3 py-2">
        <button type="button" onClick={onExit} aria-label="Stop reviewing" className="text-muted">
          <Icon.close />
        </button>
        <div className="flex-1">
          <Bar value={((i + (answered ? 1 : 0)) / cards.length) * 100} color="var(--color-purple)" h="h-4" />
        </div>
      </div>
      <p className="text-[13px] font-black tracking-[.12em] text-purple uppercase">{title}</p>
      <h2 key={card.id} className="pop text-[24px] leading-tight font-black text-balance">
        {card.front}
      </h2>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Answers">
        {card.options.map((o, k) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={pick === k}
            disabled={answered}
            className={`tile ${answered && k === card.answer ? "!border-green !text-green" : ""}`}
            onClick={() => {
              const r = { cardId: card.id, pick: k, ms: Date.now() - shownAt.current };
              playSfx(k === card.answer ? "great" : "bad");
              setPick(k);
              setReviews([...reviews, r]);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {answered && (
        <div className={`rounded-2xl p-3 ${right ? "bg-[#0f2a10]" : "bg-[#2d0f0f]"}`}>
          <p className="text-[15px] font-black" style={{ color: right ? "var(--color-green)" : "var(--color-red)" }}>
            {right ? "Right!" : "Not quite"}
          </p>
          <p className="mt-1 text-[16px] font-bold">{card.back}</p>
        </div>
      )}
      {failed && (
        <p role="alert" className="rounded-2xl bg-red/15 px-3 py-2 text-[14px] font-extrabold text-red">
          Your cards didn&apos;t save. Check your connection and try again.
        </p>
      )}
      <div className="mt-auto pt-2 pb-6">
        <button type="button" className="btn3d" disabled={!answered || saving} onClick={next}>
          {i + 1 < cards.length ? "Next card" : "Finish"}
        </button>
      </div>
    </div>
  );
}
