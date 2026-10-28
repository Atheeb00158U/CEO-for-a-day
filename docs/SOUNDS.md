# Sound effects

The game's sound effects live in `public/sfx/*.mp3` (15 files, about 150 KB in all, mono 96 kbps). The app loads
them once, plays them through Web Audio (`src/lib/sfx.ts`) and has an on/off switch in Profile → Settings.
Narration waits until a playing effect has finished (`sfxQuietIn` in `src/lib/voice.ts`), so the two never overlap.

## Where they come from, and the licence

Every file is made by `scripts/make-sfx.py` from the sound bank of
earshot (an audio tool by Leon Lin, MIT licence, bank version `forge_v2r6+fit1+pluck1`). The bank holds no recordings:

- most sounds are **pure DSP code** (modal resonators, filtered noise), so there is no third-party recording in them;
- three are **fits**: recipes measured from public-domain recordings on Freesound (CC0 1.0, no attribution needed;
  credited here anyway).

| fit used | recording | recordist | source | licence |
|---|---|---|---|---|
| `fit/click/floss_lid` | Plastic Clicks.flac | qubodup | [freesound 167829](https://freesound.org/people/qubodup/sounds/167829/) | CC0 1.0 |
| `fit/snap/switch_flip` | Switch Flip #1 | IanStarGem | [freesound 278205](https://freesound.org/people/IanStarGem/sounds/278205/) | CC0 1.0 |
| `fit/pop/mouth_plop` | Mouth Plops.wav | CapsLok | [freesound 181907](https://freesound.org/people/CapsLok/sounds/181907/) | CC0 1.0 |

So the effects are free to ship in a paid app with no credit line.

## The sounds

| file | when it plays | made from | earshot reading |
|---|---|---|---|
| `select` | tapping an answer tile | `pop/3` | bubble/cork pop (z +3.5 to +3.9) |
| `tab` | tapping a bottom tab | `fit/click/floss_lid` | soft key-release click (z +3.0) |
| `lock` | "Lock it in" | `fit/snap/switch_flip` + a soft knock | soft key click (z +3.1) |
| `next` | Continue | `swish/stick` | fast whoosh (z +4.9) |
| `great` | "Great call!" sheet | kalimba E5 → C6 | strong match for a happy correct-answer chime (z +4.2) |
| `ok` | "Risky call" sheet | soft kalimba A4, A4 | neutral kalimba note (z +4.6) |
| `bad` | "Costly call" sheet | soft kalimba E4 → C4 + low thump | strong match for a soft, low wrong-answer tone (z +3.8) |
| `heart` | losing a heart | tape-stop + knock | strong match for a sad "lost a life" deflate (z +3.3) |
| `warning` | board warning (one heart left) | soft kalimba D5, D5 | plausible gentle two-note warning (z +2.9) |
| `up` / `down` | meters move | `pro_pop/chirp` / `fit/pop/mouth_plop` | short pops |
| `legend` | a good ending (legend or survivor) | kalimba C–E–G–C arpeggio + shimmer | strong match for a joyful win arpeggio (z +4.0) |
| `lose` | collapse or fired ending | two falling tape-stops | downlifter falling sweep (z +3.3) |
| `coins` | XP and coins on the debrief and Daily Call | three bright dings | strong match for reward chimes (z +4.1) |
| `badge` | a new badge on the debrief | bell + shimmer | plausible achievement chime (z +2.8) |

"z" is earshot's text-audio match score (3 or more is strong). It hears what a sound is, not whether it is pretty:
a person still has to listen and decide on taste. The sad and happy kalimba phrases all read as "kalimba / chime"
to the model, which cannot hear melody direction, so the direction is by construction (rising for good news, falling
and lower for bad).

## Changing a sound

Edit `RECIPES` in `scripts/make-sfx.py`, then rebuild with a Python that has earshot and ffmpeg:

```bash
python scripts/make-sfx.py
```

Mix levels per sound are in `GAIN` in `src/lib/sfx.ts`.
