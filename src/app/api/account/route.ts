// Delete the account and everything saved for it (India's DPDP Act gives players this right).
import { signedIn } from "@/lib/server/http";

export const DELETE = (request: Request) =>
  signedIn(
    request,
    "account",
    async (db, userId) => {
      await db.deleteUser(userId);
      return { deleted: true };
    },
    3,
  );
