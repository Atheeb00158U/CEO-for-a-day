"use client";

import { BADGES, LEAGUES, useGame } from "@/lib/store";
import { Card, Icon } from "./ui";

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
  const { s, setSetting, setName, reset } = useGame();
  const decisions = s.runs.reduce((a, r) => a + r.notes.length, 0) || 1;
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center gap-4">
        <div className="grid size-20 place-items-center rounded-full bg-blue text-[34px] font-black text-[#04121b]">{s.name[0]?.toUpperCase()}</div>
        <div className="min-w-0">
          <label htmlFor="name" className="sr-only">Your name</label>
          <input id="name" defaultValue={s.name} onBlur={(e) => setName(e.target.value)} className="w-full bg-transparent text-[26px] font-black outline-none focus:underline" />
          <p className="font-bold text-muted">{LEAGUES[s.league.tier]} league</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Icon.flame className="size-7" />} value={s.streak} label="Day streak" />
        <Stat icon={<Icon.bolt className="size-7" />} value={s.xp} label="Total XP" />
        <Stat icon={<Icon.chair className="size-7 text-blue" />} value={s.runs.length} label="Hot seats played" />
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
                  <span className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface bg-blue transition-[left] duration-700" style={{ left: `${pos}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[12px] font-bold text-muted"><span>{t.low}</span><span>{t.high}</span></div>
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
              <div key={id} className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-center ${got ? "bg-gold/10" : "bg-surface-2 opacity-50"}`} title={b.desc}>
                <span className={`grid size-12 place-items-center rounded-full text-[20px] font-black ${got ? "bg-gold text-[#2a1d00]" : "bg-line text-muted"}`}>{got ? "★" : "?"}</span>
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
          <input type="checkbox" checked={s.settings.voice} onChange={(e) => setSetting("voice", e.target.checked)} className="size-6 accent-[var(--color-blue)]" />
        </label>
        <div>
          <p className="mb-2 font-extrabold">Language</p>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button key={l.id} type="button" disabled={!l.ready} onClick={() => setSetting("lang", l.id)}
                className={`rounded-full border-2 px-3 py-1.5 text-[15px] font-extrabold ${s.settings.lang === l.id ? "border-blue text-blue" : "border-line text-muted"} disabled:opacity-60`}>
                {l.label}{!l.ready && <span className="ml-1 text-[11px]">soon</span>}
              </button>
            ))}
          </div>
        </div>
        <ResetButton onReset={reset} />
      </Card>
    </div>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <details>
      <summary className="cursor-pointer text-[14px] font-extrabold text-red">Reset all progress</summary>
      <p className="my-2 text-[14px] font-bold text-muted">This clears your XP, streak, notes and badges on this device.</p>
      <button type="button" className="btn3d red !text-[14px]" onClick={onReset}>Yes, reset everything</button>
    </details>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-line p-3">
      {icon}
      <div><p className="text-[22px] font-black leading-none tabular-nums">{value}</p><p className="text-[13px] font-bold text-muted">{label}</p></div>
    </div>
  );
}
