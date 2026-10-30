"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { playSfx } from "@/lib/sfx";
import { GameProvider, today, useGame } from "@/lib/store";
import { Icon, Pill } from "./ui";
import { Logo } from "./Logo";
import { HomeTab } from "./HomeTab";
import { LeagueTab } from "./LeagueTab";
import { NotesTab } from "./NotesTab";
import { ShopTab } from "./ShopTab";
import { ProfileTab } from "./ProfileTab";
import { Player } from "./Player";
import { DailyPlayer } from "./DailyPlayer";
import { LessonPlayer } from "./LessonPlayer";
import { ReviewSession } from "./ReviewSession";
import { InstallSheet } from "./InstallSheet";
import { Onboarding } from "./Onboarding";
import { ContentProvider, useDaily, type Content, type LessonTarget } from "@/lib/content-client";

export type Tab = "home" | "league" | "notes" | "shop" | "profile";
const TABS: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
  { id: "home", label: "Play", icon: "navHome" },
  { id: "league", label: "League", icon: "navLeague" },
  { id: "notes", label: "Notes", icon: "navNotes" },
  { id: "shop", label: "Shop", icon: "navShop" },
  { id: "profile", label: "Profile", icon: "navProfile" },
];

export function App({ content }: { content: Content }) {
  return (
    <ContentProvider value={content}>
      <GameProvider>
        <Shell />
        <OfflineCover />
      </GameProvider>
    </ContentProvider>
  );
}

const onConnection = (f: () => void) => {
  window.addEventListener("online", f);
  window.addEventListener("offline", f);
  return () => {
    window.removeEventListener("online", f);
    window.removeEventListener("offline", f);
  };
};

/** The game is online only. This covers the screen without closing anything, so play carries on when the connection is back. */
function OfflineCover() {
  const online = useSyncExternalStore(
    onConnection,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="alert" className="fixed inset-0 z-[60] grid place-items-center bg-bg px-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={96} />
        <p className="text-[24px] font-black">No internet</p>
        <p className="text-[17px] font-bold text-muted">Connect to the internet to play. You’ll carry on from here.</p>
      </div>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [playing, setPlaying] = useState<string | null>(null);
  const [playingDaily, setPlayingDaily] = useState(false);
  const [lesson, setLesson] = useState<{ target: LessonTarget; testOut?: string[] } | null>(null);
  const [reviewing, setReviewing] = useState<{ title: string; lessonIds?: string[] } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.replace("#", "") as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (t: Tab) => {
    playSfx("tab");
    setTab(t);
    try {
      history.replaceState(null, "", "#" + t);
    } catch {
      /* sandboxed */
    }
    mainRef.current?.scrollTo(0, 0);
  };

  const { ready, s } = useGame();
  const daily = useDaily();
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={112} className="pop" />
          <p className="text-[20px] font-black">CEO for a day</p>
        </div>
      </div>
    );
  }

  if (!s.onboarding.done) return <Onboarding onDone={() => go("home")} />;

  if (lesson)
    return (
      <LessonPlayer key={JSON.stringify(lesson.target)} target={lesson.target} testOut={lesson.testOut} onExit={() => setLesson(null)} />
    );

  if (reviewing) return <ReviewSession title={reviewing.title} lessonIds={reviewing.lessonIds} onExit={() => setReviewing(null)} />;

  if (playingDaily && daily?.call) return <DailyPlayer call={daily.call} onExit={() => setPlayingDaily(false)} />;

  if (playing)
    return (
      <Player
        hotSeatId={playing}
        onExit={() => setPlaying(null)}
        onNotes={() => {
          setPlaying(null);
          go("notes");
        }}
      />
    );

  return (
    // The page itself never scrolls, only <main>: iPhone browsers misplace bars pinned to a scrolling page,
    // leaving a gap below the tab bar.
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col">
      <TopBar onShop={() => go("shop")} />
      <InstallSheet />
      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {tab === "home" && (
          <HomeTab
            daily={daily?.call}
            onPlay={setPlaying}
            onDaily={() => setPlayingDaily(true)}
            onShop={() => go("shop")}
            onLesson={(lessonId) => setLesson({ target: { lessonId } })}
            onTestOut={(moduleId, lessonIds) => setLesson({ target: { testOut: moduleId }, testOut: lessonIds })}
            onPractice={(title, lessonIds) => setReviewing({ title, lessonIds })}
          />
        )}
        {tab === "league" && <LeagueTab onPlay={() => go("home")} />}
        {tab === "notes" && (
          <NotesTab
            onPlay={() => go("home")}
            onReview={() => setReviewing({ title: "Today's cards" })}
            onLesson={(lessonId) => setLesson({ target: { lessonId } })}
          />
        )}
        {tab === "shop" && <ShopTab />}
        {tab === "profile" && <ProfileTab />}
      </main>
      <nav className="shrink-0 border-t-2 border-line bg-bg" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex justify-around px-2 py-2">
          {TABS.map((t) => {
            const I = Icon[t.icon];
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide ${on ? "bg-brand/15 text-brand ring-2 ring-brand/60" : "text-muted"}`}
              >
                <I className="size-7" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function TopBar({ onShop }: { onShop: () => void }) {
  const { s, boosterActive } = useGame();
  const playedToday = s.lastActiveDay === today();
  const mins = Math.max(0, Math.ceil((s.boosterUntil - Date.now()) / 60000));
  return (
    <header className="flex shrink-0 items-center gap-2 bg-bg px-4 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="mr-auto flex items-center gap-2">
        <Logo size={40} />
        <span className="text-[15px] font-black leading-none">
          CEO
          <br />
          <span className="text-muted">for a day</span>
        </span>
      </div>
      {boosterActive && (
        <button
          type="button"
          onClick={onShop}
          className="pop flex items-center gap-1 rounded-full bg-purple px-2.5 py-1.5 text-[13px] font-black text-[#160a2c]"
          aria-label={`Double XP active, ${mins} minutes left`}
        >
          <Icon.boltPurple className="size-4 [&_path]:fill-[#160a2c]" />
          2× {mins}m
        </button>
      )}
      <Pill label={`${s.streak} day streak`}>
        {playedToday ? <Icon.flame className="size-6" /> : <Icon.flameOff className="size-6" />}
        {s.streak}
      </Pill>
      <button type="button" onClick={onShop} aria-label={`${s.coins} coins, open shop`}>
        <Pill label={`${s.coins} coins`}>
          <Icon.coin className="size-6" />
          {s.coins}
        </Pill>
      </button>
    </header>
  );
}
