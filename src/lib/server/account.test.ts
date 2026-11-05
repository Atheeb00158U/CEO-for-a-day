// Deleting an account cancels any live subscription first, at once; if Razorpay can't, nothing is deleted.
import { describe, expect, it } from "vitest";
import { CANT_CANCEL, deleteAccount } from "./account";
import { memoryDb, type MembershipRow } from "./db";
import { GameError } from "./game";
import type { RazorpayClient } from "./razorpay";

const U = "user-1";

function fakeRp(fail?: string, remote = "active") {
  const cancelled: { id: string; atCycleEnd: boolean }[] = [];
  const rp: RazorpayClient = {
    async createSubscription() {
      throw new Error("not used");
    },
    async cancelSubscription(id, atCycleEnd) {
      if (fail) throw new Error(fail);
      cancelled.push({ id, atCycleEnd });
      return { status: "cancelled", current_end: null };
    },
    async fetchSubscription() {
      return { status: remote, current_end: null };
    },
  };
  return { rp: () => rp, cancelled };
}

async function withMembership(status: string) {
  const db = memoryDb();
  await db.createProfile(U, {} as never);
  const row: MembershipRow = { userId: U, plan: "monthly", subscriptionId: "sub_1", status, currentEnd: null };
  await db.saveMembership(row);
  return db;
}

describe("deleteAccount", () => {
  it("deletes an account with no membership without touching Razorpay", async () => {
    const db = memoryDb();
    await db.createProfile(U, {} as never);
    const rp = () => {
      throw new Error("Razorpay keys are not set");
    };
    expect(await deleteAccount(db, rp, U)).toEqual({ deleted: true });
    expect(await db.getProfile(U)).toBeNull();
  });

  it.each(["created", "authenticated", "active", "pending", "halted"])(
    "cancels a %s subscription at once, then deletes",
    async (status) => {
      const db = await withMembership(status);
      const { rp, cancelled } = fakeRp();
      await deleteAccount(db, rp, U);
      expect(cancelled).toEqual([{ id: "sub_1", atCycleEnd: false }]);
      expect(await db.getMembership(U)).toBeNull();
      expect(await db.getProfile(U)).toBeNull();
    },
  );

  it.each(["cancelled", "completed", "expired"])("skips Razorpay for a %s subscription", async (status) => {
    const db = await withMembership(status);
    const { rp, cancelled } = fakeRp("should not be called");
    await deleteAccount(db, rp, U);
    expect(cancelled).toEqual([]);
    expect(await db.getProfile(U)).toBeNull();
  });

  it.each(["expired", "cancelled", "completed"])("skips the cancel when Razorpay says the subscription is %s", async (remote) => {
    const db = await withMembership("created");
    const { rp, cancelled } = fakeRp("should not be called", remote);
    await deleteAccount(db, rp, U);
    expect(cancelled).toEqual([]);
    expect(await db.getProfile(U)).toBeNull();
  });

  it("treats Razorpay's 'already cancelled' as done", async () => {
    const db = await withMembership("active");
    const { rp } = fakeRp("Razorpay /subscriptions/sub_1/cancel 400: Subscription is not cancellable in cancelled status.");
    await deleteAccount(db, rp, U);
    expect(await db.getProfile(U)).toBeNull();
  });

  it("refuses to delete when Razorpay errors, keeping everything", async () => {
    const db = await withMembership("active");
    const { rp } = fakeRp("Razorpay /subscriptions/sub_1/cancel 502: error");
    await expect(deleteAccount(db, rp, U)).rejects.toThrow(new GameError(CANT_CANCEL));
    expect(await db.getProfile(U)).not.toBeNull();
    expect((await db.getMembership(U))?.status).toBe("active");
  });

  it("removes every Club row of the player; a report they made keeps its snapshot", async () => {
    const db = memoryDb();
    await db.createProfile(U, {} as never);
    const at = new Date().toISOString();
    const profile = { name: "N", building: "", rank: 1, stars: 0, maxStars: 0, streak: 0, streakDay: null, milestones: true };
    const times = { adultAt: at, rulesAt: at, hiddenAt: null, createdAt: at };
    await db.insertClubProfile({ userId: U, handle: "me1", ...profile, ...times });
    await db.insertClubProfile({ userId: "other", handle: "other", ...profile, ...times });
    const post = (await db.insertPost({
      authorId: "other",
      kind: "post",
      ref: null,
      parentId: null,
      body: "hi",
      held: null,
      hiddenAt: null,
      createdAt: at,
    }))!;
    await db.insertPost({
      authorId: U,
      kind: "reply",
      ref: null,
      parentId: post.id,
      body: "yo",
      held: null,
      hiddenAt: null,
      createdAt: at,
    });
    await db.setLike(post.id, U, true);
    await db.setFollow(U, "other", true);
    await db.setBlock("other", U, true);
    await db.addActivity({ userId: "other", kind: "like", actorId: U, postId: post.id, createdAt: at });
    await db.insertReport({
      reporterId: U,
      targetKind: "post",
      targetId: String(post.id),
      targetUser: "other",
      reason: "spam",
      note: "",
      snapshot: "hi",
      dueAt: at,
      createdAt: at,
    });
    await db.setClubBan(U, "infinity", "mod");
    await deleteAccount(db, () => fakeRp().rp(), U);
    const c = db.club;
    expect(JSON.stringify([[...c.profiles.values()], c.posts, c.likes, c.follows, c.blocks, c.activity, [...c.bans.keys()]])).not.toContain(
      U,
    );
    expect(c.reports[0]).toMatchObject({ reporterId: null, snapshot: "hi" });
    expect((await db.getPost(post.id))?.replyCount).toBe(0);
  });

  it("refuses when Razorpay's keys are missing but a subscription is live", async () => {
    const db = await withMembership("active");
    const rp = () => {
      throw new Error("Razorpay keys are not set");
    };
    await expect(deleteAccount(db, rp, U)).rejects.toBeInstanceOf(GameError);
    expect(await db.getProfile(U)).not.toBeNull();
  });
});
