// Send a notification by hand: to every player with reminders on, or to one player by email (handy for testing).
import Link from "next/link";
import { NotifyForm } from "@/components/admin/NotifyForm";

export const dynamic = "force-dynamic";

export default function Notify() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
        ← Hot Seats
      </Link>
      <h1 className="mt-3 text-[28px] font-black">Send a notification</h1>
      <p className="font-bold text-muted">
        It goes to phones that turned on reminders. Players get the daily streak reminder by themselves; use this for news, like a new Hot
        Seat.
      </p>
      <NotifyForm />
    </main>
  );
}
