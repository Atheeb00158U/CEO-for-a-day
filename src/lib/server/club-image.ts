// Club pictures (spec §6.5): the file's real type from its first bytes (never the name or the stated type), then
// sharp turns it upright, fits it in 1080 × 1080 and saves WebP. sharp writes no metadata unless asked, so EXIF and
// the GPS location are gone.
import sharp from "sharp";
import { LIMITS } from "../community.ts";

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** JPEG, PNG or WebP by magic bytes; null for anything else. */
export function pictureKind(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (starts(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

/** Upright WebP (quality 80), at most 1080 px a side, no metadata. Throws on a broken file. */
export async function toWebp(bytes: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }> {
  const side = LIMITS.pictures.maxSide;
  // limitInputPixels stops a tiny file that unpacks to a huge picture.
  const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(side, side, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}
