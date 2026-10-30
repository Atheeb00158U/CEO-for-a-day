// Finish a Hot Seat. The server replays the picks, so the score can't be forged, and the run key pays once.
import { parsePicks, PlayError } from "@/lib/play";
import { servableHotSeat } from "@/lib/server/content";
import { finishRun } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";
import { notifyOvertaken } from "@/lib/server/reminders";

export const POST = (request: Request) =>
  signedIn(
    request,
    "finish",
    async (db, userId) => {
      const body = await request.json().catch(() => null);
      const hs = typeof body?.hotSeatId === "string" ? servableHotSeat(body.hotSeatId) : undefined;
      if (!hs) throw new PlayError("no such Hot Seat");
      const r = await finishRun(db, userId, hs, {
        runKey: String(body.runKey ?? ""),
        picks: parsePicks(body.picks),
        hindsightUsed: body.hindsightUsed === true,
      });
      // Tell anyone this player just passed in their league. In the background: the player isn't kept waiting.
      if (r.gained) void notifyOvertaken(db, userId, r.state.league.weeklyXp - r.gained).catch(() => {});
      return r;
    },
    20,
  );
