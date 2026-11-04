# Wolf landing page and founding offer: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild `/` mobile first, with the wolf as the hero. Show the founding offer (₹99 a month locked, 500
seats) with a seat counter read from the database, and keep the first screen under about 150 KB.

**Architecture:**
- **Images:** the wolf's master pictures live in `content/brand/wolf/`. A script turns each one into AVIF and
  WebP at three widths in `public/brand/wolf/`. A `<WolfPicture>` component serves them through `<picture>`
  and `srcset`.
- **Seats:** a `founding_seats` table, server-only with RLS like every other table, holds one row per paid
  founder. The payments plan fills it; this plan only reads it, through a `Db.countFoundingSeats()` method and
  `GET /api/seats`.
- **Page:** a server component. The seat counter and the sample decision are two small client islands. The
  sample decision replays a real Kingfisher call through the existing `/api/play`, so no answers reach the
  browser.

**Tech stack:**
- Next.js App Router with React 19, Tailwind v4 and TypeScript.
- `sharp`, already a dependency, for the images.
- Supabase Postgres for the seats table.
- Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md`, sections 1–3. Payments (section 4),
the wolf inside the app (section 5) and his voice (section 6) get their own plans.

**Not in this plan:** taking money. Until the payments plan ships, the offer section says that you claim a
seat after Unit 1, and the counter shows the real count, which is 0. While the count is 0, it says "500 founding
seats at ₹99 a month" rather than "0 taken".

---

## File map

| File | What it does |
|---|---|
| `content/brand/wolf/*.webp` | Masters: `street`, `cafe`, `closeup` (1086×1448) and seven poses (512×512, transparent). |
| `scripts/brand-images.mjs` | Masters → `public/brand/wolf/<name>-<width>.{avif,webp}`. |
| `src/lib/brand.ts` | The image list (names, sizes, widths) and `srcSet()`. Pure; used by the component and the script. |
| `src/lib/brand.test.ts` | Tests for `srcSet()` and the image list. |
| `src/components/WolfPicture.tsx` | `<picture>` with AVIF and WebP sources, lazy unless it's the hero. |
| `src/lib/offer.ts` | Prices and seat numbers, and `seatsLine()`. |
| `src/lib/offer.test.ts` | Tests for `seatsLine()`. |
| `supabase/migrations/20261103090000_founding_seats.sql` | The table, its 1–500 check, RLS. |
| `src/lib/server/db.ts` | `countFoundingSeats()` on `Db`, `memoryDb()` and `supabaseDb()`. |
| `src/lib/server/seats.ts` | `seatStatus(db)`. |
| `src/lib/server/seats.test.ts` | Tests for `seatStatus()`. |
| `src/app/api/seats/route.ts` | `GET`: `{ taken, total, open }`, cached 15 s at the edge, rate limited per IP. |
| `src/components/site/SeatCounter.tsx` | Client: shows the count and polls every 20 s while the tab is visible. |
| `src/components/site/SampleCall.tsx` | Client: Kingfisher's first decision; a tap shows what happened. |
| `src/app/page.tsx` | The page, rewritten. |
| `CLAUDE.md` | The pricing line updated to the founding offer. |

---

### Task 1: Wolf masters and the image list

**Files:**
- Create: `content/brand/wolf/street.webp`, `cafe.webp`, `closeup.webp`
- Create: `content/brand/wolf/pose-pleased.webp`, `pose-thinking.webp`, `pose-warning.webp`, `pose-worried.webp`,
  `pose-celebrating.webp`, `pose-pointing.webp`, `pose-shocked.webp`
- Create: `src/lib/brand.ts`
- Test: `src/lib/brand.test.ts`

- [ ] **Step 0: Branch from an up-to-date main.** The spec and this plan are uncommitted in the working tree and
  come along. `scratch/` only holds review sheets: delete it rather than commit it.

```bash
git checkout main && git pull -q origin main && git checkout -b wolf-landing && rm -rf scratch
```

- [ ] **Step 1: Copy the masters in.** They come from the session scratchpad. A scratchpad that's gone means
  regrabbing them from the ChatGPT chat "Create Wolf Cafe Portrait".

```bash
S=/private/tmp/claude-501/-Users-atheebh-Desktop-CEO-for-a-day/4b2970d2-6971-413d-ba31-3325f6d27955/scratchpad/wolf/img
mkdir -p content/brand/wolf
cp $S/wolf_c.webp content/brand/wolf/street.webp
cp $S/wolf_a2.webp content/brand/wolf/cafe.webp
cp $S/wolf_b2.webp content/brand/wolf/closeup.webp
for p in pleased thinking warning worried celebrating pointing shocked; do cp $S/poses/$p.webp content/brand/wolf/pose-$p.webp; done
ls -la content/brand/wolf
```

Expected: 10 files.

- [ ] **Step 2: Write the failing test.**

```ts
// src/lib/brand.test.ts
import { describe, expect, it } from "vitest";
import { WOLF, srcSet } from "./brand";

describe("brand images", () => {
  it("lists every width of a picture for srcset", () => {
    expect(srcSet("street", "avif")).toBe(
      "/brand/wolf/street-400.avif 400w, /brand/wolf/street-800.avif 800w, /brand/wolf/street-1086.avif 1086w",
    );
  });
  it("gives poses small widths only", () => {
    expect(WOLF["pose-pleased"].widths).toEqual([128, 256, 512]);
  });
  it("never lists a width above the master", () => {
    for (const img of Object.values(WOLF)) expect(Math.max(...img.widths)).toBeLessThanOrEqual(img.width);
  });
});
```

- [ ] **Step 3: Run it and see it fail.**

Run: `npx vitest run src/lib/brand.test.ts`
Expected: FAIL, "Cannot find module './brand'".

- [ ] **Step 4: Write `src/lib/brand.ts`.**

```ts
// The wolf's pictures: masters in content/brand/wolf/, served from public/brand/wolf/ at a few widths each
// (npm run brand). Node runs this file too (scripts/brand-images.mjs), so it imports nothing.
export interface BrandImage {
  width: number;
  height: number;
  widths: number[];
  alt: string;
}

const portrait = (alt: string): BrandImage => ({ width: 1086, height: 1448, widths: [400, 800, 1086], alt });
const pose = (alt: string): BrandImage => ({ width: 512, height: 512, widths: [128, 256, 512], alt });

export const WOLF = {
  street: portrait("The wolf in a pinstripe suit under an umbrella on a rainy Mumbai street at night"),
  cafe: portrait("The wolf with a glass of cutting chai in an old Irani café on a rainy night"),
  closeup: portrait("The wolf leaning in with a sly grin"),
  "pose-pleased": pose("The wolf, pleased, raising his chai"),
  "pose-thinking": pose("The wolf, thinking, hand on his chin"),
  "pose-warning": pose("The wolf, warning, one finger raised"),
  "pose-worried": pose("The wolf, worried, loosening his tie"),
  "pose-celebrating": pose("The wolf, celebrating, fist raised"),
  "pose-pointing": pose("The wolf pointing at you"),
  "pose-shocked": pose("The wolf, shocked, spilling his chai"),
} satisfies Record<string, BrandImage>;

export type WolfName = keyof typeof WOLF;

export const srcSet = (name: WolfName, ext: "avif" | "webp") =>
  WOLF[name].widths.map((w) => `/brand/wolf/${name}-${w}.${ext} ${w}w`).join(", ");
```

- [ ] **Step 5: Run the test and see it pass.**

Run: `npx vitest run src/lib/brand.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit.**

```bash
git add content/brand/wolf src/lib/brand.ts src/lib/brand.test.ts
git commit -m "brand: the wolf's master pictures and image list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The resize script

**Files:**
- Create: `scripts/brand-images.mjs`
- Modify: `package.json`, adding `"brand": "node scripts/brand-images.mjs"` and running it in `predev` and
  `prebuild` after `sync-media`
- Modify: `.gitignore`, adding `/public/brand/`, since the outputs are built every time

- [ ] **Step 1: Write the script.**

```js
// Makes the wolf's served pictures from the masters in content/brand/wolf/:
// public/brand/wolf/<name>-<width>.avif and .webp for every width in src/lib/brand.ts.
// Runs before `next dev` and `next build`; skips files that are already newer than their master.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { WOLF } from "../src/lib/brand.ts";

const SRC = "content/brand/wolf";
const OUT = "public/brand/wolf";
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const [name, img] of Object.entries(WOLF)) {
  const master = join(SRC, `${name}.webp`);
  const at = statSync(master).mtimeMs;
  for (const w of img.widths) {
    for (const ext of ["avif", "webp"]) {
      const dest = join(OUT, `${name}-${w}.${ext}`);
      if (existsSync(dest) && statSync(dest).mtimeMs > at) continue;
      const s = sharp(master).resize({ width: w, withoutEnlargement: true });
      await (ext === "avif" ? s.avif({ quality: 50, effort: 4 }) : s.webp({ quality: 74 })).toFile(dest);
      made++;
    }
  }
}
console.log(`brand: ${made} image(s) made in ${OUT}`);
```

- [ ] **Step 2: Wire it into `package.json`.**

```json
"brand": "node scripts/brand-images.mjs",
"predev": "node scripts/sync-media.mjs && node scripts/brand-images.mjs",
"prebuild": "node scripts/sync-media.mjs && node scripts/brand-images.mjs",
```

- [ ] **Step 3: Run it and check the sizes.**

Run: `npm run brand && ls -la public/brand/wolf | head -20 && du -ch public/brand/wolf/street-400.* | tail -3`
Expected: 60 images made. `street-400.avif` under about 40 KB. Running it a second time prints "0 image(s) made".

- [ ] **Step 4: Check that Node can import the `.ts` file.** `content-files.ts` already works the same way.

Run: `node --version && npm run brand`
Expected: no "Unknown file extension" error. If there is one, rename the import to match how
`scripts/media.mjs` imports `../src/lib/content-files.ts` (it works today on Node 22+).

- [ ] **Step 5: Commit.**

```bash
git add scripts/brand-images.mjs package.json .gitignore
git commit -m "brand: build the wolf's pictures at three widths in AVIF and WebP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `<WolfPicture>`

**Files:**
- Create: `src/components/WolfPicture.tsx`

- [ ] **Step 1: Write the component.**

```tsx
import { WOLF, srcSet, type WolfName } from "@/lib/brand";

/**
 * One of the wolf's pictures at the right size for the screen: AVIF where the browser can, WebP otherwise.
 * `priority` is for the hero only: loaded at once and preloaded by the page. Everything else loads as it scrolls in.
 */
