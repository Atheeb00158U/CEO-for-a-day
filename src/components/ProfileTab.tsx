"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/auth";
import { showPaywall } from "@/lib/content-client";
import type { MembershipView } from "@/lib/membership-view";
import { FOUNDING, REGULAR } from "@/lib/offer";
import { BADGES, LEAGUES, useGame } from "@/lib/store";
import { CareerPill, useCareer } from "./CareerTitle";
import { ReminderCard } from "./ReminderCard";
import { SignInCard } from "./SignInCard";
import { Card, Icon } from "./ui";
import { WolfPicture } from "./WolfPicture";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// Copy for the membership card.
const MEMBER_COPY = {
  title: "Membership",
  plan: { founding: "Founding member", monthly: "Monthly plan", yearly: "Yearly plan" },
  price: {
    founding: `${rs(FOUNDING.monthly)} a month, locked`,
    monthly: `${rs(REGULAR.monthly)} a month`,
    yearly: `${rs(REGULAR.yearly)} a year`,
  },
  renews: (d: string) => `Renews on ${d}`,
  ends: (d: string) => `Ends on ${d}`,
  ended: (d: string) => `Ended on ${d}`,
  waiting: "We are checking your first payment.",
  cancel: "Cancel membership",
  confirm: (d: string | null) => (d ? `You keep access until ${d}.` : "Your membership stops now."),
  foundingEnds: "If you cancel, you lose your founding price.",
  yesCancel: "Yes, cancel",
  keep: "Keep my membership",
  failed: "There was a problem. Try again.",
  join: "Join again",
};
/** Statuses the player can still cancel (the server's list, without an unpaid checkout). */
const CANCELLABLE = new Set(["active", "authenticated", "pending", "halted"]);

const TRAITS = [
  { k: "horizon" as const, name: "Time horizon", low: "Short-term", high: "Long-term" },
  { k: "risk" as const, name: "Risk appetite", low: "Cautious", high: "Bold" },
  { k: "disrupt" as const, name: "Self-disruption", low: "Protect the core", high: "Disrupt yourself" },
];
const LANGS = [
  { id: "en", label: "English", ready: true },
  { id: "hi", label: "हिन्दी", ready: false },
  { id: "ta", label: "தமிழ்", ready: false },
  { id: "bn", label: "বাংলা", ready: false },
] as const;

