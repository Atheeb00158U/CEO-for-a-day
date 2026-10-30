"use client";

import { useGame } from "@/lib/store";
import { Card } from "./ui";

/** Asks a guest to save their progress with Google. Shows nothing when signed in or when sign-in isn't set up. */
export function SignInCard({ title = "Save your progress", text }: { title?: string; text?: string }) {
  const { account, canSignIn, signIn } = useGame();
  if (account || !canSignIn) return null;
  return (
    <Card className="flex flex-col gap-3 border-brand/40 bg-brand/5">
      <div>
        <h2 className="text-[19px] font-black">{title}</h2>
        <p className="text-[15px] font-bold text-muted">
          {text ?? "Sign in to keep your streak and notes on any phone, and to join a weekly league."}
        </p>
      </div>
      <button type="button" className="btn3d green" onClick={signIn}>
        Sign in with Google
      </button>
      <p className="text-[12px] font-bold text-muted">
        We only use your name and email to save your progress.{" "}
        <a className="underline" href="/privacy">
          Privacy
        </a>
      </p>
    </Card>
  );
}
