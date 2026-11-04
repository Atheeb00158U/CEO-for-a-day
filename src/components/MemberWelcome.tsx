"use client";

import { useEffect, useRef } from "react";
import type { MembershipView } from "@/lib/membership-view";
import { playSfx } from "@/lib/sfx";
import { WolfPicture } from "./WolfPicture";

const COPY = {
  titleFounding: "You're a founding member!",
  title: "You're a member!",
  line: "Every lesson and every Hot Seat is now open.",
  start: { lesson: "Start the lesson", testOut: "Start the test", hotSeat: "Start the Hot Seat" },
  letsGo: "Let's go",
};

/** Shown once when a player becomes a member: the wolf celebrates, then the item they tapped before paying opens. */
export function MemberWelcome({
  plan,
  item,
  onDone,
}: {
  plan: MembershipView["plan"];
  /** The kind of item that opens next, if any. */
  item: keyof typeof COPY.start | null;
  onDone: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    playSfx("legend");
    button.current?.focus();
  }, []);
  // Each line pops in a beat after the one before (all at once with reduced motion: globals.css turns animations off).
  const beat = (n: number) => ({ animationDelay: `${n * 140}ms`, animationFillMode: "both" as const });
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-welcome-title"
      className="fixed inset-0 z-[55] overflow-y-auto bg-bg"
      style={{
        backgroundImage: "radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--color-gold) 22%, transparent), transparent 62%)",
      }}
    >
      <div
        className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-5 text-center"
        style={{ paddingTop: "max(40px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="my-auto flex flex-col items-center">
          <div className="pop w-[240px]">
            <WolfPicture name="pose-celebrating" sizes="240px" priority className="h-auto w-full" />
          </div>
          <h1 id="member-welcome-title" className="pop mt-4 text-[30px] leading-tight font-black text-balance text-gold" style={beat(1)}>
            {plan === "founding" ? COPY.titleFounding : COPY.title}
          </h1>
          <p className="pop mt-2 text-[18px] font-bold text-ink" style={beat(2)}>
            {COPY.line}
          </p>
        </div>
        <button ref={button} type="button" className="btn3d green pop mt-6 w-full" style={beat(3)} onClick={onDone}>
          {item ? COPY.start[item] : COPY.letsGo}
        </button>
      </div>
    </div>
  );
}
