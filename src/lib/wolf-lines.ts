// What the wolf says when he drops in on Home, spoken in his own voice (scripts/voices/wolf.wav, designed in
// OmniVoice, never cloned from a person). Node runs this file too (voice-lines.ts), so: type-only, relative imports.
import type { WolfName } from "./brand.ts";

export const WOLF_VOICE = "wolf";

/** Each moment has a reason to show, and a few lines he rotates through so he doesn't repeat himself. */
export const WOLF_LINES = {
  /** The first time a player lands on Home. */
  meet: { pose: "pose-pointing", lines: ["Hah! A new boss! I'm the Wolf. Show me what you can do."] },
  /** Back on a new day, streak still alive, nothing played yet today. */
  back: {
    pose: "pose-pleased",
    lines: [
      "Hah! Welcome back, boss. One lesson keeps your streak alive.",
      "Back again, boss? Good. Your streak needs one lesson today.",
      "Hah! I knew you'd be back. Play one lesson to keep your streak.",
    ],
  },
  /** Back after missing a day: the streak is gone. */
  lost: {
    pose: "pose-worried",
    lines: [
      "Hah! Look who's back. Your streak is gone. Start a new one today.",
      "Where were you, boss? You lost your streak. Let's start again today.",
    ],
  },
} satisfies Record<string, { pose: WolfName; lines: string[] }>;
export type WolfMoment = keyof typeof WOLF_LINES;
