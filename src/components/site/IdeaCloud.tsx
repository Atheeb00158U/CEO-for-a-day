"use client";

/**
 * The named ideas on the course map (docs/CURRICULUM.md, the Concept column), spread across the whole width with the
 * section's heading and button laid over the middle. A soft gold light moves over the words: it follows the mouse or a
 * finger, and wanders slowly on its own when nobody is pointing. With reduced motion it never moves by itself.
 * Size is how well known the name is. The order is set by hand so big and small words mix on every row; on a phone the
 * smallest words are left out so the cloud stays about one screen tall.
 */
import { useEffect, useRef } from "react";

type Idea = [name: string, size: 1 | 2 | 3 | 4];

const IDEAS: Idea[] = [
  ["Opportunity cost", 3],
  ["Decoy effect", 2],
  ["BATNA", 3],
  ["Cash runway", 2],
  ["Social proof", 3],
  ["Mirroring", 4],
  ["Loss aversion", 1],
  ["The Mom Test", 3],
  ["Framing", 4],
  ["Blue ocean strategy", 2],
  ["Unit economics", 3],
  ["Reciprocity", 4],
  ["Scarcity", 3],
  ["Sunk cost fallacy", 1],
  ["Game theory", 3],
  ["Winner's curse", 4],
  ["Beachhead market", 2],
  ["Endowment effect", 4],
  ["Porter's five forces", 3],
  ["Switching costs", 4],
  ["Anchoring", 1],
  ["Value-based pricing", 3],
  ["Streisand effect", 4],
  ["Outcome bias", 2],
  ["Status quo bias", 4],
  ["Customer lifetime value", 3],
  ["Disruptive innovation", 2],
  ["Selection bias", 4],
  ["Loss leader", 3],
  ["Network effects", 1],
  ["Tactical empathy", 4],
  ["Operating leverage", 3],
  ["Economies of scale", 4],
  ["Jobs to be done", 2],
  ["Escalation of commitment", 4],
  ["Pricing power", 3],
  ["Cash conversion cycle", 3],
  ["Foot-in-the-door", 4],
  ["Innovator's dilemma", 2],
  ["Sachet pricing", 4],
  ["Counter-positioning", 4],
  ["Price fairness", 3],
  ["Growth loops", 4],
  ["Marketing myopia", 4],
  ["Premature scaling", 3],
  ["Total cost of ownership", 4],
  ["Fighter brand", 4],
  ["Contribution margin", 4],
  ["Reactance", 4],
  ["Service recovery paradox", 4],
  ["Co-opetition", 4],
];

const SIZE = {
  1: "font-display text-[32px] leading-[1.05] md:text-[64px]",
  2: "font-display text-[22px] leading-[1.1] md:text-[42px]",
  3: "font-display text-[17px] leading-[1.2] md:text-[28px]",
  4: "hidden text-[14px] font-semibold leading-[1.3] md:list-item md:text-[19px]",
};

// How grey each size rests, before the light reaches it.
const REST = { 1: "38%", 2: "34%", 3: "30%", 4: "28%" };

export function IdeaCloud({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const words = [...box.querySelectorAll<HTMLElement>("li")];
    let centres: { x: number; y: number }[] = [];
    const measure = () => {
      const b = box.getBoundingClientRect();
      centres = words.map((w) => {
        const r = w.getBoundingClientRect();
        return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(box);

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pointer: { x: number; y: number } | null = null;
    let seen = false;
    let frame = 0;
    const start = performance.now();

    const light = (x: number, y: number) => {
      const reach = Math.max(150, Math.min(box.clientWidth, box.clientHeight) * 0.38);
      centres.forEach((c, i) => {
        const lit = Math.max(0, 1 - Math.hypot(c.x - x, c.y - y) / reach);
        words[i].style.setProperty("--lit", lit.toFixed(3));
      });
    };
    const tick = (now: number) => {
      frame = 0;
      if (pointer) light(pointer.x, pointer.y);
      else if (!still) {
        // A slow figure-of-eight over the whole cloud, about 40 seconds a lap.
        const t = (now - start) / 6400;
        light(box.clientWidth * (0.5 + 0.42 * Math.sin(t)), box.clientHeight * (0.5 + 0.38 * Math.sin(t * 1.7 + 1)));
      }
      if (seen && !still && !pointer) frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const at = (e: PointerEvent) => {
      const b = box.getBoundingClientRect();
      pointer = { x: e.clientX - b.left, y: e.clientY - b.top };
      kick();
    };
    const leave = (e: PointerEvent) => {
      // A finger's light stays where it lifted for a moment, then the wandering light takes over again.
      if (e.pointerType === "mouse") pointer = null;
      else setTimeout(() => ((pointer = null), kick()), 1600);
      kick();
    };
    box.addEventListener("pointermove", at);
    box.addEventListener("pointerdown", at);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("pointercancel", leave);
    box.addEventListener("pointerup", leave);

    const view = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      if (seen) {
        measure();
        kick();
      }
    });
    view.observe(box);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      view.disconnect();
      box.removeEventListener("pointermove", at);
      box.removeEventListener("pointerdown", at);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("pointercancel", leave);
      box.removeEventListener("pointerup", leave);
    };
  }, []);

  return (
    <div ref={root} className="relative isolate overflow-hidden px-3 py-16 md:px-6 md:py-24">
      <ul
        aria-label="Some of the ideas you learn"
        className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center select-none md:gap-x-7 md:gap-y-3"
      >
        {IDEAS.map(([name, size]) => (
          <li key={name} className={`idea ${SIZE[size]}`} style={{ "--rest": REST[size] } as React.CSSProperties}>
            {name}
          </li>
        ))}
      </ul>
      {/* The heading and the button, over the middle of the cloud on a pool of the page's ground. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5">
        <div className="idea-pool flex flex-col items-center px-6 py-10 text-center md:px-24 md:py-20 [&_a]:pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
