"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { useGame } from "@/lib/store";
import { speak, stopVoice } from "@/lib/voice";
import { onWolf, type WolfTalk } from "@/lib/wolf";
import { WOLF_LINES, WOLF_VOICE } from "@/lib/wolf-lines";
import { WolfPicture } from "./WolfPicture";

const COPY = { close: "Tap to close" };

/**
 * The wolf steps up from the tab bar with a speech bubble and says his line out loud. He stays until the player
 * taps anywhere, then slips away.
 */
export function WolfTip() {
  const { s } = useGame();
  const voiceOn = useRef(s.settings.voice);
  useEffect(() => {
    voiceOn.current = s.settings.voice;
  }, [s.settings.voice]);
  const [tip, setTip] = useState<(WolfTalk & { key: number; leaving: boolean }) | null>(null);

  useEffect(() => {
    onWolf((t) => {
      playSfx("up");
      if (voiceOn.current) speak(t.text, WOLF_VOICE);
      setTip({ ...t, key: Date.now(), leaving: false });
    });
    return () => {
      onWolf(null);
      stopVoice();
    };
  }, []);

  // Leaving: gone once the slide-out ends (a timer, so reduced motion, with no animation, still clears it).
  useEffect(() => {
    if (!tip?.leaving) return;
    const t = setTimeout(() => setTip(null), 320);
    return () => clearTimeout(t);
  }, [tip]);

  if (!tip) return null;
  const close = () => {
    stopVoice();
    setTip((x) => x && { ...x, leaving: true });
  };
  return (
    <button
      key={tip.key}
      type="button"
      onClick={close}
      aria-label={`${tip.text} ${COPY.close}`}
      className={`${tip.leaving ? "wolf-dim-out" : "wolf-dim-in"} fixed inset-0 z-50 cursor-default bg-black/45 text-left`}
    >
      <span
        className={`${tip.leaving ? "wolf-out" : "wolf-in"} absolute left-[max(0px,calc(50%-240px))] flex items-end`}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 66px)" }}
      >
        <span className="-mr-4 w-[168px] shrink-0 drop-shadow-[0_10px_20px_rgba(0,0,0,.55)]">
          <WolfPicture name={WOLF_LINES[tip.moment].pose} sizes="168px" className="h-auto w-full" alt="" />
        </span>
        <span className="relative mb-24 max-w-[205px] rounded-2xl border-b-4 border-[#c9b98f] bg-[#fff8e6] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,.4)]">
          <span className="absolute -left-2 bottom-4 size-4 rotate-45 bg-[#fff8e6]" aria-hidden />
          <span className="relative block text-[16px] leading-snug font-extrabold text-[#2a1d00]">{tip.text}</span>
          <span className="relative mt-1.5 block text-[12px] font-extrabold text-[#8a7650] uppercase">{COPY.close}</span>
        </span>
      </span>
    </button>
  );
}
