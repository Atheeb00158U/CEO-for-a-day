// Razorpay Subscriptions over REST (no SDK). Keys live only in Railway; nothing here reaches the browser.
// Docs (checked 4 Nov 2026):
//   create  POST /v1/subscriptions             https://razorpay.com/docs/api/payments/subscriptions/create-subscription/
//   cancel  POST /v1/subscriptions/:id/cancel  https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription/
//   checkout signature: hmac_sha256(razorpay_payment_id + "|" + subscription_id, key secret), with OUR subscription id
//   webhook signature: hmac_sha256(raw body, webhook secret) in X-Razorpay-Signature
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

function same(a: string, b: string) {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
const sign = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

/** Checkout's handler signature for a subscription. `subscriptionId` must be the one we stored, not the phone's. */
export const checkoutSignatureOk = (p: { paymentId: string; subscriptionId: string; signature: string }, keySecret: string) =>
  !!keySecret && !!p.signature && same(sign(keySecret, `${p.paymentId}|${p.subscriptionId}`), p.signature);

/** The webhook's X-Razorpay-Signature, checked on the raw body before any parsing. */
export const webhookSignatureOk = (rawBody: string, signature: string | null, webhookSecret: string) =>
  !!webhookSecret && !!signature && same(sign(webhookSecret, rawBody), signature);

export interface RazorpayClient {
  /** `expireBy` (unix seconds) is the last moment the customer can make the authorisation payment. */
  createSubscription(
    planId: string,
    totalCount: number,
    notes: Record<string, string>,
    expireBy?: number,
  ): Promise<{ id: string; status: string }>;
  /** `current_end` is unix seconds (null before the first charge). */
  cancelSubscription(id: string, atCycleEnd: boolean): Promise<{ status: string; current_end: number | null }>;
}

export function razorpay(keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET): RazorpayClient {
  if (!keyId || !keySecret) throw new Error("Razorpay keys are not set");
  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const call = async <T>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(API + path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Razorpay ${path} ${r.status}: ${data?.error?.description ?? "error"}`);
    return data as T;
  };
  return {
    // The docs type customer_notify and cancel_at_cycle_end as booleans.
    createSubscription: (planId, totalCount, notes, expireBy) =>
      call("/subscriptions", {
        plan_id: planId,
        total_count: totalCount,
        customer_notify: true,
        notes,
        ...(expireBy ? { expire_by: expireBy } : {}),
      }),
    cancelSubscription: (id, atCycleEnd) => call(`/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atCycleEnd }),
  };
}
