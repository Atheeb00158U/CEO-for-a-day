import { SCENES, SCENE_WIDE, phoneCrop, sceneSrcSet, type SceneName } from "@/lib/brand";

/**
 * One of the website's scenes: its phone crop (4:5, or a square for the hero) below 768 px, the wide picture from
 * 768 px up, AVIF where the browser can. `priority` is for the hero only (the page preloads it). Everything else
 * loads as it scrolls in.
 */
export function ScenePicture({
  name,
  sizes = "100vw",
  priority = false,
  className = "",
}: {
  name: SceneName;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const crop = phoneCrop(name);
  return (
    <picture className="contents">
      <source media="(min-width: 768px)" type="image/avif" srcSet={sceneSrcSet(name, false, "avif")} sizes={sizes} />
      <source media="(min-width: 768px)" type="image/webp" srcSet={sceneSrcSet(name, false, "webp")} sizes={sizes} />
      <source type="image/avif" srcSet={sceneSrcSet(name, true, "avif")} sizes="100vw" />
      <source type="image/webp" srcSet={sceneSrcSet(name, true, "webp")} sizes="100vw" />
      <img
        src={`/brand/site/${name}-${SCENE_WIDE.widths[1]}.webp`}
        width={crop.width}
        height={crop.height}
        alt={SCENES[name].alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
