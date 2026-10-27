# Handoff to Claude Code

## How to start
1. Open Terminal and run:
   ```
   cd ~/Documents/ceo-for-a-day
   npm install
   claude
   ```
2. Paste the prompt below as your first message.

---

## Kickoff prompt (copy everything in the box)

```
You're taking over CEO For A Day, a mobile-first, dark-mode learning game built in Next.js.
Players sit in the "Hot Seat" of a real company as its CEO, make its big decisions, and
learn from what really happened. A working prototype is already in this folder.

Before writing any code:
1. Read CLAUDE.md, docs/HOT-SEAT-DESIGN.md, docs/BUILD-PLAN.md and docs/LAUNCH-CHECKLIST.md.
2. Run npm run validate and npm run dev, and play the Kodak Hot Seat once through the code
   paths so you understand the engine, scoring, board trust and the debrief.
3. Reply with a short summary of what exists, anything that looks broken, and the
   questions you need me to answer for Phase 0 and Phase 1. Wait for my answers.

Then build the product end to end by following docs/BUILD-PLAN.md phase by phase:
- Use plan mode at the start of each phase. Show me the plan, then build it.
- Keep a task list for each phase and tick items off in BUILD-PLAN.md as you finish them.
- After each phase: run lint, tests, npm run validate and npm run build, commit with a
  clear message, and give me a short demo note (what to click, what changed).
- Keep engine.ts and the Hot Seat format as the core. Extend them, don't rewrite them.
- Ask me before you sign up for any paid service, add a secret or API key, pick any vendor
  marked "decision", or change pricing, the app name or the "Hot Seat" wording.
- Keep the UI copy in simple English and never write "case study" in the UI.
- Never use a live LLM call during gameplay. Personalisation is pre-mapped or pre-generated
  and reviewed.
- Real history must be sourced. Alternate outcomes must be labelled as estimates.
- Media: archive footage from movingimagearchive.com first. Generated images come from
  ~/Documents/case-game/get_assets.sh, which I run on my Mac (Z-Image Turbo via mflux).
  Narration comes from scripts/narrate.py (Kokoro-82M).

Start with step 1 now.
```

---

## What's already decided
- **Name:** CEO For A Day. A single story is a **Hot Seat**.
- **Audience:** wannabe and struggling entrepreneurs in India. English first; Hindi, Tamil and Bengali near launch.
- **Pricing:** ₹599 a week, ₹1,499 a month, or ₹999 a month billed yearly.
- **Ordering:** each player gets a random order of Hot Seats. No difficulty labels are shown, and the first two are always gentle.
- **Mechanics already in the prototype:**
  - XP and a 2× XP booster
  - Streaks and streak freezes
  - Coins and daily quests
  - Hindsight (redo one call)
  - Board-trust hearts and getting fired
  - Weekly leagues with promotion and demotion zones
  - Badges and a decision profile
  - Personalised revision notes

## What you'll need to provide during the build
- A GitHub repo for the code.
- Accounts for the backend (Supabase or similar), the SMS/OTP provider, Razorpay, the Google Play Console, analytics and error monitoring, once Claude Code proposes them.
- A Claude API key, only for the offline debrief pre-generation script.
- Your picks for the next three Hot Seats, and sign-off on what's free.

## Related folders
- `~/Documents/case-game`: the earlier prototype and the media tools (`get_assets.sh`, raw clips and images).
