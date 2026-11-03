// The public website. A server component: the wolf's pictures are static files; the seat count is read here and
// kept fresh by <SeatCounter>; the sample decision plays through /api/play, so no Hot Seat answers reach the page.
import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { LegacyHashRedirect } from "@/components/LegacyHashRedirect";
import { Logo } from "@/components/Logo";
import { WolfPicture } from "@/components/WolfPicture";
import { SampleCall } from "@/components/site/SampleCall";
import { SeatCounter } from "@/components/site/SeatCounter";
import { srcSet, type WolfName } from "@/lib/brand";
import { FOUNDING, REGULAR } from "@/lib/offer";
import { supabaseDb } from "@/lib/server/db";
import { cachedSeatStatus } from "@/lib/server/seats";

export const metadata: Metadata = {
  title: "CEO For A Day · Learn business from real Indian stories",
  description: "Short lessons, then real business decisions you make yourself. Free to start.",
};
export const revalidate = 60; // the seat count in the HTML is at most a minute old; the counter refreshes it

// The hero is full width on a phone and a fixed column of the 1100 px layout from 768 px up.
const HERO_SIZES = "(min-width: 1024px) 540px, (min-width: 768px) 340px, 100vw";

// Each section's parts rise into place as they scroll into view: CSS only, no script, and nothing moves if the
// reader asks for reduced motion or the browser has no scroll timelines. Transform only, so nothing is ever hidden.
const MOTION = `@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .rise { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
  }
  .hero-in { animation: hero-in 900ms cubic-bezier(.2,.7,.2,1) both; }
}
@keyframes rise { from { transform: translateY(32px); } }
@keyframes hero-in { from { opacity: 0; transform: translateY(16px); } }`;

const STEPS = [
  { title: "Learn", text: "A 5-minute lesson, one rule, one true story." },
  { title: "Practise", text: "Flashcards repeat before you forget." },
  { title: "Take the hot seat", text: "Make a real company's big decision. You choose. Then see what really happened." },
];

const POSES: WolfName[] = [
  "pose-pleased",
  "pose-thinking",
  "pose-warning",
  "pose-worried",
  "pose-celebrating",
  "pose-pointing",
  "pose-shocked",
];

const FAQ = [
  { q: "Is it free?", a: "Yes, you can start free with Unit 1. Membership gives you access to the rest." },
  {
    q: `What does ₹${FOUNDING.monthly} get me?`,
    a: `Every lesson, every Hot Seat, and every new one we add. ₹${FOUNDING.monthly} a month while you stay a member.`,
  },
  {
    q: "Can I cancel?",
    a: `Yes. Cancel any time with one tap in your profile or UPI app. If you cancel, the ₹${FOUNDING.monthly} price ends.`,
  },
  { q: "Is it in Hindi?", a: "English for now. Hindi, Tamil and Bengali are coming." },
  {
    q: "Are the stories true?",
    a: "Yes, from public sources. Each Hot Seat lists them. One practice story is not real, and it says so.",
  },
];

async function seatsTaken() {
  try {
    return (await cachedSeatStatus(supabaseDb())).taken;
  } catch {
    return 0; // no database (CI build, local without keys): the line then names the offer instead of a count
  }
}

function PlayButton({ children = "Play free" }: { children?: React.ReactNode }) {
  return (
    <Link href="/app" className="btn3d green">
      {children}
    </Link>
  );
}

