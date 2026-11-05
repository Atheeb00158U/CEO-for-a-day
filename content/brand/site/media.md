# Website scenes

The website's pictures (`/`). One idea runs through all five: the same empty leather boss's chair, the Hot Seat,
waiting in a real Indian place. No archive picture fits that idea, so each was generated with ChatGPT in the
browser on Atheeb's sign-in (5 Nov 2026), following `docs/AUTHORING.md` step 5: no logos, no readable signs, no
real person's likeness, no airline colours.

Masters are 1672×941 WebP. `npm run brand` (run before `dev` and `build`) serves each one wide (16:9) for screens
from 768 px and as a 4:5 crop around `focus` (in `src/lib/brand.ts`) for phones.

| File | Where | Scene |
| --- | --- | --- |
| `street.webp` | Hero | A wet Mumbai street of small shops at night, monsoon rain |
| `shop.webp` | "Learn one rule" | Behind the counter of a kirana at dawn, an open khata and a glass of chai |
| `chai.webp` | "Remember it" | A chai stall on a sea-side promenade at dusk, blank cards on the seat |
| `tarmac.webp` | "Take the Hot Seat" | An airport apron at sunrise, a row of plain white jets |
| `dairy.webp` | The close | A misty Gujarat field at dawn, a banyan tree and steel milk cans |

`public/site/lesson-guess.webp` is a real screenshot of the game (the first lesson's "guess first" question, Jet
Airways), with the empty middle of the screen cut out so it fits the panel. Retake it if that screen changes.
