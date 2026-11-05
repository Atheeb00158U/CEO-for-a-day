// Payment problems the server logged for a person (payment_issues): open ones first, newest first, and whether
// Razorpay's webhooks are still arriving.
import Link from "next/link";
import { PaymentIssues } from "@/components/admin/PaymentIssues";
import { supabaseDb } from "@/lib/server/db";
import { paymentsAdmin } from "@/lib/server/membership";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function PaymentsAdmin() {
  const { open, resolved, events } = await paymentsAdmin(supabaseDb(), new Date());
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
        ← Hot Seats
      </Link>
      <h1 className="mt-3 text-[28px] font-black">Payment problems</h1>
      <p className="font-bold text-muted">
        Payments the server couldn&apos;t match or confirm. Sort each one out on the Razorpay dashboard, then mark it resolved with a note
        of what you did.
      </p>
      <p className="mt-3 text-[14px] font-bold">
        Webhooks: {events.lastDay} in the last 24 hours · {events.lastWeek} in 7 days
        <span className="text-muted"> · last one {events.last ? when(events.last) : "never"}</span>
      </p>
      <PaymentIssues open={open} resolved={resolved} />
    </main>
  );
}
