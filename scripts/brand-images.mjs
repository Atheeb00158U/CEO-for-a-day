// Makes the served pictures from the masters in content/brand/:
// public/brand/wolf/<name>-<width>.avif and .webp for the wolf, and public/brand/site/<name>-<width> (wide) and
// <name>-tall-<width> (the phone crop) for the website's scenes, at every width in src/lib/brand.ts.
// Runs before `next dev` and `next build`; skips files that are already newer than their master.
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SCENES, SCENE_WIDE, WOLF, phoneCrop } from "../src/lib/brand.ts";

const root = new URL("../", import.meta.url);
const dir = (p) => fileURLToPath(new URL(p, root));

let made = 0;
/** Writes `dest` in both formats from `master` unless it is already newer; `shape` crops and resizes. */
async function make(master, dest, shape) {
  const at = statSync(master).mtimeMs;
  for (const ext of ["avif", "webp"]) {
    const out = `${dest}.${ext}`;
    if (existsSync(out) && statSync(out).mtimeMs > at) continue;
    const s = shape(sharp(master));
    // Write beside the target and rename, so a crash never leaves a partial file that looks up to date.
    const tmp = out + ".tmp";
    await (ext === "avif" ? s.avif({ quality: 50, effort: 4 }) : s.webp({ quality: 74 })).toFile(tmp);
    renameSync(tmp, out);
    made++;
  }
}

const wolfOut = dir("public/brand/wolf/");
mkdirSync(wolfOut, { recursive: true });
for (const [name, img] of Object.entries(WOLF)) {
  for (const w of img.widths) {
    await make(join(dir("content/brand/wolf/"), `${name}.webp`), join(wolfOut, `${name}-${w}`), (s) =>
      s.resize({ width: w, withoutEnlargement: true }),
    );
  }
}

const siteOut = dir("public/brand/site/");
mkdirSync(siteOut, { recursive: true });
for (const [name, scene] of Object.entries(SCENES)) {
  const master = join(dir("content/brand/site/"), `${name}.webp`); // exactly SCENE_WIDE's size
  const { width, height } = SCENE_WIDE;
  const crop = phoneCrop(name);
  const tall = { width: crop.width, height: crop.height };
  const left = Math.round(Math.min(width - tall.width, Math.max(0, scene.focus * width - tall.width / 2)));
  for (const w of SCENE_WIDE.widths) {
    await make(master, join(siteOut, `${name}-${w}`), (s) => s.resize({ width: w, withoutEnlargement: true }));
  }
  for (const w of crop.widths) {
    await make(master, join(siteOut, `${name}-tall-${w}`), (s) =>
      s.extract({ left, top: Math.round((height - tall.height) / 2), ...tall }).resize({ width: w, withoutEnlargement: true }),
    );
  }
}
console.log(`brand: ${made} image(s) made in public/brand/`);
