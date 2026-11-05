// Product analytics events that only the server knows are true (a verified payment, a Razorpay webhook), sent to
// PostHog's capture API with the player's Supabase user id. Off without NEXT_PUBLIC_POSTHOG_KEY. Never sends personal
// data or payment details: the event name and a few of our own fields (plan, status).

type Props = Record<string, string | number | boolean | null>;

/** Fire and forget: analytics never slows or fails a payment. */
export function capture(userId: string, event: string, properties: Props = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  void fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, event, distinct_id: userId, properties: { ...properties, $lib: "server" } }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
