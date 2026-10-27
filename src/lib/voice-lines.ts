// Every narrated line with its audio id: sha1(voice + "|" + text), first 12 hex chars.
// public/audio/<id>.mp3 files are named by this id, so changing it orphans every recording.
// Loaded by Node (scripts, hotseat CLI): node:crypto, relative .ts imports, type-only imports. Never import it in the app.
import { createHash } from "node:crypto";
import { ADVISOR, NARRATOR, spokenWhy } from "./engine.ts";
import type { HotSeat, Text } from "./hotseat-types";

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

export function voiceLines(hotSeats: HotSeat[]): VoiceLine[] {
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
  return [...lines.values()];
}
