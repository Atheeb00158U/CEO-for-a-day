import { describe, expect, it } from "vitest";
import { WOLF, srcSet } from "./brand";

describe("brand images", () => {
  it("lists every width of a picture for srcset", () => {
    expect(srcSet("street", "avif")).toBe(
      "/brand/wolf/street-400.avif 400w, /brand/wolf/street-800.avif 800w, /brand/wolf/street-1086.avif 1086w",
    );
  });
  it("gives poses small widths only", () => {
    expect(WOLF["pose-pleased"].widths).toEqual([128, 256, 512]);
  });
  it("never lists a width above the master", () => {
    for (const img of Object.values(WOLF)) expect(Math.max(...img.widths)).toBeLessThanOrEqual(img.width);
  });
});
