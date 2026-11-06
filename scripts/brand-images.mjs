// Makes the served pictures from the masters in content/brand/:
// public/brand/wolf/<name>-<width>.avif and .webp for the wolf, and public/brand/site/<name>-<width> (wide) and
// <name>-tall-<width> (the phone crop) for the website's scenes, at every width in src/lib/brand.ts.
// Runs before `next dev` and `next build`; skips files that are already newer than their master.
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MODULE_BANNER, MODULE_BANNERS, SCENES, SCENE_WIDE, WOLF, phoneCrop } from "../src/lib/brand.ts";

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
const moduleOut = dir("public/course/modules/");
mkdirSync(moduleOut, { recursive: true });
for (const id of Object.keys(MODULE_BANNERS)) {
  for (const w of MODULE_BANNER.widths) {
    await make(join(dir("content/brand/modules/"), `${id}.webp`), join(moduleOut, `${id}-${w}`), (s) =>
      s.resize({ width: w, withoutEnlargement: true }),
    );
  }
}
console.log(`brand: ${made} image(s) made in public/brand/ and public/course/modules/`);

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
  const master = join(dir("content/brand/wolf/"), `${name}.webp`);
  const dest = join(wolfOut, `notify-${name}.jpg`);
  if (existsSync(dest) && statSync(dest).mtimeMs > statSync(master).mtimeMs) continue;
  const wolf = await sharp(master).resize(470, 470).toBuffer();
  await sharp(glow)
    .composite([{ input: wolf, top: 30, left: 277 }])
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(dest + ".tmp");
  renameSync(dest + ".tmp", dest);
  extra++;
}
const knight = dir("public/brand/knight.png");
const badge = join(wolfOut, "badge.png");
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
