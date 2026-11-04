// Delete the account and everything saved for it. Any membership is cancelled first (src/lib/server/account.ts).
import { deleteAccount } from "@/lib/server/account";
import { signedIn } from "@/lib/server/http";
import { razorpay } from "@/lib/server/razorpay";

export const DELETE = (request: Request) => signedIn(request, "account", (db, userId) => deleteAccount(db, () => razorpay(), userId), 3);
