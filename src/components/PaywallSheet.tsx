"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";
import { ApiError, api } from "@/lib/auth";
import { CheckoutClosed, openCheckout, type CheckoutSuccess } from "@/lib/checkout";
import { useContent } from "@/lib/content-client";
import { FOUNDING, REGULAR, seatsLine } from "@/lib/offer";
import { useGame } from "@/lib/store";
import { SignInCard } from "./SignInCard";
import { WolfPicture } from "./WolfPicture";

type Plan = "founding" | "monthly" | "yearly";
const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Draft copy (Task 10 runs the basic-English pass on these).
const COPY = {
  titleUnitDone: "Unit 1 is done. Keep going as a founding member.",
  titleFounding: "Keep going as a founding member.",
  titleRegular: "Become a member to keep going.",
  descFounding: `${rs(FOUNDING.monthly)} a month while you stay a member.`,
  descRegular: "Members open every lesson and Hot Seat.",
  monthly: "Monthly",
  monthlyPrice: `${rs(REGULAR.monthly)} a month`,
  yearly: "Yearly",
  yearlyPrice: `${rs(REGULAR.yearly)} a year`,
  yearlyNote: `About ${rs(Math.round(REGULAR.yearly / 12))} a month`,
  betterValue: "Better value",
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
  busy: "Opening payment…",
  checking: "Checking your payment…",
  cancelAnyTime: "Cancel any time from your profile.",
  signInTitle: "Sign in to join",
  signInText: "Your membership is saved to your Google account.",
  notCharged: "Payment didn't go through. You were not charged.",
  notConfirmed: "We could not confirm your payment yet. It can take a few minutes. Close this and try again soon.",
  member: "You are a member. Tap the lesson again to open it.",
  close: "Close",
  notNow: "Not now",
};

/** The wolf and the offer, shown when a non-member opens a locked lesson, test-out or Hot Seat. */
export function PaywallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account, membership, reload, s } = useGame();
  const { course } = useContent();
  const [seats, setSeats] = useState<{ taken: number; open: boolean } | null>(null);
  // The server's own reason when the founding price isn't on offer to this player (all taken, or they cancelled).
  const [noFounding, setNoFounding] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [phase, setPhase] = useState<"idle" | "busy" | "checking">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let live = true;
    fetch("/api/seats")
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => live && setSeats(x && typeof x.taken === "number" ? { taken: x.taken, open: !!x.open } : null))
      .catch(() => live && setSeats(null));
    return () => {
      live = false;
    };
  }, [open]);

  // Unknown seat count: offer the founding price and let the server decide.
  const founding = !noFounding && (seats?.open ?? true);
  const chosen: Plan = founding ? "founding" : plan;
  const unit1 = course?.units[0]?.modules.flatMap((m) => m.lessons.map((l) => l.id)) ?? [];
  const unit1Done = unit1.length > 0 && unit1.every((id) => s.lessons[id]);
  const title = founding ? (unit1Done ? COPY.titleUnitDone : COPY.titleFounding) : COPY.titleRegular;

  async function join() {
    setError(null);
    setPhase("busy");
    let paid: CheckoutSuccess;
    try {
      const { subscriptionId, keyId } = await api<{ subscriptionId: string; keyId: string }>("/api/pay/subscribe", {
        body: { plan: chosen },
      });
      paid = await openCheckout({ keyId, subscriptionId, description: COPY.checkoutLine[chosen], email: account?.email });
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.status === 409) {
        if (e.message === "Already a member") {
          await reload().catch(() => {});
          return;
        }
        if (chosen === "founding") {
          setNoFounding(e.message); // e.g. "Founding price ended when you cancelled": show the regular plans
          return;
        }
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
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
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
          {founding ? COPY.descFounding : COPY.descRegular}
        </SheetDescription>

        {membership?.member ? (
          <p className="mt-5 rounded-2xl bg-brand/10 p-4 text-center text-[16px] font-black text-brand">{COPY.member}</p>
        ) : (
          <>
            {founding ? (
              seats && <p className="mt-2 text-center text-[14px] font-extrabold text-brand">{seatsLine(seats.taken)}</p>
            ) : (
              <>
                {noFounding && <p className="mt-2 text-center text-[14px] font-extrabold text-brand">{noFounding}.</p>}
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
