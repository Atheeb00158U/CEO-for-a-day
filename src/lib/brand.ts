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
