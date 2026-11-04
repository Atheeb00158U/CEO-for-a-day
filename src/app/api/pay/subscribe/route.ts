// Start a membership checkout: creates the Razorpay subscription (and holds a founding seat) for Checkout to open.
import { PlayError } from "@/lib/play";
import { signedIn } from "@/lib/server/http";
import { payEnv, PLANS, startCheckout, type Plan } from "@/lib/server/membership";
import { razorpay } from "@/lib/server/razorpay";

export const POST = (request: Request) =>
  signedIn(
    request,
    "pay",
    async (db, userId) => {
      const plan = (await request.json().catch(() => null))?.plan;
      if (!PLANS.includes(plan)) throw new PlayError("unknown plan");
      return startCheckout(db, razorpay(), payEnv(), userId, plan as Plan, new Date());
    },
    10,
  );
