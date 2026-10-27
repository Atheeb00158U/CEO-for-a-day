// Lists every narrated line in every Hot Seat, with a stable id (hash of voice + text).
// Feed the output to scripts/narrate.py (Kokoro) to pre-generate audio into public/audio/.
import { createHash } from "node:crypto";
import { kodak } from "../src/content/hotseats/kodak.ts";

const NARRATOR = "af_heart", ADVISOR = "bm_george";
const lines = new Map();
const add = (text, voice = NARRATOR) => {
  const variants = typeof text === "string" ? [text] : text.map((v) => v.text);
  for (const t of variants) {
    const id = createHash("sha1").update(voice + "|" + t).digest("hex").slice(0, 12);
    lines.set(id, { id, voice, text: t });
  }
};
for (const hs of [kodak]) {
  for (const n of Object.values(hs.nodes)) {
    if (n.type === "scene" || n.type === "ending") add(n.text);
    if (n.type === "decision") {
      add(n.setup); add(n.question); add(n.advisor, ADVISOR);
      for (const o of n.options) { add(o.outcome); add(o.why + (o.better ? " What would have worked: " + o.better : "")); }
    }
  }
}
console.log(JSON.stringify([...lines.values()], null, 1));
