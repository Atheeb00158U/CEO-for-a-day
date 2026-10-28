// Runs `hotseat:check` on every Hot Seat in content/hotseats. Run: npm run validate
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DAILY_DIR, HOTSEATS_DIR, hotSeatIds } from "@/lib/content-files";
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
  expect(mediaCollisions([...hotSeatIds().map((id) => join(HOTSEATS_DIR, id)), DAILY_DIR])).toEqual([]);
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
