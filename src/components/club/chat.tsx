"use client";

// The Club's chats: the inbox, message requests, and one chat (step 2); pictures and group chats (step 3). New
// messages, "Seen" and "typing…" come live on the player's own Realtime topic; while it's down, an open chat asks the
// server every 15 seconds.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/auth";
import { CLUB_COPY, groupLine, LIMITS, timeAgo, type ChatRow, type ChatView, type MessageView } from "@/lib/community";
import { liveUp, onLive } from "@/lib/live";
import {
  Avatar,
  ClubSheet,
  errorText,
  gateOf,
  linkBtn,
  openClub,
  Picture,
  PictureButton,
  PicturePreview,
  useClub,
  usePicture,
} from "./shared";

type Person = { handle: string; name: string; title: string };

/** Pick people who follow you back (for a new group, or to add to one). */
function PeoplePicker({ skip, picked, onPick }: { skip?: string[]; picked: string[]; onPick: (handles: string[]) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    api<{ people: Person[] }>("/api/club/mutuals")
      .then((r) => setPeople(r.people))
      .catch(() => setPeople([]));
  }, []);
  const shown = people?.filter((p) => !skip?.includes(p.handle));
  return (
    <div className="flex flex-col gap-2">
      <p className="font-bold text-muted">{CLUB_COPY.mutualOnly}</p>
      {!people && <div className="h-24 animate-pulse rounded-2xl bg-bg" />}
      {shown && !shown.length && <p className="font-bold text-muted">{CLUB_COPY.noMutuals}</p>}
      {shown?.map((p) => {
        const on = picked.includes(p.handle);
        return (
          <label key={p.handle} className={`tile flex items-center gap-3 !py-2.5 ${on ? "!border-brand" : ""}`}>
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-brand)]"
              checked={on}
              onChange={() => onPick(on ? picked.filter((h) => h !== p.handle) : [...picked, p.handle])}
            />
            <Avatar name={p.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-black">{p.name}</span>
              <span className="block text-[13px] font-bold text-muted">
                @{p.handle} · {p.title}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** A new group: a name and 2 to 19 people who follow you back. A refusal opens the right nudge. */
function NewGroup({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { nudge } = useClub();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { minOthers, maxMembers, titleLength } = LIMITS.groups;
  const make = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { chatId } = await api<{ chatId: number }>("/api/club/group", { body: { title, handles: picked } });
      onOpenChange(false);
      openClub(`chat/${chatId}`);
    } catch (e) {
      const can = gateOf(e);
      if (can) {
        onOpenChange(false);
        nudge(can);
      } else setError(errorText(e));
    }
    setBusy(false);
  };
  return (
    <ClubSheet open={open} onOpenChange={onOpenChange} title={CLUB_COPY.newGroup}>
      <input
        aria-label={CLUB_COPY.groupName}
        placeholder={CLUB_COPY.groupName}
        className="w-full rounded-2xl border-2 border-line bg-bg px-3 py-2.5 text-[16px] font-bold outline-none focus:border-brand"
        value={title}
        maxLength={titleLength}
        onChange={(e) => setTitle(e.target.value)}
      />
      <h2 className="text-[16px] font-black">{CLUB_COPY.addPeople}</h2>
      {open && <PeoplePicker picked={picked} onPick={setPicked} />}
      <p className="text-[14px] font-bold text-muted">{CLUB_COPY.pickPeople(minOthers, maxMembers - 1)}</p>
      {error && <p className="font-bold text-red">{error}</p>}
      <button
        type="button"
        className="btn3d green"
        disabled={busy || !title.trim() || picked.length < minOthers || picked.length > maxMembers - 1}
        onClick={() => void make()}
      >
        {CLUB_COPY.makeGroup}
      </button>
      <button type="button" className={linkBtn} onClick={() => onOpenChange(false)}>
        {CLUB_COPY.cancel}
      </button>
    </ClubSheet>
  );
}

function Back() {
  return (
    <button type="button" className="self-start py-2 text-[15px] font-black text-muted uppercase" onClick={() => history.back()}>
      ← {CLUB_COPY.back}
    </button>
  );
}
const Problem = ({ text }: { text: string }) => <p className="py-8 text-center text-[16px] font-bold text-muted">{text}</p>;

/** Start a chat (or open the one you have) with a player by handle. A refusal opens the right nudge. */
export async function messagePlayer(handle: string, nudge: (c: NonNullable<ReturnType<typeof gateOf>>) => void): Promise<string | null> {
  try {
    const { chatId } = await api<{ chatId: number }>("/api/club/chat", { body: { handle } });
    openClub(`chat/${chatId}`);
    return null;
  } catch (e) {
    const can = gateOf(e);
    if (can) nudge(can);
    return can ? null : errorText(e);
  }
}

function ChatList({ rows }: { rows: ChatRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => openClub(`chat/${c.id}`)}
          className="flex items-center gap-3 rounded-2xl border-2 border-line p-3 text-left"
        >
          <Avatar name={c.title ?? c.with?.name ?? "?"} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-[16px] ${c.unread ? "font-black" : "font-extrabold"}`}>
                {c.title ?? c.with?.name ?? CLUB_COPY.deletedAccount}
              </span>
              {c.last && <span className="shrink-0 text-[12px] font-bold text-muted">{timeAgo(c.last.at)}</span>}
            </span>
            <span className={`block truncate text-[14px] ${c.unread ? "font-black text-ink" : "font-bold text-muted"}`}>
              {c.last?.body}
            </span>
          </span>
          {c.unread && <span className="size-2.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/** Reload a list whenever a live message arrives. */
function useChats(url: string) {
  const [data, setData] = useState<{ chats: ChatRow[]; requests: number } | null>(null);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    api<{ chats: ChatRow[]; requests: number }>(url)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [url]);
  useEffect(() => {
    load();
    return onLive((e) => e.event === "msg" && load());
  }, [load]);
  return { data, error };
}

export function Inbox() {
  const { nudge } = useClub();
  const { data, error } = useChats("/api/club/inbox");
  const [picking, setPicking] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [handle, setHandle] = useState("");
  const [startError, setStartError] = useState<string>();
  const start = async () => {
    setStartError(undefined);
    const err = await messagePlayer(handle, (c) => (setPicking(false), nudge(c)));
    if (err) setStartError(err);
    else setPicking(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Back />
        <span className="flex-1" />
        <button
          type="button"
          className="rounded-full border-2 border-line px-3 py-2 text-[13px] font-black text-muted uppercase"
          onClick={() => setGrouping(true)}
        >
          {CLUB_COPY.newGroup}
        </button>
        <button
          type="button"
          aria-label={CLUB_COPY.newMessage}
          className="grid size-10 place-items-center rounded-full border-2 border-line text-muted"
          onClick={() => setPicking(true)}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.33-2.33a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z" />
          </svg>
        </button>
      </div>
      <h1 className="text-[26px] font-black">{CLUB_COPY.messages}</h1>
      {!!data?.requests && (
        <button type="button" className="tile flex items-center justify-between !py-3" onClick={() => openClub("requests")}>
          <span>{CLUB_COPY.requestsRow(data.requests)}</span>
          <span className="size-2.5 rounded-full bg-red" aria-hidden="true" />
        </button>
      )}
      {error && <Problem text={error} />}
      {!data && !error && <div className="h-32 animate-pulse rounded-3xl bg-surface" />}
      {data && !data.chats.length && <Problem text={CLUB_COPY.emptyInbox} />}
      {data && <ChatList rows={data.chats} />}
      <ClubSheet open={picking} onOpenChange={setPicking} title={CLUB_COPY.newMessage}>
        <p className="font-bold text-muted">{CLUB_COPY.newMessageHelp}</p>
        <span className="flex items-center gap-1 rounded-2xl border-2 border-line bg-bg pl-3 focus-within:border-brand">
          <span className="font-black text-muted">@</span>
          <input
            aria-label={CLUB_COPY.handle}
            className="w-full bg-transparent py-2.5 pr-3 text-[16px] font-bold outline-none"
            value={handle}
            maxLength={15}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
        </span>
        {startError && <p className="font-bold text-red">{startError}</p>}
        <button type="button" className="btn3d green" disabled={handle.length < 3} onClick={() => void start()}>
          {CLUB_COPY.start}
        </button>
        <button type="button" className={linkBtn} onClick={() => setPicking(false)}>
          {CLUB_COPY.cancel}
        </button>
      </ClubSheet>
      <NewGroup open={grouping} onOpenChange={setGrouping} />
    </div>
  );
}

export function Requests() {
  const { data, error } = useChats("/api/club/requests");
  return (
    <div className="flex flex-col gap-3">
      <Back />
      <h1 className="text-[26px] font-black">{CLUB_COPY.requestsTitle}</h1>
      {error && <Problem text={error} />}
      {data && !data.chats.length && <Problem text={CLUB_COPY.emptyRequests} />}
      {data && <ChatList rows={data.chats} />}
    </div>
  );
}

/** Messages by id, the newest copy of each; a sent message replaces its pending copy (same clientId). */
function merge(list: MessageView[], add: MessageView[]): MessageView[] {
  const out = list.filter((m) => !add.some((a) => a.id === m.id || (a.clientId && a.clientId === m.clientId)));
  return [...out, ...add].sort((a, b) => a.id - b.id);
}
const newClientId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const PENDING = 2 ** 52; // pending messages sort after every real id

export function Chat({ id }: { id: string }) {
  const { report, reloadMe, nudge } = useClub();
  const chatId = Number(id);
  const [view, setView] = useState<ChatView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [error, setError] = useState<string>();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string>();
  const [typingUntil, setTypingUntil] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);
  const [menu, setMenu] = useState<null | "menu" | "block" | "clear" | "leave" | "add">(null);
  const [typer, setTyper] = useState("");
  const [adding, setAdding] = useState<string[]>([]);
  const picture = usePicture(chatId);
  const lastTyping = useRef(0);
  const lastSeen = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const newest = useRef(0);
  // The newest saved id, for catching up (?after=) and "Seen". Kept in an effect, before the ones that read it.
  useEffect(() => {
    newest.current = messages.filter((m) => m.id < PENDING).at(-1)?.id ?? 0;
  }, [messages]);

  const load = useCallback(
    (after?: number) =>
      api<ChatView>(`/api/club/chat/${chatId}${after ? `?after=${after}` : ""}`)
        .then((v) => {
          setView((old) => (after && old ? { ...old, chat: v.chat, theirLastRead: v.theirLastRead } : v));
          setMessages((list) => merge(after ? list : [], v.messages));
        })
        .catch((e) => setError(errorText(e))),
    [chatId],
  );

  useEffect(() => {
    void load();
    const off = onLive((e) => {
      if (e.payload.chatId !== chatId) return;
      if (e.event === "msg") {
        if (e.payload.message.chatId !== chatId) return; // only a message of this chat
        setMessages((list) => merge(list, [e.payload.message]));
        if (!e.payload.message.mine) setTypingUntil(0);
        if (e.payload.message.event) void load(newest.current); // someone came or went: refresh the members
      } else if (e.event === "seen") setView((v) => v && { ...v, theirLastRead: Math.max(v.theirLastRead, e.payload.lastId) });
      else if (e.event === "typing") {
        setTyper(e.payload.handle);
        setTypingUntil(Date.now() + 5000);
      }
    });
    // While the live channel is down, ask every 15 s; coming back to the front catches up at once.
    const poll = setInterval(() => !liveUp() && document.visibilityState === "visible" && void load(newest.current), 15_000);
    const back = () => document.visibilityState === "visible" && void load(newest.current);
    document.addEventListener("visibilitychange", back);
    return () => {
      off();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", back);
    };
  }, [chatId, load]);

  // "typing…" goes 5 s after the last event.
  useEffect(() => {
    if (!typingUntil) return;
    const t = setTimeout(() => setTypingUntil(0), Math.max(0, typingUntil - Date.now()));
    return () => clearTimeout(t);
  }, [typingUntil]);

  // New messages: scroll down and tell the server they're seen (only in an accepted chat).
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    const last = newest.current;
    if (view?.chat.state === "active" && last > lastSeen.current && document.visibilityState === "visible") {
      lastSeen.current = last;
      void api(`/api/club/chat/${chatId}/seen`, { body: { lastId: last } })
        .then(reloadMe)
        .catch(() => {});
    }
  }, [messages, view?.chat.state, chatId, reloadMe]);

  const sendNow = async () => {
    const body = text.trim();
    const imageId = picture.imageId;
    if (!body && !imageId) return;
    const clientId = newClientId();
    const pending: MessageView = {
      id: PENDING + Date.now(),
      chatId,
      mine: true,
      body,
      createdAt: new Date().toISOString(),
      flagged: false,
      held: false,
      clientId,
    };
    setText("");
    setSendError(undefined);
    setMessages((list) => merge(list, [pending]));
    try {
      const r = await api<{ message: MessageView }>(`/api/club/chat/${chatId}/send`, { body: { body, clientId, imageId } });
      setMessages((list) => merge(list, [r.message]));
      if (imageId) picture.clear();
    } catch (e) {
      setMessages((list) => list.filter((m) => m.clientId !== clientId));
      setText(body);
      setSendError(errorText(e));
    }
  };
  const group = view?.chat.group;
  const groupAct = async (what: "leave" | "add" | "remove", handle?: string) => {
    try {
      if (what === "add") for (const h of adding) await api(`/api/club/chat/${chatId}/add`, { body: { handle: h } });
      else await api(`/api/club/chat/${chatId}/${what}`, { body: handle ? { handle } : {} });
      setMenu(null);
      setAdding([]);
      if (what === "leave") history.back();
      else await load();
    } catch (e) {
      const can = gateOf(e);
      if (can) {
        setMenu(null);
        nudge(can);
      } else setSendError(errorText(e));
    }
  };
  const typed = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 3000 && view?.chat.state === "active" && !view.chat.waiting) {
      lastTyping.current = Date.now();
      void api(`/api/club/chat/${chatId}/typing`, { body: {} }).catch(() => {});
    }
  };
  const act = async (what: "accept" | "decline" | "clear" | "block") => {
    try {
      if (what === "block") await api("/api/club/block", { body: { handle: view!.chat.with!.handle, on: true } });
      else await api(`/api/club/chat/${chatId}/${what}`, { body: {} });
      if (what === "accept") {
        setMenu(null);
        await load();
      } else history.back();
      reloadMe();
    } catch (e) {
      setSendError(errorText(e));
    }
  };

  if (error)
    return (
      <div>
        <Back />
        <Problem text={error} />
      </div>
    );
  if (!view) return <div className="mt-10 h-40 animate-pulse rounded-3xl bg-surface" />;
  const { chat } = view;
  const who = chat.with;
  const name = chat.title ?? who?.name ?? CLUB_COPY.deletedAccount;
  const lastMine = [...messages].reverse().find((m) => m.mine && !m.event);
  const typerName = group ? group.members.find((p) => p.handle === typer)?.name : who?.name;
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b-2 border-line bg-bg px-4 py-2">
        <button
          type="button"
          aria-label={CLUB_COPY.back}
          className="py-1 pr-1 text-[22px] font-black text-muted"
          onClick={() => history.back()}
        >
          ←
        </button>
        <button
          type="button"
          disabled={!who && !group}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => (group ? setMenu("menu") : who && openClub(`@${who.handle}`))}
        >
          <Avatar name={chat.title ?? who?.name ?? "?"} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-black">{name}</span>
            {group ? (
              <span className="block text-[12px] font-bold text-muted">{CLUB_COPY.members(group.members.length)}</span>
            ) : (
              who && <span className="block text-[12px] font-bold text-muted">{who.title}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          aria-label={CLUB_COPY.menu}
          className="px-2 text-[22px] font-black text-muted"
          onClick={() => setMenu("menu")}
        >
          ⋯
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 py-3">
        {chat.state === "request" && who && (
          <div className="mb-2 rounded-2xl bg-surface-2 p-3 text-center">
            <p className="font-black">{CLUB_COPY.wantsToChat(who.name)}</p>
            <p className="text-[14px] font-bold text-muted">{CLUB_COPY.requestNote}</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.event ? (
            <p key={m.clientId ?? m.id} className="my-1 self-center text-center text-[13px] font-bold text-muted">
              {groupLine(m.event, m.mine ? CLUB_COPY.you : (m.from?.name ?? CLUB_COPY.deletedAccount), m.body)}
            </p>
          ) : (
            <div key={m.clientId ?? m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              {group && !m.mine && m.from && messages[i - 1]?.from?.handle !== m.from.handle && (
                <span className="mt-1 px-2 text-[12px] font-black text-muted">{m.from.name}</span>
              )}
              <button
                type="button"
                onClick={() => setOpened(opened === m.id ? null : m.id)}
                className={`flex max-w-[80%] flex-col gap-1.5 rounded-3xl text-left text-[16px] font-bold whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  m.image ? "p-1.5" : "px-4 py-2"
                } ${m.mine ? "rounded-br-md bg-brand text-[#06222e]" : "rounded-bl-md bg-surface-2"} ${m.id >= PENDING ? "opacity-60" : ""}`}
              >
                {m.image && <Picture image={m.image} className="!w-[min(260px,70vw)]" />}
                {m.imageHidden && <span className="px-2.5 py-0.5 text-[14px] text-muted">📷 {CLUB_COPY.pictureHidden}</span>}
                {m.body && <span className={m.image ? "px-2.5 pb-1" : ""}>{m.body}</span>}
              </button>
              {m.flagged && !m.mine && <p className="mt-0.5 max-w-[80%] text-[13px] font-bold text-gold">⚠ {CLUB_COPY.scamWarning}</p>}
              {m.held && <p className="mt-0.5 max-w-[80%] text-[13px] font-bold text-gold">{CLUB_COPY.held}</p>}
              {opened === m.id && (
                <p className="mt-0.5 flex gap-3 text-[12px] font-bold text-muted">
                  {m.id < PENDING && timeAgo(m.createdAt)}
                  {!m.mine && (
                    <button type="button" className="font-black text-red uppercase" onClick={() => report("message", String(m.id))}>
                      {CLUB_COPY.reportMessage}
                    </button>
                  )}
                </p>
              )}
              {!group && m === lastMine && m.id < PENDING && (
                <p className="mt-0.5 text-[12px] font-bold text-muted">{view.theirLastRead >= m.id ? CLUB_COPY.seen : CLUB_COPY.sent}</p>
              )}
            </div>
          ),
        )}
        {typingUntil > 0 && typerName && <p className="text-[13px] font-bold text-muted">{CLUB_COPY.typing(typerName)}</p>}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t-2 border-line bg-bg px-4 py-3">
        {chat.state === "request" ? (
          <div className="flex gap-2">
            <button type="button" className="btn3d ghost flex-1" onClick={() => void act("decline")}>
              {CLUB_COPY.deleteYes}
            </button>
            <button type="button" className="btn3d green flex-1" onClick={() => void act("accept")}>
              {CLUB_COPY.accept}
            </button>
          </div>
        ) : chat.canSend ? (
          <>
            {chat.waiting && who && <p className="mb-2 text-[13px] font-bold text-muted">{CLUB_COPY.waitingAccept(who.name)}</p>}
            <PicturePreview p={picture} />
            <div className="mt-2 flex items-end gap-2 first:mt-0">
              {!picture.pic && <PictureButton onPick={picture.pick} />}
              <textarea
                aria-label={CLUB_COPY.messagePlaceholder}
                className="max-h-32 min-h-[46px] min-w-0 flex-1 resize-none rounded-2xl border-2 border-line bg-surface px-3 py-2.5 text-[16px] font-bold outline-none focus:border-brand [field-sizing:content]"
                placeholder={CLUB_COPY.messagePlaceholder}
                rows={1}
                maxLength={LIMITS.chats.messageLength}
                value={text}
                onChange={(e) => typed(e.target.value)}
              />
              <button
                type="button"
                className="btn3d green !w-auto !px-4 !py-2 !text-[15px]"
                disabled={picture.busy || (!text.trim() && !picture.imageId)}
                onClick={() => void sendNow()}
              >
                {CLUB_COPY.send}
              </button>
            </div>
          </>
        ) : null}
        {sendError && <p className="mt-2 text-[14px] font-bold text-red">{sendError}</p>}
      </div>

      <ClubSheet
        open={!!menu}
        onOpenChange={(o) => !o && (setMenu(null), setAdding([]))}
        title={
          menu === "block"
            ? CLUB_COPY.blockTitle(name)
            : menu === "clear"
              ? CLUB_COPY.deleteChatTitle
              : menu === "leave"
                ? CLUB_COPY.leaveGroupTitle
                : menu === "add"
                  ? CLUB_COPY.addPeople
                  : group
                    ? name
                    : CLUB_COPY.menu
        }
      >
        {menu === "menu" && group && (
          <div className="flex flex-col gap-2">
            <h2 className="text-[16px] font-black">{CLUB_COPY.members(group.members.length)}</h2>
            {group.members.map((p) => (
              <div key={p.handle} className="flex items-center gap-3">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openClub(`@${p.handle}`)}>
                  <Avatar name={p.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate font-black">{p.mine ? CLUB_COPY.you : p.name}</span>
                    <span className="block text-[13px] font-bold text-muted">{p.title}</span>
                  </span>
                </button>
                {group.admin && !p.mine && (
                  <button
                    type="button"
                    className="text-[13px] font-black text-red uppercase"
                    onClick={() => void groupAct("remove", p.handle)}
                  >
                    {CLUB_COPY.remove(p.name)}
                  </button>
                )}
              </div>
            ))}
            {group.admin && (
              <button type="button" className="btn3d ghost mt-2" onClick={() => setMenu("add")}>
                {CLUB_COPY.addPeople}
              </button>
            )}
            <button type="button" className="btn3d ghost" onClick={() => setMenu("clear")}>
              {CLUB_COPY.deleteChat}
            </button>
            <button type="button" className="btn3d red" onClick={() => setMenu("leave")}>
              {CLUB_COPY.leaveGroup}
            </button>
          </div>
        )}
        {menu === "menu" && !group && (
          <div className="flex flex-col gap-2">
            {who && (
              <button type="button" className="btn3d ghost" onClick={() => (setMenu(null), report("profile", who.handle))}>
                {CLUB_COPY.report}
              </button>
            )}
            {who && (
              <button type="button" className="btn3d ghost" onClick={() => setMenu("block")}>
                {CLUB_COPY.block(who.name)}
              </button>
            )}
            <button type="button" className="btn3d ghost" onClick={() => setMenu("clear")}>
              {CLUB_COPY.deleteChat}
            </button>
          </div>
        )}
        {menu === "add" && group && (
          <>
            <PeoplePicker skip={group.members.map((p) => p.handle)} picked={adding} onPick={setAdding} />
            <button type="button" className="btn3d green" disabled={!adding.length} onClick={() => void groupAct("add")}>
              {CLUB_COPY.addPeople}
            </button>
          </>
        )}
        {menu === "block" && <p className="font-bold text-muted">{CLUB_COPY.blockText}</p>}
        {menu === "clear" && <p className="font-bold text-muted">{CLUB_COPY.deleteChatText}</p>}
        {menu === "leave" && <p className="font-bold text-muted">{CLUB_COPY.leaveGroupText}</p>}
        {(menu === "block" || menu === "clear") && (
          <button type="button" className="btn3d red" onClick={() => void act(menu)}>
            {menu === "block" ? CLUB_COPY.blockYes : CLUB_COPY.deleteYes}
          </button>
        )}
        {menu === "leave" && (
          <button type="button" className="btn3d red" onClick={() => void groupAct("leave")}>
            {CLUB_COPY.leaveGroup}
          </button>
        )}
        <button type="button" className={linkBtn} onClick={() => (setMenu(null), setAdding([]))}>
          {CLUB_COPY.cancel}
        </button>
      </ClubSheet>
    </div>
  );
}
