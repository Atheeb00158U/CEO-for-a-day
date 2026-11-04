// /api/club/*: 401 without a token, 404 while the Club is off for the player, 403 { can } when the gate refuses.
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDb } from "./db";

const mem = memoryDb();
vi.mock("./db", async (orig) => ({
  ...(await orig<typeof import("./db")>()),
  supabaseDb: () => mem,
  supabaseAdmin: () => ({
    auth: {
      getClaims: async (token: string) =>
        token === "good"
          ? { data: { claims: { sub: "u-1", email: "tester@example.com" } }, error: null }
          : { data: null, error: new Error("bad") },
    },
  }),
}));

const { GET, POST } = await import("../../app/api/club/[...path]/route");
const { clubOn } = await import("./membership");
const { GRIEVANCE } = await import("../legal");

let ip = 0;
const call = (method: "GET" | "POST", path: string[], token?: string, body?: unknown) =>
  (method === "GET" ? GET : POST)(
    new Request(`http://x/api/club/${path.join("/")}`, {
      method,
      headers: { "x-forwarded-for": `9.9.9.${++ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { params: Promise.resolve({ path }) },
  );

afterEach(() => vi.unstubAllEnvs());

describe("/api/club/*", () => {
  it("is 401 without a token", async () => {
    vi.stubEnv("PAYWALL_TESTERS", "tester@example.com");
    expect((await call("GET", ["me"])).status).toBe(401);
  });

  it("is 404 while the Club is off for the player", async () => {
    vi.stubEnv("PAYWALL_TESTERS", "");
    vi.stubEnv("COMMUNITY_ON", "1"); // still off: no Grievance Officer named yet
    expect((await call("GET", ["me"], "good")).status).toBe(404);
  });

  it("answers testers, and a gate refusal is 403 with `can`", async () => {
    vi.stubEnv("PAYWALL_TESTERS", "tester@example.com");
    const me = await call("GET", ["me"], "good");
    expect(me.status).toBe(200);
    expect((await me.json()).can).toEqual({ post: "join", interact: "join" });
    const r = await call("POST", ["post"], "good", { body: "hello" });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "club", can: "join" });
    expect((await call("GET", ["nope"], "good")).status).toBe(404);
  });
});

describe("clubOn", () => {
  it("stays off for everyone but testers until the Grievance Officer is named", () => {
    vi.stubEnv("PAYWALL_TESTERS", "t@x.in");
    vi.stubEnv("COMMUNITY_ON", "1");
    expect(GRIEVANCE.name).toBe("TODO");
    expect(clubOn("t@x.in")).toBe(true);
    expect(clubOn("someone@x.in")).toBe(false);
    expect(clubOn(undefined)).toBe(false);
  });
});
