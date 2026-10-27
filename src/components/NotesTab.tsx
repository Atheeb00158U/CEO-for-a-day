"use client";

import { HOT_SEATS } from "@/content/catalog";
import { useGame } from "@/lib/store";
import { Card, Icon, MediaView } from "./ui";

const GRADE_COLOR = { great: "var(--color-green)", ok: "var(--color-gold)", bad: "var(--color-red)" } as const;

export function NotesTab({ onPlay }: { onPlay: () => void }) {
  const { s } = useGame();
  // Latest run per Hot Seat
  const latest = Object.values(Object.fromEntries([...s.runs].reverse().map((r) => [r.hotSeatId, r])));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-[28px] font-black">Revision notes</h1>
        <p className="font-bold text-muted">Every hot seat you finish leaves notes here, written for the calls you made.</p>
      </div>
      {latest.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Icon.navNotes className="size-12 text-muted" />
          <p className="text-[18px] font-black">No notes yet</p>
          <p className="max-w-[28ch] font-bold text-muted">Finish your first hot seat and your key takeaways land here.</p>
          <button type="button" className="btn3d mt-2 max-w-[260px]" onClick={onPlay}>
            Take a hot seat
          </button>
        </Card>
      )}
      {latest.map((r) => {
        const hs = HOT_SEATS[r.hotSeatId];
        return (
          <Card key={r.hotSeatId} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <MediaView media={hs.cover} className="size-16 shrink-0 !rounded-2xl" kenBurns={false} label={false} />
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[.12em] text-blue">
                  {hs.company} · score {r.score}
                </p>
                <h2 className="text-[19px] font-black leading-tight">{hs.title}</h2>
                <p className="text-[13px] font-bold text-muted">
                  {new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] font-bold leading-snug marker:text-blue">
              {r.patterns.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              {r.notes.map((n) => (
                <div key={n.year} className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: GRADE_COLOR[n.grade] }}>
                    {n.year} · {n.title}
                  </p>
                  <p className="mt-1 text-[15px] font-bold leading-snug">{n.takeaway}</p>
                  {n.better && <p className="mt-1 text-[13px] font-bold text-muted">Next time: {n.better}</p>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
