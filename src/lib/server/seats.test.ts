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
