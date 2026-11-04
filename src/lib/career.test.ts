import { describe, expect, it } from "vitest";
import { careerOf, careerSpoken, TITLES } from "./career";
import type { CourseOutline } from "./course-types";

const lesson = (id: string) => ({ id, title: id, principle: "", minutes: 3, exercises: 4 });
const mod = (id: string, lessons: string[], gates: string[] = []) => ({ id, title: id, goal: "", lessons: lessons.map(lesson), gates });
const outline: CourseOutline = {
  units: [
    { id: "u1", title: "U1", goal: "", modules: [mod("m1", ["a", "b"], ["hs1"]), mod("m2", ["c"], ["hs2"])] },
    { id: "u2", title: "U2", goal: "", modules: [mod("m3", ["d"]), mod("m4", ["e"]), mod("m5", ["f"], ["hs3"])] },
    { id: "u3", title: "U3", goal: "", modules: [mod("m6", ["g"], ["hs4", "hs5"])] },
  ],
};
const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));
const career = (lessons: string[], gates: string[] = [], course = outline) =>
  careerOf({ lessons: done(...lessons), best: done(...gates) }, course);

describe("the career ladder", () => {
  it("has ten titles, Street Seller to CEO", () => {
    expect(TITLES).toHaveLength(10);
    expect(TITLES[0]).toBe("Street Seller");
    expect(TITLES[2]).toBe("Trader");
    expect(TITLES[9]).toBe("CEO");
  });

  it("starts a new player as a Street Seller with no stars", () => {
    expect(career([])).toEqual({ rank: 1, title: "Street Seller", stars: 0, maxStars: 2 });
  });

  it("needs the lessons and the Hot Seat gate for a star", () => {
    expect(career(["a", "b"]).stars).toBe(0);
    expect(career(["a"], ["hs1"]).stars).toBe(0);
    expect(career(["a", "b"], ["hs1"]).stars).toBe(1);
  });

  it("counts a gate played to any ending, even fired (score 0)", () => {
    expect(careerOf({ lessons: { a: 100, b: 100 }, best: { hs1: 0 } }, outline).stars).toBe(1);
  });

  it("counts a passed test-out, because it marks the module's lessons done", () => {
    // m2 skipped by a test-out (its lessons are in `lessons`) and its gate played, before m1 is finished.
    expect(career(["c"], ["hs2"])).toEqual({ rank: 1, title: "Street Seller", stars: 1, maxStars: 2 });
  });

  it("moves to the next title with no stars once every module of the unit is finished", () => {
    expect(career(["a", "b", "c"], ["hs1", "hs2"])).toEqual({ rank: 2, title: "Shopkeeper", stars: 0, maxStars: 3 });
  });

  it("finishes a module with no gates on its lessons alone", () => {
    expect(career(["a", "b", "c", "d", "e"], ["hs1", "hs2"])).toEqual({ rank: 2, title: "Shopkeeper", stars: 2, maxStars: 3 });
  });

  it("takes the title from the first unfinished module, even when later units have stars", () => {
    expect(career(["a", "b", "g"], ["hs1", "hs4", "hs5"]).rank).toBe(1);
  });

  it("needs every gate of a module with several", () => {
    const all = ["a", "b", "c", "d", "e", "f", "g"];
    expect(career(all, ["hs1", "hs2", "hs3", "hs4"])).toEqual({ rank: 3, title: "Trader", stars: 0, maxStars: 1 });
  });

  it("stays on the last unit's title with full stars when the whole course is finished", () => {
    const all = ["a", "b", "c", "d", "e", "f", "g"];
    expect(career(all, ["hs1", "hs2", "hs3", "hs4", "hs5"])).toEqual({ rank: 3, title: "Trader", stars: 1, maxStars: 1 });
  });

  it("shows CEO with full stars after finishing a tenth unit", () => {
    const ten: CourseOutline = { units: TITLES.map((_, i) => ({ id: `u${i}`, title: "", goal: "", modules: [mod(`m${i}`, [`l${i}`])] })) };
    expect(
      career(
        TITLES.map((_, i) => `l${i}`),
        [],
        ten,
      ),
    ).toEqual({ rank: 10, title: "CEO", stars: 1, maxStars: 1 });
    expect(
      career(
        TITLES.slice(0, 9).map((_, i) => `l${i}`),
        [],
        ten,
      ),
    ).toEqual({ rank: 10, title: "CEO", stars: 0, maxStars: 1 });
  });

  it("ignores lessons and Hot Seats that aren't in the course", () => {
    expect(career(["zzz"], ["nope"])).toEqual({ rank: 1, title: "Street Seller", stars: 0, maxStars: 2 });
  });

  it("is a Street Seller with no stars when there is no course", () => {
    expect(career([], [], { units: [] })).toEqual({ rank: 1, title: "Street Seller", stars: 0, maxStars: 0 });
  });

  it("reads the title and stars out in words", () => {
    expect(careerSpoken({ rank: 3, title: "Trader", stars: 2, maxStars: 3 })).toBe("Trader, 2 of 3 stars");
  });
});
