// The referee for signed-in players. Every change to a player's progress happens here, on the server, with the same
// pure rules the phone uses for guests (src/lib/game-state.ts). Nothing the phone sends is trusted beyond ids:
// scores come from replaying the picks (src/lib/play.ts), prices and rewards from ECONOMY, time from the server.
import {
  applyBooster,
  applyBuy,
  applyClaim,
  applyDaily,
  applyFinish,
  ECONOMY,
  fresh,
  LEAGUES,
  rollover,
  today,
  weekId,
  type DailyNote,
  type Finish,
  type GameState,
  type RunRecord,
} from "../game-state.ts";
import type { DailyCall, DailyOption, HotSeat } from "../hotseat-types";
import { leagueRows } from "../league.ts";
import { play, PlayError, type Pick } from "../play.ts";
import type { Db, LeagueRow, Profile, SavedState } from "./db.ts";

/** A request the rules refuse: not enough coins, nothing to claim, a run that can't be finished. */
export class GameError extends Error {}

const strip = (s: GameState): SavedState => {
  const rest: Partial<GameState> = { ...s };
  delete rest.runs;
  delete rest.dailyLog;
  delete rest.league;
  return rest as SavedState;
};

/** The player's state as the phone sees it, with `version` so it can ignore an older reply. */
export interface Synced {
  state: GameState;
  version: number;
}

/* ------------------------------------------------------------------ */
/* Leagues: settled when read, never by a weekly job.                  */
/* ------------------------------------------------------------------ */
export const LEAGUE_FULL = 15;
export const MOVE = 5;

/** The tier a player moves to after a finished week in `rows` (their cohort, real players only). */
export function nextTier(rows: LeagueRow[], userId: string): number {
  const me = rows.find((r) => r.userId === userId);
  if (!me) return 0;
  const ranked = [...rows].sort((a, b) => b.weeklyXp - a.weeklyXp || (a.userId < b.userId ? -1 : 1));
  const rank = ranked.indexOf(me);
  const n = ranked.length;
  let up: boolean;
  let down: boolean;
  if (n >= LEAGUE_FULL) {
    up = rank < MOVE && me.weeklyXp > 0;
    down = rank >= n - MOVE;
  } else {
    // Small cohorts: no fixed top 5 and bottom 5 (they would overlap), and a lone player must still earn it.
    up = rank < Math.max(1, Math.floor(n * 0.2)) && me.weeklyXp >= 100 * (me.tier + 1);
    down = me.weeklyXp === 0;
  }
  return Math.max(0, Math.min(LEAGUES.length - 1, me.tier + (up ? 1 : down ? -1 : 0)));
}

