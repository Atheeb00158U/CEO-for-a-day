"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";
import { freeModule } from "@/lib/access";
import { ApiError, api } from "@/lib/auth";
import { CheckoutClosed, openCheckout, type CheckoutSuccess } from "@/lib/checkout";
import { useContent } from "@/lib/content-client";
import { FOUNDING_USED, NO_FOUNDING } from "@/lib/membership-view";
import { FOUNDING, FOUNDING_LINE, REGULAR } from "@/lib/offer";
import { useGame } from "@/lib/store";
import { FoundingPrice } from "./FoundingPrice";
import { SignInCard } from "./SignInCard";
import { WolfPicture } from "./WolfPicture";

type Plan = "founding" | "monthly" | "yearly";
const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const COPY = {
  titleFreeDone: "Your free lessons are done. Continue as a founding member.",
  titleFounding: "Continue as a founding member.",
  titleRegular: "Become a member to continue.",
  descFounding: " while you stay a member.", // after the struck price: "₹199 ₹99 a month while you stay a member."
  descRegular: "Members can use every lesson and Hot Seat.",
  monthly: "Monthly",
  monthlyPrice: `${rs(REGULAR.monthly)} a month`,
  yearly: "Yearly",
  yearlyPrice: `${rs(REGULAR.yearly)} a year`,
  yearlyNote: `About ${rs(Math.round(REGULAR.yearly / 12))} a month`,
  betterValue: "Save more",
  pay: {
    founding: `Join for ${rs(FOUNDING.monthly)} a month`,
    monthly: `Join for ${rs(REGULAR.monthly)} a month`,
    yearly: `Join for ${rs(REGULAR.yearly)} a year`,
  },
  checkoutLine: {
    founding: `Founding member, ${rs(FOUNDING.monthly)} a month`,
    monthly: `Member, ${rs(REGULAR.monthly)} a month`,
    yearly: `Member, ${rs(REGULAR.yearly)} a year`,
  },
  busy: "Opening payment page…",
  checking: "Checking your payment…",
  cancelAnyTime: "Cancel any time from your profile.",
  signInTitle: "Sign in to join",
  signInText: "Your membership is linked to your Google account.",
  notCharged: "Payment didn't go through. You were not charged.",
  tryAgain: "Something went wrong. Please try again.",
  notConfirmed: "We could not check your payment yet. This may take a few minutes. Close this and try again soon.",
  member: "You are now a member. Tap the lesson again.",
  close: "Close",
  notNow: "Not now",
};

