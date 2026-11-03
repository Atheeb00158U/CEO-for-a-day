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
  - **A real sample decision:** one decision you can tap.
  - **The founding offer:** with its seat counter.
  - **A short FAQ:** price, cancelling, what's free.
  - **Footer.**
- The page reflects today's product. Lessons come first. It drops the Hot Seat grid with its wall of
  "Coming soon" (one playable decision shows what a Hot Seat is) and has no Daily Call copy.

## 3. The founding offer

- **Offer:** "Founding Member: ₹99 a month, locked while you stay subscribed", for seats 1–500.
- **Seat counter:** "N of 500 founding seats taken", read live from paid founding subscriptions in the
  database. The offer closes itself at 500 and never reopens at that price. Cancelling gives up the price.
- **Regular price:** shown as plain text, never struck through: ₹199 a month, or ₹1,499 a year
  (≈ ₹125 a month). The weekly plan is dropped.
- **Not allowed, by India's CCPA dark-patterns guidelines (2023) and the Consumer Protection Act s.2(47):**
  - a "people watching now" number that isn't real;
  - a crossed-out price nobody has paid;
  - a free trial that needs AutoPay;
  - a hidden cancel.
- **Cancelling:** one tap in Profile; cancelling from the UPI app also works.
- **Paywall placement:** after the free tier (Unit 1 plus Kingfisher), per Atheeb's free-tier rule.
- **To confirm before going live:** GST (with a CA) and the Razorpay fee on the account.

## 4. Payments (Razorpay Subscriptions)

- **Plans:** one plan for ₹99 a month (founding) and later ones for ₹199 a month and ₹1,499 a year. UPI
  AutoPay and cards.
- **Subscription and checkout:** the server creates the subscription and opens Razorpay Checkout.
- **Webhook:** checks the `X-Razorpay-Signature` HMAC. Access and a seat are granted only on a confirmed
  payment event, each handled once (keyed by event id).
- **The 500 limit:** enforced in Postgres (a counted insert under a lock), never on the phone.
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

## 5. The wolf in the app

- **Hot Seats:** "Advisor" becomes the wolf, with a small pose picture on the left of each advisor line,
  chosen by the moment (warning before a risky call, pleased after a great one).
- **Mentor moments:** Home greeting, streak and lesson-done screens.

## 6. His voice

- **Voice:** a new voice designed in VoiceStudio, from a description: a deep, slow, gravelly, calm,
  amused mafia-don voice with an Indian accent. It is not cloned from any recording.
- **Choosing:** two or three versions; Atheeb picks one.
- **Re-recording:** every advisor line is recorded again in the chosen voice (unattended, a few hours).