const prevWeek = (week: string) => {
  const d = new Date(week + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};

/** This week's tier, worked out from the player's last finished week. Safe to run any number of times. */
export async function leagueTier(db: Db, userId: string, now = new Date()): Promise<{ tier: number; row: LeagueRow | null }> {
  const week = weekId(now);
  const row = await db.getLeague(week, userId);
  if (row) return { tier: row.tier, row };
  const last = await db.lastLeague(userId, week);
  if (!last) return { tier: 0, row: null };
  let tier = nextTier(await db.cohort(last.weekId, last.cohort), userId);
  if (last.weekId !== prevWeek(week)) tier = Math.max(0, Math.min(tier, last.tier) - 1); // missed a whole week: 0 XP
  return { tier, row: null };
}

/* ------------------------------------------------------------------ */
/* Loading and saving.                                                 */
/* ------------------------------------------------------------------ */
async function profileOf(db: Db, userId: string): Promise<Profile> {
  let p = await db.getProfile(userId);
  if (!p) {
    await db.createProfile(userId, strip(fresh()));
    p = await db.getProfile(userId);
    if (!p) throw new Error("profile was not created");
  }
  return p;
}

const noteOf = (r: {
  hotSeatId: string;
  score: number;
  xp: number;
  endingId: string;
  endingTier: string;
  notes: unknown;
  patterns: string[];
  createdAt?: string;
}): RunRecord => ({
  hotSeatId: r.hotSeatId,
  score: r.score,
  xp: r.xp,
  endingId: r.endingId,
  endingTier: r.endingTier,
  notes: r.notes as RunRecord["notes"],
  patterns: r.patterns,
  at: r.createdAt ? Date.parse(r.createdAt) : 0,
});

/** The full GameState the phone shows: saved state, recent runs, the Daily log and this week's league. */
export async function load(db: Db, userId: string, now = new Date()): Promise<Synced> {
  const p = await profileOf(db, userId);
  const [runs, daily, league] = await Promise.all([db.listRuns(userId, 50), db.listDaily(userId, 60), leagueTier(db, userId, now)]);
  const state = rollover(
    {
      ...fresh(),
      ...p.state,
      runs: runs.map(noteOf),
      dailyLog: daily.map((d) => d.note),
      league: { tier: league.tier, weekId: weekId(now), weeklyXp: league.row?.weeklyXp ?? 0 },
    },
    now,
    { settleLeague: false },
  );
  return { state, version: p.version };
}

/**
 * Change a player's saved state with a pure function. The write lands only if nobody else wrote since we read
 * (the version check); otherwise it re-reads and tries again. `change` returns null to refuse.
 */
export async function update(
  db: Db,
  userId: string,
  change: (s: GameState) => GameState | null,
  now = new Date(),
  opts?: { imported?: boolean },
): Promise<Synced> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await load(db, userId, now);
    const next = change(cur.state);
    if (!next) throw new GameError("not allowed");
    if (await db.saveProfile(userId, cur.version, strip(next), opts)) return { state: next, version: cur.version + 1 };
  }
  throw new Error("too many writes at once; try again");
}

/* ------------------------------------------------------------------ */
/* Actions.                                                            */
/* ------------------------------------------------------------------ */

/**
 * Finish a Hot Seat. The server replays `picks`, so the score, ending and XP can't be forged. `runKey` (random,
 * from the phone) makes a retry or double tap pay once. Hindsight used in the run is charged here.
 */
export async function finishRun(
  db: Db,
  userId: string,
  hs: HotSeat,
  req: { runKey: string; picks: Pick[]; hindsightUsed: boolean },
  now = new Date(),
): Promise<Synced & { record: RunRecord }> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(req.runKey)) throw new GameError("bad run key");
  const view = play(hs, req.picks);
  const r = view.result;
  if (!r) throw new PlayError("this run hasn't reached an ending");
  const before = await load(db, userId, now);
  if (req.hindsightUsed && before.state.hindsights < 1) throw new GameError("no Hindsight left");
  const finish: Finish = {
    run: { hotSeatId: hs.id, score: r.score, endingId: r.endingId, endingTier: r.endingTier, notes: r.lines, patterns: r.patterns },
    traits: r.traits,
    flags: { recovered: r.recovered, beatHistory: r.beatHistory },
    grades: view.picks.map((p) => p.grade),
  };
  const { record } = applyFinish(before.state, finish, now);
  // The run row goes in first: its key is what makes a retry a no-op.
  const fresh = await db.insertRun({
    userId,
    runKey: req.runKey,
    hotSeatId: hs.id,
    picks: req.picks,
    score: record.score,
    xp: record.xp,
    endingId: record.endingId,
    endingTier: record.endingTier,
    notes: record.notes,
    patterns: record.patterns,
  });
  if (!fresh) return { ...(await load(db, userId, now)), record };
  const synced = await update(
    db,
    userId,
    (s) => {
      const paid = applyFinish(s, finish, now).state;
      return req.hindsightUsed ? { ...paid, hindsights: Math.max(0, paid.hindsights - 1) } : paid;
    },
    now,
  );
  await db.addLeagueXp(weekId(now), userId, synced.state.league.tier, record.xp);
  return { ...(await load(db, userId, now)), record };
}

/** Lock in today's Daily Call. The (player, day) key allows one a day; a second lock returns the first answer's state. */
export async function lockDaily(db: Db, userId: string, call: DailyCall, option: DailyOption, now = new Date()): Promise<Synced> {
  const day = today(now);
  const before = await load(db, userId, now);
  const after = applyDaily(before.state, call, option, now);
  if (after === before.state || !after.daily) return before; // already played today
  const note: DailyNote = after.dailyLog[0];
  const fresh = await db.insertDaily({
    userId,
    day,
    callId: call.id,
    optionId: option.id,
    grade: option.grade,
    xp: after.daily.xp,
    note,
  });
  if (!fresh) return load(db, userId, now);
  const synced = await update(db, userId, (s) => applyDaily(s, call, option, now), now);
  await db.addLeagueXp(weekId(now), userId, synced.state.league.tier, after.daily.xp);
  return load(db, userId, now);
}