export default async function Home() {
  preload("/brand/wolf/street-800.avif", {
    as: "image",
    type: "image/avif",
    imageSrcSet: srcSet("street", "avif"),
    imageSizes: HERO_SIZES,
    fetchPriority: "high",
  });
  const taken = await seatsTaken();

  return (
    <div className="min-h-dvh">
      <LegacyHashRedirect />
      <style>{MOTION}</style>
      <header className="mx-auto flex h-16 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
        <Logo size={36} />
        <span className="mr-auto text-[16px] font-black">CEO For A Day</span>
        <Link href="/app" className="btn3d green !w-auto !px-5 !py-2 !text-[14px]">
          Play
        </Link>
      </header>

      <main>
        {/* Hero: the wolf fills a phone's first screen; the title and the one action sit on a flat scrim at its foot */}
        <section className="relative mx-auto max-w-[1100px] md:grid md:grid-cols-[1fr_340px] md:items-center md:gap-10 md:px-6 md:pb-8 lg:grid-cols-[1fr_540px]">
          <div className="md:order-2">
            <WolfPicture
              name="street"
              priority
              sizes={HERO_SIZES}
              className="h-[calc(100svh-4rem)] min-h-[560px] w-full object-cover md:h-[calc(100svh-6rem)] md:max-h-[860px] md:rounded-3xl"
            />
          </div>
          <div className="hero-in absolute inset-x-0 bottom-0 bg-[rgb(8_11_15/0.78)] px-4 pt-5 pb-6 md:static md:bg-transparent md:p-0">
            <h1 className="text-[30px] leading-[1.1] font-black text-balance md:text-[32px] md:leading-[1.05] lg:text-[36px] xl:text-[46px]">
              Learn business from real Indian stories
            </h1>
            <p className="mt-2 max-w-[36ch] text-[16px] leading-snug md:mt-4 md:text-[18px]">
              Short lessons teach one rule at a time. Then you sit in the hot seat and make a real business decision.
            </p>
            <div className="mt-4 max-w-[360px] md:mt-6">
              <PlayButton />
            </div>
            <p className="mt-3 text-[14px] font-bold text-muted">Free to start. No card. Works in your phone&apos;s browser.</p>
          </div>
        </section>

        {/* How it works: the thinking wolf beside the heading, the three steps as a list; the pointing wolf on step 3 */}
        <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6 md:grid md:grid-cols-[300px_1fr] md:gap-16">
          <div className="flex items-end gap-4 md:block">
            <h2 className="text-[30px] leading-tight font-black text-balance md:text-[40px]">One rule, then a real decision</h2>
            <div className="rise w-24 shrink-0 md:mt-8 md:w-48">
              <WolfPicture name="pose-thinking" sizes="(min-width: 768px) 192px, 96px" className="aspect-square w-full" />
            </div>
          </div>
          <ol className="mt-10 grid gap-8 md:mt-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className={i === 2 ? "rise flex items-center gap-4 rounded-3xl bg-surface p-5 md:p-6" : "rise md:px-6"}>
                {i === 2 && (
                  <div className="w-20 shrink-0 lg:w-28">
                    <WolfPicture name="pose-pointing" sizes="(min-width: 1024px) 112px, 80px" className="aspect-square w-full" />
                  </div>
                )}
                <div>
                  <h3 className="text-[22px] font-black">{s.title}</h3>
                  <p className="mt-1 max-w-[46ch] text-[17px] leading-snug">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Try one: a full-width band, the sample decision beside its heading on desktop */}
        <section className="bg-surface-2/50 py-16 md:py-20">
          <div className="mx-auto grid max-w-[1100px] gap-6 px-4 sm:px-6 md:grid-cols-[1fr_1.3fr] md:items-start md:gap-12">
            <div>
              <h2 className="text-[30px] leading-tight font-black text-balance md:text-[40px]">Try one real decision</h2>
              <p className="mt-3 text-[17px] leading-snug md:text-[18px]">
                Nirma, the washing powder from Ahmedabad. Your first decision as the boss.
              </p>
            </div>
            <div className="rise">
              <SampleCall />
            </div>
          </div>
        </section>

        {/* Meet your mentor: the close-up large, then his seven moods in a grid beside it */}
        <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6">
          <div className="md:grid md:grid-cols-2 md:items-end md:gap-12">
            <h2 className="text-[30px] leading-tight font-black md:text-[40px]">Meet your mentor</h2>
            <p className="mt-3 max-w-[48ch] text-[17px] leading-snug md:mt-0 md:text-[18px]">
              He has seen every business mistake. He warns you before you make one, and smiles when you get it right.
            </p>
          </div>
          <div className="mt-8 md:flex md:items-end md:gap-8">
            <div className="rise max-w-[340px] md:w-[300px] md:shrink-0">
              <WolfPicture
                name="closeup"
                sizes="(min-width: 768px) 300px, 340px"
                className="aspect-[4/5] w-full rounded-3xl object-cover"
              />
            </div>
            <ul className="mt-4 grid grid-cols-4 gap-2 md:mt-0 md:gap-4">
              {POSES.map((p) => (
                <li key={p} className="rise">
                  <WolfPicture name={p} sizes="(min-width: 768px) 160px, 22vw" className="aspect-square w-full" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Founding members: the café wolf beside the offer and the live seat count */}
        <section id="founding" className="bg-surface">
          <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-12 md:py-20">
            <WolfPicture
              name="cafe"
              sizes="(min-width: 1100px) 480px, (min-width: 768px) 45vw, 100vw"
              className="aspect-[4/5] w-full rounded-3xl object-cover"
            />
            <div className="rise">
              <h2 className="text-[30px] leading-tight font-black text-balance md:text-[32px] lg:text-[40px]">
                Founding members pay ₹{FOUNDING.monthly} a month
              </h2>
              <p className="mt-3 text-[17px] leading-snug md:text-[18px]">
                The first {FOUNDING.seats} members pay ₹{FOUNDING.monthly} a month for as long as they stay members. After that, the price
                is ₹{REGULAR.monthly} a month.
              </p>
              <div className="mt-6">
                <SeatCounter initial={taken} />
              </div>
              <ul className="mt-6 grid list-disc gap-2 pl-5 text-[17px] font-bold marker:text-brand">
                <li>Every lesson and every Hot Seat</li>
                <li>New lessons and Hot Seats as they come out</li>
                <li>Cancel any time with one tap</li>
              </ul>
              <div className="mt-8 max-w-[360px]">
                <PlayButton>Play Unit 1 free</PlayButton>
              </div>
              <p className="mt-3 text-[14px] font-bold text-muted">You can claim a founding seat after you finish Unit 1.</p>
            </div>
          </div>
        </section>

        {/* Questions: <details> so it works with no script */}
        <section className="mx-auto max-w-[760px] px-4 py-20 sm:px-6">
          <h2 className="text-[30px] leading-tight font-black md:text-[40px]">Questions</h2>
          <div className="mt-6 grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rise group rounded-2xl bg-surface-2/60 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-black [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-[22px] text-brand transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[17px] leading-snug">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-surface/60">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-4 py-8 text-[14px] font-bold text-muted sm:px-6">
          <p>
            <span className="font-black text-ink">CEO For A Day.</span> Education, not business advice. Other outcomes are estimates.
          </p>
          <p className="flex gap-4">
            <Link className="underline" href="/privacy">
              Privacy
            </Link>
            <Link className="underline" href="/terms">
              Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
