"use client";

// The Club's screens: the feed, a thread, a profile, Activity and My reports.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/auth";
import {
  CLUB_COPY,
  LIMITS,
  reasonLabel,
  timeAgo,
  type ActivityItem,
  type PostView,
  type ProfileView,
  type ReportView,
} from "@/lib/community";
import { ReminderCard } from "../ReminderCard";
import { messagePlayer } from "./chat";
import { PostCard } from "./PostCard";
import { Avatar, errorText, gateOf, linkBtn, openClub, PictureButton, PicturePreview, TitleStars, useClub, usePicture } from "./shared";

/** Load a page; `more` appends the next one. */
function usePaged<T>(load: (cursor?: string) => Promise<{ items: T[]; cursor?: string }>, key: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The latest loader; a new `key` (tab, post id) starts again from page one.
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const run = (cursor?: string) => loader.current(cursor);
  useEffect(() => {
    let live = true;
    setItems(null);
    setError(undefined);
    loader.current = load;
    loader
      .current()
      .then((r) => live && (setItems(r.items), setCursor(r.cursor)))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const more = async () => {
    setBusy(true);
    try {
      const r = await run(cursor);
      setItems((x) => [...(x ?? []), ...r.items]);
      setCursor(r.cursor);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  return { items, setItems, cursor, error, busy, more };
}

function Back() {
  return (
    <button type="button" className="py-2 text-[15px] font-black text-muted uppercase" onClick={() => history.back()}>
      ← {CLUB_COPY.back}
    </button>
  );
}

const Problem = ({ text }: { text: string }) => <p className="py-8 text-center text-[16px] font-bold text-muted">{text}</p>;

/** Drop a post, or every post by a player just blocked. */
const without = (list: PostView[], id: number, blocked?: string) =>
  list.filter((p) => p.id !== id && (!blocked || p.author?.handle !== blocked));

export function Feed({
  tab,
  onTab,
  added,
}: {
  tab: "foryou" | "following";
  onTab: (t: "foryou" | "following") => void;
  added: PostView[];
}) {
  const { me } = useClub();
  const [question, setQuestion] = useState<PostView>();
  const [help, setHelp] = useState(false);
  const page = usePaged<PostView>(async (cursor) => {
    const r = await api<{ question?: PostView; posts: PostView[]; cursor?: string }>(
      `/api/club/feed?tab=${tab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!cursor) setQuestion(r.question);
    return { items: r.posts, cursor: r.cursor };
  }, tab);
  const shown = [...added.filter((a) => !page.items?.some((p) => p.id === a.id)), ...(page.items ?? [])];
  const seen = new Set<number>();
  const posts = shown.filter((p) => !seen.has(p.id) && seen.add(p.id));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-[26px] font-black">{CLUB_COPY.title}</h1>
        {me?.profile && (
          <span className="flex items-center gap-1">
            <button type="button" className="relative p-1 text-muted" aria-label={CLUB_COPY.messages} onClick={() => openClub("inbox")}>
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
                <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4z" />
              </svg>
              {me.badge.chats + me.badge.requests > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-red" />}
            </button>
            <button type="button" className="relative p-1 text-muted" aria-label={CLUB_COPY.activity} onClick={() => openClub("activity")}>
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
                <path d="M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6zm-2.5 16a2.5 2.5 0 0 0 5 0z" />
              </svg>
              {me.badge.activity > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-red" />}
            </button>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {(["foryou", "following"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} className="tile !w-auto !px-4 !py-2 text-center" onClick={() => onTab(t)}>
            {t === "foryou" ? CLUB_COPY.forYou : CLUB_COPY.following}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={help}
          aria-label={CLUB_COPY.rankingHelp}
          className="ml-auto grid size-9 place-items-center rounded-full border-2 border-line font-black text-muted"
          onClick={() => setHelp(!help)}
        >
          ?
        </button>
      </div>
      {help && <p className="rounded-2xl bg-surface-2 p-3 text-[14px] font-bold text-muted">{CLUB_COPY.rankingHelp}</p>}
      {question && <PostCard key={question.id} post={question} pinned />}
      {page.error && <Problem text={page.error} />}
      {!page.items && !page.error && <div className="h-32 animate-pulse rounded-3xl bg-surface" />}
      {page.items && !posts.length && tab === "following" && <Problem text={CLUB_COPY.emptyFollowing} />}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onGone={(b) => page.setItems((x) => without(x ?? [], p.id, b))} />
      ))}
      {page.cursor ? (
        <button type="button" className="btn3d ghost" disabled={page.busy} onClick={() => void page.more()}>
          {CLUB_COPY.showMore}
        </button>
      ) : (
        page.items && posts.length > 0 && <Problem text={CLUB_COPY.caughtUp} />
      )}
      <div className="h-20" />
    </div>
  );
}

export function Thread({ id }: { id: string }) {
  const { me, nudge } = useClub();
  const [post, setPost] = useState<PostView>();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const page = usePaged<PostView>(async (after) => {
    const r = await api<{ post: PostView; replies: PostView[]; after?: number }>(`/api/club/post/${id}${after ? `?after=${after}` : ""}`);
    setPost(r.post);
    return { items: r.replies, cursor: r.after ? String(r.after) : undefined };
  }, id);
  const canReply = me?.can.post === "ok";
  const picture = usePicture();
  const reply = async () => {
    setBusy(true);
    setSendError(undefined);
    try {
      const r = await api<{ post: PostView }>("/api/club/post", { body: { body: text, parentId: post!.id, imageId: picture.imageId } });
      setText("");
      picture.clear();
      page.setItems((x) => [...(x ?? []), r.post]);
      setPost((p) => p && { ...p, replies: p.replies + 1 });
    } catch (e) {
      const can = gateOf(e);
      if (can) nudge(can);
      else setSendError(errorText(e));
    }
    setBusy(false);
  };
  return (
    <div className="flex min-h-full flex-col gap-3">
      <Back />
      {page.error && <Problem text={page.error} />}
      {post && <PostCard key={post.id} post={post} inThread onGone={() => history.back()} />}
      <div className="ml-4 flex flex-col gap-3 border-l-2 border-line pl-3">
        {page.items?.map((p) => (
          <PostCard key={p.id} post={p} inThread onGone={(b) => page.setItems((x) => without(x ?? [], p.id, b))} />
        ))}
        {page.cursor && (
          <button type="button" className="btn3d ghost" disabled={page.busy} onClick={() => void page.more()}>
            {CLUB_COPY.showMore}
          </button>
        )}
      </div>
      <div className="h-24" />
      {post && (
        <div className="sticky bottom-0 -mx-4 mt-auto border-t-2 border-line bg-bg px-4 py-3">
          {canReply ? (
            <>
              <PicturePreview p={picture} />
              <div className="mt-2 flex gap-2 first:mt-0">
                {!picture.pic && <PictureButton onPick={picture.pick} />}
                <input
                  className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-3 py-2.5 text-[16px] font-bold outline-none focus:border-brand"
                  placeholder={CLUB_COPY.replyPlaceholder}
                  maxLength={LIMITS.postLength}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn3d green !w-auto !px-4 !py-2 !text-[15px]"
                  disabled={busy || picture.busy || !text.trim()}
                  onClick={() => void reply()}
                >
                  {CLUB_COPY.reply}
                </button>
              </div>
              {sendError && <p className="mt-2 text-[14px] font-bold text-red">{sendError}</p>}
            </>
          ) : (
            <button type="button" className="tile text-center !text-muted" onClick={() => me && nudge(me.can.post)}>
              {CLUB_COPY.replyLocked}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type FullProfile = ProfileView & { posts: PostView[]; before?: number };

export function ClubProfile({ handle }: { handle: string }) {
  const { nudge, report, reloadMe } = useClub();
  const [p, setP] = useState<FullProfile | null>(null);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState({ name: "", building: "", milestones: true });
  const [saveError, setSaveError] = useState<string>();

  const load = useCallback(() => {
    setError(undefined);
    api<FullProfile>(`/api/club/u/${encodeURIComponent(handle)}`)
      .then(setP)
      .catch((e) => setError(e instanceof ApiError && e.status === 409 ? e.message : CLUB_COPY.error));
  }, [handle]);
  useEffect(load, [load]);

  const call = async (url: string, body: object) => {
    try {
      await api(url, { body });
      load();
    } catch (e) {
      const can = gateOf(e);
      if (can) nudge(can);
      else setError(errorText(e));
    }
  };
  const save = async () => {
    setSaveError(undefined);
    try {
      await api("/api/club/me", { body: draft });
      setEditing(false);
      load();
      reloadMe();
    } catch (e) {
      setSaveError(errorText(e));
    }
  };

  if (error)
    return (
      <div>
        <Back />
        <Problem text={error} />
      </div>
    );
  if (!p) return <div className="mt-10 h-40 animate-pulse rounded-3xl bg-surface" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Back />
        {!p.mine && (
          <button
            type="button"
            aria-label={CLUB_COPY.menu}
            className="px-2 text-[22px] font-black text-muted"
            onClick={() => setMenu(!menu)}
          >
            ⋯
          </button>
        )}
      </div>
      {menu && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-surface p-3">
          <button type="button" className="btn3d ghost !text-[14px]" onClick={() => (setMenu(false), report("profile", p.handle))}>
            {CLUB_COPY.report}
          </button>
          <button
            type="button"
            className="btn3d ghost !text-[14px]"
            onClick={() => (setMenu(false), void call("/api/club/block", { handle: p.handle, on: !p.blocked }))}
          >
            {p.blocked ? CLUB_COPY.unblock(p.name) : CLUB_COPY.block(p.name)}
          </button>
        </div>
      )}
      <div className="flex flex-col items-center gap-1 text-center">
        <Avatar name={p.name} size={80} />
        <p className="mt-1 text-[24px] font-black">{p.name}</p>
        <p className="font-bold text-muted">@{p.handle}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <TitleStars title={p.title} stars={p.stars} maxStars={p.maxStars} />
          {p.streak > 0 && <span className="text-[13px] font-black text-[#ff9600]">🔥 {CLUB_COPY.streak(p.streak)}</span>}
        </div>
      </div>
      {editing ? (
        <div className="flex flex-col gap-3 rounded-3xl border-2 border-line bg-surface p-4">
          <label className="flex flex-col gap-1 font-extrabold">
            {CLUB_COPY.name}
            <input
              className="rounded-2xl border-2 border-line bg-bg px-3 py-2 font-bold outline-none focus:border-brand"
              maxLength={LIMITS.nameLength}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 font-extrabold">
            {CLUB_COPY.whatBuilding}
            <textarea
              className="rounded-2xl border-2 border-line bg-bg px-3 py-2 font-bold outline-none focus:border-brand"
              rows={2}
              maxLength={LIMITS.buildingLength}
              placeholder={CLUB_COPY.buildingExample}
              value={draft.building}
              onChange={(e) => setDraft({ ...draft, building: e.target.value })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 font-extrabold">
            <span>
              {CLUB_COPY.milestones}
              <span className="block text-[14px] font-bold text-muted">{CLUB_COPY.milestonesLine}</span>
            </span>
            <input
              type="checkbox"
              checked={draft.milestones}
              onChange={(e) => setDraft({ ...draft, milestones: e.target.checked })}
              className="size-6 shrink-0 accent-[var(--color-brand)]"
            />
          </label>
          {saveError && <p className="font-bold text-red">{saveError}</p>}
          <button type="button" className="btn3d green" onClick={() => void save()}>
            {CLUB_COPY.save}
          </button>
          <button type="button" className={linkBtn} onClick={() => setEditing(false)}>
            {CLUB_COPY.cancel}
          </button>
        </div>
      ) : (
        p.building && (
          <div className="rounded-3xl border-2 border-line bg-surface p-4">
            <p className="text-[13px] font-black tracking-wide text-muted uppercase">{CLUB_COPY.whatBuilding}</p>
            <p className="mt-1 text-[16px] font-bold whitespace-pre-wrap">{p.building}</p>
          </div>
        )
      )}
      <p className="text-center font-bold text-muted">
        {CLUB_COPY.followers(p.followers)} · {CLUB_COPY.followingCount(p.following)}
      </p>
      {p.mine ? (
        !editing && (
          <button
            type="button"
            className="btn3d ghost"
            onClick={() => {
              setDraft({ name: p.name, building: p.building, milestones: p.milestones ?? true });
              setEditing(true);
            }}
          >
            {CLUB_COPY.edit}
          </button>
        )
      ) : p.blocked ? (
        <button type="button" className="btn3d ghost" onClick={() => void call("/api/club/block", { handle: p.handle, on: false })}>
          {CLUB_COPY.unblock(p.name)}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn3d flex-1 ${p.youFollow ? "ghost" : "green"}`}
            onClick={() => void call("/api/club/follow", { handle: p.handle, on: !p.youFollow })}
          >
            {p.youFollow ? CLUB_COPY.followingBtn : CLUB_COPY.follow}
          </button>
          <button
            type="button"
            className="btn3d ghost flex-1"
            onClick={() => void messagePlayer(p.handle, nudge).then((e) => e && setError(e))}
          >
            {CLUB_COPY.message}
          </button>
        </div>
      )}
      {!p.blocked && (
        <>
          <h2 className="text-[19px] font-black">{CLUB_COPY.posts}</h2>
          {!p.posts.length && <Problem text={CLUB_COPY.noPosts} />}
          {p.posts.map((x) => (
            <PostCard key={x.id} post={x} onGone={() => setP({ ...p, posts: p.posts.filter((y) => y.id !== x.id) })} />
          ))}
        </>
      )}
      <div className="h-6" />
    </div>
  );
}

function activityLine(a: ActivityItem): string {
  const name = a.actor?.name ?? "";
  if (a.kind === "reply") return CLUB_COPY.replied(name);
  if (a.kind === "like") return a.others ? CLUB_COPY.likedMany(name, a.others) : CLUB_COPY.liked(name);
  if (a.kind === "follow") return CLUB_COPY.followed(name);
  return a.text ?? "";
}

export function Activity() {
  const { reloadMe } = useClub();
  const page = usePaged<ActivityItem>(async (before) => {
    const r = await api<{ items: ActivityItem[]; before?: number }>(`/api/club/activity${before ? `?before=${before}` : ""}`);
    return { items: r.items, cursor: r.before ? String(r.before) : undefined };
  }, "activity");
  useEffect(() => {
    if (page.items) reloadMe(); // they are seen now: the dot goes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!page.items]);
  return (
    <div className="flex flex-col gap-3">
      <Back />
      <h1 className="text-[26px] font-black">{CLUB_COPY.activity}</h1>
      <p className="font-bold text-muted">{CLUB_COPY.turnOnNotifications}</p>
      <ReminderCard compact />
      {page.error && <Problem text={page.error} />}
      {page.items && !page.items.length && <Problem text={CLUB_COPY.emptyActivity} />}
      {page.items?.map((a) => {
        const go = a.postId ? () => openClub(`post/${a.postId}`) : a.actor ? () => openClub(`@${a.actor!.handle}`) : undefined;
        return (
          <button
            key={a.id}
            type="button"
            disabled={!go}
            onClick={go}
            className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left ${a.seen ? "border-line" : "border-brand/60 bg-brand/5"}`}
          >
            {a.actor ? <Avatar name={a.actor.name} size={36} /> : <span className="text-[22px]">🐺</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black">{activityLine(a)}</span>
              {a.text && a.kind === "reply" && <span className="block truncate text-[14px] font-bold text-muted">{a.text}</span>}
              <span className="text-[12px] font-bold text-muted">{timeAgo(a.createdAt)}</span>
            </span>
          </button>
        );
      })}
      {page.cursor && (
        <button type="button" className="btn3d ghost" disabled={page.busy} onClick={() => void page.more()}>
          {CLUB_COPY.showMore}
        </button>
      )}
    </div>
  );
}

export function MyReports() {
  const page = usePaged<ReportView>(
    async () => ({ items: (await api<{ reports: ReportView[] }>("/api/club/reports")).reports }),
    "reports",
  );
  return (
    <div className="flex flex-col gap-3">
      <Back />
      <h1 className="text-[26px] font-black">{CLUB_COPY.myReports}</h1>
      {page.error && <Problem text={page.error} />}
      {page.items && !page.items.length && <Problem text={CLUB_COPY.noReports} />}
      {page.items?.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line p-3">
          <span className="text-[15px] font-bold">{reasonLabel(r.reason)}</span>
          <span
            className={`shrink-0 text-[13px] font-black ${r.status === "removed" ? "text-red" : r.status === "kept" ? "text-green" : "text-gold"}`}
          >
            {CLUB_COPY.reportStatus[r.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
