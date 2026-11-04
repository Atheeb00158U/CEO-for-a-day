import { describe, expect, it } from "vitest";
import { autoFlag, canInteract, canPost, checkHandle, CLUB_COPY, POST_RANK, rankForYou, shownStreak, type GateInput } from "./community";

const now = new Date("2026-11-05T06:30:00Z");
const base: GateInput = { signedIn: true, joined: true, member: true, rank: POST_RANK, bannedUntil: null };

describe("the gate", () => {
  it.each<[string, Partial<GateInput>, string, string]>([
    ["guest", { signedIn: false }, "signin", "signin"],
    ["signed in, not joined", { joined: false }, "join", "join"],
    ["joined, free", { member: false }, "ok", "pay"],
    ["member below Trader", { rank: POST_RANK - 1 }, "ok", "rank"],
    ["member at Trader", {}, "ok", "ok"],
    ["banned for good", { bannedUntil: "infinity" }, "banned", "banned"],
    ["free and banned", { member: false, bannedUntil: "2026-11-06T00:00:00Z" }, "banned", "banned"],
  ])("%s", (_, p, interact, post) => {
    expect(canInteract({ ...base, ...p }, now)).toBe(interact);
    expect(canPost({ ...base, ...p }, now)).toBe(post);
  });

  it("lets a ban run out", () => {
    expect(canPost({ ...base, bannedUntil: "2026-11-05T06:30:01Z" }, now)).toBe("banned");
    expect(canPost({ ...base, bannedUntil: "2026-11-05T06:30:00Z" }, now)).toBe("ok");
  });
});

describe("handles", () => {
  it("lower-cases and checks length and characters", () => {
    expect(checkHandle("RaviK")).toEqual({ handle: "ravik" });
    expect(checkHandle("@ravi_k")).toEqual({ handle: "ravi_k" });
    expect(checkHandle("ab")).toEqual({ error: CLUB_COPY.badHandle });
    expect(checkHandle("a".repeat(16))).toEqual({ error: CLUB_COPY.badHandle });
    expect(checkHandle("ravi k")).toEqual({ error: CLUB_COPY.badHandle });
    expect(checkHandle(5)).toEqual({ error: CLUB_COPY.badHandle });
  });

  it.each(["wolf", "Admin", "ceoforaday", "support"])("keeps %s for us", (h) => {
    expect(checkHandle(h)).toEqual({ error: CLUB_COPY.handleTaken });
  });
});

describe("automatic flags", () => {
  it.each([
    "Call me on 9876543210",
    "+91 98765 43210",
    "98765-43210",
    "9.8.7.6.5.4.3.2.1.0",
    "nine eight seven six five four three two one zero",
    "mail me at ravi@gmail.com",
    "pay to ravi@okaxis",
    "UPI ravi.k@ybl",
  ])("refuses contact details: %s", (t) => {
    expect(autoFlag(t)).toEqual({ refuse: CLUB_COPY.noContacts });
  });

  it.each([
    "Invest ₹1000 and earn ₹500 daily",
    "Guaranteed returns every month",
    "Paisa double in 30 din",
    "10% monthly return, pakka",
    "Learn crypto with me",
    "Join my group for trading tips",
    "Whatsapp me for details",
    "Work from home, per day income ₹2000",
  ])("holds a money scheme: %s", (t) => {
    expect(autoFlag(t).hold).toBe("auto_scam");
  });

  it.each(["see https://bit.ly/x", "www.myshop.in", "visit myshop.com today"])("holds a link: %s", (t) => {
    expect(autoFlag(t)).toEqual({ hold: "auto_link" });
  });

  it.each([
    "I earned my first ₹500 profit today",
    "my shop is on the main road",
    "Sold 40 cups of chai, ₹10 each",
    "Bhai, aaj 3 naye customer aaye",
    "Someone told me money comes slowly at first",
    "I paid 12000 rent and 3500 for stock",
  ])("passes: %s", (t) => {
    expect(autoFlag(t)).toEqual({});
  });
});

describe("For you", () => {
  const post = (id: number, authorId: string, hoursAgo: number, likeCount = 0, replyCount = 0, kind = "post") => ({
    id,
    authorId,
    kind,
    likeCount,
    replyCount,
    createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
  });
  const ids = (xs: { id: number }[]) => xs.map((x) => x.id);
  const nobody = { follows: new Set<string>() };

  it("ranks talk above likes and new above old", () => {
    const r = rankForYou([post(1, "a", 1, 2), post(2, "b", 1, 0, 2), post(3, "c", 30, 5)], nobody, now);
    expect(ids(r)).toEqual([2, 1, 3]);
  });

  it("boosts people you follow and damps rank-ups", () => {
    expect(ids(rankForYou([post(1, "a", 1), post(2, "b", 1)], { follows: new Set(["a"]) }, now))[0]).toBe(1);
    expect(ids(rankForYou([post(1, "a", 1, 0, 0, "rank_up"), post(2, "b", 1.2)], nobody, now))[0]).toBe(2);
  });

  it("never shows one author twice in five in a row", () => {
    const r = rankForYou(
      [post(1, "a", 1, 9), post(2, "a", 1, 8), post(3, "b", 1), post(4, "c", 1), post(5, "d", 1), post(6, "e", 1)],
      nobody,
      now,
    );
    const authors = r.map((p) => p.authorId);
    for (let i = 0; i + 5 <= authors.length; i++) expect(new Set(authors.slice(i, i + 5)).size).toBe(5);
  });

  it("cuts posts older than a week or after asOf, and is stable for the same asOf", () => {
    const list = [post(1, "a", 24 * 8), post(2, "b", -1), post(3, "c", 2), post(4, "d", 2)];
    expect(ids(rankForYou(list, nobody, now))).toEqual([4, 3]);
    expect(ids(rankForYou([...list].reverse(), nobody, now))).toEqual([4, 3]);
  });
});

it("shows a streak only while it was kept today or yesterday", () => {
  expect(shownStreak(5, "2026-11-05", "2026-11-05")).toBe(5);
  expect(shownStreak(5, "2026-11-04", "2026-11-05")).toBe(5);
  expect(shownStreak(5, "2026-11-03", "2026-11-05")).toBe(0);
  expect(shownStreak(5, null, "2026-11-05")).toBe(0);
});
