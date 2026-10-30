import type { Metadata } from "next";
import { App } from "@/components/App";
import { catalog, trial } from "@/lib/server/content";

export const metadata: Metadata = { title: "Play · CEO For A Day" };

// A server component: only the map's card fields reach the phone. Each step of play comes from /api/play.
export default function Page() {
  return <App content={{ catalog: catalog(), trial: trial() }} />;
}
