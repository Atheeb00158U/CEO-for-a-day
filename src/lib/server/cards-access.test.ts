// Earned flashcards (spec §4a): a lesson's cards are kept only for a lesson the server saw finished (lesson_plays) or
// one finished before the paywall (early_access). The phone's own save can't unlock them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  process.env.CFAD_COURSE_DIR = `${process.cwd()}/src/lib/__fixtures__/course`;
  return { db: undefined as unknown as import("./db").Db };
});
vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  supabaseDb: () => shared.db,
  // The bearer token is the user id: enough to stand in for Supabase's check of the token.
  supabaseAdmin: () => ({
    auth: { getClaims: async (token: string) => ({ data: { claims: { sub: token, email: "player@example.com" } }, error: null }) },
  }),
}));

import { newCard } from "../srs";
import { memoryDb } from "./db";
import { POST as cardsRoute } from "../../app/api/cards/route";
import { POST as reviewRoute } from "../../app/api/cards/review/route";
import { POST as importRoute } from "../../app/api/import/route";

const mem = memoryDb();
shared.db = mem;
const day = new Date().toISOString().slice(0, 10);
let n = 0;
/** A new player id each test, so the minute-long access cache never carries over. */
const user = () => `user-${++n}-${Date.now()}`;

const req = (path: string, userId: string, body: unknown) =>
  new Request(`http://x${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { authorization: `Bearer ${userId}`, "x-forwarded-for": `9.9.9.${n}` },
  });

async function cardsFor(userId: string) {
  const r = await cardsRoute(req("/api/cards", userId, { lessonIds: ["sample-margin", "sample-paid-next"] }));
  return [...new Set(((await r.json()).cards as { lessonId: string }[]).map((c) => c.lessonId))].sort();
}

/** A guest save that claims the paid lesson is finished and carries its card. */
const forge = (userId: string) =>
  importRoute(
    req("/api/import", userId, {
      save: { lessons: { "sample-paid-next": 100, "sample-margin": 100 }, cards: { "sample-paid-next-1": newCard(day) } },
    }),
  );

const review = async (userId: string) =>
  (await (await reviewRoute(req("/api/cards/review", userId, { reviews: [{ cardId: "sample-paid-next-1", pick: 0, ms: 2000 }] }))).json())
    .counted;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PAYWALL_ON", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("earned flashcards come from server records only", () => {
  it("an imported save claiming a paid lesson gets no cards for it, and its reviews don't count", async () => {
    const u = user();
    expect((await forge(u)).status).toBe(200);
    expect((await mem.getProfile(u))?.state.lessons).toHaveProperty("sample-paid-next");
    expect(await cardsFor(u)).toEqual(["sample-margin"]);
    expect(await review(u)).toBe(0);
  });

  it("a lesson the server saw finished (lesson_plays) keeps its cards and reviews", async () => {
    const u = user();
    await forge(u);
    await mem.insertLessonPlay({ userId: u, playKey: "play-1", lessonId: "sample-paid-next", answers: [], accuracy: 90, xp: 10 });
    expect(await cardsFor(u)).toEqual(["sample-margin", "sample-paid-next"]);
    expect(await review(u)).toBe(1);
  });

  it("a test-out play is not a finished lesson", async () => {
    const u = user();
    await mem.insertLessonPlay({ userId: u, playKey: "play-t", lessonId: "test-sample-ask", answers: [], accuracy: 100, xp: 0 });
    expect(await cardsFor(u)).toEqual(["sample-margin"]);
  });

  it("a lesson finished before the paywall (early access) keeps its cards", async () => {
    const u = user();
    mem.early.set(u, new Set(["lesson:sample-paid-next"]));
    expect(await cardsFor(u)).toEqual(["sample-margin", "sample-paid-next"]);
  });

  it("a member gets every lesson's cards", async () => {
    const u = user();
    await forge(u);
    const end = new Date(Date.now() + 30 * 864e5).toISOString();
    await mem.saveMembership({ userId: u, plan: "monthly", subscriptionId: `sub_${u}`, status: "active", currentEnd: end });
    expect(await cardsFor(u)).toEqual(["sample-margin", "sample-paid-next"]);
    expect(await review(u)).toBe(1);
  });
});

describe("memoryDb.finishedLessons", () => {
  it("lists a player's played lessons, without test-outs or other players", async () => {
    const db = memoryDb();
    await db.insertLessonPlay({ userId: "a", playKey: "k1", lessonId: "l1", answers: [], accuracy: 1, xp: 0 });
    await db.insertLessonPlay({ userId: "a", playKey: "k2", lessonId: "test-m1", answers: [], accuracy: 1, xp: 0 });
    await db.insertLessonPlay({ userId: "b", playKey: "k3", lessonId: "l2", answers: [], accuracy: 1, xp: 0 });
    expect([...(await db.finishedLessons("a"))]).toEqual(["l1"]);
  });
});
