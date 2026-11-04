// The lock badges on the phone's map. Only a hint: the server's 402 is the real gate (spec §4a).
import { canOpen, freeItems, type Item } from "./access";
import type { CourseOutline } from "./course-types";
import type { MembershipView } from "./membership-view";

/** Whether to show `item` as members-only. */
export type Locked = (item: Item) => boolean;

/**
 * The phone's guess at what is locked. The server's early-access list isn't sent, so anything this player has
 * already finished counts as theirs (early players keep what they finished); the server has the last word.
 */
export function phoneLocks(
  outline: CourseOutline | undefined,
  membership: MembershipView | null,
  paywall: boolean,
  finished: { lessons: Record<string, unknown>; best: Record<string, unknown> },
): Locked {
  if (!paywall || membership?.member) return () => false;
  const free = freeItems({
    units: (outline?.units ?? []).map((u) => ({ ...u, modules: u.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => l.id) })) })),
  });
  const early = new Set([
    ...Object.keys(finished.lessons).map((id) => `lesson:${id}`),
    ...Object.keys(finished.best).map((id) => `hotseat:${id}`),
  ]);
  return (item) => !canOpen(item, { paywall, member: false, early }, free);
}
