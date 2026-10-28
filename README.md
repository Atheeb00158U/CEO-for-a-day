# CEO For A Day

A mobile-first, dark-mode learning game. You sit in the **hot seat** of a real company, make its biggest calls, and live with the results.

## Run it
```bash
npm install
npm run dev          # http://localhost:3000
```

| Route | What it is |
|---|---|
| `/` | The website |
| `/app` | The game |
| `/admin` | Every Hot Seat and a tree of every possible path. Needs `ADMIN_PASSWORD` on the server (any username); open without it only in `npm run dev` |

## Useful scripts
| Command | What it does |
|---|---|
| `npm run hotseat:new -- <id>` | Starts a new Hot Seat in `content/hotseats/<id>/` from the template, as a draft |
| `npm run hotseat:check [-- <id>]` | Checks the schema, walks every path, and checks endings, media and narration |
| `npm run hotseat:tree -- <id>` | Writes `tree.mmd`, a Mermaid map of the tree (`/admin/<id>` shows the full path tree) |
| `npm run media -- <id> <files…>` | Turns images into 1080 px webp and clips into ≤ 9 s silent H.264, into the Hot Seat's `media/` |
| `npm run narrate` | Refreshes `voice-lines.json` and records missing lines with OmniVoice (needs VoiceStudio installed) |
| `npm run debriefs -- <id> [--dry-run]` | Drafts one debrief per path with Claude, offline, into `debriefs.json` for review |

How to write a Hot Seat or a Daily Call, step by step: `docs/AUTHORING.md`. Daily Calls live in `content/daily/daily.json`.
| `npm test` / `npm run validate` | All tests / just the Hot Seat checks |

## Where things live
- `content/hotseats/<id>/`: one folder per Hot Seat: `hotseat.json`, `media/`, and `debriefs.json` once drafted
- `content/templates/hotseat.json`: the template `hotseat:new` copies
- `src/content/catalog.ts`: finds every Hot Seat at build time; drafts only show in `npm run dev`
- `src/lib/hotseat-schema.ts`, `hotseat-check.ts`, `hotseat-tree.ts`: the schema, the checks and the path tree
- `src/lib/engine.ts`: the game engine (choices, meters, board trust, scoring, personalised debrief, per-player ordering)
- `src/lib/store.tsx`: player state (XP, streak, freezes, booster, coins, quests, league, notes, badges), saved on the device
- `src/lib/league.ts`: the weekly league (simulated players until there's a backend)
- `src/components/`: the screens
- `docs/HOT-SEAT-DESIGN.md`: how Hot Seats, scoring and personalisation work
- `docs/LAUNCH-CHECKLIST.md`: what's still missing before launch

Media: archive clips from the Moving Image Archive (public domain), illustrations generated with Z-Image Turbo (Apache 2.0), and narration from OmniVoice.
