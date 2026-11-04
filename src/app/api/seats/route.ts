// Whether founding seats are left, for the paywall sheet. Public and cacheable. Only `open` is sent: players never
// see how many seats are taken.
import { NextResponse } from "next/server";
import { supabaseDb, type Db } from "@/lib/server/db";
import { ipOf, limited } from "@/lib/server/http";
import { cachedSeatStatus } from "@/lib/server/seats";

let db: Db | undefined;

export async function GET(request: Request) {
  if (limited(`seats:${ipOf(request)}`, 60)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    db ??= supabaseDb();
    const { open } = await cachedSeatStatus(db);
    return NextResponse.json({ open }, { headers: { "Cache-Control": "public, max-age=10" } });
  } catch {
    return NextResponse.json({ error: "Seat status unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
