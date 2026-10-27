// Lists every narrated line in every Hot Seat, with a stable id (hash of voice + text).
// Feed the output to scripts/narrate.py (Kokoro) to pre-generate audio into public/audio/.
import { hotSeatIds, readHotSeat } from "../src/lib/content-files.ts";
import { voiceLines } from "../src/lib/voice-lines.ts";

console.log(JSON.stringify(voiceLines(hotSeatIds().map(readHotSeat)), null, 1));
