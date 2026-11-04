// The website's sample (/api/play?site=1) reveals only Nirma's first decision; after that the paywall applies.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHotSeat } from "../content-files";
import { play, type Pick } from "../play";
import { POST as playRoute } from "../../app/api/play/route";

const nirma = readHotSeat("nirma-washing-powder");

/** The first `n` picks, always taking each decision's first option. */
function firstPicks(n: number): Pick[] {
  const picks: Pick[] = [];
  while (picks.length < n) {
    const d = play(nirma, picks).screens.at(-1)!;
    if (d.kind !== "decision") throw new Error("expected a decision");
    picks.push({ nodeId: d.id, optionId: d.options[0].id });
  }
  return picks;
}

let ip = 0;
const post = (picks: Pick[], site = true) =>
  playRoute(
    new Request(`http://x/api/play${site ? "?site=1" : ""}`, {
      method: "POST",
      body: JSON.stringify({ hotSeatId: nirma.id, picks }),
      headers: { "x-forwarded-for": `7.7.7.${++ip}` },
    }),
  );

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/play?site=1 with PAYWALL_ON=1", () => {
  it("lets a guest see Nirma's first decision and its verdict", async () => {
    vi.stubEnv("PAYWALL_ON", "1");
    expect((await post([])).status).toBe(200);
    expect((await post(firstPicks(1))).status).toBe(200);
  });

  it("refuses a second pick (402)", async () => {
    vi.stubEnv("PAYWALL_ON", "1");
    const r = await post(firstPicks(2));
    expect(r.status).toBe(402);
    expect(await r.json()).toEqual({ error: "members_only" });
  });

  it("refuses Nirma without ?site=1 (it is not free)", async () => {
    vi.stubEnv("PAYWALL_ON", "1");
    expect((await post([], false)).status).toBe(402);
  });

  it("plays on with the paywall off", async () => {
    vi.stubEnv("PAYWALL_ON", "");
    vi.stubEnv("PAYWALL_TESTERS", "");
    expect((await post(firstPicks(2))).status).toBe(200);
  });
});
