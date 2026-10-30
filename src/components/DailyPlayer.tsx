"use client";

import { useEffect, useState } from "react";
import { lockDaily } from "@/lib/content-client";
import type { DailyAnswer, DailyQuestion } from "@/lib/hotseat-types";
import { today, useGame } from "@/lib/store";
import { playSfx } from "@/lib/sfx";
import { stopVoice } from "@/lib/voice";
import { DecisionView, RevealView } from "./Player";
import { Icon } from "./ui";

/**
 * One decision, about a minute. The phone gets the answer only from the server at "Lock it in", and the pick is
 * saved then, so a reload shows the same result.
 */
export function DailyPlayer({ call, onExit }: { call: DailyQuestion; onExit: () => void }) {
  const game = useGame();
  const played = game.s.daily?.day === today() && game.s.daily.id === call.id ? game.s.daily : null;
  const [answer, setAnswer] = useState<DailyAnswer>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => stopVoice(), []);

  const lock = (optionId: string, first: boolean) => {
    setBusy(true);
    setFailed(false);
    lockDaily(call.id, optionId)
      .then((a) => {
        if (first) {
          game.playDaily(call, a.option);
          playSfx("coins", 1000); // the XP, after the verdict sound
        }
        setAnswer(a);
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };

  // Played earlier today: fetch the same reveal again.
  useEffect(() => {
    if (played) lock(played.optionId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const option = answer?.option;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => {
            stopVoice();
            onExit();
          }}
          aria-label="Close today's call"
          className="text-muted"
        >
          <Icon.close />
        </button>
        <p className="text-[13px] font-black tracking-[.12em] text-brand uppercase">Today&apos;s call · {call.company}</p>
      </div>

      {failed && (
        <p role="alert" className="mb-3 rounded-2xl bg-red/15 px-3 py-2 text-[14px] font-extrabold text-red">
          That didn&apos;t go through. Check your connection and try again.
        </p>
      )}

      {!option ? (
        !played && (
          <DecisionView
            year={call.year}
            media={call.media}
            setup={call.setup}
            question={call.question}
            advisor={call.advisor}
            options={call.options}
            busy={busy}
            onChoose={(id) => lock(id, true)}
          />
        )
      ) : (
        <RevealView
          year={call.year}
          real={!!option.real}
          outcome={option.outcome}
          grade={option.grade}
          why={option.why}
          better={option.better}
          pointsLabel={`+${game.s.daily?.xp ?? 0} XP`}
          realChoice={answer.realChoice}
          extra={
            <div className="rounded-2xl border-2 border-line bg-surface p-3">
              <p className="text-[11px] font-black tracking-wider text-muted uppercase">What really happened</p>
              <p className="mt-1 text-[15px] leading-snug font-bold">{answer.realHistory}</p>
              <p className="mt-2 flex flex-wrap gap-x-3 text-[12px] font-bold text-muted">
                {answer.sources.map((s) => (
                  <a key={s.url} className="underline" href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                ))}
              </p>
            </div>
          }
          onNext={onExit}
        />
      )}
    </div>
  );
}
