// Every Hot Seat (drafts included) with its hotseat:check result. Built at build time from content/hotseats.
import { join } from "node:path";
import Link from "next/link";
import { Badge } from "@/components/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { EndingsBar } from "@/components/admin/EndingsBar";
import { HOTSEATS_DIR, hotSeatIds, readHotSeat } from "@/lib/content-files";
import { AUDIO_DIR, checkHotSeat } from "@/lib/hotseat-check";

export default function AdminHome() {
  const seats = hotSeatIds().map((id) => ({ hs: readHotSeat(id), check: checkHotSeat(join(HOTSEATS_DIR, id), AUDIO_DIR) }));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <h1 className="text-[28px] font-black">Hot Seats</h1>
      <p className="font-bold text-muted">Open one to see every possible path as a tree.</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {seats.map(({ hs, check }) => (
          <li key={hs.id}>
            <Link
              href={`/admin/${hs.id}`}
              className="block rounded-xl focus-visible:ring-4 focus-visible:ring-blue/50 focus-visible:outline-none"
            >
              <Card className="h-full border-2 border-line transition-colors hover:border-blue/60">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-black tracking-[.12em] text-blue uppercase">
                      {hs.company} · {hs.years}
                    </span>
                    {hs.draft && <Badge variant="secondary">Draft</Badge>}
                    {check.errors.length > 0 && <Badge variant="destructive">{check.errors.length} errors</Badge>}
                    {check.warnings.length > 0 && <Badge variant="outline">{check.warnings.length} warnings</Badge>}
                  </div>
                  <CardTitle className="text-[20px] font-black">{hs.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {check.stats ? (
                    <>
                      <dl className="grid grid-cols-3 gap-2 text-center">
                        {[
                          ["Paths", check.stats.paths],
                          ["Calls", check.stats.calls],
                          ["Score", check.stats.scores.join("–")],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-surface-2 p-2">
                            <dt className="text-[11px] font-black tracking-wider text-muted uppercase">{label}</dt>
                            <dd className="text-[20px] font-black tabular-nums">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <EndingsBar endings={check.stats.endings} total={check.stats.paths} />
                    </>
                  ) : (
                    <p className="font-bold text-red">The tree can&apos;t be walked until the errors are fixed.</p>
                  )}
                  {(check.errors.length > 0 || check.warnings.length > 0) && (
                    <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-[13px] font-bold">
                      {check.errors.map((e) => (
                        <li key={e} className="text-red">
                          {e}
                        </li>
                      ))}
                      {check.warnings.map((w) => (
                        <li key={w} className="text-muted">
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
