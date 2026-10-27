"""Pre-generate Kokoro-82M narration for every line in voice-lines.json. Runs offline on your Mac only.
Usage: KOKORO_MODEL=<kokoro-v1.0.onnx> KOKORO_VOICES=<voices-v1.0.bin> npm run narrate
   or: python3 scripts/narrate.py voice-lines.json public/audio <model.onnx> <voices.bin>
Setup: pip install kokoro-onnx soundfile, and download the model and voices files from the kokoro-onnx releases.
Skips lines that already have audio. Output: <id>.mp3 (mono, 48 kbps, loudness -16 LUFS)."""
import json, os, sys, subprocess, tempfile

src, out, model, voices = (sys.argv[1:5] + ["", "", "", ""])[:4]
if not (model and voices and os.path.isfile(model) and os.path.isfile(voices)):
    sys.exit("Set KOKORO_MODEL and KOKORO_VOICES to the Kokoro model and voices files (see the top of scripts/narrate.py).")

import soundfile as sf
from kokoro_onnx import Kokoro

os.makedirs(out, exist_ok=True)
k = Kokoro(model, voices)
for line in json.load(open(src)):
    mp3 = os.path.join(out, line["id"] + ".mp3")
    if os.path.exists(mp3):
        continue
    audio, sr = k.create(line["text"], voice=line["voice"], speed=1.0, lang="en-us")
    with tempfile.NamedTemporaryFile(suffix=".wav") as w:
        sf.write(w.name, audio, sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w.name, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "24000", "-ac", "1", "-b:a", "48k", mp3], check=True)
    print(line["id"], round(len(audio) / sr, 1), flush=True)
