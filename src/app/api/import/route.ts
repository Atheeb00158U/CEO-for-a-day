// Bring a guest's progress into their new account, once. Every number is capped (see importGuest). The reply is the
// phone's first state after signing in, so it carries the membership and the paywall flag like /api/state.
import { cardLessons, courseLessonIds } from "@/lib/server/content";
import { importGuest, membershipView } from "@/lib/server/game";
import { emailFrom, signedIn } from "@/lib/server/http";
import { paywallFor } from "@/lib/server/membership";

export const POST = (request: Request) =>
  signedIn(
    request,
    "import",
    async (db, userId) => {
      const synced = await importGuest(db, userId, (await request.json().catch(() => null))?.save, new Date(), {
        lessons: courseLessonIds(),
        cardLesson: cardLessons(),
      });
      return { ...synced, membership: await membershipView(db, userId), paywall: paywallFor(await emailFrom(request)) };
    },
    5,
  );
