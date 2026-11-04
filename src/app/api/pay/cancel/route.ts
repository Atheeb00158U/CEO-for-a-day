// Cancel the membership at the end of the paid period (one tap plus a confirmation in Profile).
import { membershipView } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";
import { cancelMembership } from "@/lib/server/membership";
import { razorpay } from "@/lib/server/razorpay";

export const POST = (request: Request) =>
  signedIn(
    request,
    "pay",
    async (db, userId) => {
      await cancelMembership(db, razorpay(), userId);
      return { membership: await membershipView(db, userId) };
    },
    10,
  );
