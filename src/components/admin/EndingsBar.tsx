import { TIER_COLOR, TIER_LABEL } from "./tiers";

/** A stacked bar of how many playthroughs reach each ending tier. */
export function EndingsBar({ endings, total }: { endings: Record<string, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {Object.entries(endings).map(([tier, n]) => (
          <span key={tier} style={{ width: `${(n / total) * 100}%`, background: TIER_COLOR[tier] }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold text-muted">
        {Object.entries(endings).map(([tier, n]) => (
          <span key={tier} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: TIER_COLOR[tier] }} />
            {TIER_LABEL[tier] ?? tier} {n}
          </span>
        ))}
      </p>
    </div>
  );
}
