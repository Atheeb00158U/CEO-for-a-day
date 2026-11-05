// The public website. It sells the answer to a founder's fear (making the wrong call with nobody to teach them the
// rules), not samples of the game. Honest FOMO only (India's dark-pattern rules): real losses from real companies,
// real moments with the outcome kept for the app, and the one real scarcity, the founding price for the first 1,000
// members. A server component: whether founding seats are left is read here (never shown as a count).
// The website has its own look (site.css): bold uppercase headlines, the phone's own text face, one brass accent,
// everything inside one 1,280 px column.
import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import Link from "next/link";
import { preload } from "react-dom";
import "./site.css";
import { FoundingPrice } from "@/components/FoundingPrice";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { IdeaCloud } from "@/components/site/IdeaCloud";
import { ScenePicture } from "@/components/site/ScenePicture";
import { SCENES, sceneSrcSet } from "@/lib/brand";
import { TITLES } from "@/lib/career";
import { NOT_ADVICE, helpMail } from "@/lib/legal";
import { FOUNDING, FOUNDING_LINE, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { cachedSeatStatus } from "@/lib/server/seats";

const display = Oswald({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "CEO For A Day · Good business decisions are a skill",
  description:
    "Many people learn business by losing money, but you can learn it from real Indian companies in five minutes a day. Start free.",
};
export const revalidate = 60; // the founding offer switches to the regular plans at most a minute after the last seat goes

const PAINS = [
  "Your business is not growing, and you don't know why.",
  "You have lost money because of a wrong decision.",
  "You have no one to talk to about your business.",
  "You watch business videos, but forget what you learn.",
  "You can't afford an MBA, and you are not sure it would help.",
  "You worry about one big wrong decision.",
];

const BECOME = [
  "You know what to ask before a big decision.",
  "You spot the trap before it costs you money.",
  "You think like the founders you look up to.",
];

const yearly = REGULAR.yearly.toLocaleString("en-IN");

function faq(full: boolean) {
  return [
    {
      q: "What is CEO For A Day?",
      a: "It is a game that teaches you business. You learn one rule at a time in short lessons, then play a Hot Seat and make decisions for a real company.",
    },
    {
      q: "What is a Hot Seat?",
      a: "You face a big decision from a real company. You choose what to do, then see what the company did and what happened next.",
    },
    {
      q: "Do I need business experience?",
      a: "No. Each lesson starts with a real story and explains one rule in simple English.",
    },
    { q: "How long does it take?", a: "About five minutes for a lesson, and five to seven minutes for a Hot Seat." },
    {
      q: "Is it free?",
      a: "Yes. Your first five lessons and your first Hot Seat are free. Become a member to get the rest.",
    },
    full
      ? {
          q: "What does membership get me?",
          a: `All lessons and Hot Seats, plus new ones when they are added. ₹${REGULAR.monthly} a month or ₹${yearly} a year.`,
        }
      : {
          q: `What does ₹${FOUNDING.monthly} get me?`,
          a: (
            <>
              All lessons and Hot Seats, plus new ones when they are added. <FoundingPrice /> while you stay a member. {FOUNDING_LINE}
            </>
          ),
        },
    { q: "How do I pay?", a: "With UPI or a card, once a month." },
    {
      q: "Can I cancel?",
      a: full
        ? "Yes. Cancel any time with one tap in your profile or UPI app."
        : `Yes. Cancel any time with one tap in your profile or UPI app. If you cancel, you lose the ₹${FOUNDING.monthly} price.`,
    },
    {
      q: "Do I need to download an app?",
      a: "No. Play in your phone's browser. You can also add it to your home screen and open it like an app.",
    },
    {
      q: "Are the stories true?",
      a: "Yes. They come from public sources, and you can see the sources in each Hot Seat. One practice story is made up, and we tell you that.",
    },
    { q: "Is it in Hindi?", a: "Only English for now, but Hindi, Tamil and Bengali are coming." },
    {
      q: "Is this business advice?",
      a: "No. It is for learning. The real events come from public sources, and other possible results are our estimates.",
    },
  ];
}

/** True once every founding seat is taken. Never shown as a number. */
async function seatsFull() {
  try {
    return !(await cachedSeatStatus(supabaseDb())).open;
  } catch {
    return false; // no database (CI build, local without keys): show the founding offer
  }
}

/** The one action on the page, repeated after each section. */
function StartButton({ small = false, className = "" }: { small?: boolean; className?: string }) {
  return (
    <Link
      href="/app"
      className={`site-cta inline-flex items-center justify-center rounded-full font-semibold ${small ? "h-10 px-5 text-[15px]" : "h-14 px-9 text-[18px]"} ${className}`}
    >
      Start free
    </Link>
  );
}

/** A delay step for the parts of a section that rise in one after another. */
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

// The page's one column and its type steps: display (the hero, the close), heading, lead.
const WRAP = "mx-auto w-full max-w-[1280px] px-5 md:px-10";
const DISPLAY = "font-display text-[40px] leading-[0.98] text-balance md:text-[clamp(60px,5.6vw,92px)] md:leading-[0.94]";
const HEADING = "font-display text-[36px] leading-[1] text-balance md:text-[clamp(44px,4vw,64px)] md:leading-[0.98]";
const LEAD = "text-[18px] leading-[1.55] text-ink/85 md:text-[20px]";
const SIDE = "(min-width: 1280px) 500px, (min-width: 768px) 40vw, 100vw";

function Tick() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 fill-none stroke-[var(--brass)] stroke-[2.5]">
      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One plan card: name, price, what it includes, and a button at the foot. The featured one has a brass edge. */
function Plan({
  name,
  price,
  items,
  action,
  note,
  badge,
  featured = false,
}: {
  name: string;
  price: React.ReactNode;
  items: string[];
  action: string;
  note?: string;
  badge?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`site-rise flex flex-col rounded-[24px] p-8 ${featured ? "bg-[var(--warm)] ring-2 ring-[var(--brass)]" : "bg-surface"}`}
      style={step(featured ? 2 : 1)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className={`font-display text-[30px] leading-none ${featured ? "text-[var(--brass)]" : ""}`}>{name}</h3>
        {badge && (
          <span className="rounded-full bg-[var(--brass)] px-3 py-1 text-[13px] font-semibold text-[var(--brass-ink)]">{badge}</span>
        )}
      </div>
      <p className="mt-5 text-[34px] leading-none font-semibold tracking-[-0.02em]">{price}</p>
      {featured && badge && <p className="mt-3 text-[15px] font-semibold text-[var(--brass)]">{FOUNDING_LINE}</p>}
      <ul className="mt-7 grid gap-3 text-[17px]">
        {items.map((it) => (
          <li key={it} className="flex gap-3">
            <Tick />
            {it}
          </li>
        ))}
      </ul>
      {note && <p className="mt-6 text-[15px] leading-relaxed text-ink/70">{note}</p>}
      <div className="mt-auto pt-8">
        <Link
          href="/app"
          className={`flex h-12 items-center justify-center rounded-full text-[16px] font-semibold ${featured ? "site-cta" : "bg-surface-2 transition-colors hover:bg-line"}`}
        >
          {action}
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  preload(`/brand/site/empire-tall-752.avif`, {
    as: "image",
    type: "image/avif",
    imageSrcSet: sceneSrcSet("empire", true, "avif"),
    imageSizes: "100vw",
    media: "(max-width: 767px)",
    fetchPriority: "high",
  });
  preload(`/brand/site/empire-1672.avif`, {
    as: "image",
    type: "image/avif",
    imageSrcSet: sceneSrcSet("empire", false, "avif"),
    imageSizes: "100vw",
    media: "(min-width: 768px)",
    fetchPriority: "high",
  });
  const full = await seatsFull();

  return (
    <div className={`site ${display.variable} min-h-dvh overflow-x-clip`}>
      <LegacyHashRedirect />
      <header className={`${WRAP} flex h-16 items-center gap-3 md:h-20`}>
        <Logo size={32} />
        <span className="mr-auto text-[17px] font-semibold tracking-[-0.01em]">CEO For A Day</span>
        <nav aria-label="On this page" className="hidden items-center gap-8 text-[15px] font-medium text-ink/80 md:flex">
          <a className="site-link" href="#why">
            What you learn
          </a>
          <a className="site-link" href="#club">
            The Club
          </a>
          <a className="site-link" href="#price">
            Price
          </a>
        </nav>
        <StartButton small className="md:ml-6" />
      </header>

      <main>
        {/* Hero: one belief, on the wolf between the kirana and the towers. It paints at once: the picture is
            preloaded, a blurred copy and its colour stand in while it loads, and nothing here waits for a fade. */}
        <section>
          <div className="relative isolate overflow-hidden bg-surface md:h-[calc(100svh-80px)] md:min-h-[600px]">
            <div
              className="site-drift relative -z-10 aspect-square overflow-hidden bg-[#281818] bg-cover bg-center md:absolute md:inset-0 md:aspect-auto"
              style={{ backgroundImage: `url(${SCENES.empire.poster})` }}
            >
              <ScenePicture name="empire" priority sizes="100vw" className="h-full w-full object-cover object-top" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(20_27_34)_0%,rgb(20_27_34)_42%,rgb(20_27_34/0)_58%)] md:bg-[linear-gradient(to_top,rgb(11_16_21/0.95)_0%,rgb(11_16_21/0.5)_34%,rgb(11_16_21/0)_58%),linear-gradient(to_right,rgb(11_16_21/0.7)_0%,rgb(11_16_21/0)_55%)]"
            />
            <div className={`${WRAP} -mt-10 pb-8 md:absolute md:inset-x-0 md:bottom-0 md:mt-0 md:pb-16`}>
              <h1 className={`md:max-w-[22ch] ${DISPLAY}`}>Good business decisions are a skill.</h1>
              <p className={`mt-5 max-w-[44ch] ${LEAD}`}>
                Many people learn business by losing money, but you can learn it from real Indian companies in five minutes a day.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <StartButton className="w-full sm:w-auto" />
                <p className="text-[15px] text-ink/75">Free to start. No card needed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* What the course teaches: the named ideas from the course map as one cloud, the open ones in brass */}
        <section id="why" className="scroll-mt-4 md:py-16">
          <IdeaCloud>
            <h2 className="font-display max-w-[14ch] text-[40px] leading-[0.98] text-balance md:text-[clamp(56px,5.6vw,88px)]">
              Business ideas nobody teaches you
            </h2>
            <StartButton className="mt-8" />
          </IdeaCloud>
        </section>

        {/* The problem: the shopkeeper alone at night fills the width; the reader's worries sit on its dark right side,
            inside the page's column. On a phone the picture comes first and the list below it. */}
        <section className="site-zoom relative isolate mb-20 overflow-hidden bg-surface md:mb-32 md:min-h-[min(100svh,860px)]">
          <div className="relative aspect-[4/5] overflow-hidden md:absolute md:inset-0 md:-z-10 md:aspect-auto">
            <ScenePicture name="alone" className="h-full w-full object-cover md:object-[30%_50%]" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(20_27_34),rgb(20_27_34/0))] md:hidden"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 hidden md:block md:bg-[linear-gradient(to_left,rgb(11_16_21/0.96)_0%,rgb(11_16_21/0.85)_40%,rgb(11_16_21/0)_70%)]"
          />
          <div className={`${WRAP} pt-2 pb-16 md:flex md:min-h-[inherit] md:items-center md:justify-end md:py-20`}>
            <div className="md:w-[min(52%,600px)]">
              <h2 className={`site-rise ${HEADING}`}>Be honest. Is this you?</h2>
              <ul className="mt-8 grid gap-1">
                {PAINS.map((p, i) => (
                  <li
                    key={p}
                    className={`site-rise flex gap-3 rounded-[14px] px-5 py-3.5 text-[18px] leading-snug md:text-[20px] ${i % 2 ? "" : "bg-bg/70"}`}
                    style={step(i * 0.3)}
                  >
                    <span aria-hidden="true" className="-mt-0.5 text-[26px] leading-none font-bold text-[var(--brass)]">
                      •
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <p className={`site-rise mt-6 ${LEAD}`}>If this sounds like you, you are not alone. Nobody taught you these rules.</p>
            </div>
          </div>
        </section>

        {/* Where the rules come from: paid for by real companies, learned here in five minutes */}
        <section className={`${WRAP} pb-20 md:grid md:grid-cols-12 md:items-center md:gap-10 md:pb-32`}>
          <div className="md:col-span-6">
            <h2 className={`site-rise ${HEADING}`}>School did not teach you this.</h2>
            <p className={`site-rise mt-6 ${LEAD}`} style={step(1)}>
              School taught you to pass exams, but business asks something harder: what do you do when your own money is at risk?
            </p>
            <p className={`site-rise mt-4 ${LEAD}`} style={step(2)}>
              Real companies made these decisions with crores at stake, and you learn the rule behind each one in five minutes.
            </p>
            <StartButton className="site-rise mt-8 w-full sm:w-auto" />
          </div>
          <div className="site-rise mt-10 overflow-hidden rounded-[24px] bg-surface md:col-span-5 md:col-start-8 md:mt-0">
            <ScenePicture name="shop" sizes={SIDE} className="aspect-[4/5] h-auto w-full object-cover" />
          </div>
        </section>

        {/* Who you become: the same shopkeeper at sunrise, then the ladder of titles */}
        <section className={`${WRAP} pb-20 md:pb-32`}>
          <div className="md:grid md:grid-cols-12 md:items-center md:gap-10">
            <div className="site-rise overflow-hidden rounded-[24px] bg-surface md:col-span-5">
              <ScenePicture name="rise" sizes={SIDE} className="aspect-[4/5] h-auto w-full object-cover object-[57%_50%]" />
            </div>
            <div className="mt-10 md:col-span-6 md:col-start-7 md:mt-0">
              <h2 className={`site-rise ${HEADING}`}>Who you become</h2>
              <ul className="mt-6 grid gap-3">
                {BECOME.map((b, i) => (
                  <li key={b} className="site-rise flex gap-3 text-[19px] leading-snug md:text-[22px]" style={step(i * 0.4 + 1)}>
                    <span aria-hidden="true" className="text-[var(--brass)]">
                      →
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-16 md:mt-24 md:grid md:grid-cols-12 md:items-end md:gap-10">
            <h2 className={`site-rise md:col-span-7 ${HEADING}`}>From Street Seller to CEO</h2>
            <p className={`site-rise mt-5 max-w-[34ch] md:col-span-5 md:mt-0 ${LEAD}`} style={step(1)}>
              Your title grows as you learn, from Street Seller to CEO.
            </p>
          </div>
          <ol className="mt-10 grid gap-1.5 md:mt-12 xl:h-[400px] xl:grid-cols-10 xl:items-end xl:gap-2">
            {TITLES.map((t, i) => {
              const top = i === TITLES.length - 1;
              return (
                <li
                  key={t}
                  className="site-rise flex flex-col xl:h-full xl:justify-end"
                  style={{ "--i": i * 0.4, "--h": `${12 + i * 7.1}%`, "--w": `${34 + i * 7.3}%` } as React.CSSProperties}
                >
                  {top && (
                    <div className="hidden xl:block">
                      <WolfPicture name="pose-celebrating" sizes="110px" className="mx-auto aspect-square w-[80%]" />
                    </div>
                  )}
                  <div
                    className={`flex h-12 w-[var(--w)] items-center rounded-[12px] px-4 xl:h-[var(--h)] xl:w-full xl:items-end xl:px-2.5 xl:pb-3 ${top ? "bg-[var(--brass)] text-[var(--brass-ink)]" : "bg-surface-2"}`}
                  >
                    <span className="text-[14px] leading-tight font-semibold xl:text-[15px]">{t}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The Club: founders pushing each other's ideas at a chai stall, the wolf hosting at the edge; full width, the
            words on the dark foot of the picture, inside the page's column; honest that it opens soon */}
        <section
          id="club"
          className="site-zoom relative isolate mb-20 scroll-mt-4 overflow-hidden bg-surface md:mb-32 md:min-h-[min(100svh,860px)]"
        >
          <div className="relative aspect-[4/5] overflow-hidden md:absolute md:inset-0 md:-z-10 md:aspect-auto">
            <ScenePicture name="club" className="h-full w-full object-cover" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(20_27_34),rgb(20_27_34/0))] md:hidden"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 hidden md:block md:bg-[linear-gradient(to_top,rgb(11_16_21/0.95)_0%,rgb(11_16_21/0.75)_28%,rgb(11_16_21/0)_58%)]"
          />
          <div className={`${WRAP} pt-2 pb-16 md:flex md:min-h-[inherit] md:items-end md:pb-20`}>
            <div className="max-w-[620px]">
              <h2 className={`site-rise ${HEADING}`}>Meet serious business minds</h2>
              <p className={`site-rise mt-6 ${LEAD}`} style={step(1)}>
                The Club is a private place for members to share what worked, ask for advice and meet people who want to build a business.
              </p>
              <p className="site-rise mt-3 text-[18px] font-semibold text-[var(--brass)] md:text-[20px]" style={step(3)}>
                The Club opens soon.
              </p>
              <StartButton className="site-rise mt-8 w-full sm:w-auto" />
            </div>
          </div>
        </section>

        {/* Price: two plans side by side, the same shape, the member plan highlighted; the one real scarcity on top */}
        <section id="price" className={`${WRAP} scroll-mt-4 pb-20 md:pb-32`}>
          <div className="mx-auto max-w-[720px] text-center">
            <h2 className={`site-rise ${HEADING}`}>Start free</h2>
            {!full && (
              <p className={`site-rise mt-5 ${LEAD}`} style={step(1)}>
                The founding price is only for the first {FOUNDING.seats.toLocaleString("en-IN")} members. After that, it is ₹
                {REGULAR.monthly} a month.
              </p>
            )}
          </div>
          <div className="mx-auto mt-12 grid max-w-[920px] gap-4 md:grid-cols-2">
            <Plan
              name="Free"
              price={<>₹0</>}
              items={["Your first five lessons", "Your first Hot Seat", "Flashcards and leagues"]}
              action="Start free"
            />
            <Plan
              featured
              name="Member"
              badge={full ? undefined : "Founding price"}
              price={full ? <>₹{REGULAR.monthly} a month</> : <FoundingPrice />}
              note={full ? `Or ₹${yearly} a year.` : `You keep ₹${FOUNDING.monthly} a month for as long as you stay a member.`}
              items={[
                "All lessons and Hot Seats",
                "New ones when they are ready",
                "The Club, when it opens",
                "Cancel any time with one tap",
              ]}
              action="Start free, join when ready"
            />
          </div>
        </section>

        {/* Questions: an accordion, the first one open; works with no script */}
        <section aria-labelledby="questions" className={`${WRAP} pb-20 md:pb-32`}>
          <div className="mx-auto max-w-[820px]">
            <h2 id="questions" className={`site-rise text-center ${HEADING}`}>
              Questions
            </h2>
            <div className="mt-10 grid gap-2">
              {faq(full).map((f, i) => (
                <details key={f.q} open={i === 0} className="site-faq group rounded-[18px] bg-surface px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-semibold md:text-[20px] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-5 w-5 shrink-0 fill-none stroke-[var(--brass)] stroke-[2.5] transition-transform group-open:rotate-180"
                    >
                      <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="max-w-[64ch] pb-6 text-[17px] leading-[1.55] text-ink/85">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* The close: learn it here, or with your own money */}
        <section className={WRAP}>
          <div className="site-zoom relative isolate flex min-h-[70svh] items-end overflow-hidden rounded-[28px] bg-surface md:min-h-[560px]">
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <ScenePicture name="dairy" sizes="(min-width: 1280px) 1200px, 100vw" className="h-full w-full object-cover" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21/0.94)_0%,rgb(11_16_21/0.6)_34%,rgb(11_16_21/0)_64%)]"
            />
            <div className="w-full p-6 md:flex md:items-end md:justify-between md:gap-10 md:p-12">
              <div>
                <h2 className={`site-rise md:max-w-[24ch] ${HEADING}`}>Learn it here, or learn it with your own money.</h2>
                <p className={`site-rise mt-5 ${LEAD}`} style={step(1)}>
                  Start your first lesson for free.
                </p>
              </div>
              <StartButton className="site-rise mt-8 w-full shrink-0 sm:w-auto md:mt-0" />
            </div>
          </div>
        </section>
      </main>

      <footer className={`${WRAP} pt-16 pb-10 md:pt-20`}>
        <div className="flex flex-col gap-6 text-[15px] text-ink/75 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[44ch]">{NOT_ADVICE} Other outcomes are estimates.</p>
          <p className="flex gap-6 text-ink">
            <Link className="site-link" href="/app">
              Start
            </Link>
            <Link className="site-link" href="/privacy">
              Privacy
            </Link>
            <Link className="site-link" href="/terms">
              Terms
            </Link>
            <a className="site-link" href={helpMail()}>
              Help
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
