// The founding-seat count for the landing page. Public and cacheable: it's one number everyone may see.
import { NextResponse } from "next/server";
import { supabaseDb, type Db } from "@/lib/server/db";
import { ipOf, limited } from "@/lib/server/http";
import { cachedSeatStatus } from "@/lib/server/seats";

let db: Db | undefined;

export async function GET(request: Request) {
  if (limited(`seats:${ipOf(request)}`, 60)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    db ??= supabaseDb();
    const status = await cachedSeatStatus(db);
    return NextResponse.json(status, { headers: { "Cache-Control": "public, max-age=10" } });
  } catch {
    return NextResponse.json({ error: "Seat count unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
