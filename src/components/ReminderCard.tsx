"use client";

import { useEffect, useState } from "react";
import { currentSubscription, disableReminders, enableReminders, pushBlocker } from "@/lib/push";
import { useGame } from "@/lib/store";
import { Card } from "./ui";

const HOUR_KEY = "cfad.remindHour"; // this phone's chosen hour; a convenience only, the server keeps the real one
const HOURS = [7, 9, 12, 15, 18, 19, 20, 21];
const label = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

/**
 * Daily streak reminder: on/off and the hour. For signed-in players only (the server needs to know who to remind).
 * `compact` is the one-tap version shown after a Hot Seat; it hides itself once reminders are on.
 */
export function ReminderCard({ compact }: { compact?: boolean }) {
  const { account } = useGame();
  const [on, setOn] = useState<boolean>();
  const [hour, setHour] = useState(19);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const blocker = typeof window === "undefined" ? null : pushBlocker();

  useEffect(() => {
    try {
      setHour(Number(localStorage.getItem(HOUR_KEY)) || 19);
    } catch {
      /* ignore */
    }
    currentSubscription()
      .then((s) => setOn(!!s))
      .catch(() => setOn(false));
  }, []);

  if (!account || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || blocker === "unsupported") return null;
  if (compact && (on !== false || blocker)) return null;

  const turnOn = async (h: number) => {
    setBusy(true);
    setMsg(undefined);
    try {
      const ok = await enableReminders(h);
      setOn(ok);
      if (ok) {
        try {
          localStorage.setItem(HOUR_KEY, String(h));
        } catch {
          /* ignore */
        }
      } else setMsg("Notifications are blocked. Allow them for this site in your phone's settings.");
    } catch {
      setMsg("That didn't work. Try again.");
    }
    setBusy(false);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-[19px] font-black">Daily reminder</h2>
        <p className="text-[15px] font-bold text-muted">
          {compact ? "Get one reminder a day, so you never lose your streak." : "One reminder a day, only if you haven't played yet."}
        </p>
      </div>
      {blocker === "install-first" ? (
        <p className="font-bold">On iPhone, add the app to your Home Screen first. Then open it from there and turn this on.</p>
      ) : blocker === "denied" ? (
        <p className="font-bold">Notifications are blocked. Allow them for this site in your phone&apos;s settings.</p>
      ) : (
        <>
          {!compact && (
            <label className="flex items-center justify-between gap-3 font-extrabold">
              Remind me at
              <select
                value={hour}
                disabled={busy}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setHour(h);
                  if (on) void turnOn(h); // same phone, new hour
                }}
                className="rounded-xl border-2 border-line bg-surface px-3 py-2 font-black"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {label(h)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {on ? (
            <button
              type="button"
              className="btn3d ghost !text-[14px]"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await disableReminders().catch(() => {});
                setOn(false);
                setBusy(false);
              }}
            >
              Turn off reminders
            </button>
          ) : (
            <button type="button" className="btn3d green" disabled={busy} onClick={() => void turnOn(hour)}>
              {compact ? `Remind me at ${label(hour)}` : "Turn on reminders"}
            </button>
          )}
        </>
      )}
      {msg && <p className="text-[14px] font-bold text-red">{msg}</p>}
    </Card>
  );
}
