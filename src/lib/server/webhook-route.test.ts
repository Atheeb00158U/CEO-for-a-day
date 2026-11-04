// The webhook route: raw body, signature, size cap and event ids, with the real handler on an in-memory database.
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryDb, type Db } from "./db";

const shared = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("./db", async (importOriginal) => ({ ...(await importOriginal<typeof import("./db")>()), supabaseDb: () => shared.db }));

import { POST } from "../../app/api/pay/webhook/route";

const SECRET = "test-webhook-secret";
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

const charged = (current_end = 1_800_000_000) =>
  JSON.stringify({
    event: "subscription.charged",
    payload: { subscription: { entity: { entity: "subscription", id: "sub_1", status: "active", current_end } } },
  });

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(new Request("http://x/api/pay/webhook", { method: "POST", body, headers: { "content-type": "application/json", ...headers } }));

let mem: ReturnType<typeof memoryDb>;
beforeEach(async () => {
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", SECRET);
  mem = memoryDb();
  shared.db = mem;
  await mem.saveMembership({ userId: "u1", plan: "monthly", subscriptionId: "sub_1", status: "authenticated", currentEnd: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/pay/webhook", () => {
  it("applies a signed event and answers only { ok: true }", async () => {
    const body = charged();
    const r = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_1" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await mem.getMembership("u1")).toMatchObject({ status: "active", currentEnd: new Date(1_800_000_000_000).toISOString() });
    expect(await mem.insertPaymentEvent("evt_1")).toBe(false); // recorded as handled
  });

  it("falls back to the body's hash only when the event id header is missing", async () => {
    const body = charged();
    expect((await post(body, { "x-razorpay-signature": sign(body) })).status).toBe(200);
    const hash = (await import("node:crypto")).createHash("sha256").update(body).digest("hex");
    expect(await mem.insertPaymentEvent(hash)).toBe(false);
    expect((await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": " " })).status).toBe(400);
  });

  it("refuses a bad or missing signature, and a body signed with another secret, changing nothing", async () => {
    const body = charged();
    expect((await post(body, { "x-razorpay-signature": "nope", "x-razorpay-event-id": "e" })).status).toBe(400);
    expect((await post(body, { "x-razorpay-event-id": "e" })).status).toBe(400);
    expect((await post(body, { "x-razorpay-signature": sign(body, "other"), "x-razorpay-event-id": "e" })).status).toBe(400);
    // The signature covers the exact bytes: re-spacing the JSON breaks it.
    expect((await post(body.replace(":", ": "), { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "e" })).status).toBe(400);
    expect((await mem.getMembership("u1"))?.status).toBe("authenticated");
  });

  it("refuses everything when no webhook secret is set", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    const body = charged();
    expect((await post(body, { "x-razorpay-signature": sign(body, ""), "x-razorpay-event-id": "e" })).status).toBe(400);
  });

  it("refuses bodies over 1 MB, by header and by actual size", async () => {
    const big = "x".repeat(1_000_001);
    expect((await post("{}", { "content-length": "2000000" })).status).toBe(413);
    expect((await post(big, { "x-razorpay-signature": sign(big), "x-razorpay-event-id": "e" })).status).toBe(413);
    // No Content-Length (chunked): the cap still holds while reading.
    const chunked = new Request("http://x/api/pay/webhook", {
      method: "POST",
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(big.slice(0, 600_000)));
          c.enqueue(new TextEncoder().encode(big.slice(600_000)));
          c.close();
        },
      }),
      duplex: "half",
      headers: { "x-razorpay-signature": sign(big), "x-razorpay-event-id": "e" },
    } as RequestInit);
    expect((await POST(chunked)).status).toBe(413);
  });

  it("answers 500 when handling fails, so Razorpay retries", async () => {
    mem.saveMembership = async () => {
      throw new Error("database down");
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = charged();
    const r = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_2" });
    expect(r.status).toBe(500);
    expect(await mem.insertPaymentEvent("evt_2")).toBe(true); // not marked handled
    expect(JSON.stringify(err.mock.calls)).not.toContain("sub_1");
    err.mockRestore();
  });
});
