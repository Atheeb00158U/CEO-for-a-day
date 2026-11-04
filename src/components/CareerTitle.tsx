"use client";

import { useMemo } from "react";
import { careerOf, careerSpoken, type Career } from "@/lib/career";
import { useContent } from "@/lib/content-client";
import { useGame } from "@/lib/store";

/** The player's career from their own save, or undefined while the course is off. */
export function useCareer(): Career | undefined {
  const { course } = useContent();
  const { s } = useGame();
  return useMemo(() => (course ? careerOf({ lessons: s.lessons, best: s.best }, course) : undefined), [course, s.lessons, s.best]);
}

/** "Trader ★★☆": the title, a gold star for each finished module of the unit and a dim one for each still to go. */
export function CareerPill({ career }: { career: Career }) {
  return (
    <span
      role="img"
      aria-label={careerSpoken(career)}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-gold-dark/60 bg-surface px-2.5 py-0.5 text-[14px] font-black"
    >
      {career.title}
      {career.maxStars > 0 && (
        <span aria-hidden="true" className="tracking-tight">
          <span className="text-gold">{"★".repeat(career.stars)}</span>
          <span className="text-muted/50">{"★".repeat(career.maxStars - career.stars)}</span>
        </span>
      )}
    </span>
  );
}
