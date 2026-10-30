// Finish a lesson or a test-out quiz. The server replays the answers, so accuracy can't be forged; the play key pays once.
import { parseAnswers } from "@/lib/lesson-play";
import { PlayError } from "@/lib/play";
import { lessonOf } from "@/lib/server/content";
import { finishLesson } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";
import { notifyOvertaken } from "@/lib/server/reminders";

export const POST = (request: Request) =>
  signedIn(
    request,
    "lesson-finish",
    async (db, userId) => {
      const body = await request.json().catch(() => null);
      const found = lessonOf(body);
      if (!found) throw new PlayError("no such lesson");
      const r = await finishLesson(db, userId, found.lesson, {
        playKey: String(body.playKey ?? ""),
        answers: parseAnswers(body.answers),
        testOut: found.testOut,
      });
      if (r.gained) void notifyOvertaken(db, userId, r.state.league.weeklyXp - r.gained).catch(() => {});
      return r;
    },
    20,
  );
