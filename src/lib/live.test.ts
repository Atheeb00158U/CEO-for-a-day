// The phone's live channel: one private topic for the signed-in player, swapped when another player signs in.
import { afterEach, describe, expect, it, vi } from "vitest";

let user: string | null = "a";
let authChange: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
const opened: string[] = [];
const removed: string[] = [];
const fakeSb = {
  auth: {
    getSession: async () => ({ data: { session: user ? { user: { id: user } } : null } }),
    onAuthStateChange: (cb: typeof authChange) => (authChange = cb),
  },
  realtime: { setAuth: async () => {} },
  channel(name: string, opts: { config: { private: boolean } }) {
    expect(opts.config.private).toBe(true);
    opened.push(name);
    const ch = { name, on: () => ch, subscribe: () => ch };
    return ch;
  },
  removeChannel: async (ch: { name: string }) => void removed.push(ch.name),
};
vi.mock("./auth", () => ({ supabase: () => fakeSb }));
vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} });

const { onLive } = await import("./live");
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.unstubAllGlobals());

describe("onLive", () => {
  it("listens on the player's own topic and switches when another player signs in", async () => {
    const off = onLive(() => {});
    await settle();
    expect(opened).toEqual(["user:a"]);
    user = "b";
    authChange!("SIGNED_IN", { user: { id: "b" } });
    await settle();
    expect(removed).toEqual(["user:a"]);
    expect(opened).toEqual(["user:a", "user:b"]);
    authChange!("TOKEN_REFRESHED", { user: { id: "b" } }); // same player: the channel stays
    user = null;
    authChange!("SIGNED_OUT", null);
    await settle();
    expect(removed).toEqual(["user:a", "user:b"]);
    expect(opened).toHaveLength(2);
    off();
  });
});
