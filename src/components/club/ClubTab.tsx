"use client";

// The Club tab: a small screen stack mirrored in the hash (#club, #club/post/9, #club/@ravik, #club/activity,
// #club/reports), so the phone's back button and notification links work. App passes the part after "#club/".
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/auth";
import { CLUB_COPY, type Can, type ClubMe, type PostView } from "@/lib/community";
import { showPaywall } from "@/lib/content-client";
import { useGame } from "@/lib/store";
import { SignInCard } from "../SignInCard";
import { Activity, ClubProfile, Feed, MyReports, Thread } from "./screens";
import { ClubContext, TitleStars } from "./shared";
import { Composer, JoinSheet, NudgeSheet, ReportSheet } from "./sheets";

export function ClubTab({ sub, onPlay, onMe }: { sub: string; onPlay: () => void; onMe?: (me: ClubMe) => void }) {
  const { account } = useGame();
  const [me, setMe] = useState<ClubMe | null>(null);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [composing, setComposing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [nudgeKind, setNudgeKind] = useState<"rank" | "banned" | null>(null);
  const [reporting, setReporting] = useState<{ kind: "post" | "profile"; id: string } | null>(null);
  const [added, setAdded] = useState<PostView[]>([]);

  const onMeRef = useRef(onMe);
  useEffect(() => {
    onMeRef.current = onMe;
  });
  const reloadMe = useCallback(() => {
    if (!account) return;
    api<ClubMe>("/api/club/me")
      .then((m) => {
        setMe(m);
        onMeRef.current?.(m);
      })
      .catch(() => {});
  }, [account]);
  useEffect(reloadMe, [reloadMe]);

  const nudge = (can: Can) => {
    if (can === "join") setJoining(true);
    else if (can === "pay") showPaywall(undefined, CLUB_COPY.payLine);
    else if (can === "rank" || can === "banned") setNudgeKind(can);
  };

  if (!account) return <GuestClub />;

  const [screen, arg] = sub.startsWith("@") ? ["@", sub.slice(1)] : sub.split("/");
  return (
    <ClubContext.Provider value={{ me, reloadMe, nudge, report: (kind, id) => setReporting({ kind, id }) }}>
      {screen === "post" && arg ? (
        <Thread key={arg} id={arg} />
      ) : screen === "@" && arg ? (
        <ClubProfile key={arg} handle={arg} />
      ) : screen === "activity" ? (
        <Activity />
      ) : screen === "reports" ? (
        <MyReports />
      ) : (
        <>
          <Feed tab={tab} onTab={setTab} added={added} />
          <button
            type="button"
            aria-label={CLUB_COPY.newPost}
            className="btn3d green fixed z-30 !size-16 !rounded-full !p-0 !text-[34px]"
            style={{ bottom: "calc(92px + env(safe-area-inset-bottom))", right: "max(16px, calc(50vw - 224px))" }}
            onClick={() => (me?.can.post === "ok" ? setComposing(true) : me && nudge(me.can.post))}
          >
            +
          </button>
        </>
      )}
      <Composer open={composing} onOpenChange={setComposing} onPosted={(p) => setAdded((x) => [p, ...x])} />
      <JoinSheet open={joining} onOpenChange={setJoining} onJoined={reloadMe} />
      <NudgeSheet kind={nudgeKind} onClose={() => setNudgeKind(null)} onPlay={onPlay} />
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </ClubContext.Provider>
  );
}

/** Guests: one sign-in card over three blurred sample posts (fixed text, not real posts). */
function GuestClub() {
  return (
    <div className="relative flex flex-col gap-3 pt-2">
      <h1 className="text-[26px] font-black">{CLUB_COPY.title}</h1>
      <div aria-hidden="true" className="pointer-events-none flex flex-col gap-3 blur-[3px] select-none">
        {CLUB_COPY.samples.map((x) => (
          <div key={x.name} className="rounded-3xl border-2 border-line bg-surface p-4">
            <p className="font-black">{x.name}</p>
            <TitleStars title={x.title} stars={1} maxStars={2} />
            <p className="mt-2 font-bold">{x.body}</p>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-16">
        <SignInCard title={CLUB_COPY.guestTitle} text={CLUB_COPY.guestText} />
      </div>
    </div>
  );
}
