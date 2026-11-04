import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutSignatureOk, razorpay, webhookSignatureOk } from "./razorpay";

const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

describe("checkout signature", () => {
  it("accepts HMAC(payment_id|subscription_id) with the key secret", () => {
    const sig = hmac("ks", "pay_1|sub_1");
    expect(checkoutSignatureOk({ paymentId: "pay_1", subscriptionId: "sub_1", signature: sig }, "ks")).toBe(true);
  });
  it("rejects a wrong or malformed signature", () => {
    expect(checkoutSignatureOk({ paymentId: "pay_1", subscriptionId: "sub_1", signature: "00" }, "ks")).toBe(false);
    expect(checkoutSignatureOk({ paymentId: "pay_1", subscriptionId: "sub_2", signature: hmac("ks", "pay_1|sub_1") }, "ks")).toBe(false);
    expect(checkoutSignatureOk({ paymentId: "pay_1", subscriptionId: "sub_1", signature: hmac("other", "pay_1|sub_1") }, "ks")).toBe(false);
  });
});

describe("webhook signature", () => {
  it("accepts HMAC(raw body) with the webhook secret, and nothing else", () => {
    const body = '{"event":"subscription.charged"}';
    expect(webhookSignatureOk(body, hmac("ws", body), "ws")).toBe(true);
    expect(webhookSignatureOk(body + " ", hmac("ws", body), "ws")).toBe(false);
    expect(webhookSignatureOk(body, null, "ws")).toBe(false);
    expect(webhookSignatureOk(body, hmac("ws", body), "")).toBe(false);
  });
});

describe("razorpay client", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(reply: unknown, status = 200) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(reply), { status });
    });
    return calls;
  }

  it("refuses to start without keys", () => {
    expect(() => razorpay("", "")).toThrow(/keys/);
  });

  it("creates a subscription with the documented body", async () => {
    const calls = stubFetch({ id: "sub_9", status: "created" });
    const sub = await razorpay("rzp_test_x", "s").createSubscription("plan_1", 120, { userId: "u1" });
    expect(sub).toEqual({ id: "sub_9", status: "created" });
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      plan_id: "plan_1",
      total_count: 120,
      customer_notify: true,
      notes: { userId: "u1" },
    });
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Basic " + Buffer.from("rzp_test_x:s").toString("base64"));
  });

  it("cancels at the cycle end with a boolean flag", async () => {
    const calls = stubFetch({ id: "sub_9", status: "active", current_end: 1_800_000_000 });
    const out = await razorpay("k", "s").cancelSubscription("sub_9", true);
    expect(out).toMatchObject({ status: "active", current_end: 1_800_000_000 });
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/subscriptions/sub_9/cancel");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ cancel_at_cycle_end: true });
  });

  it("throws Razorpay's error description on a failed call", async () => {
    stubFetch({ error: { description: "bad plan" } }, 400);
    await expect(razorpay("k", "s").createSubscription("plan_x", 1, {})).rejects.toThrow(/400: bad plan/);
  });
});
