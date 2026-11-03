// Makes the wolf's served pictures from the masters in content/brand/wolf/:
// public/brand/wolf/<name>-<width>.avif and .webp for every width in src/lib/brand.ts.
// Runs before `next dev` and `next build`; skips files that are already newer than their master.
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { WOLF } from "../src/lib/brand.ts";

const root = new URL("../", import.meta.url);
const SRC = fileURLToPath(new URL("content/brand/wolf/", root));
const OUT = fileURLToPath(new URL("public/brand/wolf/", root));
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
      // Write beside the target and rename, so a crash never leaves a partial file that looks up to date.
      const tmp = dest + ".tmp";
      await (ext === "avif" ? s.avif({ quality: 50, effort: 4 }) : s.webp({ quality: 74 })).toFile(tmp);
      renameSync(tmp, dest);
      made++;
    }
  }
}
console.log(`brand: ${made} image(s) made in ${OUT}`);
