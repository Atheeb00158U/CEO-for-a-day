// The public website. A server component: the pictures are static files; whether founding seats are left is read
// here (never shown as a count) to pick the founding or regular offer; the sample decision plays through /api/play,
// so no Hot Seat answers reach the page. Every scene shows the same boss's chair: the Hot Seat, waiting.
import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import "./site.css";
import { FoundingPrice } from "@/components/FoundingPrice";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { SampleCall } from "@/components/site/SampleCall";
import { ScenePicture } from "@/components/site/ScenePicture";
import { sceneSrcSet, type SceneName } from "@/lib/brand";
import { TITLES } from "@/lib/career";
import { FOUNDING, FOUNDING_LINE, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { cachedSeatStatus } from "@/lib/server/seats";

export const metadata: Metadata = {
  title: "CEO For A Day · Be the boss of a real company",
  description:
    "Learn one business rule in a short lesson. Then take the Hot Seat and make a big decision for a real Indian company. Start free.",
};
export const revalidate = 60; // the founding offer switches to the regular plans at most a minute after the last seat goes

/** Published Hot Seats with a real company behind them, and a still from each story. */
const HOT_SEATS = [
  { name: "Nirma", img: "/media/nr_cover.webp" },
  { name: "Amul", img: "/media/am_cover.webp" },
  { name: "IndiGo", img: "/media/ig_cover.webp" },
  { name: "redBus", img: "/media/rb_cover.webp" },
  { name: "Kodak", img: "/media/cover.webp" },
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

function PlayButton({ className = "", children = "Play free" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link href="/app" className={`btn3d green site-btn ${className}`}>
      {children}
    </Link>
  );
}

// On a phone the hero shows a square from the middle of the wide picture (the wolf and both worlds), so it needs
// the wide file at almost twice the screen's width.
const HERO_SIZES = "(min-width: 768px) 100vw, 180vw";

/** A delay step for the parts of a section that rise in one after another. */
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

// The type steps of the website: display (the hero, the close, Questions), heading, and the lead under each.
const DISPLAY = "text-[44px] leading-[1] font-black tracking-[-0.03em] text-balance md:text-[clamp(60px,6.4vw,104px)] md:leading-[0.95]";
const HEADING = "text-[36px] leading-[1.02] font-black tracking-[-0.02em] text-balance md:text-[clamp(44px,4.6vw,72px)]";
const LEAD = "text-[18px] leading-[1.45] md:text-[21px]";

/**
 * One chapter of "how it works": a scene filling a rounded panel, the words on its dark side, and a real piece of
 * the game beside them. Below 1024 px the words sit on top and the piece of the game below.
 */
function Chapter({ scene, title, text, children }: { scene: SceneName; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="site-zoom relative isolate overflow-hidden rounded-[28px] bg-surface lg:min-h-[min(calc(100svh-32px),920px)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <ScenePicture name={scene} className="h-full w-full object-cover" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(11_16_21/0.9)_0%,rgb(11_16_21/0.55)_30%,rgb(11_16_21/0.2)_100%)] lg:bg-[linear-gradient(to_right,rgb(11_16_21/0.94)_0%,rgb(11_16_21/0.75)_32%,rgb(11_16_21/0)_62%)]"
      />
      <div className="flex flex-col gap-10 p-6 pb-8 lg:grid lg:min-h-[inherit] lg:grid-cols-12 lg:items-center lg:gap-8 lg:p-12">
        <div className="lg:col-span-5">
          <h2 className={`site-rise ${HEADING}`}>{title}</h2>
          <p className={`site-rise mt-4 max-w-[30ch] ${LEAD}`} style={step(1)}>
            {text}
          </p>
        </div>
        <div data-ui className="site-rise w-full self-center lg:col-span-5 lg:col-start-8 lg:flex lg:justify-center" style={step(2)}>
          {children}
        </div>
      </div>
    </section>
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
    <div className="min-h-dvh overflow-x-clip">
      <LegacyHashRedirect />
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="flex h-16 items-center gap-3 px-4 md:h-20 md:px-8">
          <Logo size={36} />
          <span className="mr-auto text-[17px] font-black">CEO For A Day</span>
          <nav aria-label="On this page" className="hidden items-center gap-8 text-[16px] font-extrabold md:flex">
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
          <PlayButton className="!w-auto !px-5 !py-2 !text-[14px] md:ml-6">Play</PlayButton>
        </div>
      </header>

      <main>
        {/* Hero: the wolf in the boss's chair between a kirana street and the towers, the promise at its foot */}
        <section className="relative isolate overflow-hidden md:flex md:min-h-[100svh] md:items-end">
          <div className="site-shutter relative -z-10 aspect-square overflow-hidden md:absolute md:inset-0 md:aspect-auto">
            <ScenePicture name="empire" wide priority sizes={HERO_SIZES} className="h-full w-full object-cover" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21)_0%,rgb(11_16_21)_48%,rgb(11_16_21/0)_62%)] md:bg-[linear-gradient(to_top,rgb(11_16_21)_0%,rgb(11_16_21/0.9)_26%,rgb(11_16_21/0)_58%)]"
          />
          <div className="-mt-14 w-full px-4 pb-10 md:mt-0 md:grid md:pt-28 md:grid-cols-12 md:items-end md:gap-8 md:px-8 md:pb-16">
            <div className="md:col-span-8 lg:col-span-7">
              <h1 className={`site-in ${DISPLAY}`}>Be the boss of a real company</h1>
              <p className={`site-in mt-5 max-w-[34ch] md:mt-7 ${LEAD}`} style={step(1)}>
                Learn one business rule in a short lesson. Then take the Hot Seat and make a big decision for a real Indian company.
              </p>
            </div>
            <div
              className="site-in mt-7 md:col-span-4 md:col-start-9 md:mt-0 md:justify-self-end lg:col-span-3 lg:col-start-10"
              style={step(2)}
            >
              <PlayButton className="md:w-[260px]" />
              <p className="mt-3 text-[16px] font-bold md:text-center">Start free. No card needed.</p>
            </div>
          </div>
        </section>

        {/* The Hot Seats, as one sentence of names, each with a still from its story */}
        <section id="hot-seats" className="scroll-mt-4 px-4 py-24 md:grid md:grid-cols-12 md:gap-8 md:px-8 md:py-40">
          <div className="text-[40px] leading-[1.1] md:text-[clamp(60px,6.4vw,104px)] font-black tracking-[-0.03em] md:col-span-12">
            <h2 className="site-rise inline">Hot Seats: </h2>
            <ul className="site-rise inline" style={step(1)}>
              {HOT_SEATS.map((h, i) => (
                <li key={h.name} className="inline">
                  <Link href="/app" className="site-name rounded-lg whitespace-nowrap outline-offset-4">
                    {h.name}
                    <span className="site-frame mx-[0.1em] inline-block h-[0.74em] w-[1.18em] overflow-hidden rounded-[0.14em] align-[-0.03em]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={h.img}
                        alt=""
                        width={1024}
                        height={576}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  </Link>
                  {i < HOT_SEATS.length - 1 ? ", " : "."}
                </li>
              ))}
            </ul>
          </div>
          <p className={`site-rise mt-10 max-w-[36ch] md:col-span-5 md:col-start-8 md:mt-16 ${LEAD}`} style={step(2)}>
            Based on real stories from public sources. You decide, then see what really happened.
          </p>
        </section>

        {/* How it works: three cinematic chapters, each with a real piece of the game */}
        <div id="how" className="grid scroll-mt-4 gap-2 px-2 md:gap-4 md:px-4">
          <Chapter scene="shop" title="Learn one rule" text="Five minutes. One business rule. One real story. Simple English.">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/site/lesson-guess.webp"
              alt="A lesson in the game: what stopped Jet Airways from flying? The player picked 'It ran out of cash'. Good guess."
              width={780}
              height={1228}
              loading="lazy"
              decoding="async"
              className="mx-auto h-auto w-[min(70vw,300px)] rounded-[28px] lg:w-[min(22vw,320px)]"
            />
          </Chapter>
          <Chapter scene="chai" title="Remember it" text="Flashcards come back when it is time to practise. Ten a day is enough.">
            <div className="mx-auto w-full max-w-[340px] rounded-[28px] bg-bg p-5">
              <p className="text-[19px] leading-snug font-black">{CARD.front}</p>
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
              <p className="mt-4 text-[16px] leading-snug font-bold text-brand">{CARD.back}</p>
            </div>
          </Chapter>
          <Chapter
            scene="tarmac"
            title="Take the Hot Seat"
            text="Make a big decision for a real company. Then see what happened and why. Try Nirma's first decision here."
          >
            <div className="mx-auto w-full max-w-[460px]">
              <SampleCall />
            </div>
          </Chapter>
        </div>

        {/* The career ladder: ten titles, each bar taller than the last; the wolf cheers on the last one */}
        <section className="px-4 py-24 md:px-8 md:py-40">
          <div className="md:grid md:grid-cols-12 md:items-end md:gap-8">
            <h2 className={`site-rise md:col-span-6 ${HEADING}`}>From Street Seller to CEO</h2>
            <p className={`site-rise mt-4 max-w-[34ch] md:col-span-5 md:col-start-8 md:mt-0 ${LEAD}`} style={step(1)}>
              Finish a unit to earn a new title. Other players in your league can see it.
            </p>
          </div>
          <ol className="mt-10 grid gap-1.5 md:mt-16 xl:h-[480px] xl:grid-cols-10 xl:items-end xl:gap-2">
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
                    className={`flex h-12 w-[var(--w)] items-center rounded-[14px] px-4 xl:h-[var(--h)] xl:w-full xl:items-end xl:px-2.5 xl:pb-3 ${top ? "bg-brand text-[#1a1206]" : "bg-surface-2"}`}
                  >
                    <span className="text-[16px] leading-tight font-black">{t}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Meet your mentor: an inset panel, the wolf in an arch, what he does for you */}
        <section className="px-2 md:px-4">
          <div className="flex flex-col overflow-hidden rounded-[28px] bg-surface md:grid md:grid-cols-12 md:grid-rows-[auto_1fr] md:gap-x-8">
            <h2 className={`site-rise p-6 pb-0 md:col-span-6 md:p-14 md:pb-0 ${HEADING}`}>Meet your mentor</h2>
            <div className="grid gap-8 p-6 md:col-span-5 md:col-start-8 md:row-span-2 md:row-start-1 md:content-center md:gap-12 md:py-16 md:pr-14 md:pl-0">
              <div className="site-rise" style={step(1)}>
                <h3 className="text-[22px] font-black md:text-[26px]">He warns you</h3>
                <p className="mt-2 text-[18px] leading-[1.5]">
                  He knows what can go wrong in business. He tells you before you make a mistake.
                </p>
              </div>
              <div className="site-rise" style={step(2)}>
                <h3 className="text-[22px] font-black md:text-[26px]">He cheers for you</h3>
                <p className="mt-2 text-[18px] leading-[1.5]">
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
            <div className="site-rise mx-auto mt-4 w-[86%] max-w-[480px] translate-y-[14%] md:col-span-6 md:row-start-2 md:mx-14 md:mt-12 md:w-[min(34vw,480px)] md:self-end">
              <WolfPicture
                name="closeup"
                sizes="(min-width: 768px) 34vw, 86vw"
                className="aspect-[4/5] w-full rounded-t-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Price: the free plan, then the bigger member plan beside it */}
        <section id="price" className="scroll-mt-4 px-4 py-24 md:grid md:grid-cols-12 md:items-end md:gap-2 md:px-8 md:py-40">
          <div className="md:col-span-5 md:flex md:h-[640px] md:flex-col">
            <h2 className={`site-rise ${HEADING}`}>Start free</h2>
            <div
              className="site-rise mt-8 flex flex-col overflow-hidden rounded-[28px] bg-surface-2 md:mt-auto md:h-[440px]"
              style={step(1)}
            >
              <div className="p-7">
                <h3 className="text-[26px] font-black">Free</h3>
                <p className="mt-1 text-[36px] leading-none font-black tracking-[-0.02em] md:text-[44px]">₹0</p>
                <ul className="mt-6 grid gap-2 text-[18px] font-bold">
                  <li>Your first five lessons</li>
                  <li>Your first Hot Seat</li>
                  <li>Flashcards and leagues</li>
                </ul>
              </div>
              <Link href="/app" className="site-btn mt-auto flex h-16 items-center bg-surface px-7 text-[17px] font-black">
                Play free
              </Link>
            </div>
          </div>
          <div
            className="site-rise mt-2 flex flex-col overflow-hidden rounded-[28px] bg-brand text-[#1a1206] md:col-span-7 md:mt-0 md:h-[640px]"
            style={step(2)}
          >
            <div className="grid gap-6 p-7 lg:grid-cols-[1fr_240px]">
              <div>
                <h3 className="text-[26px] font-black">Member</h3>
                {full ? (
                  <>
                    <p className="mt-1 text-[36px] leading-none font-black tracking-[-0.02em] md:text-[44px]">₹{REGULAR.monthly} a month</p>
                    <p className="mt-3 text-[18px] font-bold">Or ₹{yearly} a year.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-[36px] leading-none font-black tracking-[-0.02em] md:text-[44px] [&_s]:text-[#1a1206]/55">
                      <FoundingPrice />
                    </p>
                    <p className="mt-3 text-[18px] font-extrabold">{FOUNDING_LINE}</p>
                  </>
                )}
                <ul className="mt-6 grid gap-2 text-[18px] font-bold">
                  <li>All lessons and Hot Seats</li>
                  <li>New ones when they are ready</li>
                  <li>Cancel any time with one tap</li>
                </ul>
                {!full && (
                  <p className="mt-6 max-w-[40ch] text-[16px] leading-snug">
                    You keep ₹{FOUNDING.monthly} a month for as long as you stay a member. After the founding seats, new members pay ₹
                    {REGULAR.monthly} a month, or ₹{yearly} a year.
                  </p>
                )}
              </div>
              <WolfPicture name="cafe" sizes="240px" className="hidden aspect-[4/5] w-full rounded-[20px] object-cover lg:block" />
            </div>
            <Link href="/app" className="site-btn mt-auto flex h-16 items-center bg-brand-dark px-7 text-[17px] font-black">
              Start free, join when you are ready
            </Link>
          </div>
        </section>

        {/* Questions: one band each, every answer showing */}
        <section aria-labelledby="questions">
          <div className="flex min-h-[30svh] items-end bg-surface px-4 pt-16 pb-8 md:min-h-[36svh] md:px-8 md:pb-12">
            <h2 id="questions" className={`site-rise ${DISPLAY}`}>
              Questions
            </h2>
          </div>
          <dl>
            {faq(full).map((f, i) => (
              <div key={f.q} className={`px-4 py-8 md:grid md:grid-cols-12 md:gap-8 md:px-8 md:py-14 ${i % 2 ? "bg-surface" : ""}`}>
                <dt className="site-rise text-[22px] leading-tight font-black md:col-span-5 md:text-[26px]">{f.q}</dt>
                <dd className="site-rise mt-2 max-w-[56ch] text-[18px] leading-[1.5] md:col-span-6 md:col-start-7 md:mt-0" style={step(1)}>
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The close: the chair in a field at dawn */}
        <section className="px-2 pt-24 md:px-4 md:pt-40">
          <div className="site-zoom relative isolate flex min-h-[86svh] items-end overflow-hidden rounded-[28px] bg-surface">
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <ScenePicture name="dairy" className="h-full w-full object-cover" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(11_16_21/0.92)_0%,rgb(11_16_21/0.6)_30%,rgb(11_16_21/0)_60%)]"
            />
            <div className="w-full p-6 md:grid md:grid-cols-12 md:items-end md:gap-8 md:p-12">
              <div className="md:col-span-7">
                <h2 className={`site-rise ${DISPLAY}`}>Your chair is ready</h2>
                <p className={`site-rise mt-4 max-w-[32ch] ${LEAD}`} style={step(1)}>
                  Play your first lesson free in your phone&apos;s browser.
                </p>
              </div>
              <div className="site-rise mt-7 md:col-span-3 md:col-start-10 md:mt-0" style={step(2)}>
                <PlayButton />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden px-4 pt-24 md:px-8 md:pt-36">
        <div className="flex flex-col gap-6 text-[16px] font-bold md:flex-row md:items-end md:justify-between">
          <p className="max-w-[44ch]">Education, not business advice. Other outcomes are estimates.</p>
          <p className="flex gap-6">
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
          className="mt-10 -mb-[0.18em] text-[13.4vw] leading-[0.9] font-black tracking-[-0.045em] whitespace-nowrap text-surface-2 md:mt-16"
        >
          CEO For A Day
        </p>
      </footer>
    </div>
  );
}
