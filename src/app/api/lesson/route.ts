// One step of a lesson (or a module's test-out quiz). The phone sends the answers so far and gets back only what it
// may see now: the verdict on the last answer and the next screens.
import { NextResponse } from "next/server";
import { lessonPlay, parseAnswers } from "@/lib/lesson-play";
import { PlayError } from "@/lib/play";
import { lessonOf } from "@/lib/server/content";
import { ipOf, limited } from "@/lib/server/http";

export async function POST(request: Request) {
  if (limited(`lesson:${ipOf(request)}`, 300)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await request.json().catch(() => null);
  const found = lessonOf(body);
  if (!found) return NextResponse.json({ error: "No such lesson" }, { status: 404 });
  try {
    const view = lessonPlay(found.lesson, parseAnswers(body.answers), { retry: !found.testOut });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PlayError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