export function WolfPicture({
  name,
  sizes,
  priority = false,
  className = "",
  alt,
}: {
  name: WolfName;
  sizes: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  const img = WOLF[name];
  const mid = img.widths[Math.min(1, img.widths.length - 1)];
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, "webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- prebuilt local sizes, no optimiser needed */}
      <img
        src={`/brand/wolf/${name}-${mid}.webp`}
        width={img.width}
        height={img.height}
        alt={alt ?? img.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
```

- [ ] **Step 2: Type check.**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/components/WolfPicture.tsx
git commit -m "brand: WolfPicture serves the right size and format

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Offer numbers and the seat line

**Files:**
- Create: `src/lib/offer.ts`
- Test: `src/lib/offer.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/offer.test.ts
import { describe, expect, it } from "vitest";
import { FOUNDING, seatsLine } from "./offer";

describe("seatsLine", () => {
  it("names the offer while no seat is taken", () => {
    expect(seatsLine(0)).toBe("500 founding seats at ₹99 a month");
  });
  it("counts seats once some are taken", () => {
    expect(seatsLine(188)).toBe("188 of 500 founding seats taken");
  });
  it("says when the offer has closed", () => {
    expect(seatsLine(FOUNDING.seats)).toBe("All 500 founding seats are taken");
    expect(seatsLine(FOUNDING.seats + 3)).toBe("All 500 founding seats are taken");
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

Run: `npx vitest run src/lib/offer.test.ts`
Expected: FAIL, "Cannot find module './offer'".

- [ ] **Step 3: Write `src/lib/offer.ts`.**

```ts
// The founding offer and the regular prices (spec: docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md §3).
// Honest by rule: the regular price is shown as a future price, never struck through, and the seat count is real.
export const FOUNDING = { seats: 500, monthly: 99 } as const;
export const REGULAR = { monthly: 199, yearly: 1499 } as const;

const n = (x: number) => x.toLocaleString("en-IN");

export function seatsLine(taken: number): string {
  if (taken >= FOUNDING.seats) return `All ${n(FOUNDING.seats)} founding seats are taken`;
  if (taken <= 0) return `${n(FOUNDING.seats)} founding seats at ₹${FOUNDING.monthly} a month`;
  return `${n(taken)} of ${n(FOUNDING.seats)} founding seats taken`;
}
```

- [ ] **Step 4: Run the test and see it pass.**

Run: `npx vitest run src/lib/offer.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/offer.ts src/lib/offer.test.ts
git commit -m "offer: founding and regular prices, and the seat line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The seats table and `countFoundingSeats()`

**Files:**
- Create: `supabase/migrations/20261103090000_founding_seats.sql`
- Modify: `src/lib/server/db.ts`, adding the method to `Db`, `memoryDb()` and `supabaseDb()`
- Create: `src/lib/server/seats.ts`
- Test: `src/lib/server/seats.test.ts`

- [ ] **Step 1: Write the migration.**

```sql
-- Founding members: one row per player who paid for one of the 500 ₹99-a-month seats. The payments webhook adds
-- the row (next plan); the seat number is handed out under a lock so the 501st payment can't get one.
-- Only the server touches it (secret key): RLS on, no policies, no grants to the public roles.
create table public.founding_seats (
  seat_no integer primary key check (seat_no between 1 and 500),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  razorpay_subscription_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.founding_seats enable row level security;
revoke all on public.founding_seats from anon, authenticated;
```

- [ ] **Step 2: Apply it with the Supabase MCP, then check the advisors.**

Use `apply_migration` (project `vctghvtustlxjugpgvqz`, name `founding_seats`, the SQL above), then `get_advisors`
(type security). Expected: only the usual "RLS enabled, no policy" notice for `founding_seats`.

- [ ] **Step 3: Write the failing test.**

```ts
// src/lib/server/seats.test.ts
import { describe, expect, it } from "vitest";
import { memoryDb } from "./db";
import { seatStatus } from "./seats";

describe("seatStatus", () => {
  it("is open with no seats taken", async () => {
    expect(await seatStatus(memoryDb())).toEqual({ taken: 0, total: 500, open: true });
  });
  it("closes at 500", async () => {
    const db = memoryDb();
    db.foundingSeats = 500;
    expect(await seatStatus(db)).toEqual({ taken: 500, total: 500, open: false });
  });
});
```

- [ ] **Step 4: Run it and see it fail.**

Run: `npx vitest run src/lib/server/seats.test.ts`
Expected: FAIL, "Cannot find module './seats'".

- [ ] **Step 5: Add the method to `Db`.** Put it after `deleteUser` in the interface:

```ts
  /** How many founding seats are taken (paid founding members). */
  countFoundingSeats(): Promise<number>;
```

- [ ] **Step 6: Add it to `memoryDb()`.**
  - Widen the return type to include `foundingSeats: number`.
  - Add a `foundingSeats: 0` field and this method:

```ts
    foundingSeats: 0,
    async countFoundingSeats() {
      return this.foundingSeats;
    },
```

- [ ] **Step 7: Add it to `supabaseDb()`.**

```ts
    async countFoundingSeats() {
      const { count, error } = await sb.from("founding_seats").select("seat_no", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
```

- [ ] **Step 8: Write `src/lib/server/seats.ts`.**

```ts
// How many of the 500 founding seats are taken, for the landing page and the paywall.
import { FOUNDING } from "../offer.ts";
import type { Db } from "./db.ts";

export async function seatStatus(db: Db) {
  const taken = await db.countFoundingSeats();
  return { taken, total: FOUNDING.seats, open: taken < FOUNDING.seats };
}
```

- [ ] **Step 9: Run the tests.**

Run: `npx vitest run src/lib/server/seats.test.ts && npm test`
Expected: seats 2 passed, and the whole suite green.

- [ ] **Step 10: Commit.**

```bash
git add supabase/migrations/20261103090000_founding_seats.sql src/lib/server/db.ts src/lib/server/seats.ts src/lib/server/seats.test.ts
git commit -m "offer: founding_seats table and a server count of taken seats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `GET /api/seats`

**Files:**
- Create: `src/app/api/seats/route.ts`

- [ ] **Step 1: Write the route.**

```ts
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
```

- [ ] **Step 2: Check it in dev.**

Run: `curl -s http://localhost:3001/api/seats`
Expected: `{"taken":0,"total":500,"open":true}`. This needs the Supabase variables in `.env.local`.

- [ ] **Step 3: Commit.**

```bash
git add src/app/api/seats/route.ts
git commit -m "offer: GET /api/seats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `<SeatCounter>`

**Files:**
- Create: `src/components/site/SeatCounter.tsx`

- [ ] **Step 1: Write it.**

```tsx
"use client";

import { useEffect, useState } from "react";
import { FOUNDING, seatsLine } from "@/lib/offer";

/** The real founding-seat count. Starts from the server's number and checks again every 20 s while the tab is open. */
export function SeatCounter({ initial }: { initial: number }) {
  const [taken, setTaken] = useState(initial);

  useEffect(() => {
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/seats");
        if (r.ok) setTaken((await r.json()).taken);
      } catch {
        /* offline: keep the last number */
      }
    };
    const t = setInterval(check, 20_000);
    return () => clearInterval(t);
  }, []);

  const pct = Math.min(100, (taken / FOUNDING.seats) * 100);
  return (
    <div>
      <p className="text-[18px] font-black" aria-live="polite">
        {seatsLine(taken)}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check, then commit.**

```bash
npx tsc --noEmit -p . && git add src/components/site/SeatCounter.tsx && git commit -m "offer: live seat counter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `<SampleCall>`

**Files:**
- Create: `src/components/site/SampleCall.tsx`

It plays Kingfisher's first decision through `/api/play`, the same server replay the game uses. The page
never holds an option's grade or outcome before the tap.

- [ ] **Step 1: Write it.**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlayView, Reveal, Screen } from "@/lib/play";

type Decision = Extract<Screen, { kind: "decision" }>;
const HOT_SEAT = "kingfisher-airlines";
const GRADE = { great: "Great call", ok: "Okay call", bad: "Costly call" } as const;

const post = async (picks: { nodeId: string; optionId: string }[]): Promise<PlayView> => {
  const r = await fetch("/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hotSeatId: HOT_SEAT, picks }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

/** One real decision from a free Hot Seat, playable on the website. */
export function SampleCall() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    post([])
      .then((v) => setDecision((v.screens.find((s) => s.kind === "decision") as Decision) ?? null))
      .catch(() => setDecision(null));
  }, []);

  if (!decision) return null; // the section's text still says what a Hot Seat is

  const pick = async (optionId: string) => {
    setBusy(true);
    try {
      setReveal((await post([{ nodeId: decision.id, optionId }])).reveal ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className="text-[15px] font-bold text-muted">{decision.year}</p>
      <p className="mt-1 text-[19px] leading-snug font-black">{decision.question}</p>
      {!reveal ? (
        <div className="mt-4 grid gap-2">
          {decision.options.map((o) => (
            <button key={o.id} type="button" className="tile" disabled={busy} onClick={() => pick(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[15px] font-bold text-muted">You chose: {reveal.label}</p>
          <p className="mt-2 text-[18px] font-black">{GRADE[reveal.grade]}</p>
          <p className="mt-1 text-[16px] leading-snug">{reveal.outcome}</p>
          <Link href="/app" className="btn3d green mt-5">
            Play the whole Hot Seat free
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check that no answers ship.**

Run: `npx tsc --noEmit -p . && npm run build && npm run check-bundle`
Expected: the type check and build pass, and check-bundle reports no `why` or `takeaway` text in `.next/static`.

- [ ] **Step 3: Commit.**

```bash
git add src/components/site/SampleCall.tsx
git commit -m "site: a real Hot Seat decision playable on the landing page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The copy deck

Write the page's words before the markup. Then put every line through ChatGPT's basic-English pass, then
slopmonster, the same way as the lessons: in the browser, on Atheeb's sign-in.

- [ ] **Step 1: Save this draft as `docs/superpowers/plans/2026-11-03-landing-copy.md`.**

```
HERO (street wolf)
h1: Learn business from real Indian stories
p:  Short lessons teach one rule at a time. Then you sit in the hot seat and make the real call.
button: Play free
small: Free to start. No card. Works in your phone's browser.

HOW IT WORKS  (pose-thinking, pose-pointing)
h2: One rule, then the real call
1 Learn: a 5-minute lesson, one rule, one true story.
2 Practise: flashcards that come back before you forget.
3 Take the hot seat: a real company's big decision. You choose. Then see what really happened.

TRY ONE  (SampleCall)
h2: Try one real call
p:  Kingfisher Airlines. Your first decision as the boss.

MEET YOUR MENTOR  (closeup + the seven poses)
h2: Meet your mentor
p:  He has seen every mistake a business can make. He warns you before you make one, and grins when you get it right.

FOUNDING MEMBERS  (cafe wolf, SeatCounter)
h2: Founding members pay ₹99 a month
p:  The first 500 members pay ₹99 a month for as long as they stay members. After that, the price is ₹199 a month.
- Every lesson and every Hot Seat
- New ones every month
- Cancel any time, in one tap
button: Play Unit 1 free
small: You can claim your seat when you finish Unit 1.

QUESTIONS
Is it free?            Unit 1 and the Kingfisher Hot Seat are free. Membership opens the rest.
What does ₹99 get me?  Every lesson, every Hot Seat, and every new one we add, for ₹99 a month while you stay a member.
Can I cancel?          Yes, any time, in one tap from your profile or from your UPI app. If you cancel, the ₹99 price ends.
Is it in Hindi?        English for now. Hindi, Tamil and Bengali are coming.
Are the stories true?  Yes, from public sources. Each Hot Seat lists them. One practice story is made up, and it says so.

FOOTER
CEO For A Day. Education, not business advice. Other outcomes are estimates.
Privacy · Terms
```

- [ ] **Step 2: Run the ChatGPT pass** with the same prompt as `scratchpad/m32/copy-prompt.txt`. Keep "₹99", "₹199",
  "500", "Kingfisher Airlines", "Hot Seat" and "Unit 1" exactly. Apply the edits by hand and keep a record of
  any you skip.
- [ ] **Step 3: Run slopmonster.**

Run: `python3 <scratchpad>/deslop.py docs/superpowers/plans/2026-11-03-landing-copy.md`
Expected: 5/5. Fix any finding that is real.

- [ ] **Step 4: Commit the final deck.**

```bash
git add docs/superpowers/plans/2026-11-03-landing-copy.md
git commit -m "site: landing page copy deck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rewrite `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`, the whole file

Rules from the spec and taste-skill:
- **First screen:** the hero picture fills most of it on a phone, with the `h1` and the button over a dark
  scrim at the bottom.
- **Hero loading:** the hero is the only `priority` image, preloaded with React 19's `preload()`.
- **Ornaments:** no eyebrows, gradients or icon cards.
- **Sections:** each has its own heading, and neighbouring sections have different layouts.
- **Hot Seat list:** show only published Hot Seats; drop the "Coming soon" wall and the Daily Call line.

- [ ] **Step 1: Replace the file.** Fill in the text from the final copy deck in Task 9; the structure is below.

```tsx
// The public website. A server component: the wolf's pictures are static files; the seat count is read here and
// kept fresh by <SeatCounter>; the sample decision plays through /api/play, so no Hot Seat answers reach the page.
import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { SampleCall } from "@/components/site/SampleCall";
import { SeatCounter } from "@/components/site/SeatCounter";
import { srcSet, type WolfName } from "@/lib/brand";
import { FOUNDING, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { seatStatus } from "@/lib/server/seats";

export const metadata: Metadata = {
  title: "CEO For A Day · Learn business from real Indian stories",
  description: "Short lessons, then real business decisions you make yourself. Free to start.",
};
export const revalidate = 60; // the seat count in the HTML is at most a minute old; the counter refreshes it

const POSES: WolfName[] = [
  "pose-pleased", "pose-thinking", "pose-warning", "pose-worried", "pose-celebrating", "pose-pointing", "pose-shocked",
];

async function seatsTaken() {
  try {
    return (await seatStatus(supabaseDb())).taken;
  } catch {
    return 0; // no database (CI build, local without keys): the line then names the offer instead of a count
  }
}

function PlayButton({ children = "Play free" }: { children?: React.ReactNode }) {
  return (
    <Link href="/app" className="btn3d green">
      {children}
    </Link>
  );
}

export default async function Home() {
  preload("/brand/wolf/street-800.avif", {
    as: "image",
    imageSrcSet: srcSet("street", "avif"),
    imageSizes: "(min-width: 768px) 50vw, 100vw",
    fetchPriority: "high",
  });
  const taken = await seatsTaken();

  return (
    <div className="min-h-dvh">
      <LegacyHashRedirect />
      <header className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6">
        <Logo size={36} />
        <span className="mr-auto text-[16px] font-black">CEO For A Day</span>
        <Link href="/app" className="btn3d green !w-auto !px-5 !py-2 !text-[14px]">Play</Link>
      </header>

      <main>
        {/* Hero: the wolf, big; the title and the one action over the bottom of the picture on a phone */}
        <section className="relative mx-auto max-w-[1100px] md:grid md:grid-cols-2 md:items-center md:gap-10 md:px-6 md:py-12">
          <div className="relative md:order-2">
            <WolfPicture name="street" priority sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[3/4] w-full object-cover md:rounded-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[rgb(0_0_0/0.6)] md:hidden" aria-hidden="true" />
          </div>
          <div className="absolute inset-x-0 bottom-0 px-4 pb-8 md:static md:px-0 md:pb-0">
            <h1 className="text-[36px] leading-[1.05] font-black text-balance md:text-[56px]">{/* deck: h1 */}</h1>
            <p className="mt-3 max-w-[36ch] text-[17px] leading-snug md:text-[19px]">{/* deck: p */}</p>
            <div className="mt-5 max-w-[360px]"><PlayButton /></div>
            <p className="mt-3 text-[14px] font-bold text-muted">{/* deck: small */}</p>
          </div>
        </section>

        {/* How it works: three steps down the page on a phone, a row on desktop, with the wolf pointing at step 3 */}
        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">{/* h2 + an <ol> of the three steps */}</section>

        {/* Try one: a full-width band, the sample decision on the right on desktop */}
        <section className="bg-surface/60 py-16">
          <div className="mx-auto grid max-w-[1100px] gap-6 px-4 sm:px-6 md:grid-cols-2">
            <div>{/* h2 + p */}</div>
            <SampleCall />
          </div>
        </section>

        {/* Meet your mentor: the close-up large, the poses in a row that scrolls sideways on a phone */}
        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
          {/* h2 + p, WolfPicture name="closeup" sizes="(min-width: 768px) 40vw, 90vw" */}
          <ul className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
            {POSES.map((p) => (
              <li key={p} className="w-28 shrink-0 snap-start">
                <WolfPicture name={p} sizes="112px" className="aspect-square w-full" />
              </li>
            ))}
          </ul>
        </section>

        {/* Founding members: the café wolf beside the offer and the live seat count */}
        <section id="founding" className="mx-auto grid max-w-[1100px] gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <WolfPicture name="cafe" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[3/4] w-full rounded-3xl object-cover" />
          <div>
            <h2 className="text-[30px] leading-tight font-black">{/* deck: h2, uses FOUNDING.monthly */}</h2>
            <p className="mt-3 text-[17px] leading-snug">{/* deck: p, uses FOUNDING.seats and REGULAR.monthly */}</p>
            <div className="mt-5"><SeatCounter initial={taken} /></div>
            <ul className="mt-5 grid gap-2 text-[17px] font-bold">{/* the three lines */}</ul>
            <div className="mt-6 max-w-[360px]"><PlayButton>{/* deck: button */}</PlayButton></div>
            <p className="mt-3 text-[14px] font-bold text-muted">{/* deck: small */}</p>
          </div>
        </section>

        {/* Questions: <details> so it works with no script */}
        <section className="mx-auto max-w-[760px] px-4 pb-20 sm:px-6">{/* h2 + five <details><summary> */}</section>
      </main>

      <footer className="bg-surface/60">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-8 text-[14px] font-bold text-muted sm:px-6">
          {/* deck: footer, with the Privacy and Terms links */}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Fill in every `{/* deck: … */}` comment** with the final copy. Write the numbers as
  `{FOUNDING.monthly}`, `{FOUNDING.seats}` and `{REGULAR.monthly}`, not as typed digits. Remove any comment whose
  content is in place.
- [ ] **Step 3: Check it builds and no answers ship.**

Run: `npm run lint && npx tsc --noEmit -p . && npm test && npm run build && npm run check-bundle`
Expected: all pass.

- [ ] **Step 4: Measure the first screen.**

Run (with `npm run start` on 3001):

```bash
curl -s -o /dev/null -w "html %{size_download}\n" --compressed http://localhost:3001/
ls -la public/brand/wolf/street-400.avif public/brand/wolf/street-800.avif
```

Expected: about 40 KB or less of compressed HTML, and `street-400.avif` plus fonts and JS under about 150 KB in
total. Check in the browser pane's network list at 390 px wide.

- [ ] **Step 5: Run taste-skill's gate.**

Run: `node <taste-skill>/scripts/inspect.mjs http://localhost:3001/` (screenshots at 1440, 768 and 390). Fix every
FAIL, look at every screenshot, and do up to three rounds of critique.

- [ ] **Step 6: Play it at phone size in the browser pane.** Check that:
  - the hero loads first;
  - the sample decision plays and shows its result;
  - the seat line reads "500 founding seats at ₹99 a month";
  - the FAQ opens;
  - Play goes to `/app`.

- [ ] **Step 7: Commit.**

```bash
git add src/app/page.tsx
git commit -m "site: new landing page with the wolf and the founding offer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docs, PR and CI

**Files:**
- Modify: `CLAUDE.md`, the "Pricing plan (not built)" line

- [ ] **Step 1: Update the pricing line in `CLAUDE.md`.**

```
- **Pricing (3 Nov 2026):** founding members, seats 1–500, pay ₹99/month, locked while subscribed; the seat
  count is real (`founding_seats`) and the offer closes at 500. Then ₹199/month or ₹1,499/year. No struck-through
  "was" prices, no fake viewer counts, no AutoPay free trials (CCPA dark-patterns guidelines, 2023). Payments
  (Razorpay Subscriptions) are the next plan. Spec: `docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md`.
```

- [ ] **Step 2: Commit, push and open a draft PR.**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md docs/superpowers/plans/2026-11-03-wolf-landing-page.md
git commit -m "docs: founding offer and the wolf landing page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin wolf-landing
gh pr create -R atheeb-gridd/CEO-for-a-day-web --draft --base main --head wolf-landing --title "New landing page: the wolf and the founding offer"
```

- [ ] **Step 3: Watch CI on both repos** (atheeb-gridd/CEO-for-a-day-web and Atheeb00158U/CEO-for-a-day) until
  both are green.

- [ ] **Step 4: Show Atheeb** the page at phone size and the PR link. Publishing means merging, and that needs
  his go-ahead.