/** The wolf and the offer, shown when a non-member opens a locked lesson, test-out or Hot Seat. */
export function PaywallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account, membership, reload, s } = useGame();
  const { course } = useContent();
  // Whether founding seats are left (null: not known yet). The count itself is never shown.
  const [seatsOpen, setSeatsOpen] = useState<boolean | null>(null);
  // The server's own reason when the founding price isn't on offer to this player (all taken, or they cancelled).
  const [noFounding, setNoFounding] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [phase, setPhase] = useState<"idle" | "busy" | "checking">("idle");
  const [error, setError] = useState<string | null>(null);
  // While Razorpay's checkout is open the sheet steps aside: an open modal sheet makes the rest of the page
  // (Razorpay's frame included) ignore taps.
  const [inCheckout, setInCheckout] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let live = true;
    fetch("/api/seats")
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => live && setSeatsOpen(typeof x?.open === "boolean" ? x.open : null))
      .catch(() => live && setSeatsOpen(null));
    return () => {
      live = false;
    };
  }, [open]);

  // Unknown: offer the founding price and let the server decide.
  // A returning founder who cancelled starts on the regular plans, with the reason.
  const reason = noFounding ?? (membership?.foundingUsed ? FOUNDING_USED : null);
  const founding = !reason && (seatsOpen ?? true);
  const chosen: Plan = founding ? "founding" : plan;
  const freeLessons = (course && freeModule(course)?.lessons.map((l) => l.id)) ?? [];
  const freeDone = freeLessons.length > 0 && freeLessons.every((id) => s.lessons[id]);
  const title = founding ? (freeDone ? COPY.titleFreeDone : COPY.titleFounding) : COPY.titleRegular;

  async function join() {
    setError(null);
    setPhase("busy");
    let paid: CheckoutSuccess;
    try {
      const { subscriptionId, keyId } = await api<{ subscriptionId: string; keyId: string }>("/api/pay/subscribe", {
        body: { plan: chosen },
      });
      setInCheckout(true);
      try {
        paid = await openCheckout({ keyId, subscriptionId, description: COPY.checkoutLine[chosen], email: account?.email });
      } finally {
        setInCheckout(false);
      }
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.status === 409) {
        if (e.message === "Already a member") {
          await reload().catch(() => {});
          return;
        }
        // Only the server's two founding refusals switch to the regular plans; anything else (e.g. "Try again")
        // keeps the offer and asks the player to try again.
        if (chosen === "founding" && NO_FOUNDING.includes(e.message)) {
          setNoFounding(e.message);
          return;
        }
        setError(COPY.tryAgain);
        return;
      }
      if (!(e instanceof CheckoutClosed)) console.warn("checkout failed", e);
      setError(COPY.notCharged);
      return;
    }
    setPhase("checking");
    try {
      await api("/api/pay/verify", { body: paid });
      await reload();
      setPhase("idle");
      onOpenChange(false); // the player taps the item again
    } catch {
      // Paid at Razorpay but not confirmed here: the webhook will make them a member.
      setPhase("idle");
      setError(COPY.notConfirmed);
      void reload().catch(() => {});
    }
  }

  const busy = phase !== "idle";
  return (
    <Sheet open={open && !inCheckout} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        // Focus the sheet, not the first plan, so a focus ring never looks like a choice.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        className="mx-auto max-h-[92dvh] max-w-[480px] gap-0 overflow-y-auto rounded-t-3xl border-2 border-b-0 border-line bg-surface px-5 pt-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-[150px]">
          <WolfPicture name="pose-pointing" sizes="150px" className="h-auto w-full" />
        </div>
        <SheetTitle className="mt-3 text-center text-[22px] leading-tight font-black text-balance">{title}</SheetTitle>
        <SheetDescription className="mt-1 text-center text-[16px] font-bold text-muted">
          {founding ? (
            <>
              <FoundingPrice />
              {COPY.descFounding}
            </>
          ) : (
            COPY.descRegular
          )}
        </SheetDescription>

        {membership?.member ? (
          <p className="mt-5 rounded-2xl bg-brand/10 p-4 text-center text-[16px] font-black text-brand">{COPY.member}</p>
        ) : (
          <>
            {founding ? (
              <p className="mt-2 text-center text-[14px] font-extrabold text-brand">{FOUNDING_LINE}</p>
            ) : (
              <>
                {reason && <p className="mt-2 text-center text-[14px] font-extrabold text-brand">{reason}.</p>}
                <div role="radiogroup" aria-label="Choose a plan" className="mt-4 flex flex-col gap-3">
                  <PlanTile on={plan === "monthly"} onPick={() => setPlan("monthly")} name={COPY.monthly} price={COPY.monthlyPrice} />
                  <PlanTile
                    on={plan === "yearly"}
                    onPick={() => setPlan("yearly")}
                    name={COPY.yearly}
                    price={COPY.yearlyPrice}
                    note={COPY.yearlyNote}
                    badge={COPY.betterValue}
                  />
                </div>
              </>
            )}

            {account ? (
              <button type="button" className="btn3d green mt-5 w-full" disabled={busy} onClick={join}>
                {phase === "busy" ? COPY.busy : phase === "checking" ? COPY.checking : COPY.pay[chosen]}
              </button>
            ) : (
              <div className="mt-5">
                <SignInCard title={COPY.signInTitle} text={COPY.signInText} />
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-center text-[15px] font-bold text-red">
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-[14px] font-bold text-muted">{COPY.cancelAnyTime}</p>
          </>
        )}

        <button
          type="button"
          disabled={busy}
          className="mt-3 w-full py-2 text-[15px] font-extrabold tracking-wide text-muted uppercase"
          onClick={() => onOpenChange(false)}
        >
          {membership?.member ? COPY.close : COPY.notNow}
        </button>
      </SheetContent>
    </Sheet>
  );
}

function PlanTile({
  on,
  onPick,
  name,
  price,
  note,
  badge,
}: {
  on: boolean;
  onPick: () => void;
  name: string;
  price: string;
  note?: string;
  badge?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className="tile flex items-center gap-3 text-left">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-line">
        {on && <span className="size-3 rounded-full bg-[#1a1206]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-black">{name}</span>
        {note && <span className="block text-[13px] font-bold text-muted">{note}</span>}
      </span>
      <span className="flex flex-col items-end gap-1">
        {badge && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-black tracking-wide text-[#1a1206] uppercase">{badge}</span>
        )}
        <span className="text-[16px] font-black">{price}</span>
      </span>
    </button>
  );
}
