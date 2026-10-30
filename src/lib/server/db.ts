// Storage for the server. The game logic (src/lib/server/game.ts) talks to this interface only, so tests run it
// against `memoryDb()` and production against Supabase. Tables: supabase/migrations/.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyNote, GameState } from "../game-state";
import type { Grade } from "../hotseat-types";

/** The saved part of a player's state. Runs, the Daily log and the league live in their own tables. */
export type SavedState = Omit<GameState, "runs" | "dailyLog" | "league">;

export interface Profile {
  state: SavedState;
  version: number;
  imported: boolean;
}

export interface RunRow {
  userId: string;
  runKey: string;
  hotSeatId: string;
  picks: { nodeId: string; optionId: string }[];
  score: number;
  xp: number;
  endingId: string;
  endingTier: string;
  notes: unknown;
  patterns: string[];
  createdAt?: string;
}

export interface DailyRow {
  userId: string;
  day: string;
  callId: string;
  optionId: string;
  grade: Grade;
  xp: number;
  note: DailyNote;
}

export interface LeagueRow {
  weekId: string;
  userId: string;
  tier: number;
  cohort: number;
  weeklyXp: number;
}

export interface PushRow {
  endpoint: string;
  userId: string;
  keys: { p256dh: string; auth: string };
  remindHour: number;
}

