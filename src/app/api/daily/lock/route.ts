// Lock in today's Daily Call and get the reveal. Only today's call can be answered. Signed in, the server also
// saves the pick (one a day, kept by the database key) and returns the new progress.
import { today } from "@/lib/game-state";
import { answerOf, todaysCall } from "@/lib/server/content";
import { lockDaily } from "@/lib/server/game";
import { ipOf, json, limited, signedIn } from "@/lib/server/http";
import { notifyOvertaken } from "@/lib/server/reminders";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const call = todaysCall(today());
  if (!call || body?.id !== call.id) return json({ error: "That call isn't open today" }, 409);
  const answer = typeof body.optionId === "string" ? answerOf(call, body.optionId) : undefined;
  if (!answer) return json({ error: "No such option" }, 400);
  if (!request.headers.has("authorization"))
    return limited(`daily:${ipOf(request)}`, 30) ? json({ error: "Too many requests" }, 429) : json(answer);
  return signedIn(
    request,
    "daily",
    async (db, userId) => {
      const { gained, ...synced } = await lockDaily(db, userId, call, answer.option);
      if (gained) void notifyOvertaken(db, userId, synced.state.league.weeklyXp - gained).catch(() => {});
      // A second lock today keeps the first answer: reveal that one.
      const first = synced.state.daily?.optionId === answer.option.id ? answer : answerOf(call, synced.state.daily?.optionId ?? "");
      return { ...first, synced };
    },
    20,
  );
}
