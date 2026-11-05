"use client";

import { useEffect, useRef } from "react";
import { achievements, SPECIALS, TIER_COLOURS, type Progress } from "@/lib/achievements";
import { playSfx } from "@/lib/sfx";
import { BADGES, useGame } from "@/lib/store";
import { Bar } from "./ui";

const COPY = {
  title: "Achievements",
  special: "Special badges",
  level: (n: number) => `Level ${n}`,
  top: "Max level!",
  newTitle: "New achievement!",
  newBadge: "New badge!",
  button: "Nice!",
};

/** An achievement's emblem (public/achievements/<id>.webp), greyed out until earned. */
export function Emblem({ id, level, size }: { id: string; level: number; size: number }) {
  const src = `/achievements/${id}.webp`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 object-contain ${level ? "drop-shadow-[0_6px_10px_rgba(0,0,0,.45)]" : "opacity-35 grayscale"}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Profile's achievements: each family with its level and the way to the next, then the one-off badges. */
export function Achievements() {
  const { s } = useGame();
  const list = achievements(s);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[19px] font-black">{COPY.title}</h2>
      <ul className="flex flex-col divide-y-2 divide-line">
        {list.map((p) => (
          <Row key={p.family.id} p={p} />
        ))}
      </ul>
      <h3 className="mt-2 text-[17px] font-black">{COPY.special}</h3>
      <div className="grid grid-cols-3 gap-3">
        {SPECIALS.map((id) => {
          const got = s.badges.includes(id);
          return (
            <div key={id} className="flex flex-col items-center gap-1.5 text-center" title={BADGES[id].desc}>
              <Emblem id={id} level={got ? 1 : 0} size={76} />
              <span className={`text-[13px] leading-tight font-extrabold ${got ? "text-ink" : "text-muted"}`}>{BADGES[id].name}</span>
              <span className="text-[11px] leading-tight font-bold text-muted">{BADGES[id].desc}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ p }: { p: Progress }) {
  const { family: f, level, value, next } = p;
  const colour = TIER_COLOURS[Math.min(level, TIER_COLOURS.length) - 1];
  const pct = next === null ? 100 : (value / next) * 100; // matches the "3/7" beside it
  return (
    <li className="flex items-center gap-4 py-4">
      <div className="relative">
        <Emblem id={f.id} level={level} size={68} />
        {level > 0 && (
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-black whitespace-nowrap text-[#1a1206] uppercase"
            style={{ background: colour }}
          >
            {COPY.level(level)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-black">{f.name}</p>
        <p className="text-[13px] font-bold text-muted">{next === null ? COPY.top : f.goal(next)}</p>
        <div className="mt-2 flex items-center gap-2">
          <Bar value={pct} color={level ? colour : "var(--color-brand)"} h="h-3" />
          {next !== null && (
            <span className="shrink-0 text-[12px] font-black text-muted tabular-nums">
              {Math.min(value, next).toLocaleString("en-IN")}/{next.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/** A full-screen cheer for a new achievement level or badge: the emblem drops in with a shine, then one button. */
export function AchievementCelebration({
  id,
  level,
  name,
  line,
  onDone,
}: {
  id: string;
  level: number;
  name: string;
  line: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    playSfx("badge");
    ref.current?.focus();
  }, []);
  const beat = (n: number) => ({ animationDelay: `${n * 140}ms`, animationFillMode: "both" as const });
  const special = (SPECIALS as readonly string[]).includes(id);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ach-title"
      className="fixed inset-0 z-[56] overflow-y-auto bg-bg"
      style={{
        backgroundImage: "radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--color-gold) 24%, transparent), transparent 60%)",
      }}
    >
      <div
        className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-5 text-center"
        style={{ paddingTop: "max(40px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="my-auto flex flex-col items-center">
          <p className="pop text-[14px] font-black tracking-[.14em] text-gold uppercase">{special ? COPY.newBadge : COPY.newTitle}</p>
          <div className="medal-drop relative mt-4 overflow-hidden rounded-full">
            <Emblem id={id} level={Math.max(1, level)} size={200} />
            <span className="shine pointer-events-none absolute inset-0" aria-hidden />
          </div>
          <h1 id="ach-title" className="pop mt-5 text-[30px] leading-tight font-black text-balance" style={beat(4)}>
            {name}
          </h1>
          {!special && (
            <span
              className="pop mt-2 rounded-full px-3 py-1 text-[13px] font-black text-[#1a1206] uppercase"
              style={{ ...beat(5), background: TIER_COLOURS[Math.min(level, TIER_COLOURS.length) - 1] }}
            >
              {COPY.level(level)}
            </span>
          )}
          <p className="pop mt-3 max-w-[300px] text-[17px] font-bold text-muted" style={beat(6)}>
            {line}
          </p>
        </div>
        <button ref={ref} type="button" className="btn3d green pop mt-6 w-full" style={beat(7)} onClick={onDone}>
          {COPY.button}
        </button>
      </div>
    </div>
  );
}
