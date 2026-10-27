"use client";

import lines from "../../voice-lines.json";

/**
 * Narration. Pre-generated Kokoro audio (public/audio/<id>.mp3) is used when it exists;
 * otherwise the browser's built-in speech voice reads the line, so nothing is ever silent.
 */
const byText = new Map<string, string>();
for (const l of lines as { id: string; voice: string; text: string }[]) byText.set(l.voice + "|" + l.text, l.id);

import { ADVISOR, NARRATOR } from "./engine";

export { ADVISOR, NARRATOR };

let audio: HTMLAudioElement | null = null;
let onProgress: ((p: number) => void) | null = null;
let raf = 0;

export function stopVoice() {
  cancelAnimationFrame(raf);
  if (audio) {
    audio.pause();
    audio.src = "";
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Speak a line. `progress` gets 0..1 so captions can highlight word by word. */
export function speak(text: string, voice = NARRATOR, progress?: (p: number) => void, onEnd?: () => void) {
  stopVoice();
  onProgress = progress ?? null;
  const id = byText.get(voice + "|" + text);
  const done = () => {
    onProgress?.(1);
    onEnd?.();
  };
  const fallback = () => speakBrowser(text, voice, done);
  if (!id) return fallback();
  audio = audio ?? new Audio();
  audio.src = `./audio/${id}.mp3`;
  audio.onended = done;
  audio.onerror = fallback;
  const loop = () => {
    if (audio && audio.duration) onProgress?.(audio.currentTime / audio.duration);
    if (audio && !audio.paused) raf = requestAnimationFrame(loop);
  };
  audio.onplay = () => (raf = requestAnimationFrame(loop));
  audio.play().catch(() => done());
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
