# Video Hot Seat experiment: plan

Plan only. No repo files were changed. Read alongside `CLAUDE.md`, `docs/HOT-SEAT-DESIGN.md`, `docs/AUTHORING.md` and the `mmh-motion-graphics` skill.

**The short version:** pilot **Kodak**. Build the video as **one segment per existing Screen**: scene variants, decision setups, option outcomes and endings. The engine and `/api/play` stay as they are. The server adds a video URL to each screen it already returns. Render at **720×1280** in two qualities, as plain MP4 files in **Supabase Storage** (Mumbai) under secret names. The full tree is **about 10 minutes of video in 39 segments, or about 61 ten-second review windows**. One play of the real path watches about 3.8 minutes. Start with a **100-second slice** and test it with 5 people before building the rest.

---

## 1. Which Hot Seat to pilot

### What the archive search actually returns

`POST https://www.movingimagearchive.com/api/search {query}` works from curl. The bare domain answers with a 308 redirect to `www.`. The search is **semantic (CLIP-style)**, so every query returns 24 clips with `hasMore: true` and a score between 0.24 and 0.33. **Hit counts tell you nothing.** What matters is whether the top titles really show the thing. Two more findings:

- **Clips come at 320×240, 4:3**, both the `videoUrl` and `/api/clips/<id>/download`. Our existing Kodak clips (`content/hotseats/kodak/media/photo4.mp4` and others) are 320×240 too. The original films are on archive.org (the Prelinger collection, linked from each `/sources/<slug>` page), often at 640×480 or better. For any shot that fills the screen, fetch the original.
- About 1 query in 6 failed with an empty or non-JSON reply. That looks like rate limiting, so space out the queries, as the MMH skill already says.

**I ran 35 queries.** Top results, scored on whether they show the subject:

