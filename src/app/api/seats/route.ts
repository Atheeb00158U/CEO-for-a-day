// The founding-seat count for the landing page. Public and cacheable: it's one number everyone may see.
import { NextResponse } from "next/server";
import { supabaseDb } from "@/lib/server/db";
import { ipOf, limited } from "@/lib/server/http";
import { seatStatus } from "@/lib/server/seats";

export async function GET(request: Request) {
  if (limited(`seats:${ipOf(request)}`, 30)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const status = await seatStatus(supabaseDb());
  return NextResponse.json(status, { headers: { "Cache-Control": "public, max-age=10, s-maxage=15" } });
}
