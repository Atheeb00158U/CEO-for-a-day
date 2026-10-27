import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Admin · CEO For A Day", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b-2 border-line">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-blue text-[#04121b]">
              <Icon.chair className="size-5" />
            </span>
            <span className="text-[15px] font-black">CEO For A Day</span>
          </Link>
          <span className="rounded-lg bg-purple/15 px-2 py-1 text-[11px] font-black tracking-wider text-purple uppercase">Admin</span>
          <Link href="/app" className="ml-auto text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
            Open the game →
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
