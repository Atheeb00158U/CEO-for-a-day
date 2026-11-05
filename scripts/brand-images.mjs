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

// Notification pictures (src/lib/server/reminders.ts): each pose centred on a wide 2:1 banner, which is the shape
// Android shows under a notification, as small JPEGs. And the badge: Android's status-bar icon, which it draws as a
// white shape, so the knight's outline in white on clear.
const POSES = Object.keys(WOLF).filter((n) => n.startsWith("pose-"));
const glow = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><defs><radialGradient id="g" cx="50%" cy="55%" r="60%">` +
    `<stop offset="0" stop-color="#f3ae47" stop-opacity=".45"/><stop offset=".55" stop-color="#141b22"/><stop offset="1" stop-color="#0b1015"/>` +
    `</radialGradient></defs><rect width="1024" height="512" fill="url(#g)"/></svg>`,
);
let extra = 0;
for (const name of POSES) {
  const master = join(SRC, `${name}.webp`);
  const dest = join(OUT, `notify-${name}.jpg`);
  if (existsSync(dest) && statSync(dest).mtimeMs > statSync(master).mtimeMs) continue;
  const wolf = await sharp(master).resize(470, 470).toBuffer();
  await sharp(glow)
    .composite([{ input: wolf, top: 30, left: 277 }])
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(dest + ".tmp");
  renameSync(dest + ".tmp", dest);
  extra++;
}
const knight = fileURLToPath(new URL("public/brand/knight.png", root));
const badge = join(OUT, "badge.png");
if (!existsSync(badge) || statSync(badge).mtimeMs < statSync(knight).mtimeMs) {
  const alpha = await sharp(knight).resize(96, 96, { fit: "contain", background: "#0000" }).extractChannel("alpha").toBuffer();
  await sharp({ create: { width: 96, height: 96, channels: 3, background: "#fff" } })
    .joinChannel(alpha)
    .png()
    .toFile(badge + ".tmp");
  renameSync(badge + ".tmp", badge);
  extra++;
}
console.log(`brand: ${extra} notification image(s) made`);
