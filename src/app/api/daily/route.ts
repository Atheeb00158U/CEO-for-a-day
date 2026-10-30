// Today's Daily Call (IST), without its answers.
import { NextResponse } from "next/server";
import { today } from "@/lib/game-state";
import { questionOf, todaysCall } from "@/lib/server/content";

export async function GET() {
  const day = today();
  const call = todaysCall(day);
  return NextResponse.json({ day, call: call ? questionOf(call) : null }, { headers: { "Cache-Control": "no-store" } });
}
