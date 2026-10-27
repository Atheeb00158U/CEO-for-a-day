"use client";

import { useEffect } from "react";

const TABS = ["home", "league", "notes", "shop", "profile"];

/** The game used to live at "/", so old links like "/#league" now go to "/app#league". */
export function LegacyHashRedirect() {
  useEffect(() => {
    const tab = location.hash.slice(1);
    if (TABS.includes(tab)) location.replace(`/app#${tab}`);
  }, []);
  return null;
}
