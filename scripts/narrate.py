"""Pre-generate narration for every line in voice-lines.json with OmniVoice, the engine inside VoiceStudio. Offline, on Atheeb's Mac.
Usage: npm run narrate   (runs with VoiceStudio's Python; set VOICESTUDIO_PYTHON to use another one with `omnivoice` installed)
   or: <python> scripts/narrate.py voice-lines.json public/audio
Voices are cloned from scripts/voices/<voice>.wav, read with the matching text in REF_TEXT below:
  narrator: Atheeb's own cloned voice; advisor: a designed voice (female, middle-aged, Indian accent).
Skips lines that already have audio. Output: <id>.mp3 (mono, 48 kbps, loudness -16 LUFS)."""
import os, subprocess, sys, tempfile, json, time

import numpy as np
import soundfile as sf
import torch
from omnivoice import OmniVoice

REF_TEXT = {
    "narrator": "A survey published this May by a hiring software company asked people who had been through an AI interview what happened afterwards.",
    "advisor": "Milk spoils in hours. Whoever owns the plant decides the price.",
}
# One line per call: batched generate() on Apple Silicon returned noise, not speech.

src, out = sys.argv[1:3]
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
todo = [l for l in json.load(open(src)) if not os.path.exists(os.path.join(out, l["id"] + ".mp3"))]
print(f"{len(todo)} lines to record", flush=True)
if not todo:
    sys.exit(0)

device = "mps" if torch.backends.mps.is_available() else "cpu"
m = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=device, dtype=torch.float16)
prompts = {v: m.create_voice_clone_prompt(ref_audio=os.path.join(here, "voices", v + ".wav"), ref_text=t) for v, t in REF_TEXT.items()}

start = time.time()
for n, line in enumerate(todo, 1):
    a = m.generate(text=line["text"], voice_clone_prompt=prompts[line["voice"]])[0]
    with tempfile.NamedTemporaryFile(suffix=".wav") as w:
        sf.write(w.name, np.asarray(a, dtype="float32").reshape(-1), 24000)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w.name, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "24000", "-ac", "1", "-b:a", "48k", os.path.join(out, line["id"] + ".mp3")], check=True)
    print(f"{n}/{len(todo)}  {time.time() - start:.0f}s", flush=True)
