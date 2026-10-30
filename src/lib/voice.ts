"use client";

/**
 * Narration. Pre-generated audio (public/audio/<id>.mp3) is used when it exists;
 * otherwise the browser's built-in speech voice reads the line, so nothing is ever silent.
 * The id is worked out here, the same way src/lib/voice-lines.ts does: sha1(voice + "|" + text), first 12 hex
 * characters. No list of lines ships to the phone, because that list would hold every answer.
 */
export async function lineId(voice: string, text: string): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined; // not https: use the browser voice
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(voice + "|" + text));
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

import { ADVISOR, NARRATOR } from "./engine";
import { sfxQuietIn } from "./sfx";

export { ADVISOR, NARRATOR };

let audio: HTMLAudioElement | null = null;
let onProgress: ((p: number) => void) | null = null;
let raf = 0;
let wait: ReturnType<typeof setTimeout> | undefined;
/** Bumped on every stop, so callbacks from a stopped line (ended, error, cancelled speech) do nothing. */
let gen = 0;

// Phones (iPhones most strictly) only let sound start from a tap, and narration starts a moment after one. Playing
// silence on the shared audio element and an empty line of browser speech during the first tap unlocks both for
// the rest of the visit. touchend and click count as a tap on iPhone; pointerdown does not.
if (typeof window !== "undefined") {
  const unlock = () => {
    window.removeEventListener("touchend", unlock, true);
    window.removeEventListener("click", unlock, true);
    audio = audio ?? new Audio();
    if (!audio.src) {
      audio.src = "/silence.mp3";
      audio.play().catch(() => {});
    }
    if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  };
  window.addEventListener("touchend", unlock, true);
  window.addEventListener("click", unlock, true);
}

export function stopVoice() {
  gen++;
  clearTimeout(wait);
  cancelAnimationFrame(raf);
  if (audio) {
    audio.onended = audio.onerror = audio.onplay = null;
    audio.pause();
    audio.removeAttribute("src");
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Speak a line. `progress` gets 0..1 so captions can highlight word by word.
 * It starts once any sound effect has finished; the timeout also lets effects that fire in the same render
 * (a verdict sound, a lost heart) be scheduled first.
 */
export function speak(text: string, voice = NARRATOR, progress?: (p: number) => void, onEnd?: () => void) {
  stopVoice();
  const g = gen;
  wait = setTimeout(() => g === gen && start(text, voice, progress, onEnd), 0);
}

function start(text: string, voice: string, progress?: (p: number) => void, onEnd?: () => void) {
  const quiet = sfxQuietIn();
  if (quiet > 0) {
    wait = setTimeout(() => start(text, voice, progress, onEnd), quiet + 80);
    return;
  }
  onProgress = progress ?? null;
  const g = gen;
  lineId(voice, text).then(
    (id) => g === gen && play(id, text, voice, done(g, onEnd)),
    () => g === gen && speakBrowser(text, voice, done(g, onEnd)),
  );
}

const done = (g: number, onEnd?: () => void) => () => {
  if (g !== gen) return;
  onProgress?.(1);
  onEnd?.();
};

function play(id: string | undefined, text: string, voice: string, done: () => void) {
  const g = gen;
  const fallback = () => g === gen && speakBrowser(text, voice, done);
  if (!id) return fallback();
  audio = audio ?? new Audio();
  audio.src = `/audio/${id}.mp3`;
  audio.onended = done;
  audio.onerror = fallback;
  const loop = () => {
    if (audio && audio.duration) onProgress?.(audio.currentTime / audio.duration);
    if (audio && !audio.paused) raf = requestAnimationFrame(loop);
  };
  audio.onplay = () => (raf = requestAnimationFrame(loop));
  // A missing file rejects here too, after onerror has handed over to the browser voice: let that voice finish.
  audio.play().catch((e) => e?.name === "NotAllowedError" && done());
}

function speakBrowser(text: string, voice: string, done: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return done();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const want = voice === ADVISOR ? /en-GB/i : /en-(US|IN)/i;
  u.voice = voices.find((v) => want.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
  u.rate = 1;
  const words = text.split(/\s+/).length;
  u.onboundary = (e) => {
    if (e.name === "word") onProgress?.(Math.min(1, text.slice(0, e.charIndex).split(/\s+/).length / words));
  };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}
