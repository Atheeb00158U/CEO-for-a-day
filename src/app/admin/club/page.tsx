// The Club's moderation queue: open reports, soonest due first (red when late), and what was done in the last 30 days.
import Link from "next/link";
import { ClubQueue } from "@/components/admin/ClubQueue";
import { queue } from "@/lib/server/club";
import { supabaseDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function ClubAdmin() {
  const { open, done } = await queue(supabaseDb());
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
        ← Hot Seats
      </Link>
      <h1 className="mt-3 text-[28px] font-black">Club reports</h1>
      <p className="font-bold text-muted">
        Private pictures and pretending to be someone: 2 hours. Everything else: 36 hours. Every action closes all open reports on the same
        post or profile.
      </p>
      <ClubQueue open={open} done={done} now={Date.now()} />
    </main>
  );
}
