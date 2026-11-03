// Makes the wolf's served pictures from the masters in content/brand/wolf/:
// public/brand/wolf/<name>-<width>.avif and .webp for every width in src/lib/brand.ts.
// Runs before `next dev` and `next build`; skips files that are already newer than their master.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { WOLF } from "../src/lib/brand.ts";

const SRC = "content/brand/wolf";
const OUT = "public/brand/wolf";
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const [name, img] of Object.entries(WOLF)) {
  const master = join(SRC, `${name}.webp`);
  const at = statSync(master).mtimeMs;
  for (const w of img.widths) {
    for (const ext of ["avif", "webp"]) {
      const dest = join(OUT, `${name}-${w}.${ext}`);
      if (existsSync(dest) && statSync(dest).mtimeMs > at) continue;
      const s = sharp(master).resize({ width: w, withoutEnlargement: true });
      await (ext === "avif" ? s.avif({ quality: 50, effort: 4 }) : s.webp({ quality: 74 })).toFile(dest);
      made++;
    }
  }
}
console.log(`brand: ${made} image(s) made in ${OUT}`);
