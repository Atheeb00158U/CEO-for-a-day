// Runs `hotseat:check` on every Hot Seat in content/hotseats. Run: npm run validate
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { COURSE_DIR, DAILY_DIR, HOTSEATS_DIR, hotSeatIds } from "@/lib/content-files";
import { checkCourse } from "@/lib/course-check";
import { checkDailyPool, checkHotSeat, factcheckProblems, mediaCollisions } from "@/lib/hotseat-check";
import { createHash } from "node:crypto";
import { today } from "@/lib/game-state";

describe.each(hotSeatIds())("Hot Seat %s", (id) => {
  it("passes hotseat:check", () => {
    const r = checkHotSeat(join(HOTSEATS_DIR, id));
    if (r.stats)
      console.log(`${id}: ${r.stats.paths} possible playthroughs`, r.stats.endings, `CEO score range ${r.stats.scores.join("–")}`);
    expect(r.errors).toEqual([]);
  });
});

it("has no media names shared between Hot Seats", () => {
  expect(mediaCollisions([...hotSeatIds().map((id) => join(HOTSEATS_DIR, id)), DAILY_DIR, COURSE_DIR])).toEqual([]);
});

it("has a valid course", () => {
  expect(checkCourse(COURSE_DIR, hotSeatIds()).errors).toEqual([]);
});

