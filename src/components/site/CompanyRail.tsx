"use client";

import { useEffect, useRef } from "react";

export interface RailItem {
  company: string;
  title: string;
  /** A still from the story; unpublished ones have none and show their name large instead. */
  img?: string;
  live: boolean;
}

/**
 * A row of companies that never runs out: three copies side by side, and when the reader nears either end the row
 * jumps back by one copy, so swiping, the arrows and the slow drift all loop. The drift stops while the reader
 * touches, hovers or focuses the row, and for reduced motion. `children` is the fade at the right edge.
 */
export function CompanyRail({ items, children }: { items: RailItem[]; children?: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const set = () => el.scrollWidth / 3;
    el.scrollLeft = set();
    const wrap = () => {
      if (el.scrollLeft < set() * 0.5) el.scrollLeft += set();
      else if (el.scrollLeft > set() * 1.5) el.scrollLeft -= set();
    };
    el.addEventListener("scroll", wrap, { passive: true });

    let held = false;
    const hold = () => (held = true);
    const free = () => (held = false);
    for (const e of ["pointerenter", "pointerdown", "focusin", "touchstart"]) el.addEventListener(e, hold, { passive: true });
    for (const e of ["pointerleave", "focusout", "touchend"]) el.addEventListener(e, free, { passive: true });

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let carry = 0;
    const drift = () => {
      if (!held && !document.hidden) {
        carry += 0.4;
        if (carry >= 1) {
          el.scrollLeft += Math.floor(carry);
          carry -= Math.floor(carry);
        }
      }
      frame = requestAnimationFrame(drift);
    };
    if (!still) frame = requestAnimationFrame(drift);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", wrap);
    };
  }, []);

  const nudge = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={row}
        tabIndex={0}
        aria-label="Companies you can run"
        className="flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {[0, 1, 2].flatMap((copy) =>
          items.map((it) => (
            <article
              key={`${copy}-${it.company}`}
              aria-hidden={copy !== 1}
              className="w-[250px] shrink-0 overflow-hidden rounded-[20px] bg-surface md:w-[290px]"
            >
              {it.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.img}
                  alt=""
                  width={1024}
                  height={768}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-[var(--warm)] px-5 text-center">
                  <span className="font-display text-[40px] leading-[0.95] text-[var(--brass)]">{it.company}</span>
                </div>
              )}
              <div className="p-5">
                {it.img && <p className="mb-2 font-display text-[26px] leading-none">{it.company}</p>}
                <p className="text-[16px] leading-snug text-ink/85">{it.title}</p>
                <p
                  className={`mt-4 inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${it.live ? "bg-[var(--brass)] text-[var(--brass-ink)]" : "bg-surface-2 text-ink/70"}`}
                >
                  {it.live ? "Play now" : "Coming soon"}
                </p>
              </div>
            </article>
          )),
        )}
      </div>
      {children}
      <div className="mt-5 hidden justify-end gap-2 px-10 md:flex">
        {([-1, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => nudge(d)}
            aria-label={d < 0 ? "Earlier companies" : "More companies"}
            className="grid size-11 place-items-center rounded-full bg-surface-2 text-[20px] transition-colors hover:bg-line"
          >
            {d < 0 ? "←" : "→"}
          </button>
        ))}
      </div>
    </div>
  );
}
