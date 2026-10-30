import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms · CEO For A Day" };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="30 October 2026">
      <p>By playing CEO For A Day you agree to these terms.</p>

      <h2>A game, not advice</h2>
      <p>
        CEO For A Day is for learning. It is not business, legal, tax or investment advice. Real stories use public sources. Other outcomes
        in the game are our estimates of what might have happened.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Use your own Google account, and keep it safe.</li>
        <li>
          Pick a game name that is not rude or hurtful. Other players in your league can see it. We may change or remove a name that breaks
          this rule.
        </li>
        <li>Don&apos;t cheat, use bots or attack the game. We may reset progress or close accounts that do.</li>
      </ul>

      <h2>Coins and items</h2>
      <p>Coins, streak freezes, boosters and Hindsight have no money value and can&apos;t be exchanged for money.</p>

      <h2>Changes and availability</h2>
      <p>
        We may change the game, its content or these terms. We try to keep it running, but we can&apos;t promise it will always be
        available.
      </p>

      <h2>Your data</h2>
      <p>
        See our{" "}
        <a className="underline" href="/privacy">
          privacy page
        </a>
        .
      </p>
    </LegalPage>
  );
}
