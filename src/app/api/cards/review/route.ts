// Save a flashcard session: one write for the whole session. The server grades each tap against the content.
import { PlayError } from "@/lib/play";
import { cardLessons, cardsOf, courseOn } from "@/lib/server/content";
import { parseReviews, reviewCards } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "cards-review", async (db, userId) => {
    if (!courseOn()) throw new PlayError("no course yet");
    const reviews = parseReviews((await request.json().catch(() => null))?.reviews);
    const byCard = cardLessons();
    const lessons = [...new Set(reviews.map((r) => byCard.get(r.cardId)).filter((x): x is string => !!x))];
    const answers = Object.fromEntries(cardsOf(lessons).map((c) => [c.id, c.answer]));
    return reviewCards(db, userId, reviews, answers);
  });
