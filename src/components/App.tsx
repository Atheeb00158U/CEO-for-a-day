"use client";

import { useEffect, useState } from "react";
import { GameProvider, today, useGame } from "@/lib/store";
import { Icon, Pill } from "./ui";
import { HomeTab } from "./HomeTab";
import { LeagueTab } from "./LeagueTab";
import { NotesTab } from "./NotesTab";
import { ShopTab } from "./ShopTab";
import { ProfileTab } from "./ProfileTab";
import { Player } from "./Player";
import { DailyPlayer } from "./DailyPlayer";
import { todaysCall } from "@/content/catalog";

export type Tab = "home" | "league" | "notes" | "shop" | "profile";
const TABS: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
  { id: "home", label: "Play", icon: "navHome" },
  { id: "league", label: "League", icon: "navLeague" },
  { id: "notes", label: "Notes", icon: "navNotes" },
  { id: "shop", label: "Shop", icon: "navShop" },
  { id: "profile", label: "Profile", icon: "navProfile" },
];

export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [playing, setPlaying] = useState<string | null>(null);
  const [playingDaily, setPlayingDaily] = useState(false);

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
    setTab(t);
    try {
      history.replaceState(null, "", "#" + t);
    } catch {
      /* sandboxed */
    }
    window.scrollTo(0, 0);
  };

  const { ready } = useGame();
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="pop grid size-20 place-items-center rounded-3xl bg-blue text-[#04121b]">
            <Icon.chair className="size-12" />
          </div>
          <p className="text-[20px] font-black">CEO for a day</p>
        </div>
      </div>
    );
  }

  const daily = playingDaily ? todaysCall(today()) : undefined;
  if (daily) return <DailyPlayer call={daily} onExit={() => setPlayingDaily(false)} />;

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
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar onShop={() => go("shop")} />
      <main className="flex-1 px-4 pb-28">
        {tab === "home" && <HomeTab onPlay={setPlaying} onDaily={() => setPlayingDaily(true)} onShop={() => go("shop")} />}
        {tab === "league" && <LeagueTab onPlay={() => go("home")} />}
        {tab === "notes" && <NotesTab onPlay={() => go("home")} />}
        {tab === "shop" && <ShopTab />}
        {tab === "profile" && <ProfileTab />}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-bg/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-[480px] justify-around px-2 py-2">
          {TABS.map((t) => {
            const I = Icon[t.icon];
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide ${on ? "bg-blue/15 text-blue ring-2 ring-blue/60" : "text-muted"}`}
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
    <header
      className="sticky top-0 z-10 flex items-center gap-2 bg-bg/95 px-4 pb-2 backdrop-blur"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
    >
      <div className="mr-auto flex items-center gap-2">
        <div className="grid size-10 place-items-center rounded-xl bg-blue text-[#04121b]">
          <Icon.chair className="size-6" />
        </div>
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
