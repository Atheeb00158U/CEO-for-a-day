import { SCENES, SCENE_TALL, SCENE_WIDE, sceneSrcSet, type SceneName } from "@/lib/brand";

/**
 * One of the website's scenes: the 4:5 crop on phones, the wide picture from 768 px up, AVIF where the browser can.
 * `wide` uses the wide picture on phones too (the page crops it itself), with `sizes` covering every width.
 * `priority` is for the hero only (the page preloads it). Everything else loads as it scrolls in.
 */
export function ScenePicture({
  name,
  sizes = "100vw",
  wide = false,
  priority = false,
  className = "",
}: {
  name: SceneName;
  sizes?: string;
  wide?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const media = wide ? undefined : "(min-width: 768px)";
  return (
    <picture className="contents">
      <source media={media} type="image/avif" srcSet={sceneSrcSet(name, false, "avif")} sizes={sizes} />
      <source media={media} type="image/webp" srcSet={sceneSrcSet(name, false, "webp")} sizes={sizes} />
      {!wide && <source type="image/avif" srcSet={sceneSrcSet(name, true, "avif")} sizes="100vw" />}
      {!wide && <source type="image/webp" srcSet={sceneSrcSet(name, true, "webp")} sizes="100vw" />}
      <img
        src={`/brand/site/${name}-${SCENE_WIDE.widths[1]}.webp`}
        width={wide ? SCENE_WIDE.width : SCENE_TALL.width}
        height={wide ? SCENE_WIDE.height : SCENE_TALL.height}
        alt={SCENES[name].alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
