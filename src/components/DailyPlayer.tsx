"use client";

import { useEffect, useState } from "react";
import type { DailyCall } from "@/lib/hotseat-types";
import { today, useGame } from "@/lib/store";
import { stopVoice } from "@/lib/voice";
import { DecisionView, RevealView } from "./Player";
import { Icon } from "./ui";

/** One decision, about a minute. The answer is saved at "Lock it in", so a reload shows the same result. */
export function DailyPlayer({ call, onExit }: { call: DailyCall; onExit: () => void }) {
  const game = useGame();
  const played = game.s.daily?.day === today() && game.s.daily.id === call.id ? game.s.daily : null;
  const [revealed, setRevealed] = useState(!!played);
  useEffect(() => () => stopVoice(), []);

  const option = played && call.options.find((o) => o.id === played.optionId);
  const real = call.options.find((o) => o.real);

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

      {!revealed || !option ? (
        <DecisionView
          year={call.year}
          media={call.media}
          setup={call.setup}
          question={call.question}
          advisor={call.advisor}
          options={call.options}
          onChoose={(id) => {
            game.playDaily(call, id);
            setRevealed(true);
          }}
        />
      ) : (
        <RevealView
          year={call.year}
          real={!!option.real}
          outcome={option.outcome}
          grade={option.grade}
          why={option.why}
          better={option.better}
          pointsLabel={`+${played.xp} XP`}
          realChoice={!option.real && real ? { company: call.company, label: real.label } : undefined}
          extra={
            <div className="rounded-2xl border-2 border-line bg-surface p-3">
              <p className="text-[11px] font-black tracking-wider text-muted uppercase">What really happened</p>
              <p className="mt-1 text-[15px] leading-snug font-bold">{call.realHistory}</p>
              <p className="mt-2 flex flex-wrap gap-x-3 text-[12px] font-bold text-muted">
                {call.sources.map((s) => (
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
