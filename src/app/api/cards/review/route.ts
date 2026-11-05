// Save a flashcard session: one write for the whole session. The server grades each tap against the content.
import { PlayError } from "@/lib/play";
import { cardLessons, cardsOf, courseOn } from "@/lib/server/content";
import { parseReviews, reviewCards } from "@/lib/server/game";
import { allowedLessonIds, signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "cards-review", async (db, userId) => {
    if (!courseOn()) throw new PlayError("no course yet");
    const reviews = parseReviews((await request.json().catch(() => null))?.reviews);
    const byCard = cardLessons();
    const named = [...new Set(reviews.map((r) => byCard.get(r.cardId)).filter((x): x is string => !!x))];
    // Only cards of lessons this player may study (free, finished, or a member's) earn review XP.
    const lessons = await allowedLessonIds(request, named);
    const answers = Object.fromEntries(cardsOf(lessons).map((c) => [c.id, c.answer]));
    return reviewCards(
      db,
      userId,
      reviews.filter((r) => r.cardId in answers),
      answers,
    );
  });
