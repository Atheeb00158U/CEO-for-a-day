"use client";

import { useEffect, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { LINES, onWolf, type WolfLine } from "@/lib/wolf";
import { WolfPicture } from "./WolfPicture";

/** The wolf peeks in from the bottom left with a speech bubble, stays long enough to read, then slips away. A tap closes it. */
export function WolfTip() {
  const [tip, setTip] = useState<{ line: WolfLine; key: number; leaving: boolean } | null>(null);

  useEffect(() => {
    onWolf((line) => {
      playSfx("up");
      setTip({ line, key: Date.now(), leaving: false });
    });
    return () => onWolf(null);
  }, []);

  useEffect(() => {
    if (!tip) return;
    // Leaving: gone once the slide-out ends (a timer, so reduced motion, with no animation, still clears it).
    if (tip.leaving) {
      const t = setTimeout(() => setTip(null), 320);
      return () => clearTimeout(t);
    }
    const words = LINES[tip.line].text.split(/\s+/).length;
    const t = setTimeout(() => setTip((x) => x && { ...x, leaving: true }), 2600 + words * 280);
    return () => clearTimeout(t);
  }, [tip]);

  if (!tip) return null;
  const { pose, text } = LINES[tip.line];
  return (
    <button
      key={tip.key}
      type="button"
      onClick={() => setTip((x) => x && { ...x, leaving: true })}
      aria-label={text}
      className={`${tip.leaving ? "wolf-out" : "wolf-in"} fixed left-[max(4px,calc(50%-236px))] z-40 flex items-end text-left`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 150px)" }}
    >
      <span className="-mr-3 w-[118px] shrink-0 drop-shadow-[0_8px_16px_rgba(0,0,0,.5)]">
        <WolfPicture name={pose} sizes="118px" className="h-auto w-full" alt="" />
      </span>
      <span className="relative mb-14 max-w-[200px] rounded-2xl border-b-4 border-[#c9b98f] bg-[#fff8e6] px-3.5 py-2.5 text-[15px] leading-snug font-extrabold text-[#2a1d00] shadow-[0_8px_24px_rgba(0,0,0,.4)]">
        <span className="absolute -left-2 bottom-3 size-4 rotate-45 bg-[#fff8e6]" aria-hidden />
        <span className="relative">{text}</span>
      </span>
    </button>
  );
}
