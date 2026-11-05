"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PaymentIssueRow } from "@/lib/server/db";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** The ids, as text that copies cleanly into Razorpay's search. */
function Ids({ p }: { p: PaymentIssueRow }) {
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-[13px] break-all">
      <dt className="text-muted">user</dt>
      <dd>{p.userId ?? "—"}</dd>
      <dt className="text-muted">subscription</dt>
      <dd>{p.subscriptionId}</dd>
      <dt className="text-muted">payment</dt>
      <dd>{p.paymentId ?? "—"}</dd>
    </dl>
  );
}

function Head({ p }: { p: PaymentIssueRow }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 text-[13px] font-black tracking-wide uppercase">
      <span className="text-gold">{p.kind}</span>
      <span className="text-muted">{when(p.createdAt)} IST</span>
    </div>
  );
}

export function PaymentIssues({ open, resolved }: { open: PaymentIssueRow[]; resolved: PaymentIssueRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string>();

  const resolve = async (id: number) => {
    setBusy(id);
    setError(undefined);
    const r = await fetch("/admin/payments/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, note: notes[id] ?? "" }),
    });
    if (!r.ok) setError((await r.json().catch(() => null))?.error ?? `Failed (${r.status})`);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {error && <p className="font-bold text-red">{error}</p>}
      {!open.length && <p className="font-bold text-muted">No open problems.</p>}
      {open.map((p) => (
        <div key={p.id} className="rounded-2xl border-2 border-line bg-surface p-4">
          <Head p={p} />
          {p.note && <p className="mt-2 font-bold whitespace-pre-wrap">{p.note}</p>}
          <Ids p={p} />
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={notes[p.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
              maxLength={500}
              placeholder="What you did (optional)"
              className="min-w-0 flex-1 rounded-xl border-2 border-line bg-surface-2 px-3 py-1.5 text-[14px] font-bold"
            />
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => resolve(p.id)}
              className="btn3d green !w-auto !px-3 !py-1.5 !text-[12px]"
            >
              Mark resolved
            </button>
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <h2 className="mt-6 text-[20px] font-black">Resolved lately</h2>
          <ul className="flex flex-col divide-y-2 divide-line">
            {resolved.map((p) => (
              <li key={p.id} className="py-3">
                <Head p={p} />
                {p.note && <p className="mt-1 text-[14px] font-bold text-muted">{p.note}</p>}
                <Ids p={p} />
                <p className="mt-1 text-[14px] font-bold">
                  Resolved {when(p.resolvedAt!)} IST{p.resolution && `: ${p.resolution}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
