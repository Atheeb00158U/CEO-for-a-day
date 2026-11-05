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
// <name>-tall-<width>.<ext>, a 4:5 crop around `focus` (0 = left edge, 1 = right edge), for phones.
export interface Scene {
  alt: string;
  focus: number;
}
export const SCENE_WIDE = { width: 1672, height: 941, widths: [828, 1280, 1672] } as const;
export const SCENE_TALL = { width: 752, height: 940, widths: [480, 752] } as const;

export const SCENES = {
  empire: {
    alt: "The wolf in a leather boss's chair, half in a shopkeeper's kurta with a glass of chai, half in a pinstripe suit with a fountain pen, kirana shops on one side and glass towers on the other",
    focus: 0.5,
  },
  shop: { alt: "An empty boss's chair behind the counter of a kirana shop in morning light", focus: 0.5 },
  chai: { alt: "An empty boss's chair beside a chai stall by the sea at dusk", focus: 0.5 },
  tarmac: { alt: "An empty boss's chair on an airport runway at sunrise, a row of planes behind it", focus: 0.5 },
  dairy: { alt: "An empty boss's chair in a misty village field at dawn, steel milk cans beside it", focus: 0.5 },
} satisfies Record<string, Scene>;

export type SceneName = keyof typeof SCENES;

export const sceneSrcSet = (name: SceneName, tall: boolean, ext: "avif" | "webp") =>
  (tall ? SCENE_TALL : SCENE_WIDE).widths.map((w) => `/brand/site/${name}${tall ? "-tall" : ""}-${w}.${ext} ${w}w`).join(", ");
