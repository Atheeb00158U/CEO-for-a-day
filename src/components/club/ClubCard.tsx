"use client";

// The Club rows on the game's Profile tab: open or join, My reports, Report a problem and Leave the Club.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/auth";
import { CLUB_COPY, type ClubMe } from "@/lib/community";
import { useGame } from "@/lib/store";
import { Card } from "../ui";
import { errorText, linkBtn, openClub } from "./shared";
import { JoinSheet, RulesSheet } from "./sheets";

export function ClubCard() {
  const { account, club } = useGame();
  const [me, setMe] = useState<ClubMe | null>(null);
  const [joining, setJoining] = useState(false);
  const [rules, setRules] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    if (account && club)
      api<ClubMe>("/api/club/me")
        .then(setMe)
        .catch(() => {});
  }, [account, club]);
  useEffect(load, [load]);
  if (!account || !club || !me) return null;

  const leave = async () => {
    setError(undefined);
    try {
      await api("/api/club/leave", { body: {} });
      setLeaving(false);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const row = "flex w-full items-center justify-between py-2 text-left text-[16px] font-extrabold";
  return (
    <Card className="flex flex-col">
      <h2 className="mb-1 text-[19px] font-black">{CLUB_COPY.title}</h2>
      {me.profile ? (
        <button type="button" className={row} onClick={() => openClub(`@${me.profile!.handle}`)}>
          {CLUB_COPY.clubProfile} <span className="text-muted">@{me.profile.handle} ›</span>
        </button>
      ) : (
        <button type="button" className={`${row} text-brand`} onClick={() => setJoining(true)}>
          {CLUB_COPY.joinTitle} <span>›</span>
        </button>
      )}
      <button type="button" className={row} onClick={() => openClub("reports")}>
        {CLUB_COPY.myReports} <span className="text-muted">›</span>
      </button>
      <button type="button" className={row} onClick={() => setRules(true)}>
        {CLUB_COPY.reportProblem} <span className="text-muted">›</span>
      </button>
      {me.profile &&
        (leaving ? (
          <div role="group" aria-label={CLUB_COPY.leaveTitle} className="mt-2 flex flex-col gap-3">
            <p className="text-[17px] font-black">{CLUB_COPY.leaveTitle}</p>
            <p className="font-bold text-muted">{CLUB_COPY.leaveText}</p>
            <button type="button" className="btn3d red !text-[14px]" onClick={() => void leave()}>
              {CLUB_COPY.leaveYes}
            </button>
            <button type="button" className={linkBtn} onClick={() => setLeaving(false)}>
              {CLUB_COPY.stay}
            </button>
            {error && <p className="font-bold text-red">{error}</p>}
          </div>
        ) : (
          <button type="button" className={`${row} text-red`} onClick={() => setLeaving(true)}>
            {CLUB_COPY.leave}
          </button>
        ))}
      <JoinSheet open={joining} onOpenChange={setJoining} onJoined={load} />
      <RulesSheet open={rules} onOpenChange={setRules} />
    </Card>
  );
}
