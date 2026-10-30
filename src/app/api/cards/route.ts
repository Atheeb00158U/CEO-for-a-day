// The flashcards of the lessons named. Card answers are study material (shown after each tap), not secrets.
import { NextResponse } from "next/server";
import { cardsOf, courseOn } from "@/lib/server/content";
import { ipOf, limited } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!courseOn()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (limited(`cards:${ipOf(request)}`, 60)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.lessonIds) ? body.lessonIds.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  return NextResponse.json({ cards: cardsOf(ids) }, { headers: { "Cache-Control": "no-store" } });
}
