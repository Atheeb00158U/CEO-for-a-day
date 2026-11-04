"use client";

// The Club's sheets: join, rules, report, the composer, and the nudges for players who can't post yet.
import { useState } from "react";
import { api } from "@/lib/auth";
import { CLUB_COPY, LIMITS, REPORT_REASONS, type PostView, type ProfileView } from "@/lib/community";
import { GRIEVANCE } from "@/lib/legal";
import { useGame } from "@/lib/store";
import { ClubSheet, errorText, gateOf, linkBtn, useClub } from "./shared";

const field = "w-full rounded-2xl border-2 border-line bg-bg px-3 py-2.5 text-[16px] font-bold outline-none focus:border-brand";

export function JoinSheet({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onJoined: (p: ProfileView) => void;
}) {
  const { s } = useGame();
  const [handle, setHandle] = useState("");
  const [name, setName] = useState(s.name === "You" ? "" : s.name);
  const [building, setBuilding] = useState("");
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const join = async () => {
    setError(undefined);
    if (!adult) return setError(CLUB_COPY.under18);
    if (!agree) return setError(CLUB_COPY.mustAgree);
    setBusy(true);
    try {
      const r = await api<{ profile: ProfileView }>("/api/club/join", { body: { handle, name, building, adult, rules: agree } });
      onJoined(r.profile);
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  return (
    <ClubSheet open={open} onOpenChange={onOpenChange} title={CLUB_COPY.joinTitle}>
      <label className="flex flex-col gap-1 font-extrabold">
        {CLUB_COPY.handle}
        <span className="flex items-center gap-1 rounded-2xl border-2 border-line bg-bg pl-3 focus-within:border-brand">
          <span className="font-black text-muted">@</span>
          <input
            className="w-full bg-transparent py-2.5 pr-3 text-[16px] font-bold outline-none"
            value={handle}
            maxLength={15}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 font-extrabold">
        {CLUB_COPY.name}
        <input className={field} value={name} maxLength={LIMITS.nameLength} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 font-extrabold">
        {CLUB_COPY.building}
        <textarea
          className={field}
          rows={2}
          value={building}
          maxLength={LIMITS.buildingLength}
          placeholder={CLUB_COPY.buildingExample}
          onChange={(e) => setBuilding(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-3 font-extrabold">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
          className="size-6 shrink-0 accent-[var(--color-brand)]"
        />
        {CLUB_COPY.adult}
      </label>
      <label className="flex items-center gap-3 font-extrabold">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="size-6 shrink-0 accent-[var(--color-brand)]"
        />
        <span>
          {CLUB_COPY.agree.replace(CLUB_COPY.rulesTitle, "")}
          <button type="button" className="text-brand underline" onClick={() => setRules(true)}>
            {CLUB_COPY.rulesTitle}
          </button>
        </span>
      </label>
      <p className="text-[14px] font-bold text-muted">{CLUB_COPY.notice}</p>
      {error && (
        <p role="alert" className="font-bold text-red">
          {error}
        </p>
      )}
      <button type="button" className="btn3d green" disabled={busy || handle.length < 3 || !name.trim()} onClick={() => void join()}>
        {CLUB_COPY.join}
      </button>
      <button type="button" className={linkBtn} onClick={() => onOpenChange(false)}>
        {CLUB_COPY.cancel}
      </button>
      <RulesSheet open={rules} onOpenChange={setRules} />
    </ClubSheet>
  );
}

export function RulesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <ClubSheet open={open} onOpenChange={onOpenChange} title={CLUB_COPY.rulesTitle}>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[16px] font-bold">
        {CLUB_COPY.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className="font-bold text-muted">{CLUB_COPY.rulesBreak}</p>
      <h3 className="text-[17px] font-black">{CLUB_COPY.grievanceTitle}</h3>
      <p className="font-bold text-muted">{CLUB_COPY.rulesComplain}</p>
      <a className="font-black text-brand underline" href={`mailto:${GRIEVANCE.email}`}>
        {GRIEVANCE.email}
      </a>
      <p className="font-bold text-muted">{CLUB_COPY.rulesReply}</p>
      <button type="button" className="btn3d ghost" onClick={() => onOpenChange(false)}>
        {CLUB_COPY.close}
      </button>
    </ClubSheet>
  );
}

export function ReportSheet({ target, onClose }: { target: { kind: "post" | "profile"; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string>();
  const close = () => {
    setReason(null);
    setNote("");
    setState("idle");
    setError(undefined);
    onClose();
  };
  const send = async () => {
    setState("busy");
    setError(undefined);
    try {
      await api("/api/club/report", { body: { ...target, reason, note } });
      setState("done");
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  };
  return (
    <ClubSheet open={!!target} onOpenChange={(o) => !o && close()} title={CLUB_COPY.reportTitle}>
      {state === "done" ? (
        <p className="text-[17px] font-black text-green">{CLUB_COPY.reportThanks}</p>
      ) : (
        <>
          <div role="radiogroup" className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={reason === r.id}
                className="tile !py-3"
                onClick={() => setReason(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {reason && (
            <>
              <textarea
                className={field}
                rows={2}
                maxLength={LIMITS.noteLength}
                placeholder={CLUB_COPY.reportNote}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="button" className="btn3d red" disabled={state === "busy"} onClick={() => void send()}>
                {CLUB_COPY.sendReport}
              </button>
            </>
          )}
          {error && <p className="font-bold text-red">{error}</p>}
        </>
      )}
      <button type="button" className={linkBtn} onClick={close}>
        {state === "done" ? CLUB_COPY.close : CLUB_COPY.cancel}
      </button>
    </ClubSheet>
  );
}

/** The full-screen composer. A refused post keeps its text and shows why. */
export function Composer({
  open,
  onOpenChange,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPosted: (p: PostView) => void;
}) {
  const { nudge } = useClub();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const left = LIMITS.postLength - [...text].length;
  const post = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ post: PostView }>("/api/club/post", { body: { body: text } });
      setText("");
      onPosted(r.post);
      onOpenChange(false);
    } catch (e) {
      const can = gateOf(e);
      if (can) {
        onOpenChange(false);
        nudge(can);
      } else setError(errorText(e));
    }
    setBusy(false);
  };
  return (
    <ClubSheet open={open} onOpenChange={onOpenChange} title={CLUB_COPY.newPost} full>
      <textarea
        className={`${field} min-h-[40dvh] flex-1`}
        autoFocus
        maxLength={LIMITS.postLength}
        placeholder={CLUB_COPY.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center justify-between text-[14px] font-bold text-muted">
        <span>{CLUB_COPY.rulesLine}</span>
        {left <= 50 && <span className={left < 0 ? "text-red" : ""}>{CLUB_COPY.left(left)}</span>}
      </div>
      {error && (
        <p role="alert" className="font-bold text-red">
          {error}
        </p>
      )}
      <button type="button" className="btn3d green" disabled={busy || !text.trim() || left < 0} onClick={() => void post()}>
        {CLUB_COPY.post}
      </button>
      <button type="button" className={linkBtn} onClick={() => onOpenChange(false)}>
        {CLUB_COPY.cancel}
      </button>
    </ClubSheet>
  );
}

/** Why the player can't post yet: their title, or a ban. */
export function NudgeSheet({ kind, onClose, onPlay }: { kind: "rank" | "banned" | null; onClose: () => void; onPlay: () => void }) {
  const { me } = useClub();
  const until = me?.bannedUntil;
  const date =
    until && until !== "infinity"
      ? new Date(until).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" })
      : null;
  return (
    <ClubSheet
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={kind === "rank" ? CLUB_COPY.rankTitle : date ? CLUB_COPY.bannedUntil(date) : CLUB_COPY.bannedForGood}
    >
      {kind === "rank" && (
        <>
          <p className="text-[16px] font-bold text-muted">{CLUB_COPY.rankText(me?.title ?? "Street Seller")}</p>
          <button
            type="button"
            className="btn3d green"
            onClick={() => {
              onClose();
              onPlay();
            }}
          >
            {CLUB_COPY.playNow}
          </button>
        </>
      )}
      <button type="button" className={linkBtn} onClick={onClose}>
        {CLUB_COPY.close}
      </button>
    </ClubSheet>
  );
}
