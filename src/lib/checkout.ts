// Razorpay Checkout on the phone. Its script loads only when a checkout starts (never on the landing page), once.
// The server creates the subscription; Checkout takes the payment and hands back three fields for /api/pay/verify.
import { track } from "./analytics";

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** What Checkout's success handler returns, sent as is to /api/pay/verify. */
export interface CheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

/** The player closed Checkout (or it never opened) before paying. */
export class CheckoutClosed extends Error {
  constructor() {
    super("Checkout closed");
  }
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", f: (r: { error?: { reason?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayCheckout;
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let script: Promise<RazorpayCtor> | undefined;
const loadCheckout = () =>
  (script ??= new Promise<RazorpayCtor>((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const tag = document.createElement("script");
    tag.src = SRC;
    tag.async = true;
    tag.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Checkout didn't load")));
    tag.onerror = () => {
      script = undefined; // let the next tap try again
      tag.remove();
      reject(new Error("Checkout didn't load"));
    };
    document.head.appendChild(tag);
  }));

/** The brand colour from the CSS tokens, for Checkout's theme. */
const brandColour = () => getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim() || "#f3ae47";

/**
 * Open Checkout for a subscription the server created. Resolves with the three fields once Razorpay says it's paid;
 * rejects with CheckoutClosed if the player closes it first. A failed payment keeps Checkout open so they can retry.
 */
export async function openCheckout(o: { keyId: string; subscriptionId: string; description: string; email?: string }) {
  const Razorpay = await loadCheckout();
  // A Radix sheet that just closed can leave `pointer-events: none` on <body>; Razorpay's frame lives in <body>,
  // so every tap on it would be ignored. Clear it (globals.css also forces Razorpay's frame to take taps).
  document.body.style.removeProperty("pointer-events");
  return new Promise<CheckoutSuccess>((resolve, reject) => {
    const checkout = new Razorpay({
      key: o.keyId,
      subscription_id: o.subscriptionId,
      name: "CEO For A Day",
      description: o.description,
      prefill: o.email ? { email: o.email } : undefined,
      theme: { color: brandColour() },
      handler: (r: CheckoutSuccess) => resolve(r),
      modal: { ondismiss: () => reject(new CheckoutClosed()) },
    });
    // Razorpay's reason code only (e.g. "payment_cancelled"), never the payer's details.
    checkout.on("payment.failed", (r) => track("payment_failed", { reason: r.error?.reason ?? "unknown" }));
    checkout.open();
  });
}
