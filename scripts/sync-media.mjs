// Copies every content/hotseats/<id>/media/* into public/media/, which Next serves. Runs before dev and build.
// Restart `npm run dev` after adding media.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("public/media/", root);
rmSync(out, { recursive: true, force: true });
for (const id of readdirSync(new URL("content/hotseats/", root))) {
  const media = new URL(`content/hotseats/${id}/media/`, root);
  if (existsSync(media)) cpSync(media, out, { recursive: true });
}
