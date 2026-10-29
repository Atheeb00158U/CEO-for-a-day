// Prepares media for a Hot Seat and writes it into content/hotseats/<id>/media/.
//   npm run media -- <id> <files…>
// Images (jpg, png, webp, …) → <name>.webp, 1080 px wide at most. Clips (mp4, mov, …) → <name>.mp4: ≤ 9 s, no audio, H.264,
// plus <name>.jpg, its first frame: the poster while it loads and the still that data saver shows instead.
// Refer to the result as "img:<name>" or "vid:<name>" in hotseat.json. Restart `npm run dev` to see new files.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";
import { HOTSEATS_DIR } from "../src/lib/content-files.ts";

const [id, ...files] = process.argv.slice(2);
const out = id && join(HOTSEATS_DIR, id, "media");
if (!out || !existsSync(out) || !files.length) {
  console.error("Usage: npm run media -- <hot-seat-id> <files…>   (the Hot Seat must exist; see npm run hotseat:new)");
  process.exit(1);
}

const IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"];
const CLIPS = [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"];
const kb = (f) => Math.round(statSync(f).size / 1024) + " KB";

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const name = basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  if (IMAGES.includes(ext)) {
    const dest = join(out, `${name}.webp`);
    // rotate() applies the photo's EXIF orientation, so phone shots aren't sideways.
    await sharp(file).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
    console.log(`img:${name}  ${kb(file)} → ${kb(dest)}`);
  } else if (CLIPS.includes(ext)) {
    const dest = join(out, `${name}.mp4`);
    // Argument array, no shell: the comma in min(1080\,iw) is escaped for ffmpeg's filter parser only.
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      file,
      "-t",
      "9",
      "-an",
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "slow",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=min(1080\\,iw):-2",
      "-movflags",
      "+faststart",
      dest,
    ]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", dest, "-frames:v", "1", "-q:v", "5", join(out, `${name}.jpg`)]);
    console.log(`vid:${name}  ${kb(file)} → ${kb(dest)} + still`);
  } else {
    console.error(`Skipped ${file}: not an image or clip`);
    process.exitCode = 1;
  }
}
