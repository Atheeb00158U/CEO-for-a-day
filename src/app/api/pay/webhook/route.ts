// Razorpay's webhook. Not signed in: the HMAC of the raw body is the proof. Each event is handled once; a failure
// answers 500 so Razorpay retries. The payload is never logged or echoed.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseDb } from "@/lib/server/db";
import { handleWebhook, payEnv } from "@/lib/server/membership";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_000_000;
const reply = (status: number) => NextResponse.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return reply(413);
  // The raw text first: the signature is over these exact bytes.
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) return reply(413);
  // Razorpay sends an event id with every delivery; only a missing header falls back to the body's hash.
  const header = request.headers.get("x-razorpay-event-id");
  if (header !== null && (!header.trim() || header.length > 200)) return reply(400);
  const eventId = header?.trim() || createHash("sha256").update(raw).digest("hex");
  try {
    const out = await handleWebhook(supabaseDb(), payEnv(), raw, request.headers.get("x-razorpay-signature"), eventId);
    return reply(out.ok ? 200 : out.status);
  } catch (e) {
    // No payload in the log: only that it failed and why. Razorpay retries on a 5xx.
    console.error("payments webhook failed:", e instanceof Error ? e.message : "unknown error");
    return reply(500);
  }
}
