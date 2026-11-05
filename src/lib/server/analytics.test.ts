import { afterEach, describe, expect, it, vi } from "vitest";
import { capture } from "./analytics";

describe("capture", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends nothing without a key", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    capture("user-1", "payment_verified", { plan: "founding" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the event with the user id and our fields only", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    capture("user-1", "payment_verified", { plan: "founding" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/i/v0/e/");
    expect(JSON.parse(init.body)).toEqual({
      api_key: "phc_test",
      event: "payment_verified",
      distinct_id: "user-1",
      properties: { plan: "founding", $lib: "server" },
    });
  });

  it("never throws when PostHog is down", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => capture("user-1", "subscription_charged")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // the rejection is caught, not unhandled
  });
});
