// What the wolf says when he drops in on Home, spoken in his own voice (scripts/voices/wolf.wav, designed in
// OmniVoice, never cloned from a person). Node runs this file too (voice-lines.ts), so: type-only, relative imports.
import type { WolfName } from "./brand.ts";

export const WOLF_VOICE = "wolf";

/** Each moment has a reason to show, and a few lines he rotates through so he doesn't repeat himself. */
export const WOLF_LINES = {
  /** The first time a player lands on Home, just after the welcome screens (he has met them there already). */
  meet: { pose: "pose-pointing", lines: ["This is Home, boss. You will find your next lesson here."] },
  /** Back on a new day, streak still alive, nothing played yet today. */
  back: {
    pose: "pose-pleased",
    lines: [
      "Welcome back, boss. Play one lesson today to keep your streak.",
      "Back again, boss? Good. One lesson today will keep your streak.",
      "Good to see you back, boss. One lesson today keeps your streak.",
    ],
  },
  /** Back after missing a day: the streak is gone. */
  lost: {
    pose: "pose-worried",
    lines: [
      "Welcome back, boss. Your streak has ended. Start a new one today.",
      "You missed a day, boss. Your streak has ended. Start again today.",
    ],
  },
} satisfies Record<string, { pose: WolfName; lines: string[] }>;
export type WolfMoment = keyof typeof WOLF_LINES;

/**
 * The welcome screens (Onboarding.tsx): he asks the three questions, then shows how the game works, one beat at a
 * time, with a real piece of the game moving beside him. One short line each, in basic English.
 */
export const WOLF_WELCOME = {
  hello: { pose: "pose-pointing", line: "I'm the Wolf. I will teach you to think like a boss. First, three questions." },
  doing: { pose: "pose-thinking", line: "What do you do now?" },
  focus: { pose: "pose-thinking", line: "What do you want to learn most? I will start there." },
  minutes: { pose: "pose-pleased", line: "How much time can you play each day? This will be your daily goal." },
  lesson: { pose: "pose-warning", line: "Each lesson teaches you one business rule. It takes a few minutes." },
  hotSeat: { pose: "pose-pointing", line: "Then you sit in the hot seat. You are the boss. You make the big decisions." },
  hearts: { pose: "pose-worried", line: "You have three hearts. They are the board's trust. Lose all three, and you are fired." },
  streak: { pose: "pose-pleased", line: "Play one lesson each day to keep your streak." },
  league: { pose: "pose-celebrating", line: "Every win earns XP. More XP moves you up the weekly league." },
  notes: { pose: "pose-thinking", line: "Every rule you learn is saved in Notes. Read them again to remember." },
  go: { pose: "pose-pointing", line: "You are ready. Start your first lesson." },
  trial: { pose: "pose-warning", line: "Now sit in the hot seat. You have two big decisions to make." },
  style: { pose: "pose-thinking", line: "This is how you have made decisions so far. The story is not over." },
} satisfies Record<string, { pose: WolfName; line: string }>;
export type WolfBeat = keyof typeof WOLF_WELCOME;
