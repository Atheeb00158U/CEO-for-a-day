"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reasonLabel } from "@/lib/community";
import type { ReportRow } from "@/lib/server/db";

type Row = ReportRow & { reporter: string; author: string; removals: number; imageUrl: string | null };

/** The reported picture (a signed link, good for an hour). */
const Pic = ({ url }: { url: string | null }) =>
  url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Reported picture" className="mt-2 max-h-64 rounded-xl border-2 border-line" />
  ) : null;

const BUTTONS: { action: string; label: string; cls: string; hideAll?: boolean }[] = [
  { action: "remove", label: "Remove", cls: "red" },
  { action: "keep", label: "Keep", cls: "green" },
  { action: "ban7", label: "Ban 7 days", cls: "ghost" },
  { action: "ban30", label: "Ban 30 days", cls: "ghost" },
  { action: "ban", label: "Ban for good", cls: "ghost" },
  { action: "ban", label: "Ban and hide everything", cls: "ghost", hideAll: true },
  { action: "lift", label: "Lift ban", cls: "ghost" },
];

const left = (due: string, now: number) => {
  const m = Math.round((Date.parse(due) - now) / 60000);
  if (m < 0) return `${Math.ceil(-m / 60)} h late`;
  return m < 120 ? `${m} min left` : `${Math.round(m / 60)} h left`;
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function ClubQueue({ open, done, now }: { open: Row[]; done: Row[]; now: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const act = async (reportId: number, action: string, hideAll?: boolean) => {
    if (action.startsWith("ban") && !confirm("Ban this player?")) return;
    setBusy(reportId);
    setError(undefined);
    const r = await fetch("/admin/club/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action, hideAll }),
    });
    if (!r.ok) setError((await r.json().catch(() => null))?.error ?? `Failed (${r.status})`);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {error && <p className="font-bold text-red">{error}</p>}
      {!open.length && <p className="font-bold text-muted">Nothing to look at.</p>}
      {open.map((r) => {
        const late = Date.parse(r.dueAt) < now;
        return (
          <div key={r.id} className={`rounded-2xl border-2 bg-surface p-4 ${late ? "border-red" : "border-line"}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 text-[13px] font-black tracking-wide uppercase">
              <span className={late ? "text-red" : "text-gold"}>{left(r.dueAt, now)}</span>
              <span>{reasonLabel(r.reason)}</span>
              <span className="text-muted">
                {r.targetKind} · by {r.reporter}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap font-bold">{r.snapshot}</p>
            <Pic url={r.imageUrl} />
            {r.note && <p className="mt-1 text-[14px] font-bold text-muted">Note: {r.note}</p>}
            <p className="mt-1 text-[13px] font-bold text-muted">
              Author: @{r.author} · {r.removals} past removals
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BUTTONS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  disabled={busy === r.id}
                  className={`btn3d ${b.cls} !w-auto !px-3 !py-1.5 !text-[12px]`}
                  onClick={() => void act(r.id, b.action, b.hideAll)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <h2 className="mt-6 text-[20px] font-black">Done in the last 30 days</h2>
      {!done.length && <p className="font-bold text-muted">Nothing yet.</p>}
      {done.map((r) => (
        <div key={r.id} className="rounded-2xl border-2 border-line p-3 text-[14px] font-bold">
          <span className={r.status === "removed" ? "text-red" : "text-green"}>{r.status}</span> · {reasonLabel(r.reason)} · @{r.author} ·{" "}
          {when(r.resolvedAt!)}
          <p className="mt-1 truncate text-muted">{r.snapshot}</p>
          <Pic url={r.imageUrl} />
        </div>
      ))}
    </div>
  );
}
