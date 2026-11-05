"use client";

// Product analytics (PostHog): retention, where players quit, and the paywall funnel. Off without
// NEXT_PUBLIC_POSTHOG_KEY, or when the browser asks not to be tracked: posthog-js then never loads.
// Events carry ids, counts and choices from our own lists only: never an email, a name, typed text, or an
// answer's grade, "why" or takeaway. Signed-in players are known by their Supabase user id. No autocapture, no
// session recording. The landing page (/) never calls this.
import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

type Props = Record<string, string | number | boolean | null | undefined>;

let client: Promise<PostHog | null> | undefined;
const posthog = () =>
  (client ??=
    !KEY || typeof window === "undefined" || navigator.doNotTrack === "1"
      ? Promise.resolve(null)
      : import("posthog-js")
          .then(({ default: ph }) => {
            ph.init(KEY, {
              api_host: HOST,
              persistence: "localStorage",
              person_profiles: "identified_only",
              capture_pageview: true, // the first load of /app only
              capture_pageleave: false,
              autocapture: false,
              rageclick: false,
              capture_dead_clicks: false,
              capture_heatmaps: false,
              capture_exceptions: false,
              capture_performance: false,
              disable_session_recording: true,
              disable_surveys: true,
              disable_product_tours: true,
              disable_conversations: true,
              disable_web_experiments: true,
              disable_external_dependency_loading: true,
              advanced_disable_flags: true,
              respect_dnt: true,
              // Hashes hold Club post ids; the sign-in return carries a one-time code in the query.
              disable_capture_url_hashes: true,
              mask_personal_data_properties: true,
              custom_personal_data_properties: ["code", "state", "error_description"],
            });
            return ph;
          })
          .catch(() => null));

/** Record that something happened. Never throws, never waits. */
export const track = (event: string, props?: Props) => void posthog().then((ph) => ph?.capture(event, props));

/** From now on, events on this phone belong to this signed-in player (their Supabase user id, nothing else). */
export const identify = (userId: string) => void posthog().then((ph) => ph?.identify(userId));

/** Signed out: a new anonymous id, so the next player on this phone isn't counted as the last one. */
export const forget = () => void posthog().then((ph) => ph?.reset());
