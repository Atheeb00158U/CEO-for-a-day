"use client";

/**
 * Sound effects. Short files in public/sfx/ (sources and licences in docs/SOUNDS.md), decoded once and played
 * through Web Audio so taps sound instantly. Narration waits for a playing effect to finish (see `sfxQuietIn`),
 * so the two never talk over each other.
 */
export const SFX = [
  "select",
  "lock",
  "great",
  "ok",
  "bad",
  "heart",
  "warning",
  "up",
  "down",
  "next",
  "legend",
  "lose",
  "coins",
  "badge",
  "tab",
] as const;
export type Sfx = (typeof SFX)[number];

/**
 * Mix levels. The files are peak-normalised, so these even out their loudness (measured with earshot, see
 * docs/SOUNDS.md) and keep taps quieter than the moments that matter.
 */
const GAIN: Record<Sfx, number> = {
  select: 0.5,
  tab: 0.4,
  lock: 0.55,
  next: 0.55,
  great: 0.8,
  ok: 0.85,
  bad: 0.65,
  heart: 0.6,
  warning: 0.6,
  up: 0.45,
  down: 0.5,
  legend: 0.75,
  lose: 0.7,
  coins: 0.5,
  badge: 1,
};

let on = true;
let ctx: AudioContext | null = null;
let loading: Promise<void> | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
/** performance.now() when the last scheduled effect ends. */
let busyUntil = 0;
/** When each effect last played, so React's doubled dev effects don't play it twice. */
const lastPlayed = new Map<Sfx, number>();

export function setSfxOn(v: boolean) {
  on = v;
  if (v) load();
}

function load() {
  if (loading || typeof window === "undefined" || !("AudioContext" in window)) return;
  ctx = new AudioContext();
  // Browsers start audio suspended until a tap; resume on taps until it runs. iPhone counts touchend and click as a tap, not pointerdown.
  const wake = () => ctx?.state === "suspended" && ctx.resume();
  for (const e of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(e, wake, { capture: true });
  loading = Promise.all(
    SFX.map((n) =>
      fetch(`/sfx/${n}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx!.decodeAudioData(b))
        .then((buf) => void buffers.set(n, buf))
        .catch(() => {}),
    ),
  ).then(() => {});
}

/** Play an effect, optionally `delay` ms from now. Does nothing when sound is off or not loaded yet. */
export function playSfx(name: Sfx, delay = 0) {
  if (!on || !ctx) return;
  const buf = buffers.get(name);
  if (!buf || performance.now() - (lastPlayed.get(name) ?? -1e9) < 60) return;
  lastPlayed.set(name, performance.now());
  if (ctx.state === "suspended") ctx.resume();
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = GAIN[name];
  src.buffer = buf;
  src.connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + delay / 1000);
  busyUntil = Math.max(busyUntil, performance.now() + delay + buf.duration * 1000);
}

/** Milliseconds until the effects scheduled so far have finished (0 when quiet). */
export function sfxQuietIn() {
  return Math.max(0, busyUntil - performance.now());
}
