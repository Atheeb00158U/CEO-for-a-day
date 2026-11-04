import { describe, expect, it } from "vitest";
import { FOUNDING, FOUNDING_LINE, foundingPrice, REGULAR } from "./offer";

describe("the founding offer's wording", () => {
  it("names the 1,000 founding seats, without a count of seats taken", () => {
    expect(FOUNDING.seats).toBe(1000);
    expect(FOUNDING_LINE).toBe("Founding price, only for the first 1,000 members.");
  });
  it("strikes the real regular price next to ₹99", () => {
    expect(foundingPrice).toEqual({ was: "₹199", now: "₹99 a month", label: "was ₹199, now ₹99 a month" });
    expect(REGULAR.monthly).toBeGreaterThan(FOUNDING.monthly);
  });
});
