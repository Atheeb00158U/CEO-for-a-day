// Every playthrough of one Hot Seat as a tree. Prerendered for each folder in content/hotseats, drafts included.
import type { Metadata } from "next";
import Link from "next/link";
import { TreeView } from "@/components/admin/TreeView";
import { hotSeatIds, readHotSeat } from "@/lib/content-files";

export const dynamicParams = false;
export const generateStaticParams = () => hotSeatIds().map((id) => ({ id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${readHotSeat(id).company} tree · Admin` };
}

export default async function HotSeatTree({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-[13px] font-black tracking-wide text-muted uppercase hover:text-ink">
        ← All Hot Seats
      </Link>
      <div className="mt-4">
        <TreeView hs={readHotSeat(id)} />
      </div>
    </main>
  );
}
