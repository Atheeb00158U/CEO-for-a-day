// The Home path's rules: what is done, what is next and what is still locked. Pure, from the outline and the save.
import type { CourseOutline } from "./course-types";

export type NodeState = "done" | "current" | "open" | "locked";

export interface PathModule {
  id: string;
  title: string;
  goal: string;
  lessons: { id: string; title: string; minutes: number; state: NodeState; best?: number }[];
  /** Mixed flashcard practice of the module's lessons: open once one of them is done. */
  practice: { state: "open" | "locked"; lessonIds: string[] };
  gates: { id: string; state: NodeState }[];
  /** A confident player can skip the module's lessons with a short quiz. */
  canTestOut: boolean;
}

/**
 * Lessons unlock in order. A module's Hot Seat gates open when its lessons are done, and the next module opens when
 * they are all played (any score, even fired). A module whose lessons are all done is open too, so a passed test-out
 * skips ahead. `current` is the first thing to play on the whole path.
 */
export function coursePath(
  outline: CourseOutline,
  progress: { lessons: Record<string, number>; best: Record<string, number> },
): { units: { id: string; title: string; goal: string; modules: PathModule[] }[] } {
  let prevDone = true;
  let current = false;
  const mark = (available: boolean, done: boolean): NodeState => {
    if (done) return "done";
    if (!available) return "locked";
    if (current) return "open";
    current = true;
    return "current";
  };
  const units = outline.units.map((u) => ({
    id: u.id,
    title: u.title,
    goal: u.goal,
    modules: u.modules.map((m): PathModule => {
      const done = m.lessons.map((l) => progress.lessons[l.id] !== undefined);
      const allDone = done.every(Boolean);
      const open = prevDone || allDone;
      const lessons = m.lessons.map((l, i) => ({
        id: l.id,
        title: l.title,
        minutes: l.minutes,
        state: mark(open && done.slice(0, i).every(Boolean), done[i]),
        best: progress.lessons[l.id],
      }));
      const gates = m.gates.map((id) => ({ id, state: mark(open && allDone, progress.best[id] !== undefined) }));
      prevDone = open && allDone && gates.every((g) => g.state === "done");
      return {
        id: m.id,
        title: m.title,
        goal: m.goal,
        lessons,
        practice: {
          state: open && done.some(Boolean) ? "open" : "locked",
          lessonIds: m.lessons.filter((_, i) => done[i]).map((l) => l.id),
        },
        gates,
        canTestOut: !allDone,
      };
    }),
  }));
  return { units };
}
