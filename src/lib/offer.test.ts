import { describe, expect, it } from "vitest";
import { FOUNDING, seatsLine } from "./offer";

describe("seatsLine", () => {
  it("names the offer while no seat is taken", () => {
    expect(seatsLine(0)).toBe("500 founding seats at ₹99 a month");
  });
  it("counts seats once some are taken", () => {
    expect(seatsLine(188)).toBe("188 of 500 founding seats taken");
  });
  it("says when the offer has closed", () => {
    expect(seatsLine(FOUNDING.seats)).toBe("All 500 founding seats are taken");
    expect(seatsLine(FOUNDING.seats + 3)).toBe("All 500 founding seats are taken");
  });
});
