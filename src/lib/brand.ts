// The wolf's pictures: masters in content/brand/wolf/, served from public/brand/wolf/ at a few widths each
// (npm run brand). Node runs this file too (scripts/brand-images.mjs), so it imports nothing.
export interface BrandImage {
  width: number;
  height: number;
  widths: number[];
  alt: string;
}

const portrait = (alt: string): BrandImage => ({ width: 1086, height: 1448, widths: [400, 800, 1086], alt });
const pose = (alt: string): BrandImage => ({ width: 512, height: 512, widths: [128, 256, 512], alt });

export const WOLF = {
  street: portrait("The wolf in a pinstripe suit under an umbrella on a rainy Mumbai street at night"),
  cafe: portrait("The wolf with a glass of cutting chai in an old Irani café on a rainy night"),
  closeup: portrait("The wolf leaning in with a sly grin"),
  "pose-pleased": pose("The wolf, pleased, raising his chai"),
  "pose-thinking": pose("The wolf, thinking, hand on his chin"),
  "pose-warning": pose("The wolf, warning, one finger raised"),
  "pose-worried": pose("The wolf, worried, loosening his tie"),
  "pose-celebrating": pose("The wolf, celebrating, fist raised"),
  "pose-pointing": pose("The wolf pointing at you"),
  "pose-shocked": pose("The wolf, shocked, spilling his chai"),
} satisfies Record<string, BrandImage>;

export type WolfName = keyof typeof WOLF;

export const srcSet = (name: WolfName, ext: "avif" | "webp") =>
  WOLF[name].widths.map((w) => `/brand/wolf/${name}-${w}.${ext} ${w}w`).join(", ");

// The website's scenes: the boss's chair in real Indian places (in the hero, the wolf sits in it). Wide masters
// (16:9) in content/brand/site/, served at public/brand/site/<name>-<width>.<ext> for wide screens and
// <name>-tall-<width>.<ext>, a crop around `focus` (0 = left edge, 1 = right edge) for phones: 4:5, or a square
// for a scene that needs its width (the hero: the wolf and both worlds).
export interface Scene {
  alt: string;
  focus: number;
  square?: boolean;
  /** For a picture on the first screen: a 32×18 blur of the master, shown at once while the real file loads.
   *  Remake it if the master changes: sharp(master).resize(32, 18).blur(0.6).webp({ quality: 40 }), as base64. */
  poster?: string;
}
export const SCENE_WIDE = { width: 1672, height: 941, widths: [828, 1280, 1672] } as const;
export const SCENE_TALL = { width: 752, height: 940, widths: [480, 752] } as const;
export const SCENE_SQUARE = { width: 940, height: 940, widths: [480, 752, 940] } as const;

export const SCENES = {
  empire: {
    alt: "The wolf in a leather boss's chair, half in a shopkeeper's kurta with a glass of chai, half in a pinstripe suit with a fountain pen, kirana shops on one side and glass towers on the other",
    focus: 0.5,
    square: true,
    poster:
      "data:image/webp;base64,UklGRqoAAABXRUJQVlA4IJ4AAAAQBQCdASogABIAPu1mqU2ppaOiMAgBMB2JYgCdMoR071MATxZRF9recKjbN4I3ak2AAP2cSXtJrUtJ5NWVj2LI36C4uBT7XbUf9efNDMHSX8L/SnwPkUCq50KQHcRGzRVFzWUG/uInyhbAY7dvjPQ2/GZ4+g0R1Rr33HyNJpbPVwyHihA9B6QHeyBDXqhFOKFX7WcdsUgp+gfuk0gAAA==",
  },
  alone: { alt: "A young shopkeeper alone in his shop at night, worried, looking at his account book", focus: 0.47 },
  shop: { alt: "An empty boss's chair behind the counter of a kirana shop in morning light", focus: 0.5 },
  rise: { alt: "The same shopkeeper months later at sunrise, calm, in front of his busy, bigger shop", focus: 0.57 },
  club: { alt: "Young founders around a table in an old café at night, talking over chai, the wolf listening", focus: 0.5 },
  dairy: { alt: "An empty boss's chair in a misty village field at dawn, steel milk cans beside it", focus: 0.5 },
} satisfies Record<string, Scene>;

export type SceneName = keyof typeof SCENES;

/** The size of a scene's phone crop. */
export const phoneCrop = (name: SceneName) => ((SCENES[name] as Scene).square ? SCENE_SQUARE : SCENE_TALL);

export const sceneSrcSet = (name: SceneName, tall: boolean, ext: "avif" | "webp") =>
  (tall ? phoneCrop(name) : SCENE_WIDE).widths.map((w) => `/brand/site/${name}${tall ? "-tall" : ""}-${w}.${ext} ${w}w`).join(", ");

// Course map banners: one per module, showing what its lessons are about (made with ChatGPT, 6 Nov 2026; briefs in
// docs/MODULE-ART.md). Masters (exactly MODULE_BANNER's size) in content/brand/modules/<module id>.webp, served at
// public/course/modules/<module id>-<width>.<ext>. A module listed here shows its own banner on the map; one that
// isn't falls back to its gate Hot Seat's cover. Draft modules may be listed early: nothing shows until they're live.
export const MODULE_BANNER = { width: 1440, height: 600, widths: [480, 960, 1440] } as const;

export const MODULE_BANNERS: Record<string, string> = {
  "u1-where-money-goes": "A kirana shop owner at night, staring into an almost empty cash box beside a spike of unpaid bills",
};

export const moduleSrcSet = (id: string, ext: "avif" | "webp") =>
  MODULE_BANNER.widths.map((w) => `/course/modules/${id}-${w}.${ext} ${w}w`).join(", ");
