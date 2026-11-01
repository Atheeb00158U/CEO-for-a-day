// What a lesson says aloud, screen by screen. Shared by the player (which speaks it) and voice-lines.ts (which lists
// it for recording), so both make the same text and so the same audio id. No runtime imports: the phone loads it too.
import type { Lesson, Screen } from "./course-types";
import type { LessonScreen } from "./lesson-play";

export interface Said {
  text: string;
  /** Spoken by the advisor, not the narrator. */
  advisor?: boolean;
}

/** The praise before the rule when a missed exercise comes back right (lesson-play.ts). */
export const GOT_IT = "There you go, you've got it now. Here's the rule to keep:";

/** A gap sentence as read aloud: each ___ is said as "blank". */
export const spokenGap = (text: string) => text.replaceAll("___", "blank");

/**
 * The lines read before the player answers: the teaching text or the question. Options are never read out (Atheeb,
 * 1 Nov 2026): players read them, and hearing them slowed every question down.
 * Scenarios are read by DecisionView (setup, question, advisor) and RevealView (outcome, then the why).
 */
export function askLines(s: Screen | LessonScreen): Said[] {
  switch (s.kind) {
    case "explain":
      return [{ text: s.text }];
    case "choice":
      return [{ text: s.prompt }];
    case "gap":
      return [{ text: spokenGap(s.text) }];
    case "order":
      return [{ text: s.prompt }];
    case "sort":
      // Shown one card at a time, and each card is read out (LessonPlayer's Sort).
      return [{ text: s.prompt }, ...s.items.map((i) => ({ text: typeof i === "string" ? i : i.text }))];
    case "scenario":
      return [{ text: s.setup }, { text: s.question }, ...(s.advisor ? [{ text: s.advisor, advisor: true }] : [])];
  }
}

/** The end card, read aloud: the rule, then each summary line. */
export const takeawayLines = (l: Pick<Lesson, "principle" | "summary">): Said[] => [
  { text: l.principle },
  ...l.summary.map((text) => ({ text })),
];
