# What's missing before launch

The prototype has the game loop, the design system, one complete Hot Seat (Kodak, 79 mapped paths), XP, streaks with freezes, a 2× booster, coins, daily quests, a weekly league, revision notes, badges and a decision profile. Everything below is still needed.

## 1. Biggest product gap: a daily habit that takes 1 minute
A Hot Seat takes 5–8 minutes. That's too long to protect a daily streak. Add a **Daily Call**: one decision from a real company, answered in under a minute, that keeps the streak alive. Hot Seats then become the "main episodes" people play when they have time.

## 2. Content
- **Volume:** about 20 Hot Seats at launch, then 1–2 a week. Write Indian cases early (for example Maggi 2015, Jio, Nokia in India, Kingfisher, Paytm). That audience wants stories it recognises.
- **Fact-checking and legal review for every Hot Seat.** Real companies and living people are involved. Avoid companies in active litigation, never put invented words in real people's mouths, and use no logos.
- **Authoring tool:** a simple editor that writes the Hot Seat JSON, runs the validator, and shows the tree map. Writers shouldn't edit TypeScript.
- **Images:** from the four archives in `AUTHORING.md` step 5, with a reviewer catching anachronisms. The AI images already in the app stay until replaced.
- **Copyright check before charging money:** film stills (FILMGRAB) and fashion shoots used as credited inserts are still someone else's copyright. Credit alone doesn't make them safe in a paid app; get a lawyer's view or a licence, or swap them for public-domain footage.

## 3. Accounts and backend
- ~~Phone-number OTP sign-in~~ Google sign-in, with guest play first (done 2026-10-30). Phone OTP can come later; it needs an SMS provider and DLT registration.
- ~~Cloud save~~ Done: signed-in progress lives on the server.
- ~~Real leagues~~ Done: the server replays each path, so scores can't be faked. Groups of up to 30, settled weekly.
- Friends, following and referral codes.

## 4. Money
- **Payments:** Google Play Billing and Apple in-app purchase inside the store apps (required for digital subscriptions there), and Razorpay with UPI Autopay on the web.
- **Free vs paid:** decide what's free. A suggestion is the Daily Call plus your first Hot Seat, with the paywall after the first debrief, when the player has just felt the value.
- **Pricing:** your current plan is ₹599/week, ₹1,499/month, or ₹999/month billed yearly (₹11,988/year). Test it against a lower yearly price before committing; Empirio charges $89.99/year in the US.
- GST registration, invoices and a refund policy.

## 5. Languages (after the English launch)
- An i18n layer for the UI text (for example `next-intl`), plus one content file per language for each Hot Seat.
- Fonts for Indian scripts (Noto Sans Devanagari, Tamil and Bengali).
- **Voice:** narration is made with OmniVoice. Its code is Apache 2.0, but the model weights are CC-BY-NC (non-commercial). Atheeb has chosen to use it; confirm the licence position before charging. OmniVoice also covers Hindi, Tamil and Bengali.

## 6. Distribution
- Make the app installable from the browser (a PWA; online only, no offline play), then wrap it for the Play Store with a Trusted Web Activity or Capacitor. Do iOS later.
- **Performance on cheap Android phones:** keep images and clips small, and add a data-saver mode that skips video.

## 7. Retention and growth
- **Notifications:** streak reminders via push are built (2026-10-30). WhatsApp reminders are still to do. WhatsApp reminders work well in India, but need opt-in and an approved template.
- **Share cards:** for example "I beat Kodak's real CEO, 92/100", made for WhatsApp and Instagram stories.
- **Friend duels:** two players take the same Hot Seat and compare scores.
- **Streak wager:** bet coins on keeping a 7-day streak. Duolingo reported its wager test raised Day-7 retention by 14%.
- **Timed crisis decisions:** occasional calls with a countdown, to add pressure.

## 8. Measurement
- Product analytics (for example PostHog or Firebase): Day-1, Day-7 and Day-30 retention, Hot Seat completion rate, where players quit, and paywall conversion.
- Make the A/B testing setup ready from day one; most of the retention wins will come from experiments.

## 9. Legal and trust
- Privacy policy and consent under India's Digital Personal Data Protection Act, 2023, plus terms of service.
- A disclaimer that the app is education, not business or financial advice.
- A notice explaining that alternate-history outcomes are estimates (already labelled in the app).
- A credits log for every archive clip and its public-domain source.
- An age rating, and a support or feedback channel.

## 10. Polish still to do in the prototype
- Sound effects (correct, wrong, level up), haptics, and a confetti moment on the debrief.
- A first-run onboarding flow: name, goal, a short tutorial decision.
- Two out-of-period images to regenerate (the 1900 box camera and the 1976 store).