describe("the course check catches broken lessons", () => {
  const tmp = mkdtempSync(join(tmpdir(), "course-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are deliberately broken JSON
  type Json = any;
  /** A copy of content/course in <tmp>/<name>, changed by `edit`. Returns the errors. */
  const fixture = (name: string, edit: (course: Json, lessons: Record<string, Json>) => void) => {
    const dir = join(tmp, name);
    cpSync(COURSE_DIR, dir, { recursive: true });
    const course = JSON.parse(readFileSync(join(dir, "course.json"), "utf8"));
    const lessons: Record<string, Json> = {};
    for (const id of ["sample-sales-not-profit", "sample-margin", "sample-fixed-variable"])
      lessons[id] = JSON.parse(readFileSync(join(dir, "lessons", `${id}.json`), "utf8"));
    edit(course, lessons);
    writeFileSync(join(dir, "course.json"), JSON.stringify(course));
    for (const [id, l] of Object.entries(lessons)) writeFileSync(join(dir, "lessons", `${id}.json`), JSON.stringify(l));
    return checkCourse(dir, hotSeatIds()).errors.join("\n");
  };

  it("rejects unknown keys and wrong answers", () => {
    const errors = fixture("answers", (_, l) => {
      l["sample-margin"].screens[2].answr = "b";
      l["sample-fixed-variable"].screens[3].answer = "z";
    });
    expect(errors).toMatch(/Unrecognized key: "answr"/);
    expect(errors).toMatch(/sample-fixed-variable\/slow: answer "z" is not one of its options/);
  });

  it("checks gaps, scenarios and cards", () => {
    const errors = fixture("kinds", (_, l) => {
      l["sample-fixed-variable"].screens[4].answer = ["fixed"];
      l["sample-sales-not-profit"].screens[6].options[1].better = undefined;
      l["sample-margin"].cards[1].id = "sample-margin-1";
    });
    expect(errors).toMatch(/2 blanks \(___\) but 1 answers/);
    expect(errors).toMatch(/mini\/b: an ok option needs "better"/);
    expect(errors).toMatch(/card id "sample-margin-1" is in both/);
  });

  it("checks the path: missing lessons, unknown gates, a Hot Seat in two modules", () => {
    const errors = fixture("path", (c) => {
      c.units[0].modules[1].lessons.push("nowhere");
      c.units[0].modules[1].gates = ["amul-one-brand", "not-a-hot-seat"];
    });
    expect(errors).toMatch(/Hot Seat "amul-one-brand" already closes another module/);
    expect(errors).toMatch(/gate "not-a-hot-seat" is not a Hot Seat/);
    expect(errors).not.toMatch(/nowhere/); // a draft unit only warns
    const published = fixture("published", (c) => {
      c.units[0].draft = false;
      c.units[0].modules[1].lessons.push("nowhere");
    });
    expect(published).toMatch(/lesson "nowhere" has no lessons\/nowhere.json/);
  });

  it("needs a hook first and 3 scored exercises", () => {
    const errors = fixture("shape", (_, l) => {
      const [, rule, sum, sort] = l["sample-margin"].screens;
      l["sample-margin"].screens = [sum, rule, sort];
    });
    expect(errors).toMatch(/sample-margin: the first screen must be "explain"/);
    expect(errors).toMatch(/needs at least 3 scored exercises/);
  });
});

it("has valid Daily Calls", () => {
  expect(checkDailyPool(DAILY_DIR, today()).errors).toEqual([]);
});

describe("hotseat:check catches broken Hot Seats", () => {
  const tmp = mkdtempSync(join(tmpdir(), "hotseat-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are deliberately broken JSON
  type Json = any;
  /** A copy of Kodak in <tmp>/<name>, changed by `edit`, optionally without its media. Returns the errors. */
  const fixture = (name: string, edit: (hs: Json) => void, withMedia = true) => {
    const dir = join(tmp, name);
    mkdirSync(dir);
    if (withMedia) cpSync(join(HOTSEATS_DIR, "kodak", "media"), join(dir, "media"), { recursive: true });
    const hs = { ...JSON.parse(readFileSync(join(HOTSEATS_DIR, "kodak", "hotseat.json"), "utf8")), id: name };
    edit(hs);
    writeFileSync(join(dir, "hotseat.json"), JSON.stringify(hs));
    return checkHotSeat(dir).errors.join("\n");
  };

  it("rejects unknown keys", () => {
    expect(fixture("typo", (hs) => (hs.nodes.d1.options[0].beter = "x"))).toMatch(/nodes\.d1\.options\.0: Unrecognized key: "beter"/);
  });

  it("rejects links to missing nodes and mismatched ids", () => {
    const errors = fixture("links", (hs) => {
      hs.nodes.d1.options[1].next = "nowhere";
      hs.nodes.lab.id = "lab2";
    });
    expect(errors).toMatch(/d1\/unit links to missing node "nowhere"/);
    expect(errors).toMatch(/nodes\.lab has id "lab2"/);
  });

  it("reports unreachable endings and missing media", () => {
    const errors = fixture("orphan", (hs) => (hs.nodes.orphan = { ...hs.nodes.legend, id: "orphan" }), false);
    expect(errors).toMatch(/ending "orphan" can't be reached/);
    expect(errors).toMatch(/media\/c2_prototype\.webp is missing/);
  });

  it("only warns about missing media for drafts", () => {
    expect(fixture("draft", (hs) => (hs.draft = true), false)).toBe("");
  });

  it("accepts the hotseat:new template as a valid draft", () => {
    const dir = join(tmp, "template-check");
    mkdirSync(dir);
    const template = readFileSync(new URL("../../content/templates/hotseat.json", import.meta.url), "utf8");
    writeFileSync(join(dir, "hotseat.json"), template.replaceAll("__ID__", "template-check"));
    const r = checkHotSeat(dir);
    expect(r.errors).toEqual([]);
    expect(Object.keys(r.stats!.endings).sort()).toEqual(["collapse", "fired", "legend", "survivor"]);
  });

  it("needs a real option only on decisions the real company faced", () => {
    // d2b is reachable only after the alternate "unit" call, so it may (and must) have no real option.
    const branch = (hs: Json, markReal: boolean) => {
      hs.nodes.d1.options[1].next = "d2b";
      hs.nodes.d2b = { ...hs.nodes.d2, id: "d2b", options: hs.nodes.d2.options.map((o: Json) => ({ ...o, real: markReal && o.real })) };
    };
    expect(fixture("alt-ok", (hs) => branch(hs, false))).not.toMatch(/d2b/);
    expect(fixture("alt-bad", (hs) => branch(hs, true))).toMatch(/d2b is only reachable on alternate paths/);
    expect(fixture("real-missing", (hs) => (hs.nodes.d2.options = hs.nodes.d2.options.map((o: Json) => ({ ...o, real: false }))))).toMatch(
      /d2 is on the real path, so it needs exactly one option marked real \(has 0\)/,
    );
  });

  it("leaves 'our estimate' to the app's badge, not the story text", () => {
    expect(fixture("estimate", (hs) => (hs.nodes.lab.text = "Our estimate: the lab closes."))).toMatch(/says "our estimate"/);
  });

  it("requires the folder name to match the id", () => {
    expect(fixture("folder", (hs) => (hs.id = "other"))).toMatch(/id "other" must match its folder "folder"/);
  });
});

describe("factcheck.md", () => {
  const tmp = mkdtempSync(join(tmpdir(), "factcheck-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const setup = (name: string, report?: (hash: string) => string) => {
    const dir = join(tmp, name);
    mkdirSync(dir);
    writeFileSync(join(dir, "hotseat.json"), '{"id":"x"}');
    const hash = createHash("sha256").update('{"id":"x"}').digest("hex");
    if (report) writeFileSync(join(dir, "factcheck.md"), report(hash));
    return factcheckProblems(dir, "hotseat.json").join("\n");
  };

  it("passes when the stamp matches and every claim is supported", () => {
    expect(setup("ok", (h) => `# Fact-check\nchecked-sha256: ${h}\n\n- [supported] A claim — [1]\n`)).toBe("");
  });

  it("needs a report", () => {
    expect(setup("none")).toMatch(/no factcheck.md yet/);
  });

  it("needs the stamp to match the current file", () => {
    expect(setup("stale", () => `checked-sha256: ${"0".repeat(64)}\n`)).toMatch(/different version of hotseat.json/);
  });

  it("refuses open claims", () => {
    expect(setup("open", (h) => `checked-sha256: ${h}\n- [unsupported] X\n- [contradicted] Y\n`)).toMatch(/2 unsupported or contradicted/);
  });
});

describe("Home order", () => {
  it("puts the trial first, then the player's focus, and keeps every entry", async () => {
    const { homeOrder } = await import("./catalog");
    const CATALOG = (await import("@/lib/server/content")).catalog();
    const order = homeOrder(CATALOG, "seed1", "change").map((c) => c.id);
    expect([...order].sort()).toEqual(CATALOG.map((c) => c.id).sort());
    const kodak = order.indexOf("kodak");
    expect(
      order
        .filter((id) => !["kingfisher-airlines", "kodak", "blockbuster", "netflix", "intel-quits-memory"].includes(id))
        .every((id) => order.indexOf(id) > kodak),
    ).toBe(true);
  });
});
