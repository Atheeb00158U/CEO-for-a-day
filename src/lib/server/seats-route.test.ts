// /api/seats tells the paywall whether founding seats are left, and never how many are taken.
import { describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({ db: undefined as unknown as import("./db").Db }));
vi.mock("./db", async (importOriginal) => ({ ...(await importOriginal<typeof import("./db")>()), supabaseDb: () => shared.db }));

import { memoryDb } from "./db";
import { resetSeatCache } from "./seats";
import { GET } from "../../app/api/seats/route";

describe("GET /api/seats", () => {
  it("sends only whether seats are open, with no count", async () => {
    const db = memoryDb();
    db.foundingSeats = 188;
    shared.db = db;
    resetSeatCache();
    const r = await GET(new Request("http://x/api/seats", { headers: { "x-forwarded-for": "3.3.3.3" } }));
    expect(await r.json()).toEqual({ open: true });
  });
});