export interface Db {
  getProfile(userId: string): Promise<Profile | null>;
  /** Creates the profile unless one exists. */
  createProfile(userId: string, state: SavedState): Promise<void>;
  /** Writes only if the stored version still equals `version`; returns whether it did. */
  saveProfile(userId: string, version: number, state: SavedState, opts?: { imported?: boolean }): Promise<boolean>;
  /** Returns false if this user already has a run with the same runKey. */
  insertRun(row: RunRow): Promise<boolean>;
  listRuns(userId: string, limit: number): Promise<RunRow[]>;
  countRuns(userId: string, hotSeatId?: string): Promise<number>;
  /** Returns false if the user already played a Daily Call that day. */
  insertDaily(row: DailyRow): Promise<boolean>;
  getDaily(userId: string, day: string): Promise<DailyRow | null>;
  listDaily(userId: string, limit: number): Promise<DailyRow[]>;
  /** Adds XP to the week's league, placing the player in a cohort of their tier first if needed. */
  addLeagueXp(weekId: string, userId: string, tier: number, xp: number): Promise<void>;
  getLeague(weekId: string, userId: string): Promise<LeagueRow | null>;
  /** The player's most recent league row before `weekId`. */
  lastLeague(userId: string, beforeWeekId: string): Promise<LeagueRow | null>;
  cohort(weekId: string, cohort: number): Promise<LeagueRow[]>;
  /** Each player's in-game name, by id. */
  names(userIds: string[]): Promise<Record<string, string>>;
  savePush(row: PushRow): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
  pushesAt(hour: number): Promise<PushRow[]>;
  /** Every subscription, or one player's. */
  pushes(userId?: string): Promise<PushRow[]>;
  /** Record a notification as sent. False if this kind already went to this player that day. */
  logNotice(userId: string, kind: string, day: string): Promise<boolean>;
  /** How many notifications a player got that day. */
  noticesOn(userId: string, day: string): Promise<number>;
  deleteUser(userId: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* In memory, for tests.                                               */
/* ------------------------------------------------------------------ */
export function memoryDb(): Db & { profiles: Map<string, Profile>; runs: RunRow[]; leagues: LeagueRow[] } {
  const profiles = new Map<string, Profile>();
  const runs: RunRow[] = [];
  const daily: DailyRow[] = [];
  const leagues: LeagueRow[] = [];
  const pushes = new Map<string, PushRow>();
  const notices = new Set<string>();
  const clone = <T>(x: T): T => structuredClone(x);
  return {
    profiles,
    runs,
    leagues,
    async getProfile(id) {
      const p = profiles.get(id);
      return p ? clone(p) : null;
    },
    async createProfile(id, state) {
      if (!profiles.has(id)) profiles.set(id, { state: clone(state), version: 0, imported: false });
    },
    async saveProfile(id, version, state, opts) {
      const p = profiles.get(id);
      if (!p || p.version !== version) return false;
      profiles.set(id, { state: clone(state), version: version + 1, imported: opts?.imported ?? p.imported });
      return true;
    },
    async insertRun(row) {
      if (runs.some((r) => r.userId === row.userId && r.runKey === row.runKey)) return false;
      runs.unshift({ ...clone(row), createdAt: new Date().toISOString() });
      return true;
    },
    async listRuns(id, limit) {
      return clone(runs.filter((r) => r.userId === id).slice(0, limit));
    },
    async countRuns(id, hotSeatId) {
      return runs.filter((r) => r.userId === id && (!hotSeatId || r.hotSeatId === hotSeatId)).length;
    },
    async insertDaily(row) {
      if (daily.some((d) => d.userId === row.userId && d.day === row.day)) return false;
      daily.unshift(clone(row));
      return true;
    },
    async getDaily(id, day) {
      return clone(daily.find((d) => d.userId === id && d.day === day) ?? null);
    },
    async listDaily(id, limit) {
      return clone(daily.filter((d) => d.userId === id).slice(0, limit));
    },
    async addLeagueXp(weekId, userId, tier, xp) {
      let row = leagues.find((l) => l.weekId === weekId && l.userId === userId);
      if (!row) {
        const sizes = new Map<number, number>();
        for (const l of leagues) if (l.weekId === weekId && l.tier === tier) sizes.set(l.cohort, (sizes.get(l.cohort) ?? 0) + 1);
        const open = [...sizes].filter(([, n]) => n < 30).map(([c]) => c);
        const cohort = open.length
          ? Math.max(...open)
          : Math.max(0, ...leagues.filter((l) => l.weekId === weekId).map((l) => l.cohort)) + 1;
        row = { weekId, userId, tier, cohort, weeklyXp: 0 };
        leagues.push(row);
      }
      row.weeklyXp += Math.max(0, xp);
    },
    async getLeague(weekId, userId) {
      return clone(leagues.find((l) => l.weekId === weekId && l.userId === userId) ?? null);
    },
    async lastLeague(userId, before) {
      const mine = leagues.filter((l) => l.userId === userId && l.weekId < before).sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
      return clone(mine[0] ?? null);
    },
    async cohort(weekId, cohort) {
      return clone(leagues.filter((l) => l.weekId === weekId && l.cohort === cohort));
    },
    async names(ids) {
      return Object.fromEntries(ids.filter((id) => profiles.has(id)).map((id) => [id, profiles.get(id)!.state.name]));
    },
    async savePush(row) {
      pushes.set(row.endpoint, clone(row));
    },
    async deletePush(endpoint) {
      pushes.delete(endpoint);
    },
    async pushesAt(hour) {
      return clone([...pushes.values()].filter((p) => p.remindHour === hour));
    },
    async pushes(userId) {
      return clone([...pushes.values()].filter((p) => !userId || p.userId === userId));
    },
    async logNotice(id, kind, day) {
      const k = `${id}|${day}|${kind}`;
      if (notices.has(k)) return false;
      notices.add(k);
      return true;
    },
    async noticesOn(id, day) {
      return [...notices].filter((k) => k.startsWith(`${id}|${day}|`)).length;
    },
    async deleteUser(id) {
      profiles.delete(id);
      for (const list of [runs, daily, leagues] as { userId: string }[][])
        for (let i = list.length - 1; i >= 0; i--) if (list[i].userId === id) list.splice(i, 1);
      for (const [k, p] of pushes) if (p.userId === id) pushes.delete(k);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Supabase, for the running app.                                      */
/* ------------------------------------------------------------------ */
let admin: SupabaseClient | undefined;
/** The server's Supabase client (secret key). Created on first use, so `next build` needs no keys. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};
/** Like `must`, for queries that return a list (never null once there's no error). */
const list = <T>(r: { data: T[] | null; error: { message: string } | null }): T[] => must(r) ?? [];
/** True for a unique-key clash, which several writes use to mean "already done". */
const duplicate = (e: { code?: string } | null) => e?.code === "23505";

const runOf = (r: Record<string, unknown>): RunRow => ({
  userId: r.user_id as string,
  runKey: r.run_key as string,
  hotSeatId: r.hot_seat_id as string,
  picks: r.picks as RunRow["picks"],
  score: r.score as number,
  xp: r.xp as number,
  endingId: r.ending_id as string,
  endingTier: r.ending_tier as string,
  notes: r.notes,
  patterns: r.patterns as string[],
  createdAt: r.created_at as string,
});
const dailyOf = (r: Record<string, unknown>): DailyRow => ({
  userId: r.user_id as string,
  day: r.day as string,
  callId: r.call_id as string,
  optionId: r.option_id as string,
  grade: r.grade as Grade,
  xp: r.xp as number,
  note: r.note as DailyNote,
});
const leagueOf = (r: Record<string, unknown>): LeagueRow => ({
  weekId: r.week_id as string,
  userId: r.user_id as string,
  tier: r.tier as number,
  cohort: r.cohort as number,
  weeklyXp: r.weekly_xp as number,
});
const pushOf = (r: Record<string, unknown>): PushRow => ({
  endpoint: r.endpoint as string,
  userId: r.user_id as string,
  keys: r.keys as PushRow["keys"],
  remindHour: r.remind_hour as number,
});

export function supabaseDb(sb = supabaseAdmin()): Db {
  return {
    async getProfile(id) {
      const p = must<Profile | null>(await sb.from("profiles").select("state, version, imported").eq("id", id).maybeSingle());
      return p && { state: p.state, version: p.version, imported: p.imported };
    },
    async createProfile(id, state) {
      must(await sb.from("profiles").upsert({ id, state }, { onConflict: "id", ignoreDuplicates: true }));
    },
    async saveProfile(id, version, state, opts) {
      const rows = list(
        await sb
          .from("profiles")
          .update({ state, version: version + 1, updated_at: new Date().toISOString(), ...(opts?.imported ? { imported: true } : {}) })
          .eq("id", id)
          .eq("version", version)
          .select("id"),
      );
      return rows.length === 1;
    },
    async insertRun(row) {
      const { error } = await sb.from("runs").insert({
        user_id: row.userId,
        run_key: row.runKey,
        hot_seat_id: row.hotSeatId,
        picks: row.picks,
        score: row.score,
        xp: row.xp,
        ending_id: row.endingId,
        ending_tier: row.endingTier,
        notes: row.notes,
        patterns: row.patterns,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async listRuns(id, limit) {
      return list(await sb.from("runs").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(limit)).map(runOf);
    },
    async countRuns(id, hotSeatId) {
      let q = sb.from("runs").select("id", { count: "exact", head: true }).eq("user_id", id);
      if (hotSeatId) q = q.eq("hot_seat_id", hotSeatId);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async insertDaily(row) {
      const { error } = await sb.from("daily_plays").insert({
        user_id: row.userId,
        day: row.day,
        call_id: row.callId,
        option_id: row.optionId,
        grade: row.grade,
        xp: row.xp,
        note: row.note,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async getDaily(id, day) {
      const r = must(await sb.from("daily_plays").select("*").eq("user_id", id).eq("day", day).maybeSingle());
      return r && dailyOf(r);
    },
    async listDaily(id, limit) {
      return list(await sb.from("daily_plays").select("*").eq("user_id", id).order("day", { ascending: false }).limit(limit)).map(dailyOf);
    },
    async addLeagueXp(weekId, userId, tier, xp) {
      must(await sb.rpc("add_league_xp", { p_week: weekId, p_user: userId, p_tier: tier, p_xp: xp }));
    },
    async getLeague(weekId, userId) {
      const r = must(await sb.from("league_members").select("*").eq("week_id", weekId).eq("user_id", userId).maybeSingle());
      return r && leagueOf(r);
    },
    async lastLeague(userId, before) {
      const r = must(
        await sb
          .from("league_members")
          .select("*")
          .eq("user_id", userId)
          .lt("week_id", before)
          .order("week_id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      return r && leagueOf(r);
    },
    async cohort(weekId, cohort) {
      return list(await sb.from("league_members").select("*").eq("week_id", weekId).eq("cohort", cohort)).map(leagueOf);
    },
    async names(ids) {
      if (!ids.length) return {};
      const rows = list<{ id: string; name: string }>(await sb.from("profiles").select("id, name:state->>name").in("id", ids));
      return Object.fromEntries(rows.map((r) => [r.id, r.name]));
    },
    async savePush(row) {
      must(
        await sb
          .from("push_subscriptions")
          .upsert({ endpoint: row.endpoint, user_id: row.userId, keys: row.keys, remind_hour: row.remindHour }, { onConflict: "endpoint" }),
      );
    },
    async deletePush(endpoint) {
      must(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint));
    },
    async pushesAt(hour) {
      return list(await sb.from("push_subscriptions").select("*").eq("remind_hour", hour)).map(pushOf);
    },
    async pushes(userId) {
      let q = sb.from("push_subscriptions").select("*");
      if (userId) q = q.eq("user_id", userId);
      return list(await q).map(pushOf);
    },
    async logNotice(id, kind, day) {
      const { error } = await sb.from("notifications_sent").insert({ user_id: id, kind, day });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async noticesOn(id, day) {
      const { count, error } = await sb
        .from("notifications_sent")
        .select("kind", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("day", day);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async deleteUser(id) {
      // Every table cascades from auth.users, so deleting the user removes all their rows.
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) throw new Error(error.message);
    },
  };
}
