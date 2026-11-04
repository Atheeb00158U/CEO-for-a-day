// Who may open what (spec §4a): the first module of Unit 1 (its lessons, test-out and Hot Seat gate) is free; members open everything; early players keep what they finished.
// Pure, shared by the server (enforcement) and the phone (lock badges). Node runs it too: no @/ imports.
import type { Course } from "./course-types.ts";

export type ItemKind = "lesson" | "testout" | "hotseat";
export interface Item {
  kind: ItemKind;
  id: string;
}
export interface AccessContext {
  /** False while the paywall is switched off for this player (see paywallFor in server/membership.ts). */
  paywall: boolean;
  member: boolean;
  /** `lesson:<id>` and `hotseat:<id>` finished before the paywall. */
  early: Set<string>;
}
export interface MembershipLike {
  status: string;
  currentEnd: string | null;
}

export const keyOf = (item: Item) => `${item.kind}:${item.id}`;

/** The free module: the first module of the first unit in course.json. */
export const freeModule = <M>(course: { units: { modules: M[] }[] }): M | undefined => course.units[0]?.modules[0];

export function freeItems(course: Course): Set<string> {
  const m = freeModule(course);
  const out = new Set<string>();
  if (!m) return out;
  out.add(`testout:${m.id}`);
  for (const l of m.lessons) out.add(`lesson:${l}`);
  for (const g of m.gates ?? []) out.add(`hotseat:${g}`);
  return out;
}

const PAID_UNTIL_END = new Set(["authenticated", "pending", "halted", "cancelled", "completed"]);
/** An active subscription stays open this long past its period end, in case the renewal webhook is late. */
export const GRACE_MS = 3 * 864e5;

/** A member is active now, or cancelled or behind on a payment while the paid period runs. */
export function isMember(m: MembershipLike | null, now: Date): boolean {
  if (!m) return false;
  if (m.status === "active") {
    // Never forever: the webhook always stores an end (Razorpay's, or a fallback), so no end means no access.
    return !!m.currentEnd && new Date(m.currentEnd).getTime() + GRACE_MS > now.getTime();
  }
  return PAID_UNTIL_END.has(m.status) && !!m.currentEnd && new Date(m.currentEnd) > now;
}

export function canOpen(item: Item, ctx: AccessContext, free: Set<string>): boolean {
  if (!ctx.paywall || ctx.member) return true;
  const key = keyOf(item);
  return free.has(key) || ctx.early.has(key);
}
