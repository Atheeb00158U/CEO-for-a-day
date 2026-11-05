"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";

/**
 * Right answers in a row, cheered at milestones only (3, 5, 8, then every 4) so the cheer stays special, like
 * Kahoot's answer streak. Cricket words, for Indian players. A wrong answer starts the count again.
 */
const COPY = {
  name: (n: number) => (n === 3 ? "Hat-trick!" : n === 5 ? "On fire!" : n === 8 ? "Unstoppable!" : "Legend!"),
  line: (n: number) => `${n} right in a row`,
};
const milestone = (n: number) => n === 3 || n === 5 || n === 8 || (n > 8 && n % 4 === 0);

/** Counts a lesson's or Hot Seat's right answers; `hit` after each verdict, `burst` shows the cheer. */
export function useCombo() {
  const run = useRef(0);
  const [burst, setBurst] = useState<{ n: number; key: number } | null>(null);
  const hit = useCallback((right: boolean | null) => {
    if (right === null) return; // a "guess first" question neither counts nor breaks the run
    run.current = right ? run.current + 1 : 0;
    if (right && milestone(run.current)) {
      playSfx("coins", 350);
      setBurst({ n: run.current, key: Date.now() });
    }
  }, []);
  const done = useCallback(() => setBurst(null), []);
  const node = burst && <ComboBurst key={burst.key} n={burst.n} onDone={done} />;
  return { hit, burst: node };
}

function ComboBurst({ n, onDone }: { n: number; onDone: () => void }) {
  // Gone when the animation ends (a timer, so reduced motion, with no animation, still clears it).
  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className="combo pointer-events-none fixed inset-x-0 top-[max(64px,calc(env(safe-area-inset-top)+52px))] z-40 mx-auto flex w-fit items-center gap-2 rounded-full border-b-4 border-[#b35a00] bg-gradient-to-r from-[#ffb020] to-[#ff7a00] py-2 pr-5 pl-2 text-[#2a1200] shadow-[0_8px_30px_rgba(255,120,0,.45)]"
    >
      <span className="grid size-10 place-items-center rounded-full bg-[#2a1200]/15">
        <svg viewBox="0 0 24 24" className="flicker size-7" aria-hidden>
          <path
            fill="#fff4d6"
            d="M12 2c1.2 4.2 6 5.8 6 11.6A6 6 0 0 1 6 13.6c0-2.6 1.3-4.4 2.8-5.5-.1 2.3 1.1 3.5 2.2 3.5-.6-3.3.5-6.6 1-9.6z"
          />
        </svg>
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[20px] font-black">{COPY.name(n)}</span>
        <span className="block text-[13px] font-extrabold opacity-80">{COPY.line(n)}</span>
      </span>
    </div>
  );
}
