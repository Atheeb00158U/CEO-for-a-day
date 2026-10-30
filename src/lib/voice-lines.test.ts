import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hotSeatIds, readDailyPool, readHotSeat } from "./content-files";
import { voiceLines } from "./voice-lines";
import { lineId } from "./voice";

describe("voice lines", () => {
  it("match the committed voice-lines.json, so every recording keeps its id", () => {
    const committed = JSON.parse(readFileSync(new URL("../../voice-lines.json", import.meta.url), "utf8"));
    expect(voiceLines(hotSeatIds().map(readHotSeat), readDailyPool().calls)).toEqual(committed);
  });

  it("get the same ids on the phone, which works them out instead of downloading the list", async () => {
    const lines = voiceLines(hotSeatIds().map(readHotSeat), readDailyPool().calls).slice(0, 50);
    for (const l of lines) expect(await lineId(l.voice, l.text)).toBe(l.id);
  });
});
