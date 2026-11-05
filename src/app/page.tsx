// The public website. A server component: the pictures are static files; whether founding seats are left is read
// here (never shown as a count) to pick the founding or regular offer; the sample decision plays through /api/play,
// so no Hot Seat answers reach the page. Every scene shows the same boss's chair: the Hot Seat, waiting.
// The website has its own, quieter look (site.css): a cinematic serif for headlines and one brass accent.
import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import Link from "next/link";
import { preload } from "react-dom";
import "./site.css";
import { FoundingPrice } from "@/components/FoundingPrice";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { SampleCall } from "@/components/site/SampleCall";
import { ScenePicture } from "@/components/site/ScenePicture";
import { SCENES, sceneSrcSet, type SceneName } from "@/lib/brand";
import { TITLES } from "@/lib/career";
import { FOUNDING, FOUNDING_LINE, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { cachedSeatStatus } from "@/lib/server/seats";

const display = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const text = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-site", display: "swap" });

export const metadata: Metadata = {
  title: "CEO For A Day · Be the boss of a real company",
  description:
    "Learn one business rule in a short lesson. Then take the Hot Seat and make a big decision for a real Indian company. Start free.",
};
export const revalidate = 60; // the founding offer switches to the regular plans at most a minute after the last seat goes

/** Published Hot Seats with a real company behind them: a still from each story and its name. */
const HOT_SEATS = [
  { company: "Nirma", story: "A quarter of the price", img: "/media/nr_cover.webp", width: 1024, height: 768 },
  { company: "Amul", story: "A brand owned by farmers", img: "/media/am_cover.webp", width: 1024, height: 576 },
  { company: "IndiGo", story: "One plane, on time", img: "/media/ig_cover.webp", width: 1024, height: 576 },
  { company: "redBus", story: "No ticket home for Diwali", img: "/media/rb_cover.webp", width: 1024, height: 768 },
];

/** A real flashcard from Module 1.1 (card m11-cash-2 in u1-cash-runs-out), shown already answered. */
const CARD = {
  front: "₹2,40,000 in the bank. You lose ₹40,000 a month. How long can you last?",
  options: ["6 months", "4 months", "10 months"],
  back: "₹2,40,000 ÷ ₹40,000 = 6 months of runway.",
};

const yearly = REGULAR.yearly.toLocaleString("en-IN");

function faq(full: boolean) {
  return [
    { q: "Is it free?", a: "Yes. Your first lessons and your first Hot Seat are free. Membership opens the rest." },
    full
      ? {
          q: "What does membership get me?",
          a: `Every lesson, every Hot Seat, and every new one we add. ₹${REGULAR.monthly} a month or ₹${yearly} a year.`,
        }
      : {
          q: `What does ₹${FOUNDING.monthly} get me?`,
          a: (
            <>
              Every lesson, every Hot Seat, and every new one we add. <FoundingPrice /> while you stay a member. {FOUNDING_LINE}
            </>
          ),
        },
    {
      q: "Can I cancel?",
      a: full
        ? "Yes. Cancel any time with one tap in your profile or UPI app."
        : `Yes. Cancel any time with one tap in your profile or UPI app. If you cancel, the ₹${FOUNDING.monthly} price ends.`,
    },
    { q: "Is it in Hindi?", a: "English for now. Hindi, Tamil and Bengali are coming." },
    {
      q: "Are the stories true?",
      a: "Yes, from public sources. Each Hot Seat lists them. One practice story is not real, and it says so.",
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

function PlayButton({ small = false, className = "" }: { small?: boolean; className?: string }) {
  return (
    <Link
      href="/app"
      className={`site-cta inline-flex items-center justify-center rounded-full font-semibold ${small ? "h-10 px-5 text-[15px]" : "h-14 px-8 text-[18px]"} ${className}`}
    >
      Play free
    </Link>
  );
}

// On a phone the hero shows a square from the middle of the wide picture (the wolf and both worlds), so it needs
// the wide file at almost twice the screen's width.
const HERO_SIZES = "(min-width: 768px) 100vw, 180vw";

/** A delay step for the parts of a section that rise in one after another. */
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

// The type steps of the website: display (the hero, the close), heading, lead and body.
const DISPLAY =
  "font-display text-[52px] leading-[0.95] tracking-[-0.01em] text-balance md:text-[clamp(72px,7.4vw,124px)] md:leading-[0.9]";
const HEADING =
  "font-display text-[44px] leading-[0.98] tracking-[-0.01em] text-balance md:text-[clamp(56px,5.2vw,88px)] md:leading-[0.95]";
const LEAD = "text-[18px] leading-[1.5] text-ink/85 md:text-[20px]";

/**
 * One chapter of "how it works": a full-width scene, the words on its dark side, and a real piece of the game
 * beside them. Below 1024 px the words sit on top and the piece of the game below.
 */
function Chapter({ scene, title, words, children }: { scene: SceneName; title: string; words: string; children: React.ReactNode }) {
  return (
    <section className="site-zoom relative isolate overflow-hidden bg-surface lg:min-h-[min(100svh,960px)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <ScenePicture name={scene} className="h-full w-full object-cover" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(11_16_21/0.94)_0%,rgb(11_16_21/0.7)_35%,rgb(11_16_21/0.45)_100%)] lg:bg-[linear-gradient(to_right,rgb(11_16_21/0.96)_0%,rgb(11_16_21/0.82)_34%,rgb(11_16_21/0.15)_68%)]"
      />
      <div className="flex flex-col gap-12 px-5 py-20 lg:grid lg:min-h-[inherit] lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-10 lg:py-24">
        <div className="lg:col-span-5">
          <h2 className={`site-rise ${HEADING}`}>{title}</h2>
          <p className={`site-rise mt-5 max-w-[30ch] ${LEAD}`} style={step(1)}>
            {words}
          </p>
        </div>
        <div data-ui className="site-rise w-full self-center lg:col-span-5 lg:col-start-8 lg:flex lg:justify-center" style={step(2)}>
          {children}
        </div>
      </div>
    </section>
  );
}

/** A plain phone: a black body with a thin light edge and a crisp shadow, the screen inside. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[min(74vw,300px)] rounded-[48px] bg-[#050607] p-[10px] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_28px_50px_-18px_rgb(0_0_0/0.9)] lg:w-[min(23vw,320px)]">
      <div className="overflow-hidden rounded-[38px] bg-bg">{children}</div>
    </div>
  );
}

export default async function Home() {
  preload(`/brand/site/empire-1672.avif`, {
    as: "image",
    type: "image/avif",
    imageSrcSet: sceneSrcSet("empire", false, "avif"),
    imageSizes: HERO_SIZES,
    fetchPriority: "high",
  });
  const full = await seatsFull();

  return (
    <div className={`site ${display.variable} ${text.variable} min-h-dvh overflow-x-clip`}>
      <LegacyHashRedirect />
      <header className="relative z-20 bg-bg">
        <div className="flex h-16 items-center gap-3 px-5 md:h-[72px] md:px-10">
          <Logo size={32} />
          <span className="mr-auto text-[17px] font-semibold tracking-[-0.01em]">CEO For A Day</span>
          <nav aria-label="On this page" className="hidden items-center gap-8 text-[15px] font-medium text-ink/80 md:flex">
            <a className="site-link" href="#how">
              How it works
            </a>
            <a className="site-link" href="#hot-seats">
              Hot Seats
            </a>
            <a className="site-link" href="#price">
              Price
            </a>
          </nav>
          <PlayButton small className="md:ml-6" />
        </div>
      </header>

      <main>
        {/* Hero: the wolf in the boss's chair between a kirana street and the towers. It paints at once: the picture
            is preloaded, a blurred copy and its colour stand in while it loads, and nothing here waits for a fade. */}
        <section className="relative isolate md:flex md:h-[calc(100svh-72px)] md:min-h-[600px] md:items-end">
          <div
            className="site-drift relative -z-10 aspect-square overflow-hidden bg-[#281818] bg-cover bg-center md:absolute md:inset-0 md:aspect-auto"
            style={{ backgroundImage: `url(${SCENES.empire.poster})` }}
          >
            <ScenePicture name="empire" wide priority sizes={HERO_SIZES} className="h-full w-full object-cover object-top" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21)_0%,rgb(11_16_21)_44%,rgb(11_16_21/0)_60%)] md:bg-[linear-gradient(to_top,rgb(11_16_21/0.95)_0%,rgb(11_16_21/0.55)_30%,rgb(11_16_21/0)_55%),linear-gradient(to_right,rgb(11_16_21/0.75)_0%,rgb(11_16_21/0)_50%)]"
          />
          <div className="-mt-10 w-full px-5 pb-12 md:mt-0 md:grid md:grid-cols-12 md:gap-8 md:px-10 md:pb-16">
            <div className="md:col-span-8 lg:col-span-6">
              <h1 className={DISPLAY}>Be the boss of a real company</h1>
              <p className={`mt-5 max-w-[36ch] md:mt-6 ${LEAD}`}>
                Learn one business rule in a short lesson. Then take the Hot Seat and make a big decision for a real Indian company.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <PlayButton className="w-full sm:w-auto" />
                <p className="text-[15px] text-ink/75">Start free. No card needed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* The Hot Seats: one tall still from each published story with a real company behind it */}
        <section id="hot-seats" className="scroll-mt-4 px-5 py-20 md:px-10 md:py-28">
          <div className="md:grid md:grid-cols-12 md:items-end md:gap-8">
            <h2 className={`site-rise md:col-span-7 ${HEADING}`}>Real companies. Real decisions.</h2>
            <p className={`site-rise mt-5 max-w-[34ch] md:col-span-4 md:col-start-9 md:mt-0 ${LEAD}`} style={step(1)}>
              Make big decisions for Nirma, Amul, IndiGo and redBus. Then see what really happened.
            </p>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-2 md:mt-14 md:grid-cols-4 md:gap-3">
            {HOT_SEATS.map((h, i) => (
              <li key={h.company} className="site-rise" style={step(i * 0.5)}>
                <Link href="/app" className="site-story relative block aspect-[4/5] overflow-hidden rounded-[18px] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={h.img}
                    alt=""
                    width={h.width}
                    height={h.height}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_top,rgb(11_16_21/0.96)_0%,rgb(11_16_21/0.75)_30%,rgb(11_16_21/0)_62%)]"
                  />
                  <span className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <span className="font-display block text-[22px] leading-[1.05] md:text-[30px]">{h.story}</span>
                    <span className="mt-2 block text-[15px] font-semibold text-[var(--brass)]">{h.company}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works: three full-width chapters, each with a real piece of the game */}
        <div id="how" className="scroll-mt-4">
          <Chapter scene="shop" title="Learn one rule" words="Five minutes. One business rule. One real story. Simple English.">
            <Phone>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/site/lesson-guess.webp"
                alt="A lesson in the game: what stopped Jet Airways from flying? The player picked 'It ran out of cash'. Good guess."
                width={780}
                height={1228}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </Phone>
          </Chapter>
          <Chapter scene="chai" title="Remember it" words="Flashcards come back when it is time to practise. Ten a day is enough.">
            <Phone>
              <div className="px-4 pt-8 pb-7 font-sans">
                <p className="text-[18px] leading-snug font-black">{CARD.front}</p>
                <div className="mt-4 grid gap-2">
                  {CARD.options.map((o, i) => (
                    <div
                      key={o}
                      className={`tile ${i === 0 ? "border-brand! bg-[#2a1f0d]! text-[#ffe2b0] shadow-[0_4px_0_var(--color-brand-dark)]!" : ""}`}
                    >
                      {o}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[15px] leading-snug font-bold text-brand">{CARD.back}</p>
              </div>
            </Phone>
          </Chapter>
          <Chapter
            scene="tarmac"
            title="Take the Hot Seat"
            words="Make a big decision for a real company. Then see what happened and why. Try Nirma's first decision here."
          >
            <div className="mx-auto w-full max-w-[460px] font-sans shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_28px_50px_-18px_rgb(0_0_0/0.9)] [&>div]:rounded-[24px]">
              <SampleCall />
            </div>
          </Chapter>
        </div>

        {/* The career ladder: ten titles, each bar taller than the last; the wolf cheers on the last one */}
        <section className="px-5 py-20 md:px-10 md:py-28">
          <div className="md:grid md:grid-cols-12 md:items-end md:gap-8">
            <h2 className={`site-rise md:col-span-7 ${HEADING}`}>From Street Seller to CEO</h2>
            <p className={`site-rise mt-5 max-w-[34ch] md:col-span-4 md:col-start-9 md:mt-0 ${LEAD}`} style={step(1)}>
              Finish a unit to earn a new title. Other players in your league can see it.
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
        </section>

        {/* Meet your mentor: a warm panel, the wolf in an arch, what he does for you */}
        <section className="bg-[var(--warm)]">
          <div className="flex flex-col overflow-hidden md:grid md:grid-cols-12 md:grid-rows-[auto_1fr] md:gap-x-8">
            <h2 className={`site-rise px-5 pt-20 md:col-span-6 md:px-10 md:pt-28 ${HEADING}`}>Meet your mentor</h2>
            <div className="grid gap-8 px-5 pt-8 md:col-span-5 md:col-start-8 md:row-span-2 md:row-start-1 md:content-center md:gap-12 md:px-0 md:py-28 md:pr-10">
              <div className="site-rise" style={step(1)}>
                <h3 className="font-display text-[30px] leading-tight md:text-[36px]">He warns you</h3>
                <p className="mt-2 text-[18px] leading-[1.55] text-ink/85">
                  He knows what can go wrong in business. He tells you before you make a mistake.
                </p>
              </div>
              <div className="site-rise" style={step(2)}>
                <h3 className="font-display text-[30px] leading-tight md:text-[36px]">He cheers for you</h3>
                <p className="mt-2 text-[18px] leading-[1.55] text-ink/85">
                  He is happy when you get it right. So are your streak and your league place.
                </p>
              </div>
              <div className="site-rise grid max-w-[420px] grid-cols-4 gap-2" style={step(3)}>
                {(["pose-warning", "pose-thinking", "pose-pleased", "pose-shocked"] as const).map((p) => (
                  <div key={p}>
                    <WolfPicture name={p} sizes="104px" className="aspect-square w-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="site-rise mx-auto mt-10 w-[86%] max-w-[480px] translate-y-[14%] md:col-span-6 md:row-start-2 md:mx-10 md:mt-12 md:w-[min(34vw,480px)] md:self-end">
              <WolfPicture
                name="closeup"
                sizes="(min-width: 768px) 34vw, 86vw"
                className="aspect-[4/5] w-full rounded-t-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Price: the free plan, then the bigger member plan beside it */}
        <section id="price" className="scroll-mt-4 px-5 py-20 md:grid md:grid-cols-12 md:items-end md:gap-3 md:px-10 md:py-28">
          <div className="md:col-span-5 md:flex md:h-[600px] md:flex-col">
            <h2 className={`site-rise ${HEADING}`}>Start free</h2>
            <div className="site-rise mt-8 flex flex-col overflow-hidden rounded-[24px] bg-surface md:mt-auto md:h-[420px]" style={step(1)}>
              <div className="p-7">
                <h3 className="font-display text-[40px] leading-none">Free</h3>
                <p className="mt-4 text-[36px] leading-none font-semibold tracking-[-0.02em]">₹0</p>
                <ul className="mt-6 grid gap-2.5 text-[18px]">
                  <li>Your first five lessons</li>
                  <li>Your first Hot Seat</li>
                  <li>Flashcards and leagues</li>
                </ul>
              </div>
              <Link href="/app" className="site-link mt-auto flex h-16 items-center bg-surface-2 px-7 text-[17px] font-semibold">
                Play free
              </Link>
            </div>
          </div>
          <div
            className="site-rise mt-3 flex flex-col overflow-hidden rounded-[24px] bg-[var(--warm)] md:col-span-7 md:mt-0 md:h-[600px]"
            style={step(2)}
          >
            <div className="grid gap-6 p-7 lg:grid-cols-[1fr_230px]">
              <div>
                <h3 className="font-display text-[40px] leading-none text-[var(--brass)]">Member</h3>
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
              <h2 className={`site-rise ${DISPLAY}`}>Your chair is ready</h2>
              <p className={`site-rise mt-5 max-w-[32ch] ${LEAD}`} style={step(1)}>
                Play your first lesson free in your phone&apos;s browser.
              </p>
            </div>
            <div className="site-rise mt-8 md:col-span-4 md:col-start-9 md:mt-0 md:justify-self-end" style={step(2)}>
              <PlayButton className="w-full sm:w-auto" />
            </div>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden px-5 pt-20 md:px-10 md:pt-28">
        <div className="flex flex-col gap-6 text-[15px] text-ink/75 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[44ch]">Education, not business advice. Other outcomes are estimates.</p>
          <p className="flex gap-6 text-ink">
            <Link className="site-link" href="/app">
              Play
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
          className="font-display mt-10 -mb-[0.16em] text-[16.5vw] leading-[0.9] whitespace-nowrap text-surface-2 md:mt-14"
        >
          CEO For A Day
        </p>
      </footer>
    </div>
  );
}
