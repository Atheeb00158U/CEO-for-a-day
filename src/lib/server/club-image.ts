// Club pictures (spec §6.5): the file's real type from its first bytes (never the name or the stated type), then
// sharp turns it upright, fits it in 1080 × 1080 and saves WebP. sharp writes no metadata unless asked, so EXIF and
// the GPS location are gone. Decoding is the memory-heavy part, so it is kept small: at most 24 MP a picture, one
// libvips thread per picture, and at most 2 pictures at once in the whole server.
import sharp from "sharp";
import { LIMITS } from "../community.ts";

sharp.concurrency(1);
/** A phone camera's 12–20 MP fits; a tiny file that unpacks to a huge picture doesn't. */
export const MAX_PIXELS = 24_000_000;
const AT_ONCE = 2;

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** JPEG, PNG or WebP by magic bytes; null for anything else. */
export function pictureKind(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (starts(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

let running = 0;
const waiting: (() => void)[] = [];
/** Run `task` when fewer than AT_ONCE others are running. */
async function oneOfTwo<T>(task: () => Promise<T>): Promise<T> {
  if (running >= AT_ONCE) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** How many pictures are being decoded now (for tests). */
export const decoding = () => running;

/** Upright WebP (quality 80), at most 1080 px a side, no metadata. Throws on a broken or too-large file. */
export function toWebp(bytes: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }> {
  const side = LIMITS.pictures.maxSide;
  return oneOfTwo(async () => {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(side, side, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  });
}

/**
 * The body of an upload, counted as it arrives and stopped past `max` bytes, whatever content-length says. null: too
 * big. Then parsed as multipart from those bytes.
 */
export async function readCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
