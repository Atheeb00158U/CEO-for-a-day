# Website scenes

The website's pictures (`/`). The page sells who the player becomes, so the pictures follow one shopkeeper from a
worried night to a calm sunrise, show founders together in the Club, and put the wolf (the mentor) in the hero: in
the boss's chair between a kirana street and the towers of big business, half in a shopkeeper's kurta with chai, half
in his pinstripe suit with a fountain pen. Two quieter scenes show the chair empty, waiting for the player. No
archive picture fits, so each was generated with ChatGPT in the browser on Atheeb's sign-in (5 Nov 2026), following
`docs/AUTHORING.md` step 5: no logos, no readable signs, no real person's likeness. The people pictures were made in
the same chat as the wolf's poses, so the style and the wolf stay the same.

Masters are 1672×941 WebP. `npm run brand` (run before `dev` and `build`) serves each one wide (16:9) for screens
from 768 px and as a 4:5 crop around `focus` (in `src/lib/brand.ts`) for phones. The hero is the exception: on a
phone it shows a square from the middle of the wide picture, so the wolf and both worlds fit.

| File | Where | Scene |
| --- | --- | --- |
| `empire.webp` | Hero | The wolf in the chair: kirana street on one side, glass towers on the other (square crop on phones) |
| `alone.webp` | "Be honest. Is this you?" | A young shopkeeper alone in his shop at night, worried over his account book |
| `shop.webp` | "School did not teach you this." | The empty chair behind a kirana counter at dawn, an open khata |
| `rise.webp` | "Who you become" | The same shopkeeper months later at sunrise, calm, his shop bigger and busy |
| `club.webp` | "Meet other founders" | Young founders around a table in an Irani café at night, the wolf listening |
| `dairy.webp` | The close | The empty chair in a misty Gujarat field at dawn, steel milk cans |

The shopkeeper and the founders are made-up people drawn in the wolf's painted style (made in the same ChatGPT
chat as the wolf), not anyone real.