| Candidate | Queries | What came back | Verdict |
|---|---|---|---|
| **Amul** (India, 1946–73) | milking in an Indian village; farmers with milk cans; dairy bottling; village women; milk powder factory; Indian railway crowd | *White Ammunition* (1942, US dairy), *Promise of Pakistan Geography* (1950), *Indië-materiaal* (1926, Dutch East Indies), *Triple Goodness* (1948), Dutch and US crowds | **Weak.** Almost no Indian footage. The bottling and dairy shots are American. That breaks the "period-correct, Indian settings" rule. |
| **Maruti 800** (India, 1981–90) | assembly-line robots; small car on a crowded street; Japanese factory workers; queue outside an office; Delhi traffic and scooters; Ambassador taxi; car showroom; factory morning exercise | *Robot Reality* (1990), *Henry Ford's Mirror of America* (1962), *Story Without End* (1950); Delhi traffic tops out at 0.243 with Coney Island and the Virgin Islands | **Weak.** Generic factories exist, but India and Japan in the 1980s don't. |
| **New Coke** (US, 1985) | people drinking cola; soft-drink shelves; angry protest with signs; 1980s TV news anchor; soda bottling line; blind taste test | *Out of This World* (1954), a 1922 Dutch fair, a 2000 probation video, *Logging Safety* (1992) | **Weak.** The core picture, the angry public, isn't there. |
| **Intel quits memory** (US, 1982–86) | clean-room workers; microchip under a microscope; PC in a 1980s office; Japanese electronics factory; engineers in a meeting; trading floor; memory chips | *Highlights 1965: A Progress Report* (0.330, clean room), *Robot Reality* (1990), 1979–1998 US office and PC footage, *Small Steps…Giant Strides* (1973) | **Fair.** Good US tech footage. Japan is weak, and it's a draft with a full fact-check still ahead. |
| **Kodak** (US, 1975–2012) | family snapshots; film factory; darkroom; camera store; boardroom; home movies; computer screen with a digital image; Rochester NY; slide projector; engineer at a lab bench; camera TV ad; photographer with a camera | ***Rochester: A City of Quality*** (1963, 0.32, Kodak's home town), *Your Movie Camera and How to Use It*, *Photography* (1946), *Master Hands* and NASA 1969 lab and darkroom footage, *The Power of Money* (1994) boardroom, *The Fed Today* (2001) and *Future of Learning* (2009) offices and screens, *Telegram for America* (1956) | **Best.** Cameras, film, labs, Rochester, offices and early computers are all well covered. Gaps: 1981 Sony Mavica, 2000s digital cameras and inkjet printers, and Kodak branding to crop out. |

### Recommendation: Kodak

1. **It's published, so you can run a true A/B test** against the still-and-text version (§6). With a draft, you'd be testing the video and the story at the same time.
2. **The footage fits.** It's an American story from the mid-century to the 2000s, which is what the archive holds. The existing Kodak media already comes from this archive.
3. **It's the smallest tree.** It has 4 decisions and 12 options, against 5–6 decisions and 15–19 options elsewhere. Complexity 2 means it's often one of a new player's first two Hot Seats, which is where boredom costs the most.
4. **The story is strong and easy to see:** the engineer who builds the first digital camera in 1975, the company that shelves it, and the collapse.

Runner-up: **intel-quits-memory**, if you later want a second test on a less familiar story. Indian stories (Amul, Maruti, Maggi, Tanishq) need another footage source before they can be videos. Films Division of India material is the obvious lead, but its rights need checking. That's a separate research task.

---

## 2. Branching: how video handles the tree

Kodak's structure (word counts measured from `hotseat.json`):

| Node | Kind | Text versions | Words |
|---|---|---|---|
| intro, lab | scene | 1 each | 47, 48 |
| d1 | decision | setup 35 + question 8 (advisor 17) | |
| d1 outcomes | shelve / unit / rush | 1 each | 36 / 30 / 33 |
| sony1981 | scene | 3 | 35, 37, 34 |
| d2 | decision | setup 29 + question 6 (advisor 22) | |
| d2 outcomes | dismiss / study / shift | 1 / **2** / **2** | 31 / 36, 28 / 34, 28 |
| web2001 | scene | 4 | 45, 43, 48, 50 |
| d3 | decision | setup 24 + question 4 (advisor 18) | |
| d3 outcomes | prints / network / cameras | 1 each | 31 / 35 / 24 |
| last2006 | scene | 4 | 32, 37, 29, 32 |
| d4 | decision | setup 27 + question 7 (advisor 15) | |
| d4 outcomes | camera_war / inkjet / reinvent | 1 each | 31 / 40 / 33 |
| endings | legend / survivor / collapse / fired | 2 / 2 / 3 / 1 | ~25–35 each |

### Options considered

- **A. Real path only, with still-and-text everywhere else.** This is the cheapest option, but a player who leaves the real path drops back to the boring mode mid-story. That would turn the test into "punishment for wrong answers." Rejected.
- **B. Pre-render every whole path as one film.** Kodak has 79 paths, so about 79 × 4 minutes. Rejected.
- **C. One segment per Screen (recommended).** Each text version the engine can show gets its own short video: scene variant, decision setup, option outcome (per variant) and ending variant. The app plays whichever segments `/api/play` returns, in order. This mirrors exactly how the text works today, so the engine, flags, scoring and `play.ts` don't change.

### Option C in detail

- **Segment key** = `nodeId` plus the variant index, e.g. `web2001#2`, `d2.study#1`, `collapse#0`. `resolveText` must expose which variant it picked. That's a small change to `engine.ts` and `play.ts`.
- **Manifest** `content/hotseats/kodak/video.json`, server-only like `hotseat.json`, maps each key to `{ src720, src540, poster, hold, dur, textHash }`. `server/content.ts` reads it. `play.ts` adds `video?: {...}` to each `Screen` and to the `Reveal`. The phone never sees the manifest.
- **What stays as app overlay, never baked into the video:** hearts, meters, the *Real history* / *Our estimate* badge (it depends on the path), the verdict sheet (why, what would have worked, what the company did), Hindsight, XP. These are the same for every path, and the badge must never be wrong.
- **The decision setup** segment narrates the setup and the question, then ends on a held frame. The advisor line and the three option labels appear in the drawer as text, not voiced. That keeps labels quick to reread and options out of the video.
- **Off-path text is already written per path**, so each variant is simply another segment. No new writing is needed.

### Size of the Kodak job

Pace: about 2.5 spoken words a second (MMH pace at speed 1.06, slowed a little for basic-English listeners), plus about 1.5 seconds of head and tail per segment.

| Group | Segments | Seconds |
|---|---|---|
| Opening (intro, lab) | 2 | ~40 |
| Bridges (sony1981 ×3, web2001 ×4, last2006 ×4) | 11 | ~186 |
| Decision setups (d1–d4) | 4 | ~64 |
| Option outcomes (12 options, 14 texts) | 14 | ~201 |
| Endings (8 variants) | 8 | ~112 |
| **Total** | **39** | **~603 s ≈ 10 min → ~61 review windows** |

One play of the real path watches about 227 seconds (3.8 minutes) of video. A whole run takes 6–7 minutes, counting drawers and verdict sheets.

---

## 3. Format and in-browser interaction

### Resolution: 720×1280, 30 fps, H.264 High profile, AAC mono

- The source footage is 320–640 px wide, so 1080×1920 adds bytes without adding detail. Text and paper plates look sharp at 720p on 720p and 1080p phone screens.
- Encode a second version at **540×960** for slow connections.
- **4:3 footage in a 9:16 frame:** a full-screen centre crop of a 320×240 clip keeps about 135 px of width. That's mush. Use full-screen 9:16 only for hero shots taken from archive.org originals and upscaled once with the skill's lanczos and unsharp settings. Otherwise use the MMH devices: a **rounded footage card on a paper plate**, 4:3 stacked in a top or middle band, or splits. This makes the "every phrase needs a fitting picture" rule realistic.
- Remotion composition: `width 720, height 1280, fps 30`. Caption sizes scale from the skill's 1920-tall values by 0.667: S ≈ 33 px, L ≈ 72 px, XL ≈ 103 px. Bump S to about 36 px so a basic-English reader can read it on a 6-inch phone.

### Safe zones (720×1280)

- **Top 0–150 px:** app HUD (close, hearts, meters, badge). No captions here.
- **Captions in a band at about 52–68% of the height** (y ≈ 670–870). MMH puts captions near centre-low anyway.
- **Bottom 15% (y > 1090):** progress bar and the skip-to-question control.
- The drawer only appears while the video is paused on its final frame. It may cover captions, but each setup ends on a **"question frame"**: footage dims, and the question is set large in the **top half** (y 200–560), so it stays readable above a drawer that covers about 45%.

### The pause, blur and drawer

1. A setup segment ends. Its final ~0.6 s is rendered as a blur-and-dim ramp (Remotion `filter: blur()` on the footage layer, captions settling into the question).
2. Remotion also writes **`<key>_hold.webp`**, the last frame, already blurred, about 40 KB. On the `ended` event (or `timeupdate` ≥ dur − 0.05 as a fallback) the app shows this still over the video and slides the drawer up (shadcn `Drawer`/vaul, styled with our `.tile`s).
3. **Bake the blur instead of using CSS `backdrop-filter` over a live or paused `<video>`.** On mid-range Android (Mali and Adreno GPUs), `backdrop-filter` over a video layer is expensive, sometimes flickers, and keeps the compositor busy. A baked still costs nothing and looks the same on every phone. If a live blur is ever needed, draw the current frame onto a tiny canvas (about 90×160) and scale it up with CSS `filter: blur(8px)`. That's cheap and works on any frame.
4. The player taps an option → the "Lock it in" sound plays → the outcome segment plays (see answer hiding in §4) → after the outcome, the verdict sheet slides up over that segment's own `_hold.webp`.

### One `<video>` element plus one preloader

- `<video playsinline webkit-playsinline preload="auto">`, never `controls`. Captions are burned in, so there's no track UI.
- **iOS Safari:** inline playback needs `playsinline`. Playback with sound needs a user gesture. The Hot Seat already starts with a tap, so call `play()` inside that tap. Then **reuse the same element** for every segment (swap `src`, then call `play()`). iOS keeps an element unlocked once it has played with a gesture. A second element would need its own gesture.
- **The tap that picks an option is a gesture too.** Call `video.play()` synchronously in the tap handler on a short "locking in" sting already loaded (or on the hold frame, muted), then swap to the outcome `src` when `/api/play` replies. That avoids losing the gesture after an `await`, which Safari is strict about.
- **Preloading:** a second, hidden `<video preload="auto" muted>` loads the *next known* segment while the current one plays. Use it for the next bridge or setup only, never an outcome. When it's time, move its `src` to the main element; the HTTP cache makes that start almost instantly. Android Chrome honours `preload`. iOS mostly ignores it, so on iOS also issue a `fetch()` for the first ~500 KB (`Range: bytes=0-524287`) to warm the cache.
- **Controls:** tap to pause or resume; a "⟲ 5 s" button; "Skip to question" (fast readers will want it, and how often they use it is a useful signal); mute. Volume follows the existing sound settings.

---

## 4. Delivery

### Sizes

| Version | Video | + audio 64k | MB per minute | Real-path run (3.8 min) | Full tree (10 min) |
|---|---|---|---|---|---|
| 720×1280, CRF ~26, cap 1.2 Mbps | 1.2 Mbps | 0.06 | **~9.5** | **~36 MB** | ~95 MB |
| 540×960, cap 0.6 Mbps | 0.6 Mbps | 0.06 | **~5** | **~19 MB** | ~50 MB |

Archive grain and film flicker are hard to compress. Keep a light grade, and don't add synthetic grain on top of the real grain, or the bitrate climbs. Today's still-and-text run is a few MB, so **video costs 5–10× more data**. On a typical 1.5–2 GB/day Jio or Airtel plan that's about 1–2.5% of the day per run. That's fine for most players, but a data-saver mode is required.

### MP4 segments, not HLS

- Segments are 10–40 seconds long, so switching quality mid-segment buys little. Progressive MP4 with `-movflags +faststart` starts after the first ~100–200 KB, works in every browser natively, and needs no hls.js in the bundle.
- **Choosing a version:** start at 540p if `navigator.connection.saveData` is on or `effectiveType` is not `4g`. Otherwise use 720p. After each segment, measure its download rate and step down if it was below about 2× the bitrate. iOS has no `navigator.connection`, so use the measured rate only.
- Move to HLS or Cloudflare Stream only if stalls show up in the data (see §6).

### Hosting: Supabase Storage for the pilot

| Option | Cost at 1,000 runs (~36 GB) | Notes |
|---|---|---|
| **Supabase Storage + Smart CDN** (already used, Mumbai) | Pro includes 250 GB cached egress; above that $0.03/GB cached, $0.09/GB uncached → **₹0 for the pilot** | No new vendor. Close to Indian players. Public bucket with immutable caching, or signed URLs. |
| Cloudflare R2 + custom domain | $0.015/GB-month storage, **$0 egress** | Best if video grows. The custom domain needs the zone on Cloudflare; `r2.dev` URLs are rate-limited and not for production. |
| Cloudflare Stream | $5 per 1,000 minutes stored + $1 per 1,000 minutes delivered → about **$4 per 1,000 runs** | Handles quality switching, HLS, signed tokens and thumbnails. Use only if MP4 stalls. |
| Railway static (`public/`) | $0.05/GB egress → about $1.80 | **Avoid.** It adds ~150 MB of video to the git repo and both mirrors, the Node server streams every byte, and there's no CDN in India. |

**Caching:** names are content-hashed and immutable, so set `Cache-Control: public, max-age=31536000, immutable`. A re-render produces a new name, never an overwrite. Posters and holds are cached the same way.

**Online only:** the game stays online-only, with no service-worker caching (the owner's decision). The HTTP cache alone makes replays cheap.

### Keeping answers hidden

The setup video, bridges and endings reveal nothing until a pick is made. **The outcome clips do reveal it**: they tell the story of the result, and a player could guess the grade from it.

1. **Names can't be guessed.** `kodak/<HMAC-SHA256(VIDEO_SECRET, hotseatId|key|textHash)[:20]>_720.mp4`. Nothing about the option or grade appears in the name. The secret lives in Railway env vars.
2. **The manifest is server-only.** `video.json` is read by `server/content.ts`. Extend `npm run check-bundle` to fail if any outcome segment name appears in `.next/static`.
3. **Outcome URLs travel only in the `Reveal`** that `/api/play` returns after the pick. **Never preload all three outcomes**: that leaks the answers through network requests anyone can see.
4. **Don't list the bucket**: public read by exact path only. This is the same "secret name" model as today's narration ids, and enough for a pilot. If it isn't, switch to a private bucket and have `/api/play` mint `createSignedUrl` links that expire after 10 minutes. That costs cache hits on replays.
5. **Media names stay unique across Hot Seats** (`kodak/` prefix plus the hash).

### Data-saver fallback = the current mode

The still-and-text player stays. **Video mode is a layer on top.** The same `Screen` list drives both, so switching mid-run keeps the player's place. Use quick mode (today's still and text) when:

- the player turns on Settings → "Save data (no video)";
- `saveData` is on or `effectiveType` is `2g` or `slow-2g` (ask once: "Video uses about 30 MB. Play with video?");
- **2 stalls longer than 3 seconds in one run** → toast "Slow internet. Switch to quick mode?" and switch with a tap;
- a screen has no `video` (missing or not yet reviewed). That screen uses quick mode silently, which lets a half-built tree ship to testers.

---

## 5. Production pipeline in this repo

### Where things live

```
video/                        # separate Remotion project with its own package.json,
  package.json                #   so Remotion never enters the Next build or bundle
  src/Root.tsx                # one <Composition> per segment key, driven by JSON
  src/mmh/                    # Captions, Plate, FootageCard, Highlighter, BigWord, QuestionFrame, Hold
  footage/                    # gitignored; downloaded originals and upscales
  out/                        # gitignored renders
content/hotseats/kodak/video/
  script.json                 # generated: key → text (verbatim from hotseat.json), textHash, voice text
  vo/<key>.wav                # OmniVoice output
  words/<key>.json            # {duration, words:[{text,start,end}]}
  shots/<key>.json            # shot list (below)
  review/<key>.json           # sign-off per 10-second window (below)
  sheets/<key>.html           # contact sheets (gitignored, rebuilt)
content/hotseats/kodak/video.json   # server-only manifest written by video:publish
content/hotseats/kodak/media.md     # gains a "Video footage" table: clip id, source page, archive.org original, PD status
```

Remotion licence: check the current terms. It is free for individuals and very small companies; a company licence is needed above that.

### Steps (new npm scripts)

1. **`npm run video:script -- kodak`** walks every node and variant (reusing `hotseat-tree.ts`) and writes `script.json`, one entry per segment key. **The voice text is the `hotseat.json` text, word for word**, so the existing fact-check stamp still covers it and quick mode says the same thing. Allowed changes: spoken forms of numbers and names ("nineteen seventy-five"). If you want punchier MMH-style lines, that's a text edit in `hotseat.json`, which means a copy pass (slopmonster and fluent-prose) and a new fact-check stamp, as today.
2. **Voice** on Atheeb's Mac: extend `scripts/narrate.py`, or follow the skill's Voice Studio `/generate` flow (`profile_id` = the cloned narrator, `speed≈1.06`). It writes `vo/<key>.wav`, about 1–2 minutes per line, so about 1 hour for 39 segments. Advisor lines stay as text in the drawer for the pilot.
3. **Word timings:** `/v1/audio/transcriptions` with word timestamps, aligned to the known text (difflib, as the skill describes) → `words/<key>.json`. Because the text is known, alignment is reliable.
4. **Shot list** `shots/<key>.json`: `[{ fromWord, kind: "footage"|"card"|"plate"|"doc"|"split", clipId, sourceUrl, in, out, crop, grade, push, note }]`, plus `captions: [{ words:[i..j], size:"S"|"L"|"XL" }]` and `sfx: [{ atWord, name }]`. Draft it with Claude from `script.json` plus archive searches (literal queries per phrase, top 3–4 clips downloaded, contact sheets per clip). Facts become paper documents with a highlighter wipe, and their figures must match `factcheck.md`. Run the house rules as automatic checks: no logos (crop the Kodak yellow), no face next to a line about someone else, period-correct, Indian setting only where the story is Indian.
5. **Render:** `npm run video:render -- kodak [key…]` → `out/<key>_720.mp4`, `_540.mp4`, `_poster.webp` (first frame), `_hold.webp` (blurred last frame), plus a **render hash** over the shots, words, wav and code version. Loudness: VO at about −16 LUFS integrated. The music bed sits at −28 to −24 under the voice and **ends within each segment**: no bed running across pauses, because the drawer moment should be quiet. App sounds (lock in, verdict) already exist in `public/sfx`. Only use music and SFX with a recorded licence (`docs/SOUNDS.md`).
6. **Review** (below). 7. **`npm run video:publish -- kodak`** uploads only segments whose current render hash is fully signed off, under HMAC names, and writes `video.json`. 8. **`hotseat:check`** gains warnings: segment missing, `textHash` stale (the text changed after the render), or review not signed for the render hash. While the experiment runs, these are warnings, not errors.

### "Every 10 seconds reviewed": the process

**A window** is `[key, 0–10 s]`, `[key, 10–20 s]` and so on. A segment of 23 seconds has 3 windows. Kodak has about 61 windows in total.

**`npm run video:sheet -- kodak <key>`** renders one HTML contact sheet per segment:

- per window: **10 frames, one per second** (Remotion `renderStill`), plus the **cut points marked with the word they cut on**;
- the VO words for the window, laid out under the frames with their timings;
- each shot's source: clip title, year, archive link, and whether it's public domain or a credited insert;
- facts shown on paper, next to the matching `factcheck.md` claim;
- a 10-second MP4 snippet of the window embedded so it plays with sound;
- a loudness reading for the window.

**The checklist** for each window (pass or fix):

1. Every picture fits the words being spoken: subject, setting and period.
2. No logo or readable brand name. No real face next to a line about someone else.
3. Captions: grammatical chunks, every chunk on screen for at least 0.6 s, readable on a phone (check the 540p version), at most one big word in the window.
4. Facts on paper match the fact-check, with the highlighter on the right words.
5. Cuts land on the word, with no flash frames or black frames.
6. Audio: voice clear over music, no clicks, levels inside the target.
7. *Setup segments only:* nothing in the window hints at the answer (no footage of the outcome).
8. Nothing is baked in that the app overlays (badge, hearts).

**Sign-off file** `review/<key>.json`:

```json
{ "renderHash": "9f3c…", "windows": [
  { "w": 0, "status": "ok",  "by": "Atheeb", "at": "2026-11-10", "note": "" },
  { "w": 1, "status": "fix", "by": "Atheeb", "at": "2026-11-10", "note": "shot 4 shows a Polaroid, not a Kodak-era camera" } ] }
```

**Rules:**

- `video:publish` refuses a segment unless every window is `ok` for the **current** `renderHash`. Re-rendering resets only the windows whose frames changed, which the tool can work out by comparing the per-second stills.
- Claude, in a fresh context (as the fact-check step works), reviews first and fills in the sheet with suggested statuses.
- Atheeb makes the final call on every window, on his phone, with sound.
- About 61 windows at roughly 1 minute each is about an hour of owner review for the whole tree, plus re-reviews.

---

## 6. Pilot scope, effort and success test

### Stage 1: vertical slice (about 1 week of work, ~100 s of video, 10 windows)

- **Video:** opening (intro and lab, ~40 s) + d1 setup (~16 s) + the three d1 outcomes (~45 s). That's 6 segments. Everything after d1 runs in quick mode.
- **App:** the video layer in the Hot Seat player (one element plus a preloader, held frame and drawer, controls, data-saver switch). `play.ts` and `engine.ts` pass the variant index and attach `video`. Manifest and `check-bundle` rule. Supabase bucket. An `?video=1` flag or a dev toggle.
- **Pipeline:** the `video/` Remotion project with the MMH components, `video:script`, `video:render`, `video:sheet`, the review file and `video:publish`.
- **Effort:**
  - footage hunting, shot lists and render polish: ~6–8 hours per finished minute → about 12 hours;
  - Remotion components: about 1.5 days;
  - app player: about 2 days;
  - scripts and checks: about 1 day;
  - owner review: about 20 minutes.

**Gate 1 (owner plus 5 testers):** 5 people from the audience (wannabe or struggling founders, basic English), each on their own mid-range Android, on mobile data, ideally one on the move. Each plays the slice in video mode, then the same part in quick mode, in alternating order. Ask:

- (a) "Which one would you play tomorrow?"
- (b) "What happened in the story?" Recall shows whether they followed it.
- (c) Any moment it stalled or confused them.

Also note whether anyone uses "Skip to question".

**Go on to Stage 2 if:**

- at least 4 of 5 prefer video;
- recall is no worse than in quick mode;
- there are no stalls longer than 3 s on 4G;
- **Atheeb, watching all 100 seconds cold on his own phone, wouldn't cut it.**

### Stage 2: full Kodak tree (about 2–3 more weeks of part-time work)

The remaining 33 segments, about 500 s and about 51 windows. That's roughly 50–60 hours of footage and render work. Voice takes about 1 hour of machine time. Review takes about 1 hour of owner time plus fixes.

**Live A/B test:** new players who open Kodak are split 50/50 by a seed from their player id (signed-in players and guests alike). Data-saver users go to quick mode and are counted separately. Log through the existing API routes:

- start → finish rate;
- drop-off per screen;
- run time;
- Skip-to-question use;
- stalls and data used per run;
- whether the player starts another Hot Seat that day.

**Decision after about 200 runs per arm** (or 3 weeks):

| Result | Next step |
|---|---|
| Video finish rate ≥ quick-mode rate + 10 points, **and** next-Hot-Seat rate no worse, **and** stalls under 1 per run | Make video the default and plan the next Hot Seat (Intel, or an Indian story once Indian footage is found). |
| A gain under 5 points, or a lot of skipping | The narration and pace are the problem, not the visuals. Test a rewritten, punchier script in quick mode before spending more on video. |
| Worse on data or stalls | Try Cloudflare Stream (quality switching), or make video opt-in. |

### Risks to watch

- **Footage fit:** archive shots may still feel random, which is the complaint about today's images. Card-on-plate framing and the per-window "picture fits the words" check are the guard.
- **Reading load:** captions plus drawer plus verdict is a lot for basic-English players. Keep captions sparse.
- **Translations later:** each language needs new voice, timings and captions over the same shot list.
- **Text edits** after a render make segments stale. `hotseat:check` warns, and quick mode covers the gap.

---

Sources:

- [Supabase egress docs](https://www.supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Supabase changelog: 3× cheaper egress for cache hits](https://supabase.com/changelog/38119-3x-cheaper-egress-for-cache-hits.md)
- [Railway pricing](https://docs.railway.com/reference/pricing)
- [Railway: understanding your bill](https://docs.railway.com/pricing/understanding-your-bill)
- [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- [Moving Image Archive](https://www.movingimagearchive.com) (API probed directly on 30 Oct 2026)
