# The wolf ambassador, landing page and founding offer

Agreed with Atheeb on 3 Nov 2026. Built in the order of the sections below; each ships on its own.

## 1. The wolf

- An original character, the face of the brand, the in-app mentor and the Hot Seat advisor.
- **Dress, as in Atheeb's reference images:** dark charcoal pinstripe three-piece suit, white shirt, deep-red
  tie, gold tie bar, gold rings, a cup in hand, a calm sly smile.
- **His own marks** (so he is not the wolf from another app's ad): a white streak through one ear, a small
  scar across one eyebrow, amber eyes. Try a steel cutting-chai glass as his cup.
- **World:** moody Indian city nights (rain, warm lamp light, neon signs with no readable text).
- **Pictures:** generated in ChatGPT on Atheeb's sign-in, no logos or readable text. One hero portrait,
  then a pose set on plain backgrounds for small cut-outs: pleased, thinking, warning, worried,
  celebrating, pointing, sly grin, shocked.
- Atheeb approves the look before the pose set is made.

## 2. Landing page (`/`)

- Mobile first. The wolf is the hero picture.
- Every image comes in three widths as AVIF with WebP fallback via `<picture>` and `srcset`:
  - portraits at 400, 800 and 1086 px (the masters are 1086 px wide);
  - poses at 128, 256 and 512 px.
- The hero image is preloaded; the rest load lazily. Target: first screen under about 150 KB.
- **Sections:**
  - **Hero:** "Learn business from real Indian stories", with Play free.
  - **The path:** lessons, then Hot Seats.
  - **A real sample decision:** Nirma's first decision, which you can tap. Only that one is free here;
    `/api/play?site=1` refuses a second pick with the paywall on.
  - **The founding offer:** ~~₹199~~ ₹99 a month, "Founding price, only for the first 1,000 members." No seat count.
  - **A short FAQ:** price, cancelling, what's free.
  - **Footer.**
- The page reflects today's product. Lessons come first. It drops the Hot Seat grid with its wall of
  "Coming soon" (one playable decision shows what a Hot Seat is) and has no Daily Call copy.

## 3. The founding offer

- **Offer:** "Founding Member: ₹99 a month, locked while you stay subscribed", for seats 1–1,000 (raised from
  500 by Atheeb, 4 Nov 2026). The offer closes itself at 1,000 and never reopens at that price. Cancelling gives
  up the price.
- **How the price is shown (Atheeb, 4 Nov 2026):** wherever the founding offer appears (the landing page's
  founding section and FAQ, the paywall sheet), the regular price is struck through next to ₹99:
  `<s>₹199</s> ₹99 a month` (a real `<s>`, read aloud as "was ₹199, now ₹99 a month"), with the line
  "Founding price, only for the first 1,000 members." Both numbers come from `src/lib/offer.ts`.
- **Why striking ₹199 is honest:** ₹199 a month is the real regular price, and it is what new members are
  charged once the founding seats are gone. It is not an invented "was" price.
- **No seat counts for players:** players never see how many seats are taken or a seat number (not on the
  landing page, the paywall or Profile). `/api/seats` sends only `{ open }`; the landing page reads the
  same status on the server only to switch to the regular plans when the seats are full.
- **Regular price:** ₹199 a month, or ₹1,499 a year (≈ ₹125 a month). The weekly plan is dropped.
- **Not allowed, by India's CCPA dark-patterns guidelines (2023) and the Consumer Protection Act s.2(47):**
  - a "people watching now" number that isn't real;
  - a crossed-out price nobody pays (₹199 is struck only because it is the real price after the founding
    seats);
  - a free trial that needs AutoPay;
  - a hidden cancel.
- **Cancelling:** one tap in Profile; cancelling from the UPI app also works.
- **Paywall placement:** after the free tier (Module 1.1 plus Kirana Year, see §4a).
- **To confirm before going live:** GST (with a CA) and the Razorpay fee on the account.

## 4. Payments (Razorpay Subscriptions)

- **Plans:** one plan for ₹99 a month (founding) and later ones for ₹199 a month and ₹1,499 a year. UPI
  AutoPay and cards.
- **Subscription and checkout:** the server creates the subscription and opens Razorpay Checkout.
- **Webhook:** checks the `X-Razorpay-Signature` HMAC. Access and a seat are granted only on a confirmed
  payment event, each handled once (keyed by event id).
- **The 1,000 limit:** enforced in Postgres (a counted insert under a lock), never on the phone.
- **Keys:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` live only in Railway. Atheeb
  pastes them himself; the secret never reaches the browser bundle (`check-bundle`).
- **Rollout:** build and test end to end in Razorpay test mode first, then switch to live keys.
- **From the seat-table review (3 Nov), to settle in the payments plan:**
  - **Seat numbers:** hand them out as the lowest free number, or `max(seat_no)+1`, under a lock. Never use
    `count(*)+1`.
  - **Seats stay used:** a seat must not reopen when someone deletes their account. Make `user_id` nullable
    with `on delete set null` (personal data still goes), and mark cancellations with a `cancelled_at`
    column instead of deleting the row.
  - **Account deletion:** cancel the player's Razorpay subscription first, so AutoPay never charges a
    deleted account. Add a test for it.
  - **Paywall seat checks:** use the database check under the lock, never the cached count the landing page
    shows.

### 4a. Paywall and payments decisions (Atheeb, 4 Nov 2026)

- **Free for everyone (Atheeb, 4 Nov 2026):** only the first module of Unit 1 (Module 1.1,
  `u1-where-money-goes`): its five lessons, its test-out and its Hot Seat gate, the Kirana Year story.
  `freeItems` reads the first module of the first unit from `course.json`. Module 1.2 and the Nirma Hot Seat
  are paid. This replaces "all of Unit 1" (and the earlier "Module 1 + Kingfisher"). The website's sample
  shows Nirma's first decision only.
- **Members:** everything else.
  - **Who counts as a member:** a player whose subscription is `active`, or one who cancelled or missed a
    payment but whose paid period hasn't ended.
- **Early players keep what they finished.** At launch, a one-time snapshot copies every lesson and Hot
  Seat each signed-in player had finished into `early_access`, taken from the server's own records
  (`lesson_plays`, `runs`), never from a phone's save. Those items stay open; new ones need membership.
- **Guests:** play the free module without signing in. To pay, they sign in with Google first; the checkout is tied
  to the account.
- **Switch:**
  - **Off (`PAYWALL_ON` unset):** nothing is locked, except for accounts listed in `PAYWALL_TESTERS`, who
    see the paywall and the test checkout.
  - **Why:** Razorpay can't send test webhooks to localhost, so the end-to-end test runs on Railway with
    test keys and only testers affected.
  - **Going live:** switch to live keys and set `PAYWALL_ON=1`, after Atheeb has checked GST with his CA.
- **Seats:**
  - **Holding a seat:** starting a founding checkout holds the lowest free seat for 30 minutes
    (`held_until`).
  - **Keeping it:** the first successful charge keeps the seat for good.
  - **Expiry:** a hold that runs out frees the seat.
  - **Lasting seats:** a seat that was paid for is never freed. A cancellation sets `cancelled_at`, and
    deleting an account sets `user_id` to null.
  - **What counts as taken:** paid seats plus live holds (used only to close the offer; never shown).
  - **The founding price:** offered only while seats are free.
- **Paywall moment:** opening a locked lesson, test-out or Hot Seat shows the wolf (pointing pose) and the
  offer. The course map shows a small lock on locked items for non-members. Nothing is locked
  mid-lesson.
- **Server enforcement:** checked in `/api/lesson`, `/api/lesson/finish`, `/api/play` and
  `/api/run/finish`. A refusal returns 402 `{ error: "members_only" }`.
- **Cancelling:** one tap plus a confirmation in Profile cancels at the end of the paid period. Deleting an
  account cancels the subscription first.

## 5. The wolf in the app

- **Hot Seats:** "Advisor" becomes the wolf, with a small pose picture on the left of each advisor line,
  chosen by the moment (warning before a risky call, pleased after a great one).
- **Mentor moments:** Home greeting, streak and lesson-done screens.

## 6. His voice

- **Voice:** a new voice designed in VoiceStudio, from a description: a deep, slow, gravelly, calm,
  amused mafia-don voice with an Indian accent. It is not cloned from any recording.
- **Choosing:** two or three versions; Atheeb picks one.
- **Re-recording:** every advisor line is recorded again in the chosen voice (unattended, a few hours).
