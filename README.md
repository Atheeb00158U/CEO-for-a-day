# CEO For A Day

A mobile-first, dark-mode learning game. You sit in the **hot seat** of a real company, make its biggest calls, and live with the results.

## Run it
```bash
npm install
npm run dev          # http://localhost:3000
```

## Useful scripts
| Command | What it does |
|---|---|
| `npm run validate` | Walks every possible path through every Hot Seat and checks the tree is complete |
| `npm run treemap -- kodak` | Prints a Mermaid diagram of a Hot Seat's full decision tree |
| `npm run voices` | Lists every narrated line in `voice-lines.json` |
| `python3 scripts/narrate.py voice-lines.json public/audio <model.onnx> <voices.npz>` | Pre-generates Kokoro narration |

## Where things live
- `content/hotseats/kodak/`: the Kodak Hot Seat (`hotseat.json` + `media/`)
- `src/content/catalog.ts`: which Hot Seats exist and which are playable
- `src/lib/engine.ts`: the game engine (choices, meters, board trust, scoring, personalised debrief, per-player ordering)
- `src/lib/store.tsx`: player state (XP, streak, freezes, booster, coins, quests, league, notes, badges), saved on the device
- `src/lib/league.ts`: the weekly league (simulated players until there's a backend)
- `src/components/`: the screens
- `docs/HOT-SEAT-DESIGN.md`: how Hot Seats, scoring and personalisation work
- `docs/LAUNCH-CHECKLIST.md`: what's still missing before launch

Media: archive clips from the Moving Image Archive (public domain), illustrations generated with Z-Image Turbo, and narration from Kokoro-82M (both Apache 2.0).
