// The frame for /privacy and /terms: plain text, simple English, readable on a phone.
import Link from "next/link";
import { Logo } from "@/components/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[680px] px-4 pt-6 pb-16 sm:px-6">
      <Link href="/" className="flex items-center gap-3">
        <Logo size={40} />
        <span className="text-[15px] leading-none font-black">
          CEO
          <br />
          <span className="text-muted">for a day</span>
        </span>
      </Link>
      <h1 className="mt-8 text-[32px] leading-tight font-black">{title}</h1>
      <p className="mt-1 text-[14px] font-bold text-muted">Last updated {updated}</p>
      <div className="legal mt-6 flex flex-col gap-4 text-[16px] leading-relaxed font-bold [&_h2]:mt-4 [&_h2]:text-[20px] [&_h2]:font-black [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </div>
  );
}
