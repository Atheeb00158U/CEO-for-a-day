"use client";

import { useState } from "react";

type Result = { phones: number; sent: number; gone: number; failed: number } | { error: string };

export function NotifyForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();
  const everyone = !email.trim();

  const send = async () => {
    if (everyone && !confirm("Send this to every player with reminders on?")) return;
    setBusy(true);
    setResult(undefined);
    const r = await fetch("/admin/notify/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, email }),
    });
    setResult(await r.json().catch(() => ({ error: `Failed (${r.status})` })));
    setBusy(false);
  };

  const field = "w-full rounded-xl border-2 border-line bg-surface px-3 py-2 font-bold outline-none focus:border-brand";
  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 font-extrabold">
        Title <span className="text-[13px] text-muted">{title.length}/60</span>
        <input
          className={field}
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Hot Seat: Kingfisher Airlines"
        />
      </label>
      <label className="flex flex-col gap-1 font-extrabold">
        Message <span className="text-[13px] text-muted">{body.length}/160</span>
        <textarea
          className={field}
          rows={3}
          maxLength={160}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Can you run India's most glamorous airline better than its real boss?"
        />
      </label>
      <label className="flex flex-col gap-1 font-extrabold">
        Only to this player (email)
        <input
          className={field}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Leave empty to send to everyone"
        />
      </label>

      <div className="rounded-2xl border-2 border-line bg-surface p-3">
        <p className="text-[11px] font-black tracking-wider text-muted uppercase">Preview</p>
        <p className="mt-1 font-black">{title || "Title"}</p>
        <p className="text-[14px] font-bold text-muted">{body || "Message"}</p>
      </div>

      <button type="button" className="btn3d green" disabled={busy || !title.trim() || !body.trim()} onClick={() => void send()}>
        {busy ? "Sending…" : everyone ? "Send to everyone" : `Send to ${email.trim()}`}
      </button>

      {result &&
        ("error" in result ? (
          <p className="font-bold text-red">{result.error}</p>
        ) : (
          <p className="font-bold">
            Sent to {result.sent} of {result.phones} phones.
            {result.gone > 0 && ` ${result.gone} had turned notifications off and were removed.`}
            {result.failed > 0 && ` ${result.failed} failed; try again later.`}
          </p>
        ))}
    </div>
  );
}