export const buy = async (db: Db, userId: string, item: string, now = new Date()) => {
  if (!(item in ECONOMY.prices)) throw new GameError("no such item");
  return update(db, userId, (s) => applyBuy(s, item as keyof typeof ECONOMY.prices), now);
};
export const startBooster = (db: Db, userId: string, now = new Date()) => update(db, userId, (s) => applyBooster(s, now.getTime()), now);
export const claimQuest = (db: Db, userId: string, id: string, now = new Date()) => update(db, userId, (s) => applyClaim(s, id), now);

const LANGS = ["en", "hi", "ta", "bn"] as const;
const DOING = ["job", "starting", "running", "student", "curious"];
const FOCUS = ["scratch", "rival", "money", "change"];

/** Name, settings and the welcome answers: the only things the phone may set directly. Each is checked. */
export function updateProfile(db: Db, userId: string, patch: Record<string, unknown>, now = new Date()) {
  return update(
    db,
    userId,
    (s) => {
      const x = { ...s, settings: { ...s.settings }, onboarding: { ...s.onboarding } };
      if (typeof patch.name === "string") x.name = patch.name.trim().slice(0, 20) || "You";
      const st = (patch.settings ?? {}) as Record<string, unknown>;
      for (const k of ["voice", "sfx", "dataSaver"] as const) if (typeof st[k] === "boolean") x.settings[k] = st[k];
      if (LANGS.includes(st.lang as (typeof LANGS)[number])) x.settings.lang = st.lang as (typeof LANGS)[number];
      const ob = (patch.onboarding ?? {}) as Record<string, unknown>;
      if (typeof ob.done === "boolean") x.onboarding.done = ob.done || x.onboarding.done;
      if (DOING.includes(ob.doing as string)) x.onboarding.doing = ob.doing as typeof x.onboarding.doing;
      if (FOCUS.includes(ob.focus as string)) x.onboarding.focus = ob.focus as typeof x.onboarding.focus;
      if ([5, 10, 15].includes(ob.minutes as number)) x.onboarding.minutes = ob.minutes as 5 | 10 | 15;
      return x;
    },
    now,
  );
}

/* ------------------------------------------------------------------ */
/* Bringing a guest's progress into a new account.                     */
/* ------------------------------------------------------------------ */
export const IMPORT_CAPS = { xp: 2000, coins: 1000, streak: 7, items: 5 };

const num = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0);

/**
 * Copy a guest save in, once per account and only into an account with no runs yet. The guest save lives on the
 * phone and could have been edited, so every number is capped, and imported XP never counts toward a league week.
 */
