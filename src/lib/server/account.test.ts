// Deleting an account cancels any live subscription first, at once; if Razorpay can't, nothing is deleted.
import { describe, expect, it } from "vitest";
import { CANT_CANCEL, deleteAccount } from "./account";
import { memoryDb, type MembershipRow } from "./db";
import { GameError } from "./game";
import type { RazorpayClient } from "./razorpay";

const U = "user-1";

function fakeRp(fail?: string) {
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
      throw new Error("not used");
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

  it("refuses when Razorpay's keys are missing but a subscription is live", async () => {
    const db = await withMembership("active");
    const rp = () => {
      throw new Error("Razorpay keys are not set");
    };
    await expect(deleteAccount(db, rp, U)).rejects.toBeInstanceOf(GameError);
    expect(await db.getProfile(U)).not.toBeNull();
  });
});
