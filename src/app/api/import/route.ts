// Bring a guest's progress into their new account, once. Every number is capped (see importGuest).
import { cardLessons, courseLessonIds } from "@/lib/server/content";
import { importGuest } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(
    request,
    "import",
    async (db, userId) =>
      importGuest(db, userId, (await request.json().catch(() => null))?.save, new Date(), {
        lessons: courseLessonIds(),
        cardLesson: cardLessons(),
      }),
    5,
  );
