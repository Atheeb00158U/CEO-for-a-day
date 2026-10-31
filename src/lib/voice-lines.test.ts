import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hotSeatIds, lessonFileIds, readDailyPool, readHotSeat, readLesson } from "./content-files";
import type { Lesson } from "./course-types";
import { askLines, takeawayLines } from "./lesson-voice";
import { ADVISOR, NARRATOR } from "./engine";
import { voiceLines, lineId as nodeLineId } from "./voice-lines";
import { lineId } from "./voice";

const all = () => voiceLines(hotSeatIds().map(readHotSeat), readDailyPool().calls, lessonFileIds().map(readLesson));

describe("voice lines", () => {
  it("match the committed voice-lines.json, so every recording keeps its id", () => {
    const committed = JSON.parse(readFileSync(new URL("../../voice-lines.json", import.meta.url), "utf8"));
    expect(all()).toEqual(committed);
  });

  it("get the same ids on the phone, which works them out instead of downloading the list", async () => {
    const lines = all();
    for (const l of [...lines.slice(0, 40), ...lines.slice(-40)]) expect(await lineId(l.voice, l.text)).toBe(l.id);
  });
});

describe("lesson voice lines", () => {
  // The test course's lesson, so edits to the real course can't break this.
  const lesson: Lesson = JSON.parse(
    readFileSync(new URL("./__fixtures__/course/lessons/sample-sales-not-profit.json", import.meta.url), "utf8"),
  );
  const ids = new Set(voiceLines([], [], [lesson]).map((l) => l.id));
  const has = (text: string, voice = NARRATOR) => ids.has(nodeLineId(voice, text));

  it("cover every screen's text, question and choice options, as the player says them", () => {
    for (const s of lesson.screens) for (const x of askLines(s)) expect(has(x.text, x.advisor ? ADVISOR : NARRATOR)).toBe(true);
    expect(has("Sales ₹500. Costs ₹350. What is the profit?")).toBe(true);
    expect(has("₹150")).toBe(true);
    expect(has("Profit is what is blank after you pay every blank.")).toBe(true);
  });

  it("cover the feedback and the takeaway", () => {
    expect(has("₹500 is the sales. You still have to pay the costs.")).toBe(true); // a wrong option's own line
    expect(has("Big sales mean nothing until you know the costs.")).toBe(true); // a scenario's why
    for (const x of takeawayLines(lesson)) expect(has(x.text)).toBe(true);
  });

  it("give an advisor's line the advisor's voice", () => {
    const l: Lesson = {
      ...lesson,
      screens: [{ kind: "scenario", id: "s", setup: "S.", question: "Q?", advisor: "Think of cash.", options: [] }],
    };
    expect(voiceLines([], [], [l]).find((x) => x.text === "Think of cash.")?.voice).toBe(ADVISOR);
  });
});
