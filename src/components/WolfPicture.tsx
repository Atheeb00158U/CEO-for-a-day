import { WOLF, srcSet, type WolfName } from "@/lib/brand";

/**
 * One of the wolf's pictures at the right size for the screen: AVIF where the browser can, WebP otherwise.
 * `priority` is for the hero only: loaded at once; the page itself must preload it (this component doesn't). Everything else loads as it scrolls in.
 */
export function WolfPicture({
  name,
  sizes,
  priority = false,
  className = "",
  alt,
}: {
  name: WolfName;
  sizes: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  const img = WOLF[name];
  const mid = img.widths[Math.min(1, img.widths.length - 1)];
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={srcSet(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, "webp")} sizes={sizes} />
      <img
        src={`/brand/wolf/${name}-${mid}.webp`}
        width={img.width}
        height={img.height}
        alt={alt ?? img.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
