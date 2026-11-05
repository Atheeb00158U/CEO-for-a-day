// Bring a guest's progress into their new account, once. Every number is capped (see importGuest). The reply is the
// phone's first state after signing in, so it carries the membership, the paywall and Club flags like /api/state.
import { cardLessons, courseLessonIds } from "@/lib/server/content";
import { importGuest, membershipView } from "@/lib/server/game";
import { emailFrom, signedIn } from "@/lib/server/http";
import { clubOn, paywallFor } from "@/lib/server/membership";

export const POST = (request: Request) =>
  signedIn(
    request,
    "import",
    async (db, userId) => {
      const synced = await importGuest(db, userId, (await request.json().catch(() => null))?.save, new Date(), {
        lessons: courseLessonIds(),
        cardLesson: cardLessons(),
      });
      const email = await emailFrom(request);
      return { ...synced, membership: await membershipView(db, userId), paywall: paywallFor(email), club: clubOn(email) };
    },
    5,
  );
