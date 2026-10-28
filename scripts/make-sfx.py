"""Build the game's sound effects into public/sfx/*.mp3 (sources and licences: docs/SOUNDS.md).

Every sound is rendered from earshot's sound bank (DSP code, no recorded samples, or fitted from CC0 recordings),
then layered into short phrases here. Needs a Python with the earshot package and ffmpeg:

    <earshot python> scripts/make-sfx.py [--wav DIR]

The same bank version gives the same files.
"""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from earshot.forge import bank

SR = 48000

# Each sound is a list of (bank id, start in seconds, pitch or None, gain in dB).
# Good news rises on a kalimba (C major); bad news falls, softer and lower, or deflates like a tape stopping.
RECIPES = {
    "select": [("pop/3", 0.0, None, 0)],
    "tab": [("fit/click/floss_lid", 0.0, None, 0)],
    "lock": [("fit/snap/switch_flip", 0.0, None, 0), ("pro_pop_in/knock", 0.0, None, -8)],
    "next": [("swish/stick", 0.0, None, 0)],
    "great": [("pluck/kalimba", 0.0, "E5", 0), ("pluck/kalimba", 0.11, "C6", 0)],
    "ok": [("pluck/kalimba_soft", 0.0, "A4", 0), ("pluck/kalimba_soft", 0.14, "A4", -3)],
    "bad": [("pluck/kalimba_soft", 0.0, "E4", 0), ("pluck/kalimba_soft", 0.16, "C4", -1), ("pro_pop_in/deep", 0.16, None, -10)],
    "heart": [("pro_pop_in/knock", 0.0, None, -3), ("downlifter/tape", 0.0, None, 0)],
    "warning": [("pluck/kalimba_soft", 0.0, "D5", 0), ("pluck/kalimba_soft", 0.18, "D5", -1)],
    "up": [("pro_pop/chirp", 0.0, None, 0)],
    "down": [("fit/pop/mouth_plop", 0.0, "E5", 0)],
    "legend": [
        ("pluck/kalimba", 0.0, "C5", -2),
        ("pluck/kalimba", 0.1, "E5", -2),
        ("pluck/kalimba", 0.2, "G5", -1),
        ("pluck/kalimba_ring", 0.3, "C6", 0),
        ("pro_shimmer/m1", 0.3, "C5", -10),
    ],
    "lose": [("downlifter/tape", 0.0, "G4", 0), ("downlifter/tape", 0.35, "D4", 0)],
    "coins": [("pro_notify/ding_2045", 0.0, None, -2), ("pro_notify/ding_2296", 0.08, None, -2), ("pro_notify/ding_2045", 0.16, "G7", 0)],
    "badge": [("notify/m5", 0.0, None, 0), ("pro_shimmer/m1", 0.0, "E5", -8)],
}

# Long tails cut here (seconds), with a fade, so files stay small and nothing rings under the narration.
MAX_LEN = {"legend": 1.6, "lose": 1.4, "badge": 1.3, "warning": 0.9, "great": 0.9, "ok": 0.8, "bad": 0.9, "up": 0.6, "down": 0.6, "heart": 0.6}
# Peak level (dBFS) per sound; the app sets the mix on top (src/lib/sfx.ts).
PEAK = -1.0


def render(recipe, name):
    parts = []
    for sid, at, pitch, gain in recipe:
        y, meta = bank.render(sid, pitch=pitch)
        if meta["checks"]["warnings"]:
            print(f"  {name}: {sid} {pitch or ''}: {meta['checks']['summary']}", file=sys.stderr)
        y = y.mean(axis=1) if y.ndim == 2 else y
        parts.append((int(at * SR), y * 10 ** (gain / 20)))
    out = np.zeros(max(o + len(y) for o, y in parts))
    for o, y in parts:
        out[o : o + len(y)] += y
    # Trim the silence after the sound, then cap the length with a short fade.
    live = np.nonzero(np.abs(out) > np.abs(out).max() * 10 ** (-60 / 20))[0]
    out = out[: live[-1] + 1]
    cap = int(MAX_LEN.get(name, 0.5) * SR)
    if len(out) > cap:
        out = out[:cap]
        fade = min(len(out) // 3, int(0.25 * SR))
        out[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    out[-int(0.005 * SR) :] *= np.linspace(1, 0, int(0.005 * SR))
    return out / np.abs(out).max() * 10 ** (PEAK / 20)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", help="also keep 48 kHz WAVs here (for listening checks)")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "public" / "sfx"))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    wavdir = Path(args.wav) if args.wav else Path(tempfile.mkdtemp())
    wavdir.mkdir(parents=True, exist_ok=True)
    for name, recipe in RECIPES.items():
        y = render(recipe, name)
        wav = wavdir / f"{name}.wav"
        sf.write(wav, y, SR, subtype="PCM_24")
        mp3 = out / f"{name}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "44100", "-b:a", "96k", str(mp3)],
            check=True,
        )
        print(f"{name:8s} {len(y) / SR:5.2f} s  {mp3.stat().st_size / 1024:5.1f} KB")
    print(f"bank {bank.VERSION}")


if __name__ == "__main__":
    main()
