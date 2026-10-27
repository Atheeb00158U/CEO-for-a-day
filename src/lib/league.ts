/**
 * Weekly leagues. Until there is a backend, the other players are simulated bots
 * seeded by week + player, so the board is stable through the week and "grows" over it.
 * Replace `leagueRows` with a server call when real players exist.
 */
const NAMES = [
  "Aarav", "Diya", "Kabir", "Ananya", "Rohan", "Meera", "Vihaan", "Ishita", "Arjun", "Sneha",
  "Karthik", "Priya", "Rahul", "Fatima", "Aditya", "Neha", "Siddharth", "Pooja", "Imran", "Lakshmi",
  "Sourav", "Tanvi", "Harsh", "Riya", "Manoj", "Divya", "Yash", "Sana", "Nikhil", "Bhavna",
];
const AVATARS = ["#1cb0f6", "#58cc02", "#ff9600", "#ce82ff", "#ff4b4b", "#ffc800", "#2bd9c5", "#ff86d0"];

export const LEAGUE_SIZE = 20;
export const PROMOTE = 5;
export const DEMOTE = 5;

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface LeagueRow { id: string; name: string; xp: number; color: string; you?: boolean }

export function leagueRows(opts: { seed: string; weekId: string; tier: number; yourXp: number; yourName: string }): LeagueRow[] {
  const r = rng(opts.seed + opts.weekId + opts.tier);
  const now = new Date();
  const weekStart = new Date(opts.weekId + "T00:00:00");
  const progress = Math.min(1, Math.max(0.05, (now.getTime() - weekStart.getTime()) / (7 * 864e5)));
  const pool = [...NAMES].sort(() => r() - 0.5);
  const scale = 1 + opts.tier * 0.6;
  const bots: LeagueRow[] = pool.slice(0, LEAGUE_SIZE - 1).map((name, i) => {
    const weekly = Math.round((r() ** 1.7) * 900 * scale);
    return { id: "b" + i, name, xp: Math.round(weekly * progress), color: AVATARS[Math.floor(r() * AVATARS.length)] };
  });
  const you: LeagueRow = { id: "you", name: opts.yourName, xp: opts.yourXp, color: "#1cb0f6", you: true };
  return [...bots, you].sort((a, b) => b.xp - a.xp || (a.you ? -1 : 1));
}

export function daysLeft(weekId: string) {
  const end = new Date(weekId + "T00:00:00").getTime() + 7 * 864e5;
  return Math.max(0, Math.ceil((end - Date.now()) / 864e5));
}
