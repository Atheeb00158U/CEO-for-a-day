// The public website. It sells the answer to a founder's fear (making the wrong call with nobody to teach them the
// rules), not samples of the game: the problem, who they become, the Club, then the offer. A server component:
// whether founding seats are left is read here (never shown as a count) to pick the founding or regular offer.
// The website has its own look (site.css): bold uppercase headlines, the phone's own text face, one brass accent.
import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import Link from "next/link";
import { preload } from "react-dom";
import "./site.css";
import { FoundingPrice } from "@/components/FoundingPrice";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { ScenePicture } from "@/components/site/ScenePicture";
import { SCENES, sceneSrcSet, type SceneName } from "@/lib/brand";
import { TITLES } from "@/lib/career";
import { FOUNDING, FOUNDING_LINE, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { cachedSeatStatus } from "@/lib/server/seats";

const display = Oswald({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "CEO For A Day · Good business decisions are a skill",
  description: "Learn them from real Indian companies. Five minutes a day. Start free.",
};
export const revalidate = 60; // the founding offer switches to the regular plans at most a minute after the last seat goes

const PAINS = [
  "Your business is not growing, and you don't know why.",
  "You have lost money on wrong decisions.",
  "Nobody around you understands your business.",
  "You watch business videos, but you forget them.",
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
    { q: "Is it free?", a: "Yes. Your first five lessons and first Hot Seat are free. Membership gives you the rest." },
    full
      ? {
          q: "What does membership get me?",
          a: `All lessons and Hot Seats, including new ones we add. ₹${REGULAR.monthly} a month or ₹${yearly} a year.`,
        }
      : {
          q: `What does ₹${FOUNDING.monthly} get me?`,
          a: (
            <>
              All lessons and Hot Seats, including new ones we add. <FoundingPrice /> while you stay a member. {FOUNDING_LINE}
            </>
          ),
        },
    {
      q: "Can I cancel?",
      a: full
        ? "Yes. Cancel any time with one tap in your profile or UPI app."
        : `Yes. Cancel any time with one tap in your profile or UPI app. If you cancel, you lose the ₹${FOUNDING.monthly} price.`,
    },
    { q: "Is it in Hindi?", a: "Only English for now. Hindi, Tamil and Bengali are coming." },
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

// The type steps of the website: display (the hero, the close), heading, lead.
const DISPLAY = "font-display text-[46px] leading-[0.98] text-balance md:text-[clamp(64px,6.4vw,112px)] md:leading-[0.94]";
const HEADING = "font-display text-[38px] leading-[1] text-balance md:text-[clamp(48px,4.4vw,76px)] md:leading-[0.98]";
const LEAD = "text-[18px] leading-[1.55] text-ink/85 md:text-[20px]";

/** A full-width picture with its words on the dark side: the words below the picture on a phone, at its left from 768 px. */
function SceneBand({ scene, children, id }: { scene: SceneName; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="site-zoom relative isolate scroll-mt-4 overflow-hidden bg-surface md:min-h-[min(100svh,900px)]">
      <div className="relative aspect-[4/5] overflow-hidden md:absolute md:inset-0 md:-z-10 md:aspect-auto">
        <ScenePicture name={scene} className="h-full w-full object-cover" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(20_27_34),rgb(20_27_34/0))] md:hidden"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block md:bg-[linear-gradient(to_right,rgb(11_16_21/0.95)_0%,rgb(11_16_21/0.8)_36%,rgb(11_16_21/0)_66%)]"
      />
      <div className="px-5 pt-2 pb-16 md:flex md:min-h-[inherit] md:items-center md:px-10 md:py-24">
        <div className="md:max-w-[min(46vw,620px)]">{children}</div>
      </div>
    </section>
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
      <header className="relative z-20 bg-bg">
        <div className="flex h-16 items-center gap-3 px-5 md:h-[72px] md:px-10">
          <Logo size={32} />
          <span className="mr-auto text-[17px] font-semibold tracking-[-0.01em]">CEO For A Day</span>
          <nav aria-label="On this page" className="hidden items-center gap-8 text-[15px] font-medium text-ink/80 md:flex">
            <a className="site-link" href="#is-this-you">
              Is this you?
            </a>
            <a className="site-link" href="#club">
              The Club
            </a>
            <a className="site-link" href="#price">
              Price
            </a>
          </nav>
          <StartButton small className="md:ml-6" />
        </div>
      </header>

      <main>
        {/* Hero: one belief, over the wolf between the kirana and the towers. It paints at once: the picture is
            preloaded, a blurred copy and its colour stand in while it loads, and nothing here waits for a fade. */}
        <section className="relative isolate md:flex md:h-[calc(100svh-72px)] md:min-h-[600px] md:items-end">
          <div
            className="site-drift relative -z-10 aspect-square overflow-hidden bg-[#281818] bg-cover bg-center md:absolute md:inset-0 md:aspect-auto"
            style={{ backgroundImage: `url(${SCENES.empire.poster})` }}
          >
            <ScenePicture name="empire" priority className="h-full w-full object-cover object-top" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21)_0%,rgb(11_16_21)_44%,rgb(11_16_21/0)_60%)] md:bg-[linear-gradient(to_top,rgb(11_16_21/0.95)_0%,rgb(11_16_21/0.55)_30%,rgb(11_16_21/0)_55%),linear-gradient(to_right,rgb(11_16_21/0.75)_0%,rgb(11_16_21/0)_50%)]"
          />
          <div className="-mt-10 w-full px-5 pb-12 md:mt-0 md:px-10 md:pb-16">
            <div className="md:max-w-[min(76vw,1120px)]">
              <h1 className={DISPLAY}>Good business decisions are a skill.</h1>
              <p className={`mt-5 max-w-[46ch] md:mt-6 ${LEAD}`}>Learn them from real Indian companies. Five minutes a day.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <StartButton className="w-full sm:w-auto" />
                <p className="text-[15px] text-ink/75">No card needed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* The problem: the reader's own worries, beside the shopkeeper alone at night */}
        <section id="is-this-you" className="scroll-mt-4 px-5 py-20 md:grid md:grid-cols-12 md:gap-10 md:px-10 md:py-28">
          <div className="site-rise mb-10 md:col-span-5 md:mb-0">
            <div className="overflow-hidden rounded-[20px] bg-surface md:sticky md:top-10">
              <ScenePicture name="alone" sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/5] h-auto w-full object-cover" />
            </div>
          </div>
          <div className="md:col-span-7 md:pt-4">
            <h2 className={`site-rise ${HEADING}`}>Be honest. Is this you?</h2>
            <ul className="mt-8 grid gap-1 md:mt-10">
              {PAINS.map((p, i) => (
                <li
                  key={p}
                  className={`site-rise rounded-[14px] px-5 py-4 text-[19px] leading-snug md:text-[22px] ${i % 2 ? "" : "bg-surface"}`}
                  style={step(i * 0.3)}
                >
                  {p}
                </li>
              ))}
            </ul>
            <p className={`site-rise mt-8 max-w-[40ch] ${LEAD}`}>
              If this sounds like you, you are not alone. Nobody taught you these rules.
            </p>
            <StartButton className="site-rise mt-8 w-full sm:w-auto" />
          </div>
        </section>

        {/* The reframe: school taught exams, business asks something harder; how the course answers it */}
        <SceneBand scene="shop">
          <h2 className={`site-rise ${HEADING}`}>School did not teach you this.</h2>
          <p className={`site-rise mt-6 ${LEAD}`} style={step(1)}>
            School taught you to pass exams. Business asks something harder: what do you do when your own money is at risk?
          </p>
          <p className={`site-rise mt-4 ${LEAD}`} style={step(2)}>
            Big Indian companies made these decisions with crores at stake. Each short lesson teaches one rule from their stories. Then, in
            the Hot Seat, you make the real decision the company faced, and see what it did.
          </p>
          <StartButton className="site-rise mt-8 w-full sm:w-auto" />
        </SceneBand>

        {/* Who you become: the shopkeeper at sunrise, then the ladder of titles */}
        <SceneBand scene="rise">
          <h2 className={`site-rise ${HEADING}`}>Who you become</h2>
          <ul className="mt-6 grid gap-3">
            {BECOME.map((b, i) => (
              <li key={b} className="site-rise text-[19px] leading-snug md:text-[22px]" style={step(i * 0.4 + 1)}>
                <span aria-hidden="true" className="mr-3 text-[var(--brass)]">
                  →
                </span>
                {b}
              </li>
            ))}
          </ul>
        </SceneBand>

        <section className="px-5 py-20 md:px-10 md:py-28">
          <div className="md:grid md:grid-cols-12 md:items-end md:gap-8">
            <h2 className={`site-rise md:col-span-7 ${HEADING}`}>From Street Seller to CEO</h2>
            <p className={`site-rise mt-5 max-w-[34ch] md:col-span-4 md:col-start-9 md:mt-0 ${LEAD}`} style={step(1)}>
              Finish each unit to earn a new title. Other players can see it.
            </p>
          </div>
          <ol className="mt-10 grid gap-1.5 md:mt-14 xl:h-[440px] xl:grid-cols-10 xl:items-end xl:gap-2">
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
                      <WolfPicture name="pose-celebrating" sizes="120px" className="mx-auto aspect-square w-[80%]" />
                    </div>
                  )}
                  <div
                    className={`flex h-12 w-[var(--w)] items-center rounded-[12px] px-4 xl:h-[var(--h)] xl:w-full xl:items-end xl:px-2.5 xl:pb-3 ${top ? "bg-[var(--brass)] text-[var(--brass-ink)]" : "bg-surface-2"}`}
                  >
                    <span className="text-[15px] leading-tight font-semibold">{t}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <StartButton className="site-rise mt-10 w-full sm:w-auto" />
        </section>

        {/* The Club: founders together, the whole picture with nothing over their faces; honest that it opens soon */}
        <section id="club" className="scroll-mt-4 bg-surface pb-20 md:pb-28">
          <div className="site-zoom relative aspect-[4/5] overflow-hidden md:aspect-[16/7]">
            <ScenePicture name="club" className="h-full w-full object-cover" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(20_27_34),rgb(20_27_34/0))]"
            />
          </div>
          <div className="px-5 pt-4 md:grid md:grid-cols-12 md:items-start md:gap-8 md:px-10 md:pt-6">
            <h2 className={`site-rise md:col-span-6 ${HEADING}`}>Meet other founders</h2>
            <div className="md:col-span-5 md:col-start-8">
              <p className={`site-rise mt-6 md:mt-2 ${LEAD}`} style={step(1)}>
                The Club opens soon. Members who reach Trader can post, chat and start small groups with other founders.
              </p>
              <StartButton className="site-rise mt-8 w-full sm:w-auto" />
            </div>
          </div>
        </section>

        {/* Price: the free plan, then the bigger member plan beside it */}
        <section id="price" className="scroll-mt-4 px-5 py-20 md:grid md:grid-cols-12 md:items-end md:gap-3 md:px-10 md:py-28">
          <div className="md:col-span-5 md:flex md:h-[600px] md:flex-col">
            <h2 className={`site-rise ${HEADING}`}>Start free</h2>
            <div className="site-rise mt-8 flex flex-col overflow-hidden rounded-[24px] bg-surface md:mt-auto md:h-[420px]" style={step(1)}>
              <div className="p-7">
                <h3 className="font-display text-[34px] leading-none">Free</h3>
                <p className="mt-4 text-[36px] leading-none font-semibold tracking-[-0.02em]">₹0</p>
                <ul className="mt-6 grid gap-2.5 text-[18px]">
                  <li>Your first five lessons</li>
                  <li>Your first Hot Seat</li>
                  <li>Flashcards and leagues</li>
                </ul>
              </div>
              <Link href="/app" className="site-link mt-auto flex h-16 items-center bg-surface-2 px-7 text-[17px] font-semibold">
                Start free
              </Link>
            </div>
          </div>
          <div
            className="site-rise mt-12 flex flex-col overflow-hidden rounded-[24px] bg-[var(--warm)] md:col-span-7 md:mt-0 md:h-[600px]"
            style={step(2)}
          >
            <div className="grid gap-6 p-7 lg:grid-cols-[1fr_230px]">
              <div>
                <h3 className="font-display text-[34px] leading-none text-[var(--brass)]">Member</h3>
                {full ? (
                  <>
                    <p className="mt-4 text-[36px] leading-none font-semibold tracking-[-0.02em]">₹{REGULAR.monthly} a month</p>
                    <p className="mt-3 text-[18px]">Or ₹{yearly} a year.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-[36px] leading-none font-semibold tracking-[-0.02em]">
                      <FoundingPrice />
                    </p>
                    <p className="mt-3 text-[17px] font-semibold text-[var(--brass)]">{FOUNDING_LINE}</p>
                  </>
                )}
                <ul className="mt-6 grid gap-2.5 text-[18px]">
                  <li>All lessons and Hot Seats</li>
                  <li>New ones when they are ready</li>
                  <li>The Club, when it opens</li>
                  <li>Cancel any time with one tap</li>
                </ul>
                {!full && (
                  <p className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-ink/75">
                    You keep ₹{FOUNDING.monthly} a month for as long as you stay a member. After the founding seats, new members pay ₹
                    {REGULAR.monthly} a month, or ₹{yearly} a year.
                  </p>
                )}
              </div>
              <WolfPicture name="cafe" sizes="230px" className="hidden aspect-[4/5] w-full rounded-[16px] object-cover lg:block" />
            </div>
            <Link href="/app" className="site-cta mt-auto flex h-16 items-center px-7 text-[17px] font-semibold">
              Start free, join when you are ready
            </Link>
          </div>
        </section>

        {/* Questions: one band each, every answer showing */}
        <section aria-labelledby="questions" className="bg-surface">
          <h2 id="questions" className={`site-rise px-5 pt-20 pb-6 md:px-10 md:pt-28 md:pb-10 ${HEADING}`}>
            Questions
          </h2>
          <dl>
            {faq(full).map((f, i) => (
              <div key={f.q} className={`px-5 py-8 md:grid md:grid-cols-12 md:gap-8 md:px-10 md:py-12 ${i % 2 ? "" : "bg-bg/40"}`}>
                <dt className="site-rise text-[20px] leading-tight font-semibold md:col-span-5 md:text-[22px]">{f.q}</dt>
                <dd
                  className="site-rise mt-2 max-w-[56ch] text-[18px] leading-[1.55] text-ink/85 md:col-span-6 md:col-start-7 md:mt-0"
                  style={step(1)}
                >
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The close: the chair in a field at dawn */}
        <section className="site-zoom relative isolate flex min-h-[86svh] items-end overflow-hidden bg-surface">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <ScenePicture name="dairy" className="h-full w-full object-cover" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21/0.94)_0%,rgb(11_16_21/0.6)_32%,rgb(11_16_21/0)_62%)]"
          />
          <div className="w-full px-5 pb-14 md:grid md:grid-cols-12 md:items-end md:gap-8 md:px-10 md:pb-20">
            <div className="md:col-span-7">
              <h2 className={`site-rise ${DISPLAY}`}>Your chair is ready.</h2>
              <p className={`site-rise mt-5 max-w-[32ch] ${LEAD}`} style={step(1)}>
                Start with a free lesson today.
              </p>
            </div>
            <div className="site-rise mt-8 md:col-span-4 md:col-start-9 md:mt-0 md:justify-self-end" style={step(2)}>
              <StartButton className="w-full sm:w-auto" />
            </div>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden px-5 pt-20 md:px-10 md:pt-28">
        <div className="flex flex-col gap-6 text-[15px] text-ink/75 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[44ch]">Education, not business advice. Other outcomes are estimates.</p>
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
          </p>
        </div>
        <p
          aria-hidden="true"
          className="font-display mt-10 -mb-[0.12em] text-[15.2vw] leading-[0.9] whitespace-nowrap text-surface-2 md:mt-14"
        >
          CEO For A Day
        </p>
      </footer>
    </div>
  );
}
