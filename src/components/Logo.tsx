import Image from "next/image";

// The crowned gold knight. `size` is its height in px; the art is 176×256.
export function Logo({ size, className }: { size: number; className?: string }) {
  return <Image src="/brand/knight.png" alt="" width={Math.round((size * 176) / 256)} height={size} priority className={className} />;
}
