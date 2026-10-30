// Lock in today's Daily Call and get the reveal. Only today's call can be answered.
import { NextResponse } from "next/server";
import { today } from "@/lib/game-state";
import { answerOf, todaysCall } from "@/lib/server/content";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const call = todaysCall(today());
  if (!call || body?.id !== call.id) return NextResponse.json({ error: "That call isn't open today" }, { status: 409 });
  const answer = typeof body.optionId === "string" ? answerOf(call, body.optionId) : undefined;
  if (!answer) return NextResponse.json({ error: "No such option" }, { status: 400 });
  return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
}
