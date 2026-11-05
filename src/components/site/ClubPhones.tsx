import { CLUB_COPY } from "@/lib/community";
import { WolfPicture } from "../WolfPicture";

// Two example Club screens for the website: the feed and a group chat, drawn in the game's own look (Nunito, its
// surfaces and avatar colours) from the Club's sample posts. Static: nothing here talks to the Club, which is not
// open yet, and the page labels them as examples.

const COLORS: Record<string, string> = { R: "#ff9600", P: "#58cc02", I: "#1cb0f6", Y: "#ce82ff" };

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-black text-[#160d00]"
      style={{ width: size, height: size, background: COLORS[name[0]] ?? "#ffc800", fontSize: size * 0.45 }}
    >
      {name[0]}
    </span>
  );
}

/** A plain phone: a black body with a thin light edge and a crisp shadow, the screen inside. */
function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`w-[min(70vw,280px)] rounded-[44px] bg-[#050607] p-[9px] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_28px_50px_-18px_rgb(0_0_0/0.9)] ${className}`}
    >
      <div className="h-[520px] overflow-hidden rounded-[36px] bg-bg px-3.5 pt-6 font-sans">{children}</div>
    </div>
  );
}

const [ravi, priya, imran] = CLUB_COPY.samples;

function Post({ name, title, body }: { name: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border-2 border-line bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="text-[14px] leading-tight font-black">{name}</p>
          <p className="text-[12px] font-black text-muted">{title}</p>
        </div>
      </div>
      <p className="mt-2 text-[14px] leading-snug font-bold">{body}</p>
      <p className="mt-2 flex gap-4 text-[13px] font-black text-muted">
        <span>Like</span>
        <span>Reply</span>
      </p>
    </div>
  );
}

function Feed() {
  return (
    <>
      <p className="text-[22px] font-black">{CLUB_COPY.title}</p>
      <div className="mt-2 flex gap-4 text-[14px] font-black">
        <span className="border-b-2 border-gold pb-1">{CLUB_COPY.forYou}</span>
        <span className="pb-1 text-muted">{CLUB_COPY.following}</span>
      </div>
      <div className="mt-3 grid gap-2.5">
        <div className="rounded-3xl border-2 border-gold/70 bg-surface p-3">
          <div className="flex items-center gap-2.5">
            <span className="size-9 shrink-0 overflow-hidden rounded-full bg-surface-2">
              <WolfPicture name="pose-pleased" sizes="36px" className="h-auto w-full" alt="" />
            </span>
            <div>
              <p className="text-[14px] leading-tight font-black">{CLUB_COPY.wolf}</p>
              <p className="text-[12px] font-black text-gold">{CLUB_COPY.question}</p>
            </div>
          </div>
          <p className="mt-2 text-[14px] leading-snug font-bold">A big brand cuts its price by half. Do you cut yours too?</p>
        </div>
        <Post name={ravi.name} title={ravi.title} body={ravi.body} />
        <Post name={priya.name} title={priya.title} body={priya.body} />
      </div>
    </>
  );
}

function Bubble({ name, mine, children }: { name?: string; mine?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
      {!mine && name && <Avatar name={name} size={26} />}
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug font-bold ${mine ? "rounded-br-md bg-[#2a1f0d] text-[#ffe2b0]" : "rounded-bl-md bg-surface-2"}`}
      >
        {!mine && name && <p className="text-[11px] font-black text-muted">{name}</p>}
        {children}
      </div>
    </div>
  );
}

function Group() {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="text-[20px] font-black text-muted">‹</span>
        <div>
          <p className="text-[16px] leading-tight font-black">Kirana owners</p>
          <p className="text-[12px] font-bold text-muted">Group · 6 people</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5">
        <Bubble name={priya.name}>How much stock do you buy before Diwali?</Bubble>
        <Bubble name={imran.name}>I check last year&apos;s sales first. Then I buy a little less.</Bubble>
        <Bubble mine>Same. Cash stuck in stock can&apos;t pay the rent.</Bubble>
        <Bubble name={ravi.name}>That was the frozen cash lesson!</Bubble>
        <Bubble name={priya.name}>Okay. Ordering less this year.</Bubble>
      </div>
    </>
  );
}

/** The feed and a group chat, side by side and a little offset; on a phone the second one tucks behind the first. */
export function ClubPhones() {
  return (
    <div data-ui aria-hidden="true" className="flex items-start justify-center gap-4 select-none">
      <Phone>
        <Feed />
      </Phone>
      <Phone className="mt-12 hidden sm:block">
        <Group />
      </Phone>
    </div>
  );
}
