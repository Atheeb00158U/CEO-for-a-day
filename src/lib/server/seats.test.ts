import { beforeEach, describe, expect, it } from "vitest";
import { memoryDb, type Db } from "./db";
import { cachedSeatStatus, resetSeatCache, seatStatus } from "./seats";

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

describe("cachedSeatStatus", () => {
  beforeEach(resetSeatCache);

  it("does not hit the db again within 15 s", async () => {
    const db = memoryDb();
    db.foundingSeats = 10;
    expect((await cachedSeatStatus(db, 1_000)).taken).toBe(10);
    db.foundingSeats = 20;
    expect((await cachedSeatStatus(db, 15_000)).taken).toBe(10);
  });
  it("reads again after 15 s", async () => {
    const db = memoryDb();
    db.foundingSeats = 10;
    await cachedSeatStatus(db, 1_000);
    db.foundingSeats = 20;
    expect((await cachedSeatStatus(db, 16_001)).taken).toBe(20);
  });
  it("returns the old value when the db fails after a good read", async () => {
    const db = memoryDb();
    db.foundingSeats = 10;
    await cachedSeatStatus(db, 1_000);
    const broken = { countFoundingSeats: () => Promise.reject(new Error("down")) } as unknown as Db;
    expect((await cachedSeatStatus(broken, 20_000)).taken).toBe(10);
  });
  it("rethrows when there is no old value", async () => {
    const broken = { countFoundingSeats: () => Promise.reject(new Error("down")) } as unknown as Db;
    await expect(cachedSeatStatus(broken, 1_000)).rejects.toThrow("down");
  });
});
