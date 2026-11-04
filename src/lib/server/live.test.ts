// realtimeLive: one REST call with every event on its player's private topic; failures are swallowed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { realtimeLive } from "./live";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("realtimeLive", () => {
  it("builds the broadcast body and headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    await realtimeLive([
      { userId: "u1", e: { event: "seen", payload: { chatId: 9, lastId: 4 } } },
      { userId: "u2", e: { event: "typing", payload: { chatId: 9, handle: "ravik" } } },
    ]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://p.supabase.co/realtime/v1/api/broadcast");
    expect(init.headers).toMatchObject({ apikey: "sb_secret_x", Authorization: "Bearer sb_secret_x" });
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [
        { topic: "user:u1", event: "seen", payload: { chatId: 9, lastId: 4 }, private: true },
        { topic: "user:u2", event: "typing", payload: { chatId: 9, handle: "ravik" }, private: true },
      ],
    });
  });

  it("never throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "k");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    await expect(realtimeLive([{ userId: "u", e: { event: "seen", payload: { chatId: 1, lastId: 1 } } }])).resolves.toBeUndefined();
  });
});
