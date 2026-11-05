# Analytics

PostHog, EU cloud (`https://eu.i.posthog.com`). Off until `NEXT_PUBLIC_POSTHOG_KEY` is set; with no key, posthog-js never loads.

- **Phone:** `track(event, props)` in `src/lib/analytics.ts`. It loads posthog-js on the first call (only in `/app`, never on `/`). Autocapture, session recording, surveys, heatmaps and feature flags are all off. Do Not Track turns it off.
- **Server:** `capture(userId, event, props)` in `src/lib/server/analytics.ts`, for what only the server knows: a verified payment and Razorpay's webhooks.
- **Who:** guests get PostHog's random id; signed-in players are identified by their Supabase user id only (`identify` in `store.tsx`). Signing out resets the id.
- **Never send:** an email, a name, typed text, the option a player picked, its grade, `why` or takeaway. Ids of lessons, screens and Hot Seats are fine.

## Events

| Event | Where | Properties |
| --- | --- | --- |
| `$pageview` | first load of `/app` | (PostHog's own; URL hash and sign-in code removed) |
| `app_opened` | every visit to `/app` | `installed` (opened from the home screen) |
| `onboarding_step` | each welcome screen | `step`: hook, doing, focus, minutes, `tour_<beat>`, lesson, trial, play |
| `onboarding_done` | welcome screens left (finished or skipped) | `at` (the step they left on), `doing`, `focus`, `minutes` |
| `lesson_started` | lesson or test-out opened | `lesson` or `test_out` |
| `lesson_screen` | each screen shown | `lesson`/`test_out`, `screen` (id), `kind`, `answered` |
| `lesson_finished` | lesson saved | `lesson`/`test_out`, `xp`, `accuracy`, `passed` (test-outs) |
| `lesson_quit` | ✕ in a lesson | `lesson`/`test_out`, `answered` |
| `hotseat_started` | Hot Seat opened (or replayed) | `hotseat` |
| `hotseat_decision` | each decision made | `hotseat`, `decision` (its number) |
| `hotseat_ended` | run saved | `hotseat`, `ending` (legend, survivor, collapse, fired), `decisions`, `hindsight` |
| `hotseat_quit` | ✕ in a Hot Seat | `hotseat`, `decisions` |
| `paywall_shown` | the offer sheet opens | `from` (lesson, test_out, hotseat, club, profile), `by` (tap, server, button), `item` |
| `paywall_plan_picked` | monthly/yearly tapped | `plan` |
| `checkout_opened` | Razorpay Checkout opens | `plan` |
| `checkout_closed` | closed without paying | `plan` |
| `checkout_failed` | couldn't start or Checkout failed | `plan`, `reason` |
| `payment_failed` | a payment attempt failed inside Checkout | `reason` (Razorpay's code) |
| `checkout_paid` | `/api/pay/verify` said yes | `plan` |
| `checkout_unconfirmed` | paid, but verify didn't answer (the webhook will) | `plan` |
| `payment_verified` | server: signature checked | `plan` |
| `subscription_activated`, `_charged`, `_pending`, `_halted`, `_cancelled`, `_completed` | server: Razorpay webhook | `plan`, `status` |
| `sign_in_started` | the redirect sign-in (fallback) | `via` |
| `signed_in` | Google's button signed in | `via` |
| `install_sheet_shown` | "Get the app" sheet | `way` (button, ios, android, inapp) |
| `install_prompt` | Chrome's install dialog answered | `outcome` |
| `app_installed` | the app was added | |
| `notifications_on` | reminders turned on | `hour` |
| `notifications_refused` | the phone's permission was refused | |
| `notification_opened` | a notification tapped | `kind` (streak, winback, morning, cards, league, club, chat…) |

## Setting up the dashboard (in PostHog)

- **Retention:** Retention insight, "first time" `app_opened` → returning `app_opened`, by day: read Day 1, Day 7 and Day 30.
- **Where players quit:** funnel `lesson_started` → `lesson_finished`, broken down by `lesson`; trend of `lesson_screen` by `screen` for one lesson shows the screen they stop on. Same with `hotseat_started` → `hotseat_ended` and `hotseat_decision` by `decision`.
- **Onboarding:** funnel over `onboarding_step` with each `step` value in order.
- **Paywall:** funnel `paywall_shown` → `checkout_opened` → `checkout_paid`, broken down by `from`. `payment_verified` and `subscription_charged` are the server's truth.
