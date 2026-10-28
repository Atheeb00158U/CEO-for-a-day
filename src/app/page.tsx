// The public website. A server component: only the card fields below reach the browser, never the Hot Seat answers.
import type { Metadata } from "next";
import Link from "next/link";
import { CATALOG } from "@/content/catalog";
import { Icon } from "@/components/icons";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";

export const metadata: Metadata = {
  title: "CEO For A Day · Sit in the hot seat of a real company",
};

const media = (m: string) => `/media/${m.replace(/^img:/, "")}.webp`;

const STEPS = [
  { title: "Pick a Hot Seat", text: "Each one is a real company at a real turning point. You are the CEO." },
  {
    title: "Make the big calls",
    text: "Choose from three options. Every call moves Profit and Future. Costly calls lose the board's trust.",
  },
  { title: "See what really happened", text: "Get your CEO score, what the real company did, and notes written for the calls you made." },
];

const HABITS = [
  { icon: <Icon.flame className="size-10" />, title: "Daily streak", text: "One call a day keeps your streak alive." },
  { icon: <Icon.navLeague className="size-10 text-gold" />, title: "Weekly leagues", text: "Earn XP, climb from Intern to Tycoon." },
  { icon: <Icon.navNotes className="size-10 text-brand" />, title: "Your notes", text: "Every Hot Seat leaves lessons you can reread." },
];

function PlayButton({ children = "Play free", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <Link href="/app" className={`btn3d green ${className}`}>
      {children}
    </Link>
  );
}

export default function Home() {
  const cards = CATALOG.map(({ id, company, title, hook, cover, available }) => ({ id, company, title, hook, cover, available }));
  const featured = cards.find((c) => c.available && c.cover);

  return (
    <div className="min-h-dvh">
      <LegacyHashRedirect />

      <header className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-4 sm:px-6">
        <div className="grid size-10 place-items-center rounded-xl bg-brand text-[#1a1206]">
          <Icon.chair className="size-6" />
        </div>
        <span className="mr-auto text-[15px] leading-none font-black">
          CEO
          <br />
          <span className="text-muted">for a day</span>
        </span>
        <PlayButton className="!w-auto !px-5 !py-2.5 !text-[14px]">Play</PlayButton>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1100px] items-center gap-10 px-4 pt-6 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-14 md:pb-24">
          <div>
            <p className="text-[13px] font-black tracking-[.14em] text-brand uppercase">A game about real business calls</p>
            <h1 className="mt-3 text-[40px] leading-[1.05] font-black text-balance sm:text-[56px]">
              Sit in the hot seat of a real company.
            </h1>
            <p className="mt-4 max-w-[34ch] text-[19px] leading-snug font-bold text-muted">
              Make the big calls. Live with what happens. Then see what really happened.
            </p>
            <div className="mt-8 flex max-w-[420px] flex-col gap-3 sm:flex-row">
              <PlayButton />
              <a href="#how" className="btn3d ghost">
                How it works
              </a>
            </div>
            <p className="mt-6 text-[14px] font-bold text-muted">
              Short, narrated stories · 5–8 minutes each · Made for people starting a business
            </p>
          </div>

          {featured?.cover && (
            <div className="relative">
              <div className="overflow-hidden rounded-3xl border-2 border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- static local media, no optimisation needed */}
                <img src={media(featured.cover)} alt="" className="aspect-[4/3] w-full object-cover" />
              </div>
              <div
                aria-hidden="true"
                className="relative mx-4 -mt-10 rounded-2xl border-2 border-line bg-surface p-4 shadow-2xl md:absolute md:inset-x-8 md:-bottom-8 md:mx-0 md:mt-0"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-black tracking-wider text-brand uppercase">Your call · 1975</p>
                  <span className="flex gap-0.5">
                    <Icon.heart className="size-5" />
                    <Icon.heart className="size-5" />
                    <Icon.heart className="size-5" />
                  </span>
                </div>
                <p className="mt-1 text-[18px] leading-tight font-black">{featured.hook}</p>
                <div className="mt-3 grid gap-2">
                  <div className="tile !py-2 !text-[14px]">Lock it in the lab</div>
                  <div className="tile !py-2 !text-[14px]" aria-pressed="true">
                    Set up a small digital team
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="border-y-2 border-line bg-surface/60">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
            <h2 className="text-[30px] font-black">How it works</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border-2 border-line bg-bg p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand text-[18px] font-black text-[#1a1206]">{i + 1}</span>
                  <h3 className="mt-4 text-[20px] font-black">{s.title}</h3>
                  <p className="mt-1 text-[16px] leading-snug font-bold text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Hot Seats */}
        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
          <h2 className="text-[30px] font-black">Hot Seats</h2>
          <p className="mt-1 text-[16px] font-bold text-muted">Real companies. Real turning points. New ones every week.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li
                key={c.id}
                className={`overflow-hidden rounded-2xl border-2 ${c.available ? "border-line bg-surface" : "border-dashed border-line"}`}
              >
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static local media
                  <img src={media(c.cover)} alt="" className="aspect-[16/9] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-surface-2 text-muted">
                    <Icon.lock />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-[12px] font-black tracking-[.12em] text-brand uppercase">{c.company}</p>
                  <h3 className="mt-1 text-[19px] leading-tight font-black">{c.title}</h3>
                  <p className="mt-1 text-[15px] leading-snug font-bold text-muted">{c.hook}</p>
                  {c.available ? (
                    <Link href="/app" className="mt-3 inline-block text-[14px] font-black tracking-wide text-green uppercase">
                      Play now →
                    </Link>
                  ) : (
                    <p className="mt-3 text-[14px] font-black tracking-wide text-muted uppercase">Coming soon</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Habit strip */}
        <section className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
          <div className="grid gap-4 rounded-3xl border-2 border-line bg-surface p-6 md:grid-cols-3">
            {HABITS.map((h) => (
              <div key={h.title} className="flex items-center gap-4">
                {h.icon}
                <div>
                  <p className="text-[18px] font-black">{h.title}</p>
                  <p className="text-[15px] font-bold text-muted">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section className="mx-auto max-w-[1100px] px-4 pb-20 text-center sm:px-6">
          <h2 className="text-[30px] leading-tight font-black text-balance">Your first Hot Seat takes about 7 minutes.</h2>
          <div className="mx-auto mt-6 max-w-[360px]">
            <PlayButton />
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-8 text-[14px] font-bold text-muted sm:px-6">
          <p className="font-black text-ink">CEO For A Day</p>
          <p>Education, not business advice. Real stories use public sources. Other outcomes are estimates.</p>
          <p>Archive footage from the Moving Image Archive (public domain).</p>
        </div>
      </footer>
    </div>
  );
}
