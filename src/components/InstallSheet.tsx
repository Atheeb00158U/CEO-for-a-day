"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";
import { install, installSnoozed, installWay, onInstallChange, snoozeInstall, type InstallWay } from "@/lib/pwa";
import { Logo } from "./Logo";

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="inline size-5 align-[-3px]" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Share">
    <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STEPS: Record<"ios" | "android" | "inapp", React.ReactNode[]> = {
  ios: [
    <>
      Tap the Share button <ShareIcon /> in your browser.
    </>,
    <>Scroll down and tap “Add to Home Screen”.</>,
    <>Tap “Add”.</>,
  ],
  android: [<>Tap the ⋮ menu at the top right.</>, <>Tap “Install app” or “Add to Home screen”.</>, <>Tap “Install”.</>],
  inapp: [
    <>You can’t install the app from here.</>,
    <>Tap ⋮ or ··· at the top right.</>,
    <>Tap “Open in browser”. Then install it from your browser.</>,
  ],
};

/** Asks phone players to put the app on their home screen: one tap where Chrome allows it, simple steps everywhere else. */
export function InstallSheet() {
  const [way, setWay] = useState<InstallWay>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setWay(installWay());
    update();
    const off = onInstallChange(update);
    const t = setTimeout(() => !installSnoozed() && installWay() && setOpen(true), 1500); // let Home settle first
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  const close = (snooze = true) => {
    if (snooze) snoozeInstall();
    setOpen(false);
  };
  if (!way) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[480px] gap-0 rounded-t-3xl border-2 border-b-0 border-line bg-surface px-5 pt-6"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <Logo size={56} />
          <div>
            <SheetTitle className="text-[20px] font-black leading-tight">Get the app</SheetTitle>
            <SheetDescription className="mt-1 text-[15px] font-bold text-muted">
              Add it to your home screen and open it in one tap. Hot Seats you’ve played work without internet.
            </SheetDescription>
          </div>
        </div>

        {way === "button" ? (
          <button type="button" className="btn3d green mt-6 w-full" onClick={async () => close(!(await install()))}>
            Install app
          </button>
        ) : (
          <ol className="mt-5 flex flex-col gap-3">
            {STEPS[way].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-[16px] font-bold">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/20 text-[14px] font-black text-brand">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          className="mt-4 w-full py-2 text-[15px] font-extrabold uppercase tracking-wide text-muted"
          onClick={() => close()}
        >
          {way === "button" ? "Not now" : "Got it"}
        </button>
      </SheetContent>
    </Sheet>
  );
}
