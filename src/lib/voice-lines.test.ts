import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hotSeatIds, readDailyPool, readHotSeat } from "./content-files";
import { voiceLines } from "./voice-lines";

describe("voice lines", () => {
  it("match the committed voice-lines.json, so every recording keeps its id", () => {
    const committed = JSON.parse(readFileSync(new URL("../../voice-lines.json", import.meta.url), "utf8"));
    expect(voiceLines(hotSeatIds().map(readHotSeat), readDailyPool().calls)).toEqual(committed);
  });
});
