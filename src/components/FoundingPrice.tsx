import { foundingPrice } from "@/lib/offer";

/** The regular price struck through, then the founding price: "₹199 ₹99 a month". */
export function FoundingPrice() {
  return (
    <span>
      <span className="sr-only">{foundingPrice.label}</span>
      <span aria-hidden="true">
        <s className="text-muted decoration-2">{foundingPrice.was}</s> {foundingPrice.now}
      </span>
    </span>
  );
}
