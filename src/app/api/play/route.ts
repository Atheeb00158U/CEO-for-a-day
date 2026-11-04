// One step of a Hot Seat. The phone sends the picks so far and gets back only what it may see now.
import { NextResponse } from "next/server";
import { parsePicks, play, PlayError } from "@/lib/play";
import { servableHotSeat, writtenDebrief } from "@/lib/server/content";
import { accessCheck, ipOf, limited } from "@/lib/server/http";

/** The website's free sample: its first decision only. */
const SITE_SAMPLE = "nirma-washing-powder";

export async function POST(request: Request) {
  // The website's sample decision (?site=1) has its own, smaller budget, so it never uses up the game's.
  const site = new URL(request.url).searchParams.has("site");
  if (limited(`${site ? "site-play" : "play"}:${ipOf(request)}`, site ? 30 : 240))
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (Number(request.headers.get("content-length") ?? 0) > 64_000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const body = await request.json().catch(() => null);
  const hs = typeof body?.hotSeatId === "string" ? servableHotSeat(body.hotSeatId) : undefined;
  if (!hs) return NextResponse.json({ error: "No such Hot Seat" }, { status: 404 });
  let picks;
  try {
    picks = parsePicks(body.picks);
  } catch (e) {
    if (e instanceof PlayError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  // The sample shows only the first decision and its verdict; anything further is the paid Hot Seat.
  if (!(site && hs.id === SITE_SAMPLE && picks.length <= 1)) {
    const denied = await accessCheck(request, { kind: "hotseat", id: hs.id });
    if (denied) return denied;
  }
  try {
    const view = play(hs, picks);
    return NextResponse.json(view.result ? { ...view, written: writtenDebrief(hs.id, picks) } : view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof PlayError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
