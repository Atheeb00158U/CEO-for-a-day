"use client";

// Bits every Club screen uses: the screen-to-screen link, how a refusal becomes a nudge, the avatar and the sheet.
import { createContext, useContext, useState } from "react";
import { ApiError, token } from "@/lib/auth";
import { CLUB_COPY, LIMITS, type Can, type ClubMe, type ImageView } from "@/lib/community";
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";

export interface ClubCtx {
  me: ClubMe | null;
  reloadMe: () => void;
  /** Open the sheet that matches a gate refusal (join, pay, rank, banned). */
  nudge: (can: Can) => void;
  report: (kind: "post" | "profile" | "message", id: string) => void;
}
export const ClubContext = createContext<ClubCtx>({ me: null, reloadMe: () => {}, nudge: () => {}, report: () => {} });
export const useClub = () => useContext(ClubContext);

/** Open a Club screen: "" (feed), "post/9", "@ravik", "activity", "reports", "inbox", "requests", "chat/9". Steps into history, so Back steps out. */
export function openClub(path: string) {
  try {
    history.pushState(null, "", "#club" + (path ? "/" + path : ""));
  } catch {
    /* sandboxed */
  }
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** The gate's refusal in a 403 `{ error: "club", can }`, if that's what this error is. */
export function gateOf(e: unknown): Can | null {
  const d = e instanceof ApiError && e.status === 403 ? (e.data as { error?: string; can?: Can } | undefined) : undefined;
  return d?.error === "club" && d.can ? d.can : null;
}

/** The server's own sentence for a refused request (409), otherwise the plain retry line. */
export const errorText = (e: unknown) => (e instanceof ApiError && e.status === 409 ? e.message : CLUB_COPY.error);

const COLORS = ["#ff9600", "#58cc02", "#1cb0f6", "#ce82ff", "#ff4b4b", "#ffc800"];
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-black text-[#160d00]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

/** "Trader ★★☆" in small. */
export function TitleStars({ title, stars, maxStars }: { title: string; stars: number; maxStars: number }) {
  return (
    <span className="whitespace-nowrap text-[13px] font-black text-muted">
      {title}{" "}
      {maxStars > 0 && (
        <span aria-hidden="true">
          <span className="text-gold">{"★".repeat(stars)}</span>
          <span className="opacity-40">{"★".repeat(Math.max(0, maxStars - stars))}</span>
        </span>
      )}
    </span>
  );
}

/** A bottom sheet in the game's style. */
export function ClubSheet({
  open,
  onOpenChange,
  title,
  children,
  full,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className={`mx-auto max-w-[480px] gap-3 overflow-y-auto rounded-t-3xl border-2 border-b-0 border-line bg-surface px-5 pt-5 ${full ? "h-[100dvh] rounded-none" : "max-h-[92dvh]"}`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <SheetTitle className="text-[22px] leading-tight font-black">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export const linkBtn = "w-full py-2 text-[15px] font-extrabold tracking-wide text-muted uppercase";

/* ------------------------------------------------------------------ */
/* Pictures (step 3).                                                  */
/* ------------------------------------------------------------------ */
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Send one picture to the server (multipart); its imageId then goes with the post or message within the hour. */
export async function uploadPicture(file: File, chatId?: number): Promise<{ imageId: string; width: number; height: number }> {
  if (file.size > LIMITS.pictures.maxBytes) throw new ApiError(409, CLUB_COPY.pictureTooBig);
  // An empty type is let through: the server checks the bytes either way.
  if (file.type && !TYPES.includes(file.type)) throw new ApiError(409, CLUB_COPY.pictureType);
  const t = await token();
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`/api/club/image${chatId ? `?chat=${chatId}` : ""}`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data?.error ?? "upload", data);
  return data;
}

/** One picture being added: a preview at once, the upload behind it, and Remove. */
export function usePicture(chatId?: number) {
  const { nudge } = useClub();
  const [pic, setPic] = useState<{ preview: string; imageId?: string } | null>(null);
  const [error, setError] = useState<string>();
  const clear = () => {
    if (pic) URL.revokeObjectURL(pic.preview);
    setPic(null);
    setError(undefined);
  };
  const pick = async (file: File) => {
    setError(undefined);
    const preview = URL.createObjectURL(file);
    setPic({ preview });
    try {
      const r = await uploadPicture(file, chatId);
      setPic({ preview, imageId: r.imageId });
    } catch (e) {
      URL.revokeObjectURL(preview);
      setPic(null);
      const can = gateOf(e);
      if (can) nudge(can);
      else setError(errorText(e));
    }
  };
  return { pic, error, pick, clear, busy: !!pic && !pic.imageId, imageId: pic?.imageId };
}

/** The picture button: opens the phone's photos (iPhones turn HEIC into JPEG for these types). */
export function PictureButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  return (
    <label
      aria-label={CLUB_COPY.addPicture}
      title={CLUB_COPY.addPicture}
      className={`grid size-[46px] shrink-0 cursor-pointer place-items-center rounded-2xl border-2 border-line text-muted ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
        <path d="M5 4h3l1.5-2h5L16 4h3a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3m7 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6" />
      </svg>
      <input
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />
    </label>
  );
}

/** The picture chosen for a post or message, before it is sent. */
export function PicturePreview({ p }: { p: ReturnType<typeof usePicture> }) {
  if (!p.pic && !p.error) return null;
  return (
    <div className="flex items-center gap-3">
      {p.pic && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.pic.preview} alt="" className={`size-16 rounded-xl object-cover ${p.busy ? "opacity-50" : ""}`} />
      )}
      {p.pic && (
        <span className="flex flex-col items-start text-[14px] font-bold text-muted">
          {p.busy && <span>{CLUB_COPY.addingPicture}</span>}
          <button type="button" className="font-black text-red uppercase" onClick={p.clear}>
            {CLUB_COPY.removePicture}
          </button>
        </span>
      )}
      {p.error && <p className="text-[14px] font-bold text-red">{p.error}</p>}
    </div>
  );
}

/** A picture in a post or message, sized before it loads so the list doesn't jump. */
export function Picture({ image, className = "" }: { image: ImageView; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      width={image.width}
      height={image.height}
      alt={CLUB_COPY.picture}
      loading="lazy"
      className={`h-auto max-h-[420px] w-full rounded-2xl bg-surface-2 object-contain ${className}`}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    />
  );
}
