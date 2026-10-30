// The course: units → modules → one-rule lessons, with Hot Seats as the gates that test them.
// Content lives in content/course/ (course.json + lessons/<id>.json) and is read only on the server.
// The phone gets the outline (no screens) and, during play, answer-free screens from /api/lesson.
import type { Grade, Media } from "./hotseat-types";

export interface Course {
  units: Unit[];
}

export interface Unit {
  id: string;
  title: string;
  /** One plain line: what the player can do after the unit. */
  goal: string;
  modules: Module[];
  draft?: boolean;
}

export interface Module {
  id: string;
  title: string;
  goal: string;
  /** Lesson ids in path order. */
  lessons: string[];
  /** Hot Seats that close this module, in order. Empty when the unit's Practice node closes it. */
  gates: string[];
}

export interface Option {
  id: string;
  label: string;
}

export interface ScenarioOption extends Option {
  grade: Grade;
  outcome: string;
  why: string;
  better?: string;
}

export type Screen =
  | { kind: "explain"; id: string; title?: string; text: string; media?: Media }
  | {
      kind: "choice";
      id: string;
      prompt: string;
      media?: Media;
      options: Option[];
      answer: string;
      why: string;
      /** A line for each wrong option, shown when it is picked. */
      wrong?: Record<string, string>;
      /** A "guess first" screen: no wrong answers, not scored, not repeated. */
      guess?: boolean;
    }
  | { kind: "gap"; id: string; text: string; bank: string[]; answer: string[]; why: string }
  | { kind: "order"; id: string; prompt: string; steps: string[]; why: string }
  | { kind: "sort"; id: string; prompt: string; buckets: string[]; items: { text: string; bucket: number }[]; why: string }
  | {
      kind: "scenario";
      id: string;
      year?: string;
      media?: Media;
      setup: string;
      question: string;
      advisor?: string;
      options: ScenarioOption[];
    };

export type ExerciseKind = Exclude<Screen["kind"], "explain">;

/** A flashcard: a small situation and 2–3 tap answers. Its id is the review schedule's key, so it never changes. */
export interface Card {
  id: string;
  front: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  back: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** The rule, in 12 words or fewer. It becomes the takeaway card. */
  principle: string;
  minutes: number;
  draft?: boolean;
  screens: Screen[];
  /** One line per key idea, shown in Notes. */
  summary: string[];
  cards: Card[];
  sources?: { label: string; url: string }[];
}

/** What the phone may hold about the course: titles and ids, never screens or answers. */
export interface CourseOutline {
  units: {
    id: string;
    title: string;
    goal: string;
    modules: {
      id: string;
      title: string;
      goal: string;
      lessons: { id: string; title: string; principle: string; minutes: number; exercises: number }[];
      gates: string[];
    }[];
  }[];
}
