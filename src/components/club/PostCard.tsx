"use client";

import { useState } from "react";
import { api } from "@/lib/auth";
import { CLUB_COPY, timeAgo, type PostView } from "@/lib/community";
import { WolfPicture } from "../WolfPicture";
import { Avatar, ClubSheet, errorText, gateOf, linkBtn, openClub, Picture, TitleStars, useClub } from "./shared";

/**
 * One post: who, when, the text (links never clickable), ♥ and 💬, and ⋯ for Report, Block or Delete. `onGone` runs
 * when it should leave the list: deleted, or its author blocked (with their handle, so the list can drop the rest).
 */
export function PostCard({
  post,
  onGone,
  inThread,
  pinned,
}: {
  post: PostView;
  onGone?: (blockedHandle?: string) => void;
  inThread?: boolean;
  pinned?: boolean;
}) {
  const { nudge, report } = useClub();
  const [p, setP] = useState(post);
  const [menu, setMenu] = useState<null | "menu" | "delete" | "block">(null);
  const [error, setError] = useState<string>();
  const a = p.author;
  const name = a?.name ?? CLUB_COPY.wolf;
  const openThread = () => !inThread && p.kind !== "reply" && openClub(`post/${p.id}`);

  const toggleLike = async () => {
    const on = !p.liked;
    setP({ ...p, liked: on, likes: p.likes + (on ? 1 : -1) });
    try {
      const r = await api<{ likes: number; liked: boolean }>("/api/club/like", { body: { postId: p.id, on } });
      setP((x) => ({ ...x, likes: r.likes, liked: r.liked }));
    } catch (e) {
      setP((x) => ({ ...x, liked: !on, likes: x.likes + (on ? -1 : 1) }));
      const can = gateOf(e);
      if (can) nudge(can);
    }
  };

  const act = async (what: "delete" | "block") => {
    setError(undefined);
    try {
      if (what === "delete") await api(`/api/club/post/${p.id}`, { method: "DELETE" });
      else await api("/api/club/block", { body: { handle: a!.handle, on: true } });
      setMenu(null);
      onGone?.(what === "block" ? a!.handle : undefined);
    } catch (e) {
      const can = gateOf(e);
      if (can) {
        setMenu(null);
        nudge(can);
      } else setError(errorText(e));
    }
  };

  return (
    <article className={`rounded-3xl border-2 bg-surface p-4 ${pinned ? "border-gold/70" : "border-line"}`}>
      <div className="flex items-start gap-3">
        {a ? (
          <button type="button" onClick={() => openClub(`@${a.handle}`)} aria-label={a.name}>
            <Avatar name={a.name} />
          </button>
        ) : (
          <span className="size-10 shrink-0 overflow-hidden rounded-full bg-surface-2">
            <WolfPicture name="pose-pleased" sizes="40px" className="h-auto w-full" alt="" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            {a ? (
              <button type="button" className="truncate text-[16px] font-black" onClick={() => openClub(`@${a.handle}`)}>
                {a.name}
              </button>
            ) : (
              <span className="text-[16px] font-black">{name}</span>
            )}
            {a && <span className="truncate text-[14px] font-bold text-muted">@{a.handle}</span>}
            <span className="text-[13px] font-bold text-muted">· {timeAgo(p.createdAt)}</span>
          </div>
          {a ? (
            <TitleStars title={a.title} stars={a.stars} maxStars={a.maxStars} />
          ) : (
            p.kind === "question" && <span className="text-[13px] font-black text-gold">{CLUB_COPY.question}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={CLUB_COPY.menu}
          className="-mt-1 rounded-full px-2 text-[22px] leading-none font-black text-muted"
          onClick={() => setMenu("menu")}
        >
          ⋯
        </button>
      </div>

      <div role={inThread ? undefined : "link"} tabIndex={inThread ? undefined : 0} onClick={openThread} className="mt-2 cursor-default">
        <p className={`text-[16px] font-bold break-words whitespace-pre-wrap ${p.kind === "rank_up" ? "text-gold" : ""}`}>{p.body}</p>
        {p.image && <Picture image={p.image} className="mt-2" />}
        {p.held && <p className="mt-2 rounded-xl bg-gold/10 px-3 py-2 text-[13px] font-bold text-gold">{CLUB_COPY.held}</p>}
      </div>

      <div className="mt-3 flex items-center gap-5 text-[15px] font-black text-muted">
        <button type="button" aria-pressed={p.liked} onClick={() => void toggleLike()} className={p.liked ? "text-red" : ""}>
          {p.liked ? "♥" : "♡"} {p.likes}
        </button>
        {p.kind !== "reply" && (
          <button type="button" onClick={openThread} aria-label={CLUB_COPY.replies(p.replies)}>
            💬 {p.replies}
          </button>
        )}
      </div>

      <ClubSheet
        open={!!menu}
        onOpenChange={(o) => !o && setMenu(null)}
        title={menu === "delete" ? CLUB_COPY.deleteTitle : menu === "block" ? CLUB_COPY.blockTitle(name) : CLUB_COPY.menu}
      >
        {menu === "menu" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="btn3d ghost"
              onClick={() => {
                setMenu(null);
                report("post", String(p.id));
              }}
            >
              {CLUB_COPY.report}
            </button>
            {a && !p.mine && (
              <button type="button" className="btn3d ghost" onClick={() => setMenu("block")}>
                {CLUB_COPY.block(a.name)}
              </button>
            )}
            {p.mine && (
              <button type="button" className="btn3d red" onClick={() => setMenu("delete")}>
                {CLUB_COPY.deletePost}
              </button>
            )}
          </div>
        )}
        {menu === "block" && <p className="font-bold text-muted">{CLUB_COPY.blockText}</p>}
        {(menu === "delete" || menu === "block") && (
          <>
            <button type="button" className="btn3d red" onClick={() => void act(menu)}>
              {menu === "delete" ? CLUB_COPY.deleteYes : CLUB_COPY.blockYes}
            </button>
            {error && <p className="font-bold text-red">{error}</p>}
          </>
        )}
        <button type="button" className={linkBtn} onClick={() => setMenu(null)}>
          {menu === "delete" ? CLUB_COPY.keep : CLUB_COPY.cancel}
        </button>
      </ClubSheet>
    </article>
  );
}
