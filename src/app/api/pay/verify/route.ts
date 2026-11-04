// Checkout's success handler sends its three fields here; a valid signature makes the player a member at once.
import { PlayError } from "@/lib/play";
import { membershipView } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";
import { confirmCheckout, payEnv } from "@/lib/server/membership";

const field = (x: unknown) => {
  if (typeof x !== "string" || !x || x.length > 200) throw new PlayError("bad payment details");
  return x;
};

export const POST = (request: Request) =>
  signedIn(
    request,
    "pay",
    async (db, userId) => {
      const body = await request.json().catch(() => null);
      const p = {
        paymentId: field(body?.razorpay_payment_id),
        subscriptionId: field(body?.razorpay_subscription_id),
        signature: field(body?.razorpay_signature),
      };
      const now = new Date();
      await confirmCheckout(db, payEnv(), userId, p, now);
      return { membership: await membershipView(db, userId, now) };
    },
    10,
  );
