// Copies every content/hotseats/<id>/media/* and content/daily/media/* into public/media/, which Next serves. Runs before dev and build.
// Restart `npm run dev` after adding media.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("public/media/", root);
rmSync(out, { recursive: true, force: true });
const dirs = [...readdirSync(new URL("content/hotseats/", root)).map((id) => `content/hotseats/${id}/media/`), "content/daily/media/"];
for (const dir of dirs) {
  const media = new URL(dir, root);
  if (existsSync(media)) cpSync(media, out, { recursive: true });
}