export function ProfileTab() {
  const { s, setSetting, setName, reset, account, membership } = useGame();
  const decisions = s.runs.reduce((a, r) => a + r.notes.length, 0) || 1;
  // Not for a checkout that was never paid. A member sees it first, in gold; a past member near the end.
  const showMembership = !!account && !!membership && (!!membership.currentEnd || CANCELLABLE.has(membership.status));
  const memberNow = showMembership && membership!.member;
  const career = useCareer();
  return (
    <div className="flex flex-col gap-5 pt-2">
      {memberNow && <MembershipCard m={membership!} />}
      <div className="flex items-center gap-4">
        <div className="grid size-20 place-items-center rounded-full bg-brand text-[34px] font-black text-[#1a1206]">
          {s.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <label htmlFor="name" className="sr-only">
            Your name
          </label>
          <input
            id="name"
            key={s.name}
            defaultValue={s.name}
            onBlur={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-[26px] font-black outline-none focus:underline"
          />
          {career && (
            <div className="mt-0.5 mb-1">
              <CareerPill career={career} />
            </div>
          )}
          <p className="font-bold text-muted">{LEAGUES[s.league.tier]} league</p>
        </div>
      </div>

      <SignInCard />

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Icon.flame className="size-7" />} value={s.streak} label="Day streak" />
        <Stat icon={<Icon.bolt className="size-7" />} value={s.xp} label="Total XP" />
        <Stat icon={<Icon.chair className="size-7 text-brand" />} value={s.runs.length} label="Hot seats played" />
        <Stat icon={<Icon.flame className="size-7" />} value={s.bestStreak} label="Best streak" />
      </div>

      <Card>
        <h2 className="text-[19px] font-black">How you decide</h2>
        <p className="text-[13px] font-bold text-muted">Built from every call you&apos;ve made.</p>
        <div className="mt-4 flex flex-col gap-5">
          {TRAITS.map((t) => {
            const pos = 50 + Math.max(-1, Math.min(1, s.traits[t.k] / decisions)) * 45;
            return (
              <div key={t.k}>
                <p className="text-[15px] font-black">{t.name}</p>
                <div className="relative mt-2 h-3 rounded-full bg-surface-2">
                  <span className="absolute inset-y-[-4px] left-1/2 w-0.5 bg-line" />
                  <span
                    className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface bg-brand transition-[left] duration-700"
                    style={{ left: `${pos}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[12px] font-bold text-muted">
                  <span>{t.low}</span>
                  <span>{t.high}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[19px] font-black">Badges</h2>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(BADGES).map(([id, b]) => {
            const got = s.badges.includes(id);
            return (
              <div
                key={id}
                className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-center ${got ? "bg-gold/10" : "bg-surface-2 opacity-50"}`}
                title={b.desc}
              >
                <span
                  className={`grid size-12 place-items-center rounded-full text-[20px] font-black ${got ? "bg-gold text-[#2a1d00]" : "bg-line text-muted"}`}
                >
                  {got ? "★" : "?"}
                </span>
                <span className="text-[12px] font-extrabold leading-tight">{b.name}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-[19px] font-black">Settings</h2>
        <label className="flex items-center justify-between font-extrabold">
          Narration voice
          <input
            type="checkbox"
            checked={s.settings.voice}
            onChange={(e) => setSetting("voice", e.target.checked)}
            className="size-6 accent-[var(--color-brand)]"
          />
        </label>
        <label className="flex items-center justify-between font-extrabold">
          Sound effects
          <input
            type="checkbox"
            checked={s.settings.sfx}
            onChange={(e) => setSetting("sfx", e.target.checked)}
            className="size-6 accent-[var(--color-brand)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 font-extrabold">
          <span>
            Data saver
            <span className="block text-[14px] font-bold text-muted">Show pictures, not video.</span>
          </span>
          <input
            type="checkbox"
            checked={s.settings.dataSaver}
            onChange={(e) => setSetting("dataSaver", e.target.checked)}
            className="size-6 shrink-0 accent-[var(--color-brand)]"
          />
        </label>
        <div>
          <p className="mb-2 font-extrabold">Language</p>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={!l.ready}
                onClick={() => setSetting("lang", l.id)}
                className={`rounded-full border-2 px-3 py-1.5 text-[15px] font-extrabold ${s.settings.lang === l.id ? "border-brand text-brand" : "border-line text-muted"} disabled:opacity-60`}
              >
                {l.label}
                {!l.ready && <span className="ml-1 text-[11px]">soon</span>}
              </button>
            ))}
          </div>
        </div>
        {!account && <ResetButton onReset={reset} />}
      </Card>

      <ReminderCard />

      {showMembership && !memberNow && <MembershipCard m={membership!} />}

      {account && <AccountCard email={account.email} />}
    </div>
  );
}

/** The plan, price and renewal date (never the seat number), with a one-tap cancel behind one confirmation. */
function MembershipCard({ m }: { m: MembershipView }) {
  const { reload } = useGame();
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const end = m.currentEnd ? day(m.currentEnd) : null;
  const canCancel = CANCELLABLE.has(m.status);
  const when = !end
    ? MEMBER_COPY.waiting
    : !m.member
      ? MEMBER_COPY.ended(end)
      : m.status === "active"
        ? MEMBER_COPY.renews(end)
        : MEMBER_COPY.ends(end);

  async function cancel() {
    setState("busy");
    try {
      await api("/api/pay/cancel", { body: {} });
      await reload();
      setAsking(false);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <Card className={`flex flex-col gap-3 ${m.member ? "!border-gold/70 !bg-gold/10" : ""}`}>
      <h2 className={`text-[19px] font-black ${m.member ? "text-gold" : ""}`}>{MEMBER_COPY.title}</h2>
      <div className="flex items-center gap-3">
        {m.member && (
          <div className="w-[72px] shrink-0">
            <WolfPicture name="pose-pleased" sizes="72px" className="h-auto w-full" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[17px] font-black">{MEMBER_COPY.plan[m.plan]}</p>
          <p className="font-bold text-muted">{MEMBER_COPY.price[m.plan]}</p>
          <p className="font-bold text-muted">{when}</p>
        </div>
      </div>
      {!m.member && !canCancel && (
        <button type="button" className="btn3d green !text-[14px]" onClick={() => showPaywall()}>
          {MEMBER_COPY.join}
        </button>
      )}
      {canCancel && !asking && (
        <button type="button" className="btn3d ghost !text-[14px]" onClick={() => setAsking(true)}>
          {MEMBER_COPY.cancel}
        </button>
      )}
      {canCancel && asking && (
        <div role="group" aria-label={MEMBER_COPY.cancel} className="flex flex-col gap-3">
          <p className="text-[15px] font-bold">
            {MEMBER_COPY.confirm(m.member && end ? end : null)}
            {m.plan === "founding" && ` ${MEMBER_COPY.foundingEnds}`}
          </p>
          <button type="button" className="btn3d red !text-[14px]" disabled={state === "busy"} onClick={cancel}>
            {MEMBER_COPY.yesCancel}
          </button>
          <button
            type="button"
            className="w-full py-2 text-[15px] font-extrabold tracking-wide text-muted uppercase"
            disabled={state === "busy"}
            onClick={() => {
              setAsking(false);
              setState("idle");
            }}
          >
            {MEMBER_COPY.keep}
          </button>
          {state === "failed" && (
            <p role="alert" className="text-[14px] font-bold text-red">
              {MEMBER_COPY.failed}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function AccountCard({ email }: { email?: string }) {
  const { signOut, deleteAccount } = useGame();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  // The server's own words when it refuses (e.g. payments couldn't be stopped yet); otherwise a plain retry.
  const [why, setWhy] = useState("There was a problem. Try again.");
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[19px] font-black">Account</h2>
      <p className="font-bold text-muted">Signed in{email ? ` as ${email}` : ""}. Your progress is saved on any phone.</p>
      <button type="button" className="btn3d ghost !text-[14px]" onClick={() => void signOut()}>
        Sign out
      </button>
      <details>
        <summary className="cursor-pointer text-[14px] font-extrabold text-red">Delete my account</summary>
        <p className="my-2 text-[14px] font-bold text-muted">
          This deletes your account and everything saved with it: XP, streak, notes and league. It can&apos;t be undone.
        </p>
        <button
          type="button"
          className="btn3d red !text-[14px]"
          disabled={state === "busy"}
          onClick={() => {
            setState("busy");
            deleteAccount().catch((e) => {
              setWhy(e instanceof ApiError && e.status === 409 ? e.message : "There was a problem. Try again.");
              setState("failed");
            });
          }}
        >
          Yes, delete everything
        </button>
        {state === "failed" && <p className="mt-2 text-[14px] font-bold text-red">{why}</p>}
      </details>
    </Card>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <details>
      <summary className="cursor-pointer text-[14px] font-extrabold text-red">Reset all progress</summary>
      <p className="my-2 text-[14px] font-bold text-muted">This clears your XP, streak, notes and badges on this device.</p>
      <button type="button" className="btn3d red !text-[14px]" onClick={onReset}>
        Yes, reset everything
      </button>
    </details>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-line p-3">
      {icon}
      <div>
        <p className="text-[22px] font-black leading-none tabular-nums">{value}</p>
        <p className="text-[13px] font-bold text-muted">{label}</p>
      </div>
    </div>
  );
}