export async function importGuest(db: Db, userId: string, save: unknown, now = new Date()): Promise<Synced> {
  const p = await profileOf(db, userId);
  if (p.imported || (await db.countRuns(userId)) > 0 || !save || typeof save !== "object") return load(db, userId, now);
  const g = save as Partial<GameState>;
  try {
    return await update(
      db,
      userId,
      (s) => {
        const best: Record<string, number> = {};
        for (const [k, v] of Object.entries(g.best ?? {})) if (/^[a-z0-9-]{1,60}$/.test(k)) best[k] = num(v, 100);
        const badges = (Array.isArray(g.badges) ? g.badges : []).filter((b): b is string => typeof b === "string").slice(0, 20);
        const traits = { ...s.traits };
        for (const k of ["horizon", "risk", "disrupt"] as const)
          traits[k] = Math.max(-50, Math.min(50, Math.round(Number(g.traits?.[k]) || 0)));
        const streak = num(g.streak, IMPORT_CAPS.streak);
        return {
          ...s,
          name: typeof g.name === "string" ? g.name.trim().slice(0, 20) || s.name : s.name,
          xp: s.xp + num(g.xp, IMPORT_CAPS.xp),
          coins: Math.max(s.coins, num(g.coins, IMPORT_CAPS.coins)),
          freezes: Math.max(s.freezes, num(g.freezes, IMPORT_CAPS.items)),
          boosters: Math.max(s.boosters, num(g.boosters, IMPORT_CAPS.items)),
          hindsights: Math.max(s.hindsights, num(g.hindsights, IMPORT_CAPS.items)),
          streak,
          bestStreak: Math.max(streak, num(g.bestStreak, IMPORT_CAPS.streak)),
          lastActiveDay:
            streak > 0 && typeof g.lastActiveDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.lastActiveDay) ? g.lastActiveDay : null,
          best: { ...best, ...s.best },
          badges: [...new Set([...s.badges, ...badges])],
          traits,
          settings: { ...s.settings, ...(g.settings && typeof g.settings === "object" ? pickSettings(g.settings) : {}) },
          onboarding: g.onboarding?.done ? { ...s.onboarding, done: true } : s.onboarding,
        };
      },
      now,
      { imported: true },
    );
  } catch (e) {
    if (e instanceof GameError) return load(db, userId, now);
    throw e;
  }
}

function pickSettings(x: Partial<GameState["settings"]>): Partial<GameState["settings"]> {
  const out: Partial<GameState["settings"]> = {};
  for (const k of ["voice", "sfx", "dataSaver"] as const) if (typeof x[k] === "boolean") out[k] = x[k];
  return out;
}

/* ------------------------------------------------------------------ */
/* The League tab.                                                     */
/* ------------------------------------------------------------------ */
/** Below this many real players, the board is filled with practice rivals (shown, never ranked). */
export const FILL_TO = 10;

export interface LeagueBoard {
  tier: number;
  weekId: string;
  /** False until the player earns XP this week (that's when they join a group). */
  joined: boolean;
  rows: { id: string; name: string; xp: number; you?: boolean; bot?: boolean }[];
  /** How players move up this week: the top `count` real players, if they have at least `minXp`. */
  promote: { count: number; minXp: number };
  /** How many real players move down (bottom of a full group), or 0 when only players with no XP do. */
  demote: number;
}

/** This week's board: the player's group, real players ranked by XP, topped up with practice rivals while small. */
export async function leagueBoard(db: Db, userId: string, now = new Date()): Promise<LeagueBoard> {
  const week = weekId(now);
  const { tier, row } = await leagueTier(db, userId, now);
  const real = row ? await db.cohort(week, row.cohort) : [];
  const names = await db.names(real.map((r) => r.userId));
  const rows: LeagueBoard["rows"] = real.map((r) => ({
    id: r.userId === userId ? "you" : r.userId.slice(0, 8),
    name: names[r.userId] && names[r.userId] !== "You" ? names[r.userId] : "Player",
    xp: r.weeklyXp,
    ...(r.userId === userId ? { you: true, name: names[r.userId] ?? "You" } : {}),
  }));
  if (row && real.length < FILL_TO) {
    // Practice rivals sit around the player's own level (the best at about 1.5× their XP), so the board feels
    // winnable from day one. Their spread comes from the seeded rows, so it stays steady through the week.
    const seeded = leagueRows({ seed: `${week}-${row.cohort}`, weekId: week, tier, yourXp: 0, yourName: "", now })
      .filter((b) => !b.you)
      .slice(0, FILL_TO - real.length);
    const top = Math.max(1, ...seeded.map((b) => b.xp));
    const level = Math.max(40, row.weeklyXp) * 1.5;
    const bots = seeded.map((b) => ({ id: b.id, name: b.name, xp: Math.round((b.xp / top) * level), bot: true }));
    rows.push(...bots);
  }
  rows.sort((a, b) => b.xp - a.xp || (a.you ? -1 : b.you ? 1 : 0));
  const full = real.length >= LEAGUE_FULL;
  return {
    tier,
    weekId: week,
    joined: !!row,
    rows,
    promote: full ? { count: MOVE, minXp: 1 } : { count: Math.max(1, Math.floor(real.length * 0.2)), minXp: 100 * (tier + 1) },
    demote: full ? MOVE : 0,
  };
}
