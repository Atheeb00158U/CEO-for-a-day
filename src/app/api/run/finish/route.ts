// Finish a Hot Seat. The server replays the picks, so the score can't be forged, and the run key pays once.
import { parsePicks, PlayError } from "@/lib/play";
import { servableHotSeat } from "@/lib/server/content";
import { finishRun } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(
    request,
    "finish",
    async (db, userId) => {
      const body = await request.json().catch(() => null);
      const hs = typeof body?.hotSeatId === "string" ? servableHotSeat(body.hotSeatId) : undefined;
      if (!hs) throw new PlayError("no such Hot Seat");
      return finishRun(db, userId, hs, {
        runKey: String(body.runKey ?? ""),
        picks: parsePicks(body.picks),
        hindsightUsed: body.hindsightUsed === true,
      });
    },
    20,
  );
