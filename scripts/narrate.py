"""Pre-generate Kokoro-82M narration for every line in voice-lines.json.
Usage: python3 scripts/narrate.py voice-lines.json public/audio <model.onnx> <voices.npz>
Skips lines that already have audio. Output: <id>.mp3 (mono, 48 kbps, loudness -16 LUFS)."""
import json, os, sys, subprocess, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro

src, out, model, voices = sys.argv[1:5]
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
