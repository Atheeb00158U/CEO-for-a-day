import type { Metadata } from "next";
import { Grievance } from "@/components/legal/ClubLegal";
import { CLUB_COPY } from "@/lib/community";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy · CEO For A Day" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="5 November 2026">
      <p>CEO For A Day is a game about real business decisions. This page says what we keep about you and why.</p>

      <h2>If you play without signing in</h2>
      <p>
        Your progress stays on your phone. We don&apos;t keep it on our servers. Each choice you make is sent to our server to work out what
        happens next, but we don&apos;t store it.
      </p>

      <h2>If you sign in with Google</h2>
      <p>Google tells us your name, your email address and your Google account id. We keep:</p>
      <ul>
        <li>your email and account id, to know it&apos;s you;</li>
        <li>your game progress: XP, coins, streak, the choices you made in each Hot Seat and Daily Call, your notes and your league;</li>
        <li>the name you choose in the game, which other players in your league can see;</li>
        <li>if you turn on reminders, the address your phone gives us for sending them, and the hour you picked.</li>
      </ul>
      <p>We use this only to run the game: to save your progress, run the weekly leagues and send the reminders you asked for.</p>

      <h2>How the game is used</h2>
      <p>
        We count what players do in the game, like starting a lesson, leaving a Hot Seat or opening the payment page. This shows us where
        the game is too hard or boring, so we can fix it. We use PostHog for this, with servers in the EU. Each count has a random id, or
        your account id if you signed in. It never has your name, your email or anything you type. We don&apos;t record your screen. If your
        browser asks sites not to track you (&quot;Do Not Track&quot;), your phone sends us no counts. Payments are counted either way (the
        plan, never your details), so we know how many people joined.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or share it with advertisers.</li>
        <li>We don&apos;t show ads.</li>
        <li>We don&apos;t read your Google contacts, files or anything else in your Google account.</li>
      </ul>

      <h2>Where it is kept</h2>
      <p>Your data is stored with Supabase in Mumbai, India. The game runs on Railway&apos;s servers in Singapore.</p>

      <h2>Deleting your data</h2>
      <p>
        In the game, open Profile, then Account, then &quot;Delete my account&quot;. This deletes your account and everything saved with it,
        straight away. To stop reminders, turn them off in Profile or in your phone&apos;s settings.
      </p>

      <h2>Children</h2>
      <p>The game is for people aged 13 and over. If you are under 18, ask a parent or guardian before you sign in.</p>

      <h2>Changes</h2>
      <p>If we change what we keep or why, we will update this page and the date at the top.</p>
      <h2>{CLUB_COPY.privacyTitle}</h2>
      <p>{CLUB_COPY.notice}</p>
      <Grievance />
    </LegalPage>
  );
}
