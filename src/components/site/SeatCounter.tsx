"use client";

import { useEffect, useState } from "react";
import { FOUNDING, seatsLine } from "@/lib/offer";

/** The real founding-seat count. Starts from the server's number and checks again every 20 s while the tab is open. */
export function SeatCounter({ initial }: { initial: number }) {
  const [taken, setTaken] = useState(initial);

  useEffect(() => {
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/seats");
        if (r.ok) {
          const j = await r.json();
          if (typeof j.taken === "number") setTaken(j.taken);
        }
      } catch {
        /* offline: keep the last number */
      }
    };
    const t = setInterval(check, 20_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const pct = Math.min(100, (taken / FOUNDING.seats) * 100);
  return (
    <div>
      <p className="text-[18px] font-black" role="status">
        {seatsLine(taken)}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
