// Every narrated line with its audio id: sha1(voice + "|" + text), first 12 hex chars.
// public/audio/<id>.mp3 files are named by this id, so changing it orphans every recording.
// Loaded by Node (scripts, hotseat CLI): node:crypto, relative .ts imports, type-only imports. Never import it in the app.
import { createHash } from "node:crypto";
import { ADVISOR, NARRATOR, spokenWhy } from "./engine.ts";
import type { Lesson } from "./course-types";
import type { DailyCall, HotSeat, Text } from "./hotseat-types";
import { askLines, GOT_IT, takeawayLines } from "./lesson-voice.ts";

export interface VoiceLine {
  id: string;
  voice: string;
  text: string;
}

export const lineId = (voice: string, text: string) =>
  createHash("sha1")
    .update(voice + "|" + text)
    .digest("hex")
    .slice(0, 12);

export function voiceLines(hotSeats: HotSeat[], daily: DailyCall[] = [], lessons: Lesson[] = []): VoiceLine[] {
  const lines = new Map<string, VoiceLine>();
  const add = (text: Text, voice = NARRATOR) => {
    for (const t of typeof text === "string" ? [text] : text.map((v) => v.text))
      lines.set(lineId(voice, t), { id: lineId(voice, t), voice, text: t });
  };
  for (const hs of hotSeats) {
    for (const n of Object.values(hs.nodes)) {
      if (n.type === "scene" || n.type === "ending") add(n.text);
      if (n.type === "decision") {
        add(n.setup);
        add(n.question);
        add(n.advisor, ADVISOR);
        for (const o of n.options) {
          add(o.outcome);
          add(spokenWhy(o));
        }
      }
    }
  }
  for (const c of daily) {
    add(c.setup);
    add(c.question);
    if (c.advisor) add(c.advisor, ADVISOR);
    for (const o of c.options) {
      add(o.outcome);
      add(spokenWhy(o));
    }
  }
  // Lessons: each screen's question or teaching text, then its feedback (only sent to the phone after the answer,
  // so its audio id can't be worked out early), then the takeaway.
  for (const l of lessons) {
    for (const s of l.screens) {
      for (const x of askLines(s)) add(x.text, x.advisor ? ADVISOR : NARRATOR);
      if ("why" in s) add(s.why);
      if (s.kind === "choice") for (const w of Object.values(s.wrong ?? {})) add(w);
      if (s.kind === "scenario")
        for (const o of s.options) {
          add(o.outcome);
          add(spokenWhy(o));
        }
    }
    for (const x of takeawayLines(l)) add(x.text);
  }
  if (lessons.length) add(GOT_IT);
  return [...lines.values()];
}
