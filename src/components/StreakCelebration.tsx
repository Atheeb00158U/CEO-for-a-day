"use client";

import { useEffect, useRef } from "react";
import { playSfx } from "@/lib/sfx";

const COPY = {
  title: (n: number) => `${n}-day streak!`,
  first: "Your streak starts today!",
  line: "You learned today. Come back tomorrow to keep your streak.",
  button: "Keep going",
  days: ["M", "T", "W", "T", "F", "S", "S"],
};

/**
 * The first lesson, Hot Seat or review of a new day lights the streak: a grey flame catches fire, embers rise, the
 * count ticks up and the week fills in. Shown once a day, back on the map after the play that earned it.
 */
export function StreakCelebration({ streak, onDone }: { streak: number; onDone: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    playSfx("next");
    const t = setTimeout(() => playSfx("legend"), 380);
    ref.current?.focus();
    return () => clearTimeout(t);
  }, []);
  const beat = (n: number) => ({ animationDelay: `${n * 140}ms`, animationFillMode: "both" as const });

  // This week, Monday first, with the days of the current streak lit (today last).
  const todayIx = (new Date().getDay() + 6) % 7;
  const lit = (i: number) => i <= todayIx && todayIx - i < streak;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-title"
      className="fixed inset-0 z-[56] overflow-y-auto bg-bg"
      style={{ backgroundImage: "radial-gradient(circle at 50% 34%, rgba(255,150,0,.28), transparent 60%)" }}
    >
      <div
        className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-5 text-center"
        style={{ paddingTop: "max(40px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="my-auto flex flex-col items-center">
          <div className="relative grid size-[220px] place-items-center">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="ember absolute bottom-10 size-2 rounded-full bg-[#ffc800]"
                style={{ left: `${30 + ((i * 37) % 40)}%`, animationDelay: `${600 + i * 170}ms` }}
              />
            ))}
            <svg viewBox="0 0 24 24" className="unlit absolute size-[170px]" aria-hidden>
              <path
                fill="#4a5863"
                d="M12 2c1.2 4.2 6 5.8 6 11.6A6 6 0 0 1 6 13.6c0-2.6 1.3-4.4 2.8-5.5-.1 2.3 1.1 3.5 2.2 3.5-.6-3.3.5-6.6 1-9.6z"
              />
            </svg>
            <svg viewBox="0 0 24 24" className="ignite absolute size-[170px] drop-shadow-[0_0_28px_rgba(255,150,0,.6)]" aria-hidden>
              <g className="flicker">
                <path
                  fill="#ff9600"
                  d="M12 2c1.2 4.2 6 5.8 6 11.6A6 6 0 0 1 6 13.6c0-2.6 1.3-4.4 2.8-5.5-.1 2.3 1.1 3.5 2.2 3.5-.6-3.3.5-6.6 1-9.6z"
                />
                <path fill="#ffc800" d="M12 21a3.2 3.2 0 0 1-3.2-3.2c0-2 1.6-3 2.3-4.6.9 1.6 4.1 2.4 4.1 4.6A3.2 3.2 0 0 1 12 21z" />
              </g>
            </svg>
            <span className="tick absolute bottom-3 text-[64px] leading-none font-black text-white [text-shadow:0_4px_0_#b35a00]">
              {streak}
            </span>
          </div>
          <h1 id="streak-title" className="pop mt-4 text-[32px] leading-tight font-black text-[#ff9600]" style={beat(4)}>
            {streak === 1 ? COPY.first : COPY.title(streak)}
          </h1>
          <p className="pop mt-2 max-w-[300px] text-[17px] font-bold text-ink" style={beat(5)}>
            {COPY.line}
          </p>
          <div className="pop mt-6 flex gap-2 rounded-2xl bg-surface px-4 py-3" style={beat(6)}>
            {COPY.days.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`text-[12px] font-black ${i === todayIx ? "text-[#ff9600]" : "text-muted"}`}>{d}</span>
                <span
                  className={`grid size-8 place-items-center rounded-full ${lit(i) ? "bg-[#ff9600] text-[#3a1d00]" : "bg-surface-2"}`}
                  style={i === todayIx ? beat(8) : undefined}
                >
                  {lit(i) && (
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button ref={ref} type="button" className="btn3d green pop mt-6 w-full" style={beat(7)} onClick={onDone}>
          {COPY.button}
        </button>
      </div>
    </div>
  );
}
